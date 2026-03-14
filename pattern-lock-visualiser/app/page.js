"use client"
import { useState, useCallback, useMemo, useEffect } from "react";

// ── Bundle patterns directly ─────────────────────────────────────────────────
// Instead of importing all.txt (which requires a loader), convert it to a JS
// module once using the script below, then import that instead.
//
// HOW TO CONVERT (run once in your terminal):
//   node -e "
//     const fs = require('fs');
//     const lines = fs.readFileSync('./all.txt','utf8')
//       .split('\n').map(l=>l.trim()).filter(l=>/^[1-9]+$/.test(l));
//     fs.writeFileSync('./patterns.js',
//       'const patterns = ' + JSON.stringify(lines) + ';\nexport default patterns;\n');
//     console.log('Done:', lines.length, 'patterns');
//   "
//
// This produces patterns.js next to this file, which is a normal JS import.
// After that, uncomment the import line below:
//
// import BUNDLED_PATTERNS from "./patterns";
//
// Until you run the script, the app shows the upload screen as fallback.

let BUNDLED_PATTERNS = null;
BUNDLED_PATTERNS = (await import("./patterns")).default;  // ← uncomment after converting

function parsePatterns(raw) {
  return raw.split("\n").map(l => l.trim()).filter(l => /^[1-9]+$/.test(l));
}

// ── localStorage ────────────────────────────────────────────────────────────
const LS_SAVED        = "plv_saved";
const LS_TRIED        = "plv_tried";
const LS_PAGE         = "plv_page";
const LS_FILTER_DOTS  = "plv_filterDots";
const LS_FILTER_START = "plv_filterStart";
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── constants ───────────────────────────────────────────────────────────────
const DOT_POSITIONS = {
  1:[0,0], 2:[1,0], 3:[2,0],
  4:[0,1], 5:[1,1], 6:[2,1],
  7:[0,2], 8:[1,2], 9:[2,2],
};
const PAGE_SIZE = 60;

// ── inject global responsive CSS once ──────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #060d1a; }

  .plv-root {
    min-height: 100vh;
    background: #060d1a;
    color: #e2e8f0;
    font-family: 'Courier New', monospace;
  }

  /* ── top bar ── */
  .plv-topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: #060d1aee;
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #0f1e35;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .plv-topbar-title {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .plv-topbar-eyebrow {
    font-size: 9px;
    letter-spacing: 4px;
    color: #38bdf8;
    text-transform: uppercase;
  }
  .plv-topbar-h1 {
    font-size: 18px;
    font-weight: 800;
    color: #f1f5f9;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .plv-topbar-meta {
    font-size: 11px;
    color: #334155;
    margin-top: 2px;
  }
  .plv-topbar-meta .autosave { color: #22c55e; }
  .plv-saved-btn {
    flex-shrink: 0;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-family: monospace;
    font-size: 13px;
    transition: all 0.15s;
    white-space: nowrap;
  }

  /* ── main content ── */
  .plv-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 16px 40px;
  }

  /* ── upload zone ── */
  .plv-upload {
    border: 2px dashed #1e3a5f;
    border-radius: 16px;
    padding: 60px 32px;
    text-align: center;
    transition: all 0.2s;
    cursor: pointer;
    max-width: 440px;
    margin: 60px auto 0;
  }
  .plv-upload.drag { border-color: #38bdf8; background: #0c2d4a20; }
  .plv-upload-icon { font-size: 44px; margin-bottom: 14px; }
  .plv-upload-title { font-size: 17px; color: #7dd3fc; margin-bottom: 6px; }
  .plv-upload-sub { font-size: 12px; color: #475569; }

  /* ── filter bar ── */
  .plv-filters {
    background: #0a1525;
    border: 1px solid #0f1e35;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .plv-filter-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .plv-filter-label {
    font-size: 10px;
    letter-spacing: 2px;
    color: #334155;
    min-width: 38px;
    text-transform: uppercase;
  }
  .plv-divider-v {
    width: 1px;
    height: 20px;
    background: #0f1e35;
    flex-shrink: 0;
  }
  .plv-filter-btn {
    padding: 5px 11px;
    border-radius: 6px;
    border: 1px solid #1e293b;
    background: #0d1829;
    color: #475569;
    cursor: pointer;
    font-size: 12px;
    font-family: monospace;
    transition: all 0.15s;
  }
  .plv-filter-btn.active {
    border-color: #38bdf8;
    background: #0c2d4a;
    color: #38bdf8;
  }
  .plv-search-input {
    background: #0d1829;
    border: 1px solid #1e293b;
    border-radius: 6px;
    color: #7dd3fc;
    padding: 5px 10px;
    font-family: monospace;
    font-size: 12px;
    outline: none;
    width: 120px;
    transition: border 0.15s;
  }
  .plv-search-input:focus { border-color: #38bdf8; }

  /* ── pattern grid ── */
  .plv-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }
  @media (max-width: 480px) {
    .plv-grid { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
  }

  .plv-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .plv-cell-inner {
    position: relative;
    cursor: pointer;
  }
  .plv-cell-icon-btn {
    position: absolute;
    background: none;
    border: none;
    cursor: pointer;
    padding: 3px;
    line-height: 1;
    transition: color 0.15s, transform 0.1s;
  }
  .plv-cell-icon-btn:hover { transform: scale(1.2); }
  .plv-cell-label {
    font-size: 10px;
    letter-spacing: 1px;
    color: #334155;
    transition: all 0.15s;
    text-align: center;
  }
  .plv-cell-label.tried {
    color: #1e293b;
    text-decoration: line-through;
  }

  /* ── pagination bar ── */
  .plv-pagebar {
    background: #0a1525;
    border: 1px solid #0f1e35;
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .plv-page-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #1e293b;
    background: #0d1829;
    color: #475569;
    cursor: pointer;
    font-size: 13px;
    font-family: monospace;
    transition: all 0.15s;
    min-width: 36px;
    text-align: center;
  }
  .plv-page-btn:hover:not(:disabled) { border-color: #38bdf8; color: #38bdf8; }
  .plv-page-btn:disabled { opacity: 0.3; cursor: default; }
  .plv-page-info {
    font-size: 12px;
    color: #475569;
    padding: 0 6px;
    white-space: nowrap;
  }
  .plv-jump-input {
    background: #0d1829;
    border: 1px solid #1e293b;
    border-radius: 6px;
    color: #7dd3fc;
    padding: 6px 8px;
    font-family: monospace;
    font-size: 12px;
    outline: none;
    width: 58px;
    text-align: center;
  }
  .plv-jump-input:focus { border-color: #38bdf8; }
  .plv-back-btn {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #1e3a5f;
    background: #0d1829;
    color: #64748b;
    cursor: pointer;
    font-size: 12px;
    font-family: monospace;
    transition: all 0.15s;
  }
  .plv-back-btn:hover { border-color: #38bdf8; color: #94a3b8; }

  /* ── legend ── */
  .plv-legend {
    display: flex;
    gap: 14px;
    justify-content: center;
    flex-wrap: wrap;
    font-size: 11px;
    color: #1e3a5f;
    padding-bottom: 8px;
  }

  /* ── modals ── */
  .plv-overlay {
    position: fixed;
    inset: 0;
    background: #000000bb;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(6px);
    padding: 16px;
  }
  .plv-modal {
    background: #0d1829;
    border: 1px solid #1e3a5f;
    border-radius: 20px;
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    box-shadow: 0 0 60px #38bdf818;
    max-width: 360px;
    width: 100%;
  }
  .plv-modal-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .plv-modal-btn {
    padding: 9px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-family: monospace;
    font-size: 13px;
    transition: all 0.15s;
  }

  /* ── saved panel ── */
  .plv-saved-panel {
    background: #0d1829;
    border: 1px solid #92400e;
    border-radius: 20px;
    padding: 24px 20px;
    max-width: 720px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 0 60px #f59e0b14;
  }
  .plv-saved-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-shrink: 0;
  }
  .plv-saved-eyebrow {
    font-size: 10px;
    letter-spacing: 4px;
    color: #f59e0b;
    margin-bottom: 4px;
    text-transform: uppercase;
  }
  .plv-saved-meta { font-size: 12px; color: #475569; }
  .plv-saved-grid {
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 10px;
  }
  .plv-saved-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: #060d1a;
    border-radius: 12px;
    padding: 10px 6px;
    border: 1px solid #92400e;
    transition: border 0.15s;
  }
  .plv-saved-card.tried { border-color: #1e293b; }
  .plv-saved-card-label {
    font-size: 10px;
    color: #475569;
    letter-spacing: 1px;
  }
  .plv-saved-card-label.tried { text-decoration: line-through; }
  .plv-saved-card-actions { display: flex; gap: 4px; }
  .plv-saved-card-btn {
    padding: 3px 9px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    background: #0d1829;
    border: 1px solid #334155;
    color: #64748b;
    transition: all 0.15s;
    font-family: monospace;
  }
  .plv-saved-card-btn.active { border-color: #475569; color: #94a3b8; }

  /* ── empty state ── */
  .plv-empty {
    text-align: center;
    color: #334155;
    padding: 50px 0;
    font-size: 14px;
    line-height: 1.8;
  }

  /* ── responsive adjustments ── */
  @media (max-width: 600px) {
    .plv-topbar { padding: 12px 14px; }
    .plv-topbar-h1 { font-size: 15px; }
    .plv-content { padding: 14px 10px 32px; }
    .plv-filters { padding: 10px 12px; gap: 8px; }
    .plv-modal { padding: 24px 18px; }
    .plv-pagebar { gap: 4px; padding: 10px 10px; }
    .plv-saved-panel { padding: 18px 14px; }
    .plv-saved-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
  }
  @media (max-width: 380px) {
    .plv-filter-btn { padding: 4px 8px; font-size: 11px; }
    .plv-page-btn { padding: 5px 9px; font-size: 12px; min-width: 30px; }
  }
`;

function useCSS() {
  useEffect(() => {
    const id = "plv-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = CSS;
      document.head.appendChild(el);
    }
  }, []);
}

// ── PatternSVG ───────────────────────────────────────────────────────────────
function PatternSVG({ pattern, size, saved = false, tried = false, highlight = false }) {
  const pad = size * 0.18;
  const step = (size - pad * 2) / 2;
  const dots = pattern.split("").map(Number);
  const points = dots.map(d => { const [cx,cy] = DOT_POSITIONS[d]; return [pad+cx*step, pad+cy*step]; });
  const line  = tried ? "#475569" : saved ? "#f59e0b" : "#38bdf8";
  const dot   = tried ? "#334155" : saved ? "#fbbf24" : "#7dd3fc";
  const start = tried ? "#475569" : saved ? "#f59e0b" : "#38bdf8";
  const border = highlight ? `1.5px solid ${line}` : saved && !tried ? "1px solid #92400e" : "1px solid #1e293b";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ background:"#0a0f1e", borderRadius:10, border, display:"block", opacity: tried ? 0.45 : 1, transition:"all 0.15s" }}>
      {Object.values(DOT_POSITIONS).map(([cx,cy],i) => (
        <circle key={i} cx={pad+cx*step} cy={pad+cy*step} r={size*0.055} fill="#1e3a5f" />
      ))}
      {points.slice(0,-1).map(([x1,y1],i) => {
        const [x2,y2] = points[i+1];
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={line} strokeWidth={size*0.04} strokeLinecap="round" opacity={0.7}/>;
      })}
      {points.map(([cx,cy],i) => (
        <circle key={`a${i}`} cx={cx} cy={cy} r={size*0.07} fill={i===0?start:dot} opacity={i===0?1:0.85}/>
      ))}
      <circle cx={points[0][0]} cy={points[0][1]} r={size*0.11} fill="none" stroke={start} strokeWidth={size*0.025} opacity={0.4}/>
    </svg>
  );
}

// ── LargePreview (modal) ─────────────────────────────────────────────────────
function LargePreview({ pattern, saved, tried, onSave, onTried }) {
  const size = 200;
  const pad  = size * 0.18;
  const step = (size - pad*2) / 2;
  const dots = pattern.split("").map(Number);
  const points = dots.map(d => { const [cx,cy]=DOT_POSITIONS[d]; return [pad+cx*step, pad+cy*step]; });
  const line  = tried ? "#64748b" : saved ? "#f59e0b" : "#38bdf8";
  const dot   = tried ? "#475569" : saved ? "#fbbf24" : "#7dd3fc";
  const start = tried ? "#64748b" : saved ? "#f59e0b" : "#38bdf8";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, width:"100%" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ background:"#0a0f1e", borderRadius:16, border:`2px solid ${line}`, boxShadow:`0 0 28px ${line}38` }}>
        {Object.values(DOT_POSITIONS).map(([cx,cy],i) => (
          <circle key={i} cx={pad+cx*step} cy={pad+cy*step} r={size*0.055} fill="#1e3a5f"/>
        ))}
        {points.slice(0,-1).map(([x1,y1],i) => {
          const [x2,y2]=points[i+1];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={line} strokeWidth={size*0.035} strokeLinecap="round" opacity={0.8}/>;
        })}
        {points.map(([cx,cy],i) => (
          <g key={`ag${i}`}>
            <circle cx={cx} cy={cy} r={size*0.075} fill={i===0?start:dot} opacity={i===0?1:0.9}/>
            <text x={cx} y={cy+size*0.028} textAnchor="middle" fill="#0a0f1e" fontSize={size*0.07} fontWeight="bold" fontFamily="monospace">{dots[i]}</text>
          </g>
        ))}
        <circle cx={points[0][0]} cy={points[0][1]} r={size*0.11} fill="none" stroke={start} strokeWidth={size*0.02} opacity={0.35}/>
      </svg>

      <div style={{ color:line, fontFamily:"monospace", fontSize:16, letterSpacing:5 }}>
        {pattern.split("").join(" → ")}
      </div>
      <div style={{ color:"#475569", fontSize:12 }}>{pattern.length} dots</div>

      <div className="plv-modal-actions">
        <button className="plv-modal-btn" onClick={onSave} style={{
          background: saved?"#1c0e00":"#0d1829",
          border: saved?"1.5px solid #f59e0b":"1px solid #334155",
          color: saved?"#fbbf24":"#94a3b8",
        }}>{saved ? "★ Saved" : "☆ Save"}</button>
        <button className="plv-modal-btn" onClick={onTried} style={{
          background: tried?"#0f172a":"#0d1829",
          border: tried?"1.5px solid #475569":"1px solid #334155",
          color: tried?"#64748b":"#94a3b8",
        }}>{tried ? "✓ Tried" : "○ Mark tried"}</button>
      </div>
    </div>
  );
}

// ── SavedPanel ───────────────────────────────────────────────────────────────
function SavedPanel({ savedPatterns, triedPatterns, onClose, onToggleSave, onToggleTried, onSelect }) {
  const triedCount = savedPatterns.filter(p => triedPatterns.includes(p)).length;
  return (
    <div className="plv-overlay" onClick={onClose}>
      <div className="plv-saved-panel" onClick={e => e.stopPropagation()}>

        <div className="plv-saved-header">
          <div>
            <div className="plv-saved-eyebrow">Saved Patterns</div>
            <div className="plv-saved-meta">
              {savedPatterns.length} saved &nbsp;·&nbsp;
              <span style={{color:"#64748b"}}>{triedCount} tried</span> &nbsp;·&nbsp;
              <span style={{color:"#f59e0b"}}>{savedPatterns.length - triedCount} untried</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:22, lineHeight:1, padding:4 }}>✕</button>
        </div>

        {savedPatterns.length === 0 ? (
          <div className="plv-empty">
            No saved patterns yet.<br/>
            <span style={{fontSize:12, color:"#1e3a5f"}}>Click ☆ on any pattern to save it here.</span>
          </div>
        ) : (
          <div className="plv-saved-grid">
            {savedPatterns.map(p => {
              const isTried = triedPatterns.includes(p);
              return (
                <div key={p} className={`plv-saved-card${isTried?" tried":""}`}>
                  <div onClick={() => onSelect(p)} style={{ cursor:"pointer" }}>
                    <PatternSVG pattern={p} size={70} saved={!isTried} tried={isTried}/>
                  </div>
                  <div className={`plv-saved-card-label${isTried?" tried":""}`}>{p}</div>
                  <div className="plv-saved-card-actions">
                    <button className={`plv-saved-card-btn${isTried?" active":""}`} onClick={() => onToggleTried(p)}>
                      {isTried ? "✓" : "○"}
                    </button>
                    <button className="plv-saved-card-btn" onClick={() => onToggleSave(p)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  useCSS();

  const [allPatterns, setAllPatterns] = useState([]);
  const [loaded, setLoaded]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(() => lsGet(LS_PAGE, 0));
  const [filterDots, setFilterDots]   = useState(() => lsGet(LS_FILTER_DOTS, "all"));
  const [filterStart, setFilterStart] = useState(() => lsGet(LS_FILTER_START, "all"));
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState(null);
  const [dragging, setDragging]       = useState(false);
  const [jumpInput, setJumpInput]     = useState("");
  const [lastPage, setLastPage]       = useState(null);
  const [showSaved, setShowSaved]     = useState(false);

  const [savedPatterns, setSavedPatterns] = useState(() => lsGet(LS_SAVED, []));
  const [triedPatterns, setTriedPatterns] = useState(() => lsGet(LS_TRIED, []));

  useEffect(() => { lsSet(LS_SAVED,        savedPatterns); }, [savedPatterns]);
  useEffect(() => { lsSet(LS_TRIED,        triedPatterns); }, [triedPatterns]);
  useEffect(() => { lsSet(LS_PAGE,         page);          }, [page]);
  useEffect(() => { lsSet(LS_FILTER_DOTS,  filterDots);    }, [filterDots]);
  useEffect(() => { lsSet(LS_FILTER_START, filterStart);   }, [filterStart]);

  // Auto-load bundled patterns on mount
  useEffect(() => {
    if (BUNDLED_PATTERNS) {
      setLoading(true);
      setTimeout(() => {
        setAllPatterns(BUNDLED_PATTERNS);
        setLoaded(true);
        setLoading(false);
        // page/filters already restored from localStorage via useState initializers
      }, 50);
    }
  }, []);

  const loadRaw = useCallback((raw) => {
    const lines = parsePatterns(raw);
    setAllPatterns(lines);
    setLoaded(true);
    setLastPage(null);
    // page/filters already restored from localStorage
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => loadRaw(e.target.result);
    reader.readAsText(file);
  }, [loadRaw]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const filtered = useMemo(() => {
    let r = allPatterns;
    if (filterDots  !== "all") r = r.filter(p => p.length === parseInt(filterDots));
    if (filterStart !== "all") r = r.filter(p => p[0] === filterStart);
    if (search.trim())          r = r.filter(p => p.includes(search.trim()));
    return r;
  }, [allPatterns, filterDots, filterStart, search]);

  const totalPages   = Math.ceil(filtered.length / PAGE_SIZE);
  const pagePatterns = filtered.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  const goToPage = (n) => {
    const clamped = Math.max(0, Math.min(totalPages-1, n));
    setLastPage(page);
    setPage(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => { if (lastPage !== null) { setPage(lastPage); setLastPage(null); } };

  const handleJump = () => {
    const n = parseInt(jumpInput);
    if (!isNaN(n) && n >= 1 && n <= totalPages) { goToPage(n-1); setJumpInput(""); }
  };

  const toggleSave  = p => setSavedPatterns(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);
  const toggleTried = p => setTriedPatterns(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);

  return (
    <div className="plv-root">

      {/* ── Top Bar ── */}
      <header className="plv-topbar">
        <div className="plv-topbar-title">
          <span className="plv-topbar-eyebrow">Android Pattern Lock</span>
          <span className="plv-topbar-h1">Pattern Visualizer</span>
          {loaded && (
            <span className="plv-topbar-meta">
              {allPatterns.length.toLocaleString()} loaded &nbsp;·&nbsp; {filtered.length.toLocaleString()} shown
              &nbsp;·&nbsp; <span className="autosave">💾 auto-saved</span>
            </span>
          )}
        </div>

        {loaded && (
          <button className="plv-saved-btn" onClick={() => setShowSaved(true)} style={{
            background: savedPatterns.length ? "#1c0e00" : "#0d1829",
            border: savedPatterns.length ? "1.5px solid #f59e0b" : "1px solid #334155",
            color: savedPatterns.length ? "#f59e0b" : "#475569",
          }}>
            ★ {savedPatterns.length > 0 ? `Saved (${savedPatterns.length})` : "Saved"}
          </button>
        )}
        {loaded && (
          <>
            <input id="plv-file-swap" type="file" accept=".txt" style={{display:"none"}}
              onChange={e => handleFile(e.target.files[0])}/>
            <button className="plv-saved-btn" title="Load a different all.txt"
              onClick={() => document.getElementById("plv-file-swap").click()}
              style={{ background:"#0d1829", border:"1px solid #1e293b", color:"#334155", fontSize:12 }}>
              ⇄ file
            </button>
          </>
        )}
      </header>

      {/* ── Main Content ── */}
      <main className="plv-content">

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"80px 0", color:"#334155" }}>
            <div style={{ fontSize:32, marginBottom:16 }}>⏳</div>
            <div style={{ color:"#38bdf8", fontSize:14, letterSpacing:2 }}>Loading patterns…</div>
          </div>

        /* Upload fallback (only shown if all.txt wasn't bundled) */
        ) : !loaded ? (
          <div
            className={`plv-upload${dragging?" drag":""}`}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => document.getElementById("plv-file").click()}
          >
            <div className="plv-upload-icon">📂</div>
            <div className="plv-upload-title">
              Drop <code style={{color:"#38bdf8"}}>all.txt</code> here
            </div>
            <div className="plv-upload-sub">
              or click to browse<br/>
              <br/>
              <strong style={{color:"#475569"}}>Tip:</strong> place <code>all.txt</code> next to this <code>.jsx</code> file<br/>
              and it will load automatically on every refresh.
            </div>
            <input id="plv-file" type="file" accept=".txt" style={{display:"none"}}
              onChange={e => handleFile(e.target.files[0])}/>
          </div>
        ) : (
          <>
            {/* ── Filters ── */}
            <div className="plv-filters">
              {/* Dots row */}
              <div className="plv-filter-row">
                <span className="plv-filter-label">Dots</span>
                {["all","4","5","6","7","8","9"].map(d => (
                  <button key={d} className={`plv-filter-btn${filterDots===d?" active":""}`}
                    onClick={() => { setFilterDots(d); goToPage(0); }}>
                    {d==="all"?"Any":d}
                  </button>
                ))}
              </div>
              {/* Start + Search row */}
              <div className="plv-filter-row">
                <span className="plv-filter-label">Start</span>
                {["all","1","2","3","4","5","6","7","8","9"].map(d => (
                  <button key={d} className={`plv-filter-btn${filterStart===d?" active":""}`}
                    onClick={() => { setFilterStart(d); goToPage(0); }}>
                    {d==="all"?"Any":d}
                  </button>
                ))}
                <div className="plv-divider-v"/>
                <input className="plv-search-input" value={search}
                  onChange={e => { setSearch(e.target.value); goToPage(0); }}
                  placeholder="contains… e.g. 159"/>
              </div>
            </div>

            {/* ── Pattern Grid ── */}
            {filtered.length === 0 ? (
              <div className="plv-empty">No patterns match your filters.</div>
            ) : (
              <>
                <div className="plv-grid">
                  {pagePatterns.map((p, i) => {
                    const isSaved = savedPatterns.includes(p);
                    const isTried = triedPatterns.includes(p);
                    return (
                      <div key={i} className="plv-cell">
                        <div className="plv-cell-inner">
                          <div onClick={() => setSelected(p)}>
                            <PatternSVG pattern={p} size={76} saved={isSaved} tried={isTried} highlight={selected===p}/>
                          </div>
                          {/* ☆ save — top right */}
                          <button className="plv-cell-icon-btn" onClick={() => toggleSave(p)}
                            title={isSaved?"Unsave":"Save"}
                            style={{ top:2, right:2, fontSize:13, color: isSaved?"#f59e0b":"#1e3a5f" }}>
                            {isSaved?"★":"☆"}
                          </button>
                          {/* ○ tried — top left */}
                          <button className="plv-cell-icon-btn" onClick={() => toggleTried(p)}
                            title={isTried?"Mark untried":"Mark tried"}
                            style={{ top:2, left:2, fontSize:11, color: isTried?"#64748b":"#1e3a5f" }}>
                            {isTried?"✓":"○"}
                          </button>
                        </div>
                        <div className={`plv-cell-label${isTried?" tried":""}`}>{p}</div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Pagination Bar ── */}
                <div className="plv-pagebar">
                  <button className="plv-page-btn" onClick={() => goToPage(0)} disabled={page===0}>«</button>
                  <button className="plv-page-btn" onClick={() => goToPage(page-1)} disabled={page===0}>‹</button>
                  <span className="plv-page-info">Page {page+1} of {totalPages.toLocaleString()}</span>
                  <button className="plv-page-btn" onClick={() => goToPage(page+1)} disabled={page>=totalPages-1}>›</button>
                  <button className="plv-page-btn" onClick={() => goToPage(totalPages-1)} disabled={page>=totalPages-1}>»</button>

                  <div className="plv-divider-v"/>

                  <input className="plv-jump-input" type="number" min={1} max={totalPages}
                    value={jumpInput} placeholder="pg #"
                    onChange={e => setJumpInput(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && handleJump()}/>
                  <button className="plv-page-btn" onClick={handleJump}>Go</button>

                  {lastPage !== null && (
                    <button className="plv-back-btn" onClick={goBack}>↩ pg {lastPage+1}</button>
                  )}
                </div>

                {/* ── Legend ── */}
                <div className="plv-legend">
                  <span>☆/★ = save &nbsp; ○/✓ = tried</span>
                  <span style={{color:"#92400e"}}>■ amber = saved</span>
                  <span style={{color:"#334155"}}>■ grey = tried</span>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ── Detail Modal ── */}
      {selected && (
        <div className="plv-overlay" onClick={() => setSelected(null)}>
          <div className="plv-modal" onClick={e => e.stopPropagation()}>
            <LargePreview
              pattern={selected}
              saved={savedPatterns.includes(selected)}
              tried={triedPatterns.includes(selected)}
              onSave={() => toggleSave(selected)}
              onTried={() => toggleTried(selected)}
            />
            <button className="plv-modal-btn" onClick={() => setSelected(null)} style={{
              background:"#0c2d4a", border:"1px solid #38bdf8", color:"#38bdf8",
            }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Saved Panel ── */}
      {showSaved && (
        <SavedPanel
          savedPatterns={savedPatterns}
          triedPatterns={triedPatterns}
          onClose={() => setShowSaved(false)}
          onToggleSave={toggleSave}
          onToggleTried={toggleTried}
          onSelect={p => { setSelected(p); setShowSaved(false); }}
        />
      )}
    </div>
  );
}