import { useState, useEffect } from "react";

// ── TOKENS — matching original REAiL app exactly ──────────────────────────────
const C = {
  bg:          "#000000",
  bgCard:      "#1C1C1E",
  bgInput:     "#2C2C2E",
  bgSection:   "#111111",
  border:      "#2C2C2E",
  borderFocus: "#3A3AFF",
  text:        "#FFFFFF",
  textSub:     "#8E8E93",
  textDim:     "#48484A",
  blue:        "#3A7BFF",
  blueDark:    "#1C4FBF",
  blueLight:   "#5B9BFF",
  yellow:      "#FF9F0A",
  yellowBg:    "#2C1A00",
  yellowBorder:"#7A4600",
  red:         "#FF3B30",
  redBg:       "#2C0000",
  redBorder:   "#7A1000",
  green:       "#30D158",
  greenBg:     "#003020",
  greenBorder: "#1A6A3A",
  white:       "#FFFFFF",
};

const SF = "'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', sans-serif";
const MONO = "'SF Mono', 'Fira Code', 'Courier New', monospace";

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#000;font-family:'Inter',sans-serif;}
  button{cursor:pointer;border:none;background:none;font-family:'Inter',sans-serif;}
  textarea,input{font-family:'Inter',sans-serif;}
  textarea{resize:none;}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:none;opacity:1}}
  @keyframes toastIn{from{transform:translateY(70px);opacity:0}to{transform:none;opacity:1}}
  .fadeIn{animation:fadeIn .3s ease both;}
  .slideUp{animation:slideUp .4s cubic-bezier(.22,1,.36,1) both;}
`;

// ── Shield SVG icon — matches original ───────────────────────────────────────
function Shield({ size = 52, color = C.blue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <path
        d="M26 4L8 11v13c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V11L26 4z"
        stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round"
      />
      <path
        d="M26 4L8 11v13c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V11L26 4z"
        fill={color} fillOpacity="0.12"
      />
    </svg>
  );
}

function ShieldAlert({ size = 48, color = C.yellow }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M12 4L4 7v7c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V7L12 4z"
          stroke="#000" strokeWidth="2" fill="none" strokeLinejoin="round"/>
        <path d="M12 9v4M12 16v.5" stroke="#000" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// ── iPhone shell ──────────────────────────────────────────────────────────────
function iPhone({ children, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600,
        color: "#555", letterSpacing: "1.2px", textTransform: "uppercase",
      }}>{label}</div>
      <div style={{
        width: 320, height: 640,
        background: "#000",
        borderRadius: 50,
        border: "1.5px solid #2a2a2a",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        position: "relative",
        boxShadow: "0 0 0 0.5px #111, 0 24px 80px rgba(0,0,0,0.95), inset 0 0 0 1px #1a1a1a",
        flexShrink: 0,
      }}>
        {/* Status bar */}
        <div style={{
          height: 44, background: "#000",
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          padding: "0 24px 6px", flexShrink: 0, position: "relative",
        }}>
          <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: 120, height: 30, background: "#000", borderRadius: "0 0 20px 20px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 70, height: 6, background: "#1a1a1a", borderRadius: 3 }} />
          </div>
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>12:56</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="white">
              <rect x="0" y="4" width="3" height="7" rx="0.5" fill="white" opacity="0.4"/>
              <rect x="4.5" y="2.5" width="3" height="8.5" rx="0.5" fill="white" opacity="0.6"/>
              <rect x="9" y="0.5" width="3" height="10.5" rx="0.5" fill="white" opacity="0.8"/>
              <rect x="13.5" y="0" width="2.5" height="11" rx="0.5" fill="white"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
              <path d="M8 2.5C9.8 2.5 11.4 3.2 12.6 4.4L14 3C12.4 1.5 10.3 0.5 8 0.5S3.6 1.5 2 3L3.4 4.4C4.6 3.2 6.2 2.5 8 2.5z" fill="white" opacity="0.5"/>
              <path d="M8 5.5c1 0 2 .4 2.7 1.1L12 5.3C10.9 4.2 9.5 3.5 8 3.5S5.1 4.2 4 5.3L5.3 6.6C6 5.9 7 5.5 8 5.5z" fill="white" opacity="0.75"/>
              <circle cx="8" cy="10" r="1.5" fill="white"/>
            </svg>
            <div style={{ display: "flex", gap: 1, alignItems: "center" }}>
              <div style={{ width: 22, height: 11, borderRadius: 3, border: "1px solid #555", padding: "1px", display: "flex", alignItems: "center" }}>
                <div style={{ width: "50%", height: "100%", background: "#30D158", borderRadius: 1.5 }} />
              </div>
            </div>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 1 — Home (matches original exactly) ────────────────────────────────
function HomeScreen({ onScan }) {
  const [val, setVal] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", background: C.bg }}>

      {/* Shield + Logo */}
      <div className="fadeIn" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <Shield size={56} color={C.blue} />
        <div style={{ marginTop: 16, fontFamily: "'Inter',sans-serif", fontSize: 32, fontWeight: 800, color: C.white, letterSpacing: "-0.5px" }}>REAiL</div>
        <div style={{ marginTop: 4, fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 500, color: C.blue }}>Wallet Shield</div>
        <div style={{ marginTop: 8, fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 400, color: C.textSub }}>Scan any link before you pay.</div>
      </div>

      {/* Input */}
      <div className="fadeIn" style={{ width: "100%", marginBottom: 12, animationDelay: ".06s" }}>
        <div style={{
          display: "flex", alignItems: "center",
          background: C.bgInput, borderRadius: 14,
          border: `1.5px solid ${focused ? C.blue : "transparent"}`,
          padding: "14px 16px", gap: 10, transition: "border-color .2s",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textSub} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Paste link"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 15, color: C.white, fontFamily: "'Inter',sans-serif",
            }}
          />
          {val && (
            <button onClick={() => setVal("")} style={{ color: C.textSub, fontSize: 18, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* Scan button */}
      <div className="fadeIn" style={{ width: "100%", marginBottom: 20, animationDelay: ".1s" }}>
        <button
          onClick={() => val.trim() && onScan(val.trim())}
          style={{
            width: "100%", padding: "16px",
            background: C.blue, borderRadius: 14,
            fontSize: 16, fontWeight: 700, color: C.white,
            opacity: val.trim() ? 1 : 0.5,
            transition: "opacity .2s",
          }}
        >
          Scan
        </button>
      </div>

      {/* Reassurance */}
      <div className="fadeIn" style={{ animationDelay: ".14s", textAlign: "center" }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.textSub }}>
          REAiL Wallet Shield · No login. Just paste.
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 2 — Scanning ───────────────────────────────────────────────────────
function ScanningScreen({ url, step }) {
  const steps = [
    "Checking domain registration...",
    "Analyzing SSL certificate...",
    "Scanning 200+ threat signals...",
    "Cross-referencing fraud database...",
    "Generating verdict...",
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", background: C.bg }}>
      <Shield size={56} color={C.blue} />
      <div style={{ marginTop: 20, marginBottom: 6, fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 600, color: C.white }}>Scanning…</div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textSub, marginBottom: 32, textAlign: "center", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {url.length > 36 ? url.slice(0, 36) + "…" : url}
      </div>
      <div style={{ width: "100%", background: C.bgCard, borderRadius: 14, overflow: "hidden" }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "12px 16px",
            borderBottom: i < steps.length - 1 ? `1px solid ${C.border}` : "none",
            alignItems: "center",
          }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: i < step ? C.blue : i === step ? "transparent" : "transparent",
              border: i < step ? "none" : i === step ? `2px solid ${C.blue}` : `2px solid ${C.textDim}`,
            }}>
              {i < step
                ? <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                : i === step
                ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, animation: "pulse 1.2s infinite" }} />
                : null
              }
            </div>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: i <= step ? C.white : C.textDim, transition: "color .3s" }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SCREEN 3 — Trust Bet ─────────────────────────────────────────────────────
function TrustBetScreen({ url, onBet }) {
  const [sel, setSel] = useState(null);
  const go = (b) => { setSel(b); setTimeout(() => onBet(b), 300); };
  return (
    <div className="fadeIn" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", background: C.bg }}>
      <Shield size={52} color={C.blue} />
      <div style={{ marginTop: 20, fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500, color: C.textSub, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 10 }}>Your gut says…</div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 700, color: C.white, textAlign: "center", marginBottom: 8, letterSpacing: "-0.3px" }}>
        Real or Scam?
      </div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textSub, textAlign: "center", marginBottom: 36, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {url.length > 38 ? url.slice(0, 38) + "…" : url}
      </div>
      <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        <button onClick={() => go("real")} style={{
          height: 88, borderRadius: 16,
          background: sel === "real" ? `${C.green}30` : C.bgCard,
          border: `1.5px solid ${sel === "real" ? C.green : C.border}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          transform: sel === "real" ? "scale(0.95)" : "scale(1)",
          opacity: sel && sel !== "real" ? 0.35 : 1,
          transition: "all .18s",
        }}>
          <span style={{ fontSize: 26 }}>✅</span>
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: C.green, letterSpacing: "0.5px" }}>REAL</span>
        </button>
        <button onClick={() => go("scam")} style={{
          height: 88, borderRadius: 16,
          background: sel === "scam" ? `${C.red}30` : C.bgCard,
          border: `1.5px solid ${sel === "scam" ? C.red : C.border}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          transform: sel === "scam" ? "scale(0.95)" : "scale(1)",
          opacity: sel && sel !== "scam" ? 0.35 : 1,
          transition: "all .18s",
        }}>
          <span style={{ fontSize: 26 }}>🛑</span>
          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: C.red, letterSpacing: "0.5px" }}>SCAM</span>
        </button>
      </div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textDim }}>Tap to reveal the verdict</div>
    </div>
  );
}

// ── SCREEN 4 — Result: CAUTION (matches screenshot) ──────────────────────────
function ResultCaution({ url, bet, betOk, onNewScan, onRefundKit }) {
  const [shared, setShared] = useState(false);
  const [toast, setToast] = useState(true);
  useEffect(() => { const t = setTimeout(() => setToast(false), 3000); return () => clearTimeout(t); }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, position: "relative" }}>
      {/* Nav bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onNewScan} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.white, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <button onClick={onNewScan} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.blue, fontWeight: 500 }}>+ New Scan</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>

        {/* Verdict header */}
        <div className="fadeIn" style={{ textAlign: "center", marginBottom: 24 }}>
          {bet && (
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: betOk ? C.green : C.yellow, marginBottom: 8, fontWeight: 500 }}>
              {betOk ? "🎯 Your instinct was right!" : "🧠 The algorithm caught it this time"}
            </div>
          )}
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 800, color: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            ⚠️ Review Before Paying
          </div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.textSub, marginTop: 4 }}>Some signals need your attention</div>
        </div>

        {/* Shield badge */}
        <div className="fadeIn" style={{ animationDelay: ".06s", background: C.yellowBg, border: `1px solid ${C.yellowBorder}`, borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
          <ShieldAlert size={60} color={C.yellow} />
          <div style={{ marginTop: 16, display: "inline-block", background: C.yellow, borderRadius: 20, padding: "6px 24px" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: "#000", letterSpacing: "1px" }}>CAUTION</span>
          </div>
        </div>

        {/* Warning card */}
        <div className="fadeIn" style={{ animationDelay: ".1s", background: C.bgCard, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600, color: C.white, textAlign: "center", lineHeight: 1.5 }}>
            Run a full scan to verify this link before clicking.
          </div>
        </div>

        {/* Reasons */}
        <div className="fadeIn" style={{ animationDelay: ".13s", background: C.bgCard, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          {[
            "Domain is 8 months old — low trust history",
            "No verifiable business registration found",
            "Mixed signals detected across sources",
            "Payment method: Zelle/crypto only",
          ].map((r, i, arr) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "flex-start" }}>
              <span style={{ color: C.yellow, fontSize: 12, marginTop: 2, flexShrink: 0 }}>⚠</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#d1d1d6", lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="fadeIn" style={{ animationDelay: ".15s", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textSub, textAlign: "center", marginBottom: 20 }}>
          👥 203 people flagged this link for review today
        </div>

        {/* Share Caution button */}
        <div className="fadeIn" style={{ animationDelay: ".17s", marginBottom: 10 }}>
          <button
            onClick={() => setShared(true)}
            style={{ width: "100%", padding: "16px", borderRadius: 14, background: C.yellow, fontSize: 15, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            {shared ? "Shared!" : "Share Caution"}
          </button>
        </div>

        {/* I already paid */}
        <div className="fadeIn" style={{ animationDelay: ".19s" }}>
          <button
            onClick={onRefundKit}
            style={{ width: "100%", padding: "14px 18px", borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, fontSize: 14, color: C.white, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>$</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 400 }}>I already paid</span>
            </div>
            <svg width="6" height="12" viewBox="0 0 6 12"><path d="M1 1l4 5-4 5" stroke={C.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          </button>
        </div>

        <div style={{ marginTop: 28, textAlign: "center", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textDim }}>REAiL Wallet Shield</div>
      </div>

      {/* Toast */}
      {toast && bet && (
        <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, background: "#1C1C1E", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", animation: "toastIn .4s cubic-bezier(.22,1,.36,1)", zIndex: 99 }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, color: C.white }}>
            {betOk ? "🎯 Instinct correct! Scan #7." : "🧠 The system caught this one. Scan #7."}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SCREEN 5 — Result: STOP ───────────────────────────────────────────────────
function ResultStop({ onNewScan, onRefundKit }) {
  const [shared, setShared] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onNewScan} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.white, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <button onClick={onNewScan} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.blue, fontWeight: 500 }}>+ New Scan</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        <div className="fadeIn" style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 800, color: C.red, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            🛑 Stop — Do Not Pay
          </div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.textSub, marginTop: 4 }}>High risk signals detected</div>
        </div>
        <div className="fadeIn" style={{ animationDelay: ".05s", background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.red, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 4L4 7v7c0 5 3.5 9.7 8 11 4.5-1.3 8-6 8-11V7L12 4z" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round"/><path d="M12 9v4M12 16v.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </div>
          <div style={{ display: "inline-block", background: C.red, borderRadius: 20, padding: "6px 24px" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "1px" }}>HIGH RISK</span>
          </div>
        </div>
        <div className="fadeIn" style={{ animationDelay: ".08s", background: C.bgCard, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          {["Domain registered 2 days ago", "No SSL certificate detected", "URL matches known scam network", "Price 91% below market — lure tactic"].map((r, i, arr) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "flex-start" }}>
              <span style={{ color: C.red, fontSize: 12, marginTop: 2, flexShrink: 0 }}>✕</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#d1d1d6", lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
        <div className="fadeIn" style={{ animationDelay: ".1s", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textSub, textAlign: "center", marginBottom: 20 }}>
          👥 847 people were warned about this today
        </div>
        <div className="fadeIn" style={{ animationDelay: ".12s", display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => setShared(true)} style={{ width: "100%", padding: "16px", borderRadius: 14, background: C.red, fontSize: 15, fontWeight: 700, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            {shared ? "Warning Shared!" : "Share Warning"}
          </button>
          <button onClick={onRefundKit} style={{ width: "100%", padding: "14px 18px", borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, fontSize: 14, color: C.white, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>$</span>
              <span>I already paid</span>
            </div>
            <svg width="6" height="12" viewBox="0 0 6 12"><path d="M1 1l4 5-4 5" stroke={C.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
          </button>
        </div>
        <div style={{ marginTop: 24, textAlign: "center", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textDim }}>REAiL Wallet Shield</div>
      </div>
    </div>
  );
}

// ── SCREEN 6 — Safe ───────────────────────────────────────────────────────────
function ResultSafe({ onNewScan }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onNewScan} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.white, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <button onClick={onNewScan} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.blue, fontWeight: 500 }}>+ New Scan</button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
        <div className="fadeIn" style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 22, fontWeight: 800, color: C.green }}>✅ Safe to Proceed</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.textSub, marginTop: 4 }}>No threats detected</div>
        </div>
        <div className="fadeIn" style={{ animationDelay: ".05s", background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 16, padding: "28px 20px", textAlign: "center", width: "100%", marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: C.green, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ display: "inline-block", background: C.green, borderRadius: 20, padding: "6px 24px" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, color: "#000", letterSpacing: "1px" }}>VERIFIED</span>
          </div>
        </div>
        <div className="fadeIn" style={{ animationDelay: ".08s", background: C.bgCard, borderRadius: 14, overflow: "hidden", width: "100%", marginBottom: 20 }}>
          {["Domain active 6+ years with clean history", "SSL certificate valid and encrypted", "Business registration verifiable", "Positive signal across 200+ sources"].map((r, i, arr) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "flex-start" }}>
              <span style={{ color: C.green, fontSize: 12, marginTop: 2, flexShrink: 0 }}>✓</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "#d1d1d6", lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
        <div className="fadeIn" style={{ animationDelay: ".1s", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textSub, marginBottom: 20 }}>
          👥 1,204 people verified this as safe
        </div>
        <button onClick={onNewScan} style={{ width: "100%", padding: "16px", borderRadius: 14, background: C.green, fontSize: 15, fontWeight: 700, color: "#000" }}>
          Scan Another Link
        </button>
        <div style={{ marginTop: 20, textAlign: "center", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textDim }}>REAiL Wallet Shield</div>
      </div>
    </div>
  );
}

// ── SCREEN 7 — Refund Kit (matches screenshots exactly) ──────────────────────
function RefundKitScreen({ onBack }) {
  const [lang, setLang] = useState("EN");
  const [copied, setCopied] = useState(null);

  const templates = {
    EN: [
      { day: "Day 0", icon: "✉️", title: "Refund Request (Day 0)", subject: "Refund Request — Order/Transaction [DATE]", body: `Dear Customer Support,\n\nI am writing to formally request a full refund for a transaction made on [DATE] in the amount of [AMOUNT].\n\nAfter review, I believe this charge is unauthorized / the product was not as described / I did not receive what was promised.\n\nI request that this refund be processed within 5 business days. If I do not receive confirmation, I will escalate this matter to my bank/payment provider and relevant consumer protection agencies.\n\nPlease confirm receipt of this request.\n\nSincerely,\n[YOUR NAME]` },
      { day: "Day +3", icon: "⏱", title: "Follow-up (Day +3)", subject: "Follow-Up — Refund Request from [DATE]", body: `Dear Customer Support,\n\nI am following up on my refund request submitted on [DATE]. I have not received a response or confirmation of my refund.\n\nPlease process this refund immediately. If I do not hear back within 48 hours, I will proceed with a formal dispute through my payment provider.\n\nRegards,\n[YOUR NAME]` },
      { day: "Day +7", icon: "⚠️", title: "Final Notice (Day +7)", subject: "FINAL NOTICE — Unresolved Refund Request", body: `Dear Customer Support,\n\nThis is my final notice regarding my refund request originally submitted on [DATE]. Despite previous attempts, this matter remains unresolved.\n\nI am now escalating this dispute. I will:\n1. File a chargeback/dispute with my bank or payment provider\n2. Report this to the FTC (reportfraud.ftc.gov) or equivalent agency\n3. File a complaint with the Better Business Bureau (BBB)\n\nYou have 48 hours to resolve this before I proceed.\n\n[YOUR NAME]` },
    ],
    ES: [
      { day: "Día 0", icon: "✉️", title: "Solicitud de Reembolso (Día 0)", subject: "Solicitud de Reembolso — Orden/Transacción [FECHA]", body: `Estimado Servicio al Cliente,\n\nEscribo para solicitar formalmente un reembolso completo por una transacción realizada el [FECHA] por un monto de [MONTO].\n\nDespués de revisar, considero que este cargo es no autorizado / el producto no fue como se describió / no recibí lo prometido.\n\nSolicito que este reembolso sea procesado en 5 días hábiles. Si no recibo confirmación, escalaré este asunto a mi banco/proveedor de pago y agencias de protección al consumidor.\n\nPor favor confirme recibo de esta solicitud.\n\nAtentamente,\n[TU NOMBRE]` },
      { day: "Día +3", icon: "⏱", title: "Seguimiento (Día +3)", subject: "Seguimiento — Solicitud de Reembolso del [FECHA]", body: `Estimado Servicio al Cliente,\n\nDoy seguimiento a mi solicitud de reembolso enviada el [FECHA]. No he recibido respuesta ni confirmación de mi reembolso.\n\nPor favor procese este reembolso de inmediato. Si no recibo respuesta en 48 horas, procederé con una disputa formal a través de mi proveedor de pago.\n\nSaludos,\n[TU NOMBRE]` },
      { day: "Día +7", icon: "⚠️", title: "Aviso Final (Día +7)", subject: "AVISO FINAL — Solicitud de Reembolso Sin Resolver", body: `Estimado Servicio al Cliente,\n\nEste es mi aviso final respecto a mi solicitud de reembolso enviada originalmente el [FECHA]. A pesar de intentos previos, este asunto sigue sin resolverse.\n\nAhora estoy escalando esta disputa. Procederé a:\n1. Presentar un contracargo/disputa con mi banco\n2. Reportar a PROFECO o la agencia equivalente\n3. Presentar queja ante la autoridad de protección al consumidor\n\nTienen 48 horas para resolver esto antes de que proceda.\n\n[TU NOMBRE]` },
    ],
  };

  const escalation = {
    EN: { title: "Escalation Steps", icon: "⚖️", items: ["File a chargeback or dispute with your bank/card issuer", "Report to FTC at reportfraud.ftc.gov", "File BBB complaint at bbb.org", "Report to your state Attorney General", "For PayPal/Venmo/CashApp: open a dispute in the app", "For crypto: report to IC3.gov (FBI Internet Crime)", "Document everything: screenshots, emails, transaction IDs"] },
    ES: { title: "Pasos de Escalación", icon: "⚖️", items: ["Presenta un contracargo con tu banco/emisor de tarjeta", "Reporta a PROFECO (profeco.gob.mx) o equivalente", "Presenta queja ante la CONDUSEF si es servicio financiero", "Reporta al Ministerio Público si es fraude", "Para PayPal/Venmo/CashApp: abre disputa en la app", "Para crypto: reporta a la policía cibernética", "Documenta todo: capturas, correos, IDs de transacción"] },
  };

  const checklist = {
    EN: { title: "Evidence Checklist", icon: "📋", items: ["Screenshot of the original offer/listing", "Transaction receipt or bank statement", "Screenshots of all communications", "URL of the website/listing", "Date and amount of transaction", "Payment method used", "Any confirmation emails received"] },
    ES: { title: "Checklist de Evidencia", icon: "📋", items: ["Captura de la oferta/publicación original", "Recibo de transacción o estado de cuenta", "Capturas de todas las comunicaciones", "URL del sitio web/publicación", "Fecha y monto de la transacción", "Método de pago utilizado", "Correos de confirmación recibidos"] },
  };

  const cur = templates[lang];
  const esc = escalation[lang];
  const chk = checklist[lang];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.white, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 16, fontWeight: 700, color: C.white }}>Refund Kit</div>
        <button onClick={onBack} style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: C.blue, fontWeight: 500 }}>+ New Scan</button>
      </div>

      {/* Lang toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", background: C.bgCard, borderRadius: 8, padding: 3, gap: 3 }}>
          {["EN", "ES"].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: "6px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: lang === l ? C.blue : "transparent",
              color: lang === l ? C.white : C.textSub,
              transition: "all .15s",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>
        {cur.map((t, i) => (
          <div key={i} style={{ background: C.bgCard, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, color: C.white }}>{t.title}</span>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#a0a0a0", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 12 }}>
                {`Subject: ${t.subject}\n\n${t.body}`}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => { setCopied(i); setTimeout(() => setCopied(null), 1800); }} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  background: copied === i ? C.green : C.bgInput, borderRadius: 8,
                  fontSize: 12, fontWeight: 600, color: copied === i ? "#000" : C.textSub,
                  transition: "all .2s",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  {copied === i ? (lang === "ES" ? "Copiado!" : "Copied!") : (lang === "ES" ? "Copiar" : "Copy")}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Escalation */}
        <div style={{ background: C.bgCard, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 16 }}>{esc.icon}</span>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, color: C.white }}>{esc.title}</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            {esc.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "10px 16px", borderBottom: i < esc.items.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.textSub, flexShrink: 0, width: 16 }}>{i + 1}.</span>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.white, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence checklist */}
        <div style={{ background: C.bgCard, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 16, color: C.green }}>{chk.icon}</span>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700, color: C.white }}>{chk.title}</span>
          </div>
          <div style={{ padding: "8px 0" }}>
            {chk.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: i < chk.items.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "flex-start" }}>
                <div style={{ width: 14, height: 14, border: `1.5px solid ${C.textDim}`, borderRadius: 3, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: C.white, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legal note */}
        <div style={{ background: C.bgInput, borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>
            {lang === "ES"
              ? "Estas plantillas son orientativas y no constituyen asesoría legal. Consulta con un profesional legal si es necesario."
              : "These templates are for guidance only and do not constitute legal advice. Consult a legal professional if needed."}
          </div>
        </div>
        <div style={{ marginTop: 20, textAlign: "center", fontFamily: "'Inter',sans-serif", fontSize: 12, color: C.textDim }}>REAiL Wallet Shield</div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function REAiLApp() {
  const [screen, setScreen] = useState("home");
  const [url, setUrl] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [bet, setBet] = useState(null);
  const [betOk, setBetOk] = useState(null);
  const [verdict, setVerdict] = useState("caution");

  const SCREENS = [
    { id: "home",    label: "1 · Home" },
    { id: "scanning",label: "2 · Scanning" },
    { id: "bet",     label: "3 · Trust Bet" },
    { id: "caution", label: "4 · Caution" },
    { id: "stop",    label: "5 · Stop" },
    { id: "safe",    label: "6 · Safe" },
    { id: "refund",  label: "7 · Refund Kit" },
  ];

  const startScan = (val) => {
    setUrl(val); setScanStep(0); setScreen("scanning");
    let s = 0;
    const iv = setInterval(() => {
      s++; setScanStep(s);
      if (s >= 5) {
        clearInterval(iv);
        const l = val.toLowerCase();
        const v = l.includes("amazon-") || l.includes("69274") || l.includes("-free") ? "stop"
          : l.includes("apple") || l.includes("stripe") ? "safe" : "caution";
        setVerdict(v);
        setTimeout(() => setScreen("bet"), 300);
      }
    }, 480);
  };

  const placeBet = (b) => {
    setBet(b);
    const ok = (b === "scam" && verdict !== "safe") || (b === "real" && verdict === "safe");
    setBetOk(ok);
    setTimeout(() => setScreen(verdict), 320);
  };

  const renderActive = () => {
    switch (screen) {
      case "home":     return <HomeScreen onScan={startScan} />;
      case "scanning": return <ScanningScreen url={url || "https://example.com"} step={scanStep} />;
      case "bet":      return <TrustBetScreen url={url} onBet={placeBet} />;
      case "caution":  return <ResultCaution url={url} bet={bet} betOk={betOk} onNewScan={() => { setScreen("home"); setBet(null); }} onRefundKit={() => setScreen("refund")} />;
      case "stop":     return <ResultStop onNewScan={() => { setScreen("home"); setBet(null); }} onRefundKit={() => setScreen("refund")} />;
      case "safe":     return <ResultSafe onNewScan={() => { setScreen("home"); setBet(null); }} />;
      case "refund":   return <RefundKitScreen onBack={() => setScreen("caution")} />;
      default: return null;
    }
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh", padding: "32px 20px 64px" }}>
      <style>{GS}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>REAiL</div>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "#555", letterSpacing: "2px", marginTop: 3 }}>WALLET SHIELD · ALL SCREENS</div>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "#444", marginTop: 8 }}>
          Use the live demo or jump to any screen →
        </div>
      </div>

      {/* Screen pills */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
        {SCREENS.map(s => (
          <button key={s.id} onClick={() => setScreen(s.id)} style={{
            padding: "6px 12px", borderRadius: 20,
            background: screen === s.id ? "#fff" : "#111",
            border: `1px solid ${screen === s.id ? "transparent" : "#222"}`,
            color: screen === s.id ? "#000" : "#555",
            fontSize: 10, fontWeight: screen === s.id ? 700 : 400,
            fontFamily: "'Inter',sans-serif", letterSpacing: "0.3px",
            transition: "all .15s",
          }}>{s.label}</button>
        ))}
      </div>

      {/* Live demo phone */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 9, fontWeight: 700, color: C.blue, letterSpacing: "1.5px" }}>▶ LIVE DEMO</div>
          <iPhone label={screen.toUpperCase()}>
            {renderActive()}
          </iPhone>
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 10, color: "#444", textAlign: "center", maxWidth: 240, lineHeight: 1.7 }}>
            Paste any link or use the pills above to jump to any screen
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", marginBottom: 36 }}>
        <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 9, color: "#333", letterSpacing: "1.5px" }}>ALL 7 SCREENS</div>
        <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
      </div>

      {/* All screens grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "center" }}>
        <iPhone label="1 · Home"><HomeScreen onScan={() => {}} /></iPhone>
        <iPhone label="2 · Scanning"><ScanningScreen url="https://amazon-deals-69274.shop/iphone15-free" step={3} /></iPhone>
        <iPhone label="3 · Trust Bet"><TrustBetScreen url="https://amazon-deals-69274.shop/iphone15-free" onBet={() => {}} /></iPhone>
        <iPhone label="4 · Caution"><ResultCaution url="https://fb-deals.com/offer" bet="real" betOk={false} onNewScan={() => {}} onRefundKit={() => {}} /></iPhone>
        <iPhone label="5 · Stop"><ResultStop onNewScan={() => {}} onRefundKit={() => {}} /></iPhone>
        <iPhone label="6 · Safe"><ResultSafe onNewScan={() => {}} /></iPhone>
        <iPhone label="7 · Refund Kit"><RefundKitScreen onBack={() => {}} /></iPhone>
      </div>

      {/* Bottom */}
      <div style={{ textAlign: "center", marginTop: 56 }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "#333", lineHeight: 2 }}>
          "Stripe verifies payments. <span style={{ color: "#fff", fontWeight: 700 }}>REAiL verifies reality."</span>
        </div>
      </div>
    </div>
  );
}
