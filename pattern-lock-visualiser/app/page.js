"use client"
import { useState, useCallback, useMemo } from "react";

const DOT_POSITIONS = {
  1: [0, 0], 2: [1, 0], 3: [2, 0],
  4: [0, 1], 5: [1, 1], 6: [2, 1],
  7: [0, 2], 8: [1, 2], 9: [2, 2],
};

const PAGE_SIZE = 60;

function PatternGrid({ pattern, size = 64, highlight = false }) {
  const pad = size * 0.18;
  const step = (size - pad * 2) / 2;

  const dots = pattern.split("").map(Number);

  const points = dots.map((d) => {
    const [cx, cy] = DOT_POSITIONS[d];
    return [pad + cx * step, pad + cy * step];
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        background: highlight ? "#0f172a" : "#0a0f1e",
        borderRadius: 10,
        border: highlight ? "1.5px solid #38bdf8" : "1px solid #1e293b",
        display: "block",
        transition: "border 0.15s",
      }}
    >
      {/* Draw all 9 dots (inactive) */}
      {Object.values(DOT_POSITIONS).map(([cx, cy], i) => (
        <circle
          key={i}
          cx={pad + cx * step}
          cy={pad + cy * step}
          r={size * 0.055}
          fill="#1e3a5f"
        />
      ))}

      {/* Draw lines */}
      {points.slice(0, -1).map(([x1, y1], i) => {
        const [x2, y2] = points[i + 1];
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#38bdf8"
            strokeWidth={size * 0.04}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}

      {/* Draw active dots */}
      {points.map(([cx, cy], i) => (
        <circle
          key={`active-${i}`}
          cx={cx}
          cy={cy}
          r={size * 0.07}
          fill={i === 0 ? "#38bdf8" : "#7dd3fc"}
          opacity={i === 0 ? 1 : 0.85}
        />
      ))}

      {/* Start indicator */}
      <circle
        cx={points[0][0]}
        cy={points[0][1]}
        r={size * 0.11}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={size * 0.025}
        opacity={0.4}
      />
    </svg>
  );
}

function LargePatternPreview({ pattern }) {
  const size = 220;
  const pad = size * 0.18;
  const step = (size - pad * 2) / 2;
  const dots = pattern.split("").map(Number);
  const points = dots.map((d) => {
    const [cx, cy] = DOT_POSITIONS[d];
    return [pad + cx * step, pad + cy * step];
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          background: "#0a0f1e",
          borderRadius: 16,
          border: "2px solid #38bdf8",
          boxShadow: "0 0 32px #38bdf840",
        }}
      >
        {Object.values(DOT_POSITIONS).map(([cx, cy], i) => (
          <circle key={i} cx={pad + cx * step} cy={pad + cy * step} r={size * 0.055} fill="#1e3a5f" />
        ))}
        {points.slice(0, -1).map(([x1, y1], i) => {
          const [x2, y2] = points[i + 1];
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#38bdf8" strokeWidth={size * 0.035} strokeLinecap="round" opacity={0.8} />
          );
        })}
        {points.map(([cx, cy], i) => (
          <g key={`ag-${i}`}>
            <circle cx={cx} cy={cy} r={size * 0.075} fill={i === 0 ? "#38bdf8" : "#7dd3fc"} opacity={i === 0 ? 1 : 0.9} />
            <text x={cx} y={cy + size * 0.028} textAnchor="middle" fill="#0a0f1e"
              fontSize={size * 0.07} fontWeight="bold" fontFamily="monospace">
              {dots[i]}
            </text>
          </g>
        ))}
        <circle cx={points[0][0]} cy={points[0][1]} r={size * 0.11}
          fill="none" stroke="#38bdf8" strokeWidth={size * 0.02} opacity={0.35} />
      </svg>
      <div style={{ color: "#7dd3fc", fontFamily: "monospace", fontSize: 18, letterSpacing: 6 }}>
        {pattern.split("").join(" → ")}
      </div>
      <div style={{ color: "#475569", fontSize: 13 }}>{pattern.length} dots</div>
    </div>
  );
}

export default function App() {
  const [allPatterns, setAllPatterns] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);
  const [filterDots, setFilterDots] = useState("all");
  const [filterStart, setFilterStart] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split("\n").map(l => l.trim()).filter(l => /^[1-9]+$/.test(l));
      setAllPatterns(lines);
      setLoaded(true);
      setPage(0);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const filtered = useMemo(() => {
    let result = allPatterns;
    if (filterDots !== "all") result = result.filter(p => p.length === parseInt(filterDots));
    if (filterStart !== "all") result = result.filter(p => p[0] === filterStart);
    if (search.trim()) result = result.filter(p => p.includes(search.trim()));
    return result;
  }, [allPatterns, filterDots, filterStart, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagePatterns = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const btnStyle = (active) => ({
    padding: "6px 14px",
    borderRadius: 6,
    border: active ? "1.5px solid #38bdf8" : "1px solid #1e293b",
    background: active ? "#0c2d4a" : "#0d1829",
    color: active ? "#38bdf8" : "#475569",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "monospace",
    transition: "all 0.15s",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060d1a",
      color: "#e2e8f0",
      fontFamily: "'Courier New', monospace",
      padding: "32px 24px",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: 6, color: "#38bdf8", marginBottom: 8, textTransform: "uppercase" }}>
            Android Pattern Lock
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: "#f1f5f9", letterSpacing: -1 }}>
            Pattern Visualizer
          </h1>
          {loaded && (
            <div style={{ color: "#475569", fontSize: 13, marginTop: 8 }}>
              {allPatterns.length.toLocaleString()} patterns loaded · {filtered.length.toLocaleString()} shown
            </div>
          )}
        </div>

        {/* Upload */}
        {!loaded ? (
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            style={{
              border: `2px dashed ${dragging ? "#38bdf8" : "#1e3a5f"}`,
              borderRadius: 16,
              padding: "60px 40px",
              textAlign: "center",
              transition: "all 0.2s",
              background: dragging ? "#0c2d4a20" : "transparent",
              cursor: "pointer",
              maxWidth: 480,
              margin: "0 auto",
            }}
            onClick={() => document.getElementById("fileInput").click()}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
            <div style={{ fontSize: 18, color: "#7dd3fc", marginBottom: 8 }}>
              Drop <code style={{ color: "#38bdf8" }}>all.txt</code> here
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              or click to browse · from github.com/delight-im/AndroidPatternLock
            </div>
            <input
              id="fileInput"
              type="file"
              accept=".txt"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
              <div style={{ color: "#475569", fontSize: 12, letterSpacing: 2 }}>DOTS</div>
              {["all", "4", "5", "6", "7", "8", "9"].map(d => (
                <button key={d} style={btnStyle(filterDots === d)}
                  onClick={() => { setFilterDots(d); setPage(0); }}>
                  {d === "all" ? "Any" : d}
                </button>
              ))}
              <div style={{ width: 1, height: 24, background: "#1e293b" }} />
              <div style={{ color: "#475569", fontSize: 12, letterSpacing: 2 }}>START</div>
              {["all", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
                <button key={d} style={btnStyle(filterStart === d)}
                  onClick={() => { setFilterStart(d); setPage(0); }}>
                  {d === "all" ? "Any" : d}
                </button>
              ))}
              <div style={{ width: 1, height: 24, background: "#1e293b" }} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder="contains… e.g. 159"
                style={{
                  background: "#0d1829",
                  border: "1px solid #1e293b",
                  borderRadius: 6,
                  color: "#7dd3fc",
                  padding: "6px 12px",
                  fontFamily: "monospace",
                  fontSize: 13,
                  outline: "none",
                  width: 140,
                }}
              />
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "#475569", padding: 60 }}>No patterns match your filters.</div>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: 10,
                  marginBottom: 24,
                }}>
                  {pagePatterns.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => setSelected(p)}
                      style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                    >
                      <PatternGrid pattern={p} size={72} highlight={selected === p} />
                      <div style={{ fontSize: 10, color: "#334155", letterSpacing: 1 }}>{p}</div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                  <button style={btnStyle(false)} onClick={() => setPage(0)} disabled={page === 0}>«</button>
                  <button style={btnStyle(false)} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
                  <span style={{ color: "#475569", fontSize: 13, padding: "0 8px" }}>
                    Page {page + 1} of {totalPages.toLocaleString()}
                  </span>
                  <button style={btnStyle(false)} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button>
                  <button style={btnStyle(false)} onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
                </div>
              </>
            )}
          </>
        )}

        {/* Modal */}
        {selected && (
          <div
            onClick={() => setSelected(null)}
            style={{
              position: "fixed", inset: 0,
              background: "#00000099",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 100,
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#0d1829",
                border: "1px solid #1e3a5f",
                borderRadius: 20,
                padding: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                boxShadow: "0 0 60px #38bdf820",
              }}
            >
              <LargePatternPreview pattern={selected} />
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "#0c2d4a",
                  border: "1px solid #38bdf8",
                  color: "#38bdf8",
                  borderRadius: 8,
                  padding: "8px 24px",
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: 13,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}