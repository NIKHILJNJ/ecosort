import { useState, useRef, useEffect, useCallback } from "react";

const API_URL = "https://nj30sep-ecosort-backend.hf.space";
const BIN_COLORS = {
  plastic:    { bg: "#3B82F6", emoji: "🔵", bin: "Blue Bin" },
  paper:      { bg: "#F59E0B", emoji: "🟡", bin: "Yellow Bin" },
  cardboard:  { bg: "#D97706", emoji: "🟠", bin: "Yellow Bin" },
  glass:      { bg: "#10B981", emoji: "🟢", bin: "Green Bin" },
  metal:      { bg: "#6B7280", emoji: "⚪", bin: "Metal Bin" },
  biological: { bg: "#84CC16", emoji: "🌱", bin: "Green Bin" },
  battery:    { bg: "#EF4444", emoji: "🔴", bin: "Hazardous Bin" },
  shoes:      { bg: "#8B5CF6", emoji: "🟣", bin: "Textile Bin" },
  clothes:    { bg: "#EC4899", emoji: "🩷", bin: "Textile Bin" },
  trash:      { bg: "#374151", emoji: "⚫", bin: "General Waste" },
};

function getBinInfo(label) {
  if (!label) return { bg: "#374151", emoji: "🗑️", bin: "Unknown" };
  for (const key of Object.keys(BIN_COLORS)) {
    if (label.toLowerCase().includes(key)) return BIN_COLORS[key];
  }
  return { bg: "#374151", emoji: "🗑️", bin: "General Waste" };
}

export default function App() {
  const [mode, setMode] = useState("upload"); // "upload" | "live"
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [liveActive, setLiveActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
  video: { facingMode: { ideal: "environment" } } 
});
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setLiveActive(true);
      setError(null);
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLiveActive(false);
  }, []);

  // Capture frame and predict
  const captureAndPredict = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");
      try {
        const res = await fetch(`${API_URL}/predict`, { method: "POST", body: formData });
        const data = await res.json();
        setResult(data);
        setHistory(h => [{ ...data, time: new Date().toLocaleTimeString() }, ...h].slice(0, 10));
      } catch {
        // silent fail on live feed
      }
    }, "image/jpeg");
  }, []);

  // Start live prediction loop
  const startLive = useCallback(async () => {
    await startCamera();
    intervalRef.current = setInterval(captureAndPredict, 2000);
  }, [startCamera, captureAndPredict]);

  const stopLive = useCallback(() => {
    stopCamera();
    setResult(null);
  }, [stopCamera]);

  // Switch modes
  useEffect(() => {
    stopCamera();
    setResult(null);
    setPreviewUrl(null);
    setError(null);
  }, [mode, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Handle file upload
  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_URL}/predict`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setResult(data);
      setHistory(h => [{ ...data, time: new Date().toLocaleTimeString() }, ...h].slice(0, 10));
    } catch {
      setError("Could not connect to backend. Make sure it's running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const binInfo = result ? getBinInfo(result.label) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f1a0f 0%, #0a1628 50%, #0f1a0f 100%)",
      fontFamily: "'Segoe UI', sans-serif",
      color: "#e2e8f0",
    }}>
      {/* Header */}
      <header style={{
        padding: "24px 32px",
        borderBottom: "1px solid rgba(16,185,129,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,0,0,0.3)",
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>🌿</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#10B981", letterSpacing: "-0.5px" }}>EcoSort</h1>
            <p style={{ margin: 0, fontSize: 11, color: "#6B7280", letterSpacing: "2px", textTransform: "uppercase" }}>AI Waste Classifier</p>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#4B5563", textAlign: "right" }}>
          <div>Final Year Project</div>
          <div style={{ color: "#10B981" }}>Deep Learning + IoT</div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>

        {/* Mode Toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 6, width: "fit-content" }}>
          {["upload", "live"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "10px 28px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              transition: "all 0.2s",
              background: mode === m ? "#10B981" : "transparent",
              color: mode === m ? "#000" : "#6B7280",
            }}>
              {m === "upload" ? "📁 Upload Image" : "📷 Live Camera"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* Left Panel */}
          <div>
            {mode === "upload" ? (
              <div>
                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                  style={{
                    border: "2px dashed rgba(16,185,129,0.4)",
                    borderRadius: 16,
                    padding: 40,
                    textAlign: "center",
                    cursor: "pointer",
                    background: "rgba(16,185,129,0.03)",
                    transition: "all 0.2s",
                    marginBottom: 16,
                  }}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
                      <p style={{ color: "#10B981", fontWeight: 600, margin: "0 0 4px" }}>Drop image here or click to upload</p>
                      <p style={{ color: "#4B5563", fontSize: 13, margin: 0 }}>Supports JPG, PNG, WEBP</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div>
                <div style={{ borderRadius: 16, overflow: "hidden", background: "#000", marginBottom: 16, minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: liveActive ? "block" : "none" }} />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  {!liveActive && (
                    <div style={{ textAlign: "center", color: "#4B5563" }}>
                      <div style={{ fontSize: 48 }}>📷</div>
                      <p>Camera not started</p>
                    </div>
                  )}
                  {liveActive && (
                    <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(16,185,129,0.9)", color: "#000", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      ● LIVE
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={startLive} disabled={liveActive} style={{
                    flex: 1, padding: "12px", borderRadius: 10, border: "none", cursor: liveActive ? "not-allowed" : "pointer",
                    background: liveActive ? "#1F2937" : "#10B981", color: liveActive ? "#4B5563" : "#000", fontWeight: 700,
                  }}>▶ Start Live</button>
                  <button onClick={stopLive} disabled={!liveActive} style={{
                    flex: 1, padding: "12px", borderRadius: 10, border: "none", cursor: !liveActive ? "not-allowed" : "pointer",
                    background: !liveActive ? "#1F2937" : "#EF4444", color: !liveActive ? "#4B5563" : "#fff", fontWeight: 700,
                  }}>■ Stop</button>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: 16, marginTop: 12, color: "#FCA5A5", fontSize: 14 }}>
                ⚠️ {error}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: "center", padding: 24, color: "#10B981" }}>
                <div style={{ fontSize: 32, animation: "spin 1s linear infinite" }}>⟳</div>
                <p>Analyzing...</p>
              </div>
            )}
          </div>

          {/* Right Panel — Result */}
          <div>
            {result ? (
              <div>
                {/* Main Result Card */}
                <div style={{
                  borderRadius: 16,
                  padding: 28,
                  background: `linear-gradient(135deg, ${binInfo.bg}22, ${binInfo.bg}11)`,
                  border: `1px solid ${binInfo.bg}44`,
                  marginBottom: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <span style={{ fontSize: 52 }}>{binInfo.emoji}</span>
                    <div>
                      <div style={{ fontSize: 13, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px" }}>Detected</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", textTransform: "capitalize" }}>{result.label}</div>
                      <div style={{ fontSize: 13, color: binInfo.bg, fontWeight: 600 }}>{binInfo.bin}</div>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                      <span style={{ color: "#9CA3AF" }}>Confidence</span>
                      <span style={{ color: "#fff", fontWeight: 700 }}>{result.confidence.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${result.confidence}%`, background: binInfo.bg, borderRadius: 4, transition: "width 0.8s ease" }} />
                    </div>
                  </div>

                  {/* Tip */}
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 14, fontSize: 13, color: "#D1FAE5", lineHeight: 1.5 }}>
                    {result.tip}
                  </div>
                </div>

                {/* Top 3 */}
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>Top Predictions</div>
                  {result.top3?.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "#4B5563", width: 16 }}>#{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 13, textTransform: "capitalize", color: i === 0 ? "#10B981" : "#9CA3AF" }}>{item.label}</span>
                      <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${item.confidence}%`, background: i === 0 ? "#10B981" : "#374151", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#6B7280", width: 40, textAlign: "right" }}>{item.confidence.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ height: "100%", minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#374151", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.3 }}>♻️</div>
                <p style={{ color: "#4B5563" }}>Results will appear here</p>
                <p style={{ color: "#374151", fontSize: 13 }}>Upload an image or start the live camera</p>
              </div>
            )}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
              Session History ({history.length} items)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {history.map((h, i) => {
                const info = getBinInfo(h.label);
                return (
                  <div key={i} style={{
                    background: `${info.bg}22`,
                    border: `1px solid ${info.bg}44`,
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span>{info.emoji}</span>
                    <span style={{ textTransform: "capitalize", color: "#e2e8f0" }}>{h.label}</span>
                    <span style={{ color: "#4B5563", fontSize: 11 }}>{h.confidence.toFixed(0)}%</span>
                    <span style={{ color: "#374151", fontSize: 10 }}>{h.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
