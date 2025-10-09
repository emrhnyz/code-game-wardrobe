import React, { useEffect, useRef, useState } from "react";
import CodeRain from "./components/CodeRain";
import hoodie1 from "./assets/hoodies/hoodie1.png";
import hoodie2 from "./assets/hoodies/hoodie2.png";
import hoodie3 from "./assets/hoodies/hoodie3.png";
import hoodieAI from "./assets/hoodies/hoodieai.png";
import codeGameOverlay from "./assets/hoodies/foto.png";

// --- SINGLE FILE REACT APP (Manual + AI) ---
// Stage is a strict 1:1 square (PP area). Person image is clipped inside it (no overflow).
// Left menu: scale/rotation sliders + Mirror toggle.
// Hoodie selection toggle (click again to deselect).
// "Code Game Profile Overlay" checkbox: overlays /hoodies/foto.png over the stage, fitted fully.
// Drag clamp: (current version allows free move; clamp function is available if needed)
// === CONFIG ===
const DISABLE_AI = true;  // AI tuşu kilit
const ALERT_COPY = {
  title: "Uyarı Başlığı (sen belirleyeceksin)",
  body:  "Buraya uyarı metni gelecek. İstediğin zaman düzenle.",
  button: "Tamam, anladım" // buton yazısı
};
// App component içinde (diğer useState'lerin yanında)
const [showAlert, setShowAlert] = useState(true); // site açılır açılmaz uyarı açık gelsin

const HOODIES = [
  { id: "hoodie1", label: "Hat #1", src: hoodie1 },
  { id: "hoodie2", label: "Hat #2", src: hoodie2 },
  { id: "hoodie3", label: "Hat #3", src: hoodie3 },
];
const CODEGAME_OVERLAY_SRC = codeGameOverlay;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// AVIF/HEIC/HEIF dosyaları PNG'e çevir
async function convertIfNeeded(file, target = "image/png") {
  if (!file || !file.type) return file;
  const unsupported = /image\/(avif|heic|heif)/i.test(file.type);
  if (!unsupported) return file;

  // Canvas ile dönüştür
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  const blob = await new Promise((res) => canvas.toBlob(res, target, 0.95));
  // dosya ismini .png ile bitirelim
  return new File([blob], (file.name || "image") + (target === "image/png" ? ".png" : ".jpg"), { type: target });
}


function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function useImage(src) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!src) return setImg(null);
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.onerror = () => setImg(null);
    i.src = src;
  }, [src]);
  return img;
}

export default function App() {
  const [personDataUrl, setPersonDataUrl] = useState("");
  const [selectedHoodieUrl, setSelectedHoodieUrl] = useState(HOODIES[0]?.src || "");
  const [useCodeGameOverlay, setUseCodeGameOverlay] = useState(false);

  // Transform state
  const [pos, setPos] = useState({ x: 360, y: 360 }); // centered in 720x720 by default
  const [scale, setScale] = useState(0.8);
  const [rotation, setRotation] = useState(0); // deg
  const [mirror, setMirror] = useState(false);

  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState("move"); // move | scale | rotate
  const dragState = useRef({ startX: 0, startY: 0, startPos: { x: 0, y: 0 }, startScale: 1, startRot: 0, center: { x:0, y:0 } });

  const personImg = useImage(personDataUrl);
  const hoodieImg = useImage(selectedHoodieUrl);
  const overlayImg = useImage(useCodeGameOverlay ? CODEGAME_OVERLAY_SRC : "");

  const stageRef = useRef(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResultUrl, setAiResultUrl] = useState("");
  const [error, setError] = useState("");

  async function onPickPerson(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    // AVIF/HEIC ise PNG'e çevir
    const f2 = await convertIfNeeded(f, "image/png");

    // PNG/JPEG/WebP ise direkt kullan
    const url = await fileToDataURL(f2);
    setPersonDataUrl(url);
    setAiResultUrl("");
  }


  // =============== DRAG / HANDLE LOGIC ===============
  function getCursor(e) {
    const rect = stageRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  }

  function overlayHalfSize() {
    const iw = hoodieImg?.naturalWidth || 1;
    const ih = hoodieImg?.naturalHeight || 1;
    const w = Math.abs(iw * scale); // mirror does not change size
    const h = ih * scale;
    return { hw: w / 2, hh: h / 2 };
  }

  function clampToStage(x, y, rect) {
    const { hw, hh } = overlayHalfSize();
    const minX = hw;
    const maxX = rect.width - hw;
    const minY = hh;
    const maxY = rect.height - hh;
    return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
  }

  function onMouseDownMove(e) {
    if (!hoodieImg) return;
    setDragging(true);
    setDragMode("move");
    const cur = getCursor(e);
    dragState.current.startX = cur.x;
    dragState.current.startY = cur.y;
    dragState.current.startPos = { ...pos };
  }
  function onMouseDownScale(e) {
    if (!hoodieImg) return;
    e.stopPropagation();
    setDragging(true);
    setDragMode("scale");
    const cur = getCursor(e);
    const box = getOverlayBox();
    dragState.current.center = { x: box.cx, y: box.cy };
    dragState.current.startScale = scale;
    dragState.current.startX = cur.x;
    dragState.current.startY = cur.y;
  }
  function onMouseDownRotate(e) {
    if (!hoodieImg) return;
    e.stopPropagation();
    setDragging(true);
    setDragMode("rotate");
    const cur = getCursor(e);
    const box = getOverlayBox();
    dragState.current.center = { x: box.cx, y: box.cy };
    dragState.current.startRot = rotation;
    dragState.current.startX = cur.x;
    dragState.current.startY = cur.y;
  }

  function angleBetween(cx, cy, x, y) { return Math.atan2(y - cy, x - cx); }
  function distBetween(cx, cy, x, y) { return Math.hypot(x - cx, y - cy); }

  function onMouseMove(e) {
    if (!dragging) return;
    const { x, y, rect } = getCursor(e);
    if (dragMode === "move") {
      const dx = x - dragState.current.startX;
      const dy = y - dragState.current.startY;
      setPos({
        x: dragState.current.startPos.x + dx,
        y: dragState.current.startPos.y + dy,
      }); // no clamp
    }
    if (dragMode === "scale") {
      const { center, startX, startY, startScale } = dragState.current;
      const d0 = distBetween(center.x, center.y, startX, startY);
      const d1 = distBetween(center.x, center.y, x, y);
      if (d0 > 0) setScale(clamp(startScale * (d1 / d0), 0.2, 4));
    }
    if (dragMode === "rotate") {
      const { center, startX, startY, startRot } = dragState.current;
      const a0 = angleBetween(center.x, center.y, startX, startY);
      const a1 = angleBetween(center.x, center.y, x, y);
      setRotation(startRot + (a1 - a0) * (180 / Math.PI));
    }
  }
  function onMouseUp() { setDragging(false); }

  function getOverlayBox() {
    const iw = hoodieImg?.naturalWidth || 1;
    const ih = hoodieImg?.naturalHeight || 1;
    const w = Math.abs(iw * scale);
    const h = ih * scale;
    return { cx: pos.x, cy: pos.y, w, h };
  }

  function resetOverlay() {
    const rect = stageRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 360;
    const cy = rect ? rect.height / 2 : 360;
    setPos({ x: cx, y: cy });
    setScale(0.8);
    setRotation(0);
    setMirror(false);
  }

  async function exportPNG() {
    try {
      if (!personImg) return alert("Please upload a profile image first.");
      const stage = stageRef.current;
      const rect = stage.getBoundingClientRect();
      const outSize = Math.round(Math.max(rect.width, rect.height));
      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d");

      // Person: cover square
      if (personImg) {
        const iw = personImg.naturalWidth, ih = personImg.naturalHeight;
        const scaleCover = Math.max(outSize / iw, outSize / ih);
        const dw = iw * scaleCover, dh = ih * scaleCover;
        const dx = (outSize - dw) / 2, dy = (outSize - dh) / 2;
        ctx.drawImage(personImg, dx, dy, dw, dh);
      }

      // CodeGame overlay (cover square)
      if (useCodeGameOverlay && overlayImg) {
        const iw = overlayImg.naturalWidth, ih = overlayImg.naturalHeight;
        const scaleCover = Math.max(outSize / iw, outSize / ih);
        const dw = iw * scaleCover, dh = ih * scaleCover;
        const dx = (outSize - dw) / 2, dy = (outSize - dh) / 2;
        ctx.drawImage(overlayImg, dx, dy, dw, dh);
      }

      // Hoodie (or hat) overlay
      if (hoodieImg && selectedHoodieUrl) {
        const rectDom = stage.getBoundingClientRect();
        const scaleXY = outSize / rectDom.width; // stage is square
        const hoodieW = hoodieImg.naturalWidth * scale;
        const hoodieH = hoodieImg.naturalHeight * scale;
        ctx.save();
        ctx.translate(pos.x * scaleXY, pos.y * scaleXY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(mirror ? -1 : 1, 1);
        ctx.drawImage(
          hoodieImg,
          -((hoodieW * scaleXY) / 2),
          -((hoodieH * scaleXY) / 2),
          hoodieW * scaleXY,
          hoodieH * scaleXY
        );
        ctx.restore();
      }

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "tryon.png";
      a.click();
    } catch (e) {
      console.error(e);
      alert("Error while exporting PNG.");
    }
  }

  async function aiTryOn() {
      if (DISABLE_AI) {
    setError("AI özelliği şu an devre dışı.");
    setTimeout(() => setError(""), 4000);
    return;
  }
    try {
      setError("");
      if (!personDataUrl) { setError("Please upload a profile image."); return; }
      setAiLoading(true);

      // 1) User image -> blob
      const personBlob = await (await fetch(personDataUrl)).blob();

      // 2) Fixed hoodie image (public/hoodies/hoodieai.png)
      const hoodieResp = await fetch(hoodieAI);
      if (!hoodieResp.ok) throw new Error("hoodieai.png not found");
      const hoodieBlob = await hoodieResp.blob();

      // 3) Send to backend (Cloudflare Worker)
      const form = new FormData();
      form.append("person", personBlob, "person.jpg");
      form.append("hoodie", hoodieBlob, "hoodieai.png");

      const res = await fetch("https://wispy-firefly-fdbd.emrhn-yildiz25.workers.dev/", {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${text.slice(0,400)}`);
      }

      // 4) Backend returns a merged PNG buffer
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Use AI result directly on stage as the main image:
      setPersonDataUrl(url);

      // Optionally reset overlay
      setSelectedHoodieUrl("");
      setPos({ x: 360, y: 360 });
      setScale(0.8);
      setRotation(0);
      setMirror(false);

      // We no longer use a separate AI result section
      setAiResultUrl("");

    } catch (e) {
      console.error(e); // developer console'da detay kalsın
      setError("AI service is temporarily unavailable. Please try again later.");
      setTimeout(() => setError(""), 4000); // 4 saniye sonra otomatik kaybolsun
    } finally {
      setAiLoading(false);
    }

  }

  // ---------- UI ----------
  return (
    
    
    <div className="w-screen min-h-screen relative bg-gradient-to-br from-neutral-950 via-neutral-900 to-black text-neutral-100 flex flex-col items-center p-4 md:p-6 gap-6 overflow-hidden">
          {/* OPENING ALERT MODAL */}
{showAlert && (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
  >
    <div className="w-full max-w-md rounded-2xl bg-neutral-900 ring-1 ring-neutral-800 shadow-2xl">
      <div className="p-5 border-b border-neutral-800">
        <h2 className="text-xl font-bold">{ALERT_COPY.title}</h2>
      </div>

      <div className="p-5 text-sm leading-relaxed text-neutral-200">
        {ALERT_COPY.body}
      </div>

      <div className="p-4 flex justify-end gap-2 border-t border-neutral-800">
        <button
          onClick={() => setShowAlert(false)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 shadow"
          autoFocus
        >
          {ALERT_COPY.button}
        </button>
      </div>
    </div>
  </div>
)}

          {/* Arka planda kayan kod efekti */}
      <CodeRain density={0.9} speed={0.3} fontSize={16} opacity={0.5} />
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl z-0" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl z-0" />

      <div className="w-full max-w-6xl flex flex-col gap-6 relative z-20">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Code Game Wardrobe <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">(Manual + AI)</span>
          </h1>
        </header>
        
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full">
          {/* LEFT: MENU */}
          <div className="lg:col-span-4 bg-neutral-900/60 rounded-2xl p-4 ring-1 ring-neutral-800 backdrop-blur-sm flex flex-col gap-4">
            {/* Person upload */}
            <div className="flex flex-col gap-2">
              <label className="text-sm">Profile Image</label>
              <input type="file" accept="image/*" onChange={onPickPerson} />
              {personImg && (<div className="text-xs opacity-70">{personImg.naturalWidth}×{personImg.naturalHeight}</div>)}
            </div>
            
            {/* Code Game overlay toggle */}
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useCodeGameOverlay} onChange={(e)=>setUseCodeGameOverlay(e.target.checked)} />
              Code Game Profile Overlay
            </label>

            {/* Hoodie picker with toggle */}
            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold">Select Overlay</div>
              <div className="grid grid-cols-3 gap-2">
                {HOODIES.map(h => {
                  const active = selectedHoodieUrl === h.src;
                  return (
                    <button
                      key={h.id}
                      onClick={() => { setSelectedHoodieUrl(active ? "" : h.src); setAiResultUrl(""); }}
                      className={`group relative rounded-xl overflow-hidden ring-1 ${active?"ring-indigo-400":"ring-neutral-800"}`}
                      title={h.label}
                    >
                      <img src={h.src} alt={h.label} className="w-full h-24 object-contain bg-neutral-800/60" />
                      <div className="absolute bottom-1 left-1 right-1 text-[11px] bg-black/40 px-2 py-0.5 rounded-md">{h.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
                
            {/* Sliders */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <label className="text-xs opacity-70">Scale</label>
                <input type="range" min={0.2} max={3} step={0.01} value={scale} onChange={(e)=>setScale(parseFloat(e.target.value))} />
                <div className="text-xs">{scale.toFixed(2)}×</div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs opacity-70">Rotate</label>
                <input type="range" min={-180} max={180} step={1} value={rotation} onChange={(e)=>setRotation(parseFloat(e.target.value))} />
                <div className="text-xs">{Math.round(rotation)}°</div>
              </div>
            </div>

            {/* Mirror + Buttons */}
            <div className="flex flex-wrap gap-2">
              <button className={`px-3 py-2 rounded-xl ring-1 ${mirror?"bg-indigo-600/30 ring-indigo-500":"bg-neutral-800 hover:bg-neutral-700 ring-neutral-700"}`} onClick={()=>setMirror(m=>!m)}>Mirror</button>
              <button className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 ring-1 ring-neutral-700" onClick={resetOverlay}>Reset</button>
              <button className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 shadow-lg" onClick={exportPNG}>Download PNG</button>
            </div>

            {/* AI Try-on (inside same panel) */}
            <div className="flex gap-2 items-center">
              <button
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 disabled:opacity-50 shadow-lg"
                onClick={aiTryOn}
                disabled={aiLoading || !personDataUrl || DISABLE_AI}
                title={DISABLE_AI ? "AI özelliği şu an devre dışı" : ""}
              >
                {DISABLE_AI ? "AI Kapalı" : (aiLoading ? "Running AI…" : "AI Hoodie Try-On")}
              </button>
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
          </div>

          {/* RIGHT: SQUARE STAGE (1:1) */}
          <div className="lg:col-span-8">
            <section className="bg-neutral-900/60 rounded-2xl p-4 md:p-5 flex flex-col gap-4 ring-1 ring-neutral-800 backdrop-blur-sm">
              <div className="text-lg font-semibold">Manual Try-On</div>
              <div
                ref={stageRef}
                className="relative w-full max-w-[720px] mx-auto aspect-square bg-neutral-800/70 rounded-2xl overflow-hidden select-none ring-1 ring-neutral-700 shadow-2xl"
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                {/* Person clipped in 1:1 square */}
                {personImg ? (
                  <img src={personDataUrl} alt="person" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-neutral-400">Upload a profile image</div>
                )}

                {/* Code Game overlay (cover) */}
                {useCodeGameOverlay && overlayImg && (
                  <img src={CODEGAME_OVERLAY_SRC} alt="overlay" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                )}

                {/* Hoodie (or hat) overlay */}
                {hoodieImg && personImg && selectedHoodieUrl && (
                  <div
                    className="absolute top-0 left-0 cursor-move"
                    style={{
                      transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%,-50%) rotate(${rotation}deg) scaleX(${mirror ? -scale : scale}) scaleY(${scale})`,
                      transformOrigin: "center center",
                    }}
                    onMouseDown={onMouseDownMove}
                  >
                    <img src={selectedHoodieUrl} alt="overlay-asset" className="max-w-[60vw] pointer-events-none" />

                    {/* handles */}
                    {(() => {
                      const size = 12;
                      const Handle = ({ style, onMouseDown, title }) => (
                        <div onMouseDown={onMouseDown} title={title} className="absolute bg-white/95 text-black grid place-items-center rounded-full shadow-md cursor-pointer" style={{ width: size, height: size, ...style }} />
                      );
                      return (
                        <>
                          <Handle title="Scale" style={{ right: -size/2, bottom: -size/2 }} onMouseDown={onMouseDownScale} />
                          <Handle title="Rotate" style={{ right: -size/2, top: -size/2 }} onMouseDown={onMouseDownRotate} />
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>

        {/* (AI result section removed — AI result now replaces the main stage image) */}

        <footer className="text-lg opacity-60 text-center pb-6">
          Tip: The profile area is fixed to a 1:1 square. — Made by{" "}
          <a
            href="https://x.com/emirhanfalan"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted hover:opacity-80"
            title="Follow Emirhan on X"
          >
            Emirhan
          </a>
        </footer>
      </div>

      {dragging && (<div className="fixed bottom-3 right-3 text-xs bg-neutral-800/80 px-2 py-1 rounded-lg">Dragging…</div>)}
    </div>
  );
}