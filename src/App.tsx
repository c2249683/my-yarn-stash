import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Cropper from "react-easy-crop";

// --- 注入日式質感樣式與備份按鈕樣式 ---
const styleTag = `
  :root {
    --bg-color-start: #f8f6f2; 
    --bg-color-end: #e8e2d2;   
    --card-bg: #ffffff;      
    --accent-color: #7c6d60;  
    --text-main: #4a4a4a;    
    --text-muted: #a09a8e;   
    --border-color: #e0ddd5;  
    --btn-secondary: #e0ddd5;
  }

  body {
    background: linear-gradient(135deg, var(--bg-color-start), var(--bg-color-end)) !important;
    margin: 0; min-height: 100vh;
    font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
  }

  .container {
    max-width: 900px; margin: 40px auto; padding: 30px;
    background: rgba(255, 255, 255, 0.4); border-radius: 20px;
    backdrop-filter: blur(10px); box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  }

  .header h1 { text-align: center; color: var(--accent-color); letter-spacing: 5px; font-weight: 300; margin-bottom: 5px; }

  .input-section {
    background: white; padding: 30px; border-radius: 15px;
    box-shadow: 0 8px 20px rgba(140, 123, 108, 0.1); margin-bottom: 40px; border: 1px solid var(--border-color);
  }

  .yarn-card {
    background: white; border-radius: 15px; overflow: hidden;
    box-shadow: 0 10px 20px rgba(140, 123, 108, 0.1); position: relative;
    transition: transform 0.3s ease; border: 1px solid var(--border-color);
  }

  .yarn-card:hover { transform: translateY(-5px); }
  .image-wrapper { height: 200px; background: #f0ede5; overflow: hidden; border-bottom: 1px solid var(--border-color); }
  .image-wrapper img { width: 100%; height: 100%; object-fit: cover; }
  .card-content { padding: 20px; }

  .info-tag {
    background: #f0ede5; color: var(--accent-color); padding: 3px 10px;
    border-radius: 5px; font-size: 12px; margin-right: 5px; display: inline-block; margin-top: 5px;
  }

  .submit-btn {
    background: var(--accent-color); color: white; border: none; padding: 15px;
    border-radius: 10px; width: 100%; cursor: pointer; font-size: 16px; margin-top: 15px;
  }

  .toolbar, .backup-bar {
    display: flex; justify-content: space-between; gap: 15px; margin-bottom: 20px;
    background: white; padding: 15px 25px; border-radius: 12px; border: 1px solid var(--border-color);
  }

  .backup-btn {
    background: var(--btn-secondary); color: var(--text-main); border: none;
    padding: 8px 15px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: 0.3s;
  }
  .backup-btn:hover { background: #d0cbc3; }

  .crop-modal {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.8); z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }

  input, select { padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; outline: none; }
  @media (max-width: 600px) { .container { margin: 10px auto; padding: 15px; } .toolbar, .backup-bar { flex-direction: column; } }
`;

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = styleTag;
  document.head.appendChild(style);
}

export default function App() {
  const [yarns, setYarns] = useState(() => {
    const saved = localStorage.getItem("yarn_stash_vFinal");
    return saved ? JSON.parse(saved) : [];
  });

  const [formData, setFormData] = useState({
    name: "",
    shop: "",
    weight: "",
    count: "",
    thickness: "2.0mm",
    image: null,
  });
  const [filterThickness, setFilterThickness] = useState("全部");
  const [sortOrder, setSortOrder] = useState("newest");
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("yarn_stash_vFinal", JSON.stringify(yarns));
    } catch (e) {
      if (e.name === "QuotaExceededError")
        alert("儲存空間滿了！請匯出備份後刪除舊資料。");
    }
  }, [yarns]);

  // --- 匯出功能 ---
  const exportData = () => {
    const dataStr = JSON.stringify(yarns);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `yarn_backup_${new Date().toLocaleDateString()}.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  // --- 匯入功能 ---
  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          if (
            window.confirm(
              `確定要匯入 ${importedData.length} 筆資料嗎？這將會覆蓋現有庫存！`
            )
          ) {
            setYarns(importedData);
          }
        } else {
          alert("檔案格式錯誤！");
        }
      } catch (err) {
        alert("讀取檔案失敗。");
      }
    };
    reader.readAsText(file);
  };

  const thicknessOptions = [
    "2.0mm",
    "2.5mm",
    "3.0mm",
    "3.5mm",
    "4.0mm",
    "4.5mm",
    "5.0mm",
    "5.5mm",
    "6.0mm",
    "手混線",
  ];

  const processedYarns = useMemo(() => {
    let result = [...yarns];
    if (filterThickness !== "全部")
      result = result.filter((y) => y.thickness === filterThickness);
    sortOrder === "newest"
      ? result.sort((a, b) => b.id - a.id)
      : result.sort((a, b) => a.id - b.id);
    return result;
  }, [yarns, filterThickness, sortOrder]);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImageToCrop(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
    setFormData({ ...formData, image: croppedImage });
    setImageToCrop(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setYarns([{ ...formData, id: Date.now() }, ...yarns]);
    setFormData({
      name: "",
      shop: "",
      weight: "",
      count: "",
      thickness: "2.0mm",
      image: null,
    });
  };

  return (
    <div className="container">
      <header className="header">
        <h1>私の毛糸棚</h1>
        <p
          style={{
            textAlign: "center",
            color: "#a09a8e",
            marginBottom: "30px",
          }}
        >
          溫柔紀錄每一團編織的記憶
        </p>
      </header>

      {/* 備份管理列 */}
      <div className="backup-bar">
        <span style={{ fontSize: "14px", color: "#7c6d60" }}>
          💾 資料備份與轉移
        </span>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="backup-btn" onClick={exportData}>
            匯出檔案 (.json)
          </button>
          <button
            className="backup-btn"
            onClick={() => fileInputRef.current.click()}
          >
            匯入檔案
          </button>
          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept=".json"
            onChange={importData}
          />
        </div>
      </div>

      {imageToCrop && (
        <div className="crop-modal">
          <div
            style={{
              position: "relative",
              width: "300px",
              height: "300px",
              background: "#333",
            }}
          >
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={4 / 3}
              onCropChange={setCrop}
              onCropComplete={(u, p) => setCroppedAreaPixels(p)}
              onZoomChange={setZoom}
            />
          </div>
          <div
            style={{
              background: "white",
              padding: "20px",
              width: "300px",
              borderRadius: "0 0 10px 10px",
            }}
          >
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
              style={{ width: "100%", marginBottom: "10px" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setImageToCrop(null)}>取消</button>
              <button
                onClick={handleCropSave}
                style={{
                  background: "#7c6d60",
                  color: "white",
                  border: "none",
                  padding: "5px 15px",
                  borderRadius: "5px",
                }}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="input-section">
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <input
              type="text"
              placeholder="毛線名稱"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="購買店家"
              value={formData.shop}
              onChange={(e) =>
                setFormData({ ...formData, shop: e.target.value })
              }
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "15px",
            }}
          >
            <select
              value={formData.thickness}
              onChange={(e) =>
                setFormData({ ...formData, thickness: e.target.value })
              }
            >
              {thicknessOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="重量 (g)"
              value={formData.weight}
              onChange={(e) =>
                setFormData({ ...formData, weight: e.target.value })
              }
            />
            <input
              type="number"
              placeholder="顆數"
              value={formData.count}
              onChange={(e) =>
                setFormData({ ...formData, count: e.target.value })
              }
            />
          </div>
          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              border: "2px dashed #e0ddd5",
              textAlign: "center",
              borderRadius: "12px",
              background: "#fcfcfc",
            }}
          >
            <label style={{ cursor: "pointer", color: "#7c6d60" }}>
              {formData.image ? "✅ 照片已就緒" : "📷 上傳毛線照片並調整"}
              <input
                type="file"
                hidden
                onChange={onFileChange}
                accept="image/*"
              />
            </label>
          </div>
          <button type="submit" className="submit-btn">
            記錄庫存
          </button>
        </form>
      </section>

      <div className="toolbar">
        <div>
          篩選：
          <select
            value={filterThickness}
            onChange={(e) => setFilterThickness(e.target.value)}
          >
            <option value="全部">全部顯示</option>
            {thicknessOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          排序：
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">最新優先</option>
            <option value="oldest">最舊優先</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "35px",
        }}
      >
        {processedYarns.map((yarn, idx) => (
          <div key={yarn.id} className="yarn-card">
            <div className="image-wrapper">
              {yarn.image ? (
                <img src={yarn.image} alt="" />
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    lineHeight: "200px",
                    color: "#a09a8e",
                  }}
                >
                  待撮影
                </div>
              )}
            </div>
            <div className="card-content">
              <div
                style={{
                  fontSize: "19px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#333",
                }}
              >
                {yarn.name}
              </div>
              <div style={{ marginBottom: "12px" }}>
                <span className="info-tag">{yarn.thickness}</span>
                {yarn.shop && <span className="info-tag">{yarn.shop}</span>}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  borderTop: "1px dashed #e0ddd5",
                  paddingTop: "12px",
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>重量</span>
                  <span>{yarn.weight || 0} g</span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>數量</span>
                  <span>{yarn.count || 0} 顆</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm("確定刪除？"))
                  setYarns(yarns.filter((y) => y.id !== yarn.id));
              }}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "white",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                color: "#7c6d60",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((r) => (image.onload = r));
  const canvas = document.createElement("canvas");
  const maxSide = 800;
  const scale = Math.min(1, maxSide / pixelCrop.width);
  canvas.width = pixelCrop.width * scale;
  canvas.height = pixelCrop.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL("image/jpeg", 0.6);
}
