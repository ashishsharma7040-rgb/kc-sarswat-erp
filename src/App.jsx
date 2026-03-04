import { useState, useMemo, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

// ── Firebase Config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDaEiDYTu8cq78vTYrPmQtQJB_W_3t-dmQ",
  authDomain: "kc-sarswat-erp-9dced.firebaseapp.com",
  projectId: "kc-sarswat-erp-9dced",
  storageBucket: "kc-sarswat-erp-9dced.firebasestorage.app",
  messagingSenderId: "657914614372",
  appId: "1:657914614372:web:d33b53f68f80d542874571"
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp);

// ── Firebase helpers ───────────────────────────────────────────────────────────
const fbGet = async (col) => {
  try { const snap = await getDocs(collection(db, col)); return snap.docs.map(d => ({ ...d.data(), _fbId: d.id })); } catch { return null; }
};
const fbSet = async (col, id, data) => {
  try { await setDoc(doc(db, col, id), data); return true; } catch { return false; }
};
const fbAdd = async (col, data) => {
  try { const r = await addDoc(collection(db, col), data); return r.id; } catch { return null; }
};
const fbUpdate = async (col, id, data) => {
  try { await updateDoc(doc(db, col, id), data); return true; } catch { return false; }
};
const fbDelete = async (col, id) => {
  try { await deleteDoc(doc(db, col, id)); return true; } catch { return false; }
};

const fbNukeCollection = async (col) => {
  try {
    const snap = await getDocs(collection(db, col));
    if (snap.empty) return;
    let batch = writeBatch(db); let count = 0;
    snap.docs.forEach(d => { batch.delete(d.ref); count++; if (count === 499) { batch.commit(); batch = writeBatch(db); count = 0; } });
    await batch.commit();
  } catch {}
};
const fbNukeAll = async () => {
  await Promise.all(["sales","supply","expenses","transport","staff","settings","tanks"].map(c => fbNukeCollection(c)));
};

// ── Constants ──────────────────────────────────────────────────────────────────
const makeStaffEmail = (name) => name.toLowerCase().replace(/\s+/g, "") + "kc@gmail.com";
const makeStaffPassword = (name) => name.toLowerCase().replace(/\s+/g, "") + "@123";
const OWNER_CRED = { email: "owner@kcsarswat.in", password: "KCSarswat@2025" };
const TODAY = new Date().toISOString().split("T")[0];
const EXPENSE_CATS = ["Cleaning", "Maintenance", "Generator Diesel", "Electricity Bill", "Water Bill", "Staff Salary", "Cash Shortage", "Custom"];
const SHIFTS = ["Day Shift", "Night Shift"];

const UNIT_CONFIG_INIT = {
  unit1: { name: "Unit 1", machines: ["M1", "M2", "M3"], petrolMargin: 4.27, dieselMargin: 2.72 },
  unit2: { name: "Unit 2", machines: ["M4", "M5"], petrolMargin: 3.79, dieselMargin: 2.28 },
  unit3: { name: "Unit 3", machines: ["M6", "M7"], petrolMargin: 4.14, dieselMargin: 2.63 },
};
const INITIAL_SETTINGS = { petrolPrice: 102.84, dieselPrice: 89.62, lowStockAlert: 500, minOrderLitres: 12000, maxOrderLitres: 23000 };
const INITIAL_TANKS = {
  unit1: { petrol: { capacity: 10000, current: 0, buffer: 1000 }, diesel: { capacity: 15000, current: 0, buffer: 1500 } },
  unit2: { petrol: { capacity: 8000,  current: 0, buffer: 800  }, diesel: { capacity: 12000, current: 0, buffer: 1200 } },
  unit3: { petrol: { capacity: 8000,  current: 0, buffer: 800  }, diesel: { capacity: 12000, current: 0, buffer: 1200 } },
};
const INITIAL_STAFF = [];

const INDIAN_HOLIDAYS = [
  "2025-01-26","2025-03-25","2025-03-29","2025-04-14","2025-08-15","2025-10-02","2025-10-20","2025-10-23","2025-12-25",
  "2026-01-01","2026-01-26","2026-03-17","2026-04-14","2026-08-15","2026-10-02"
];
const TRUCK_TYPES = [
  { id: "personal", name: "Personal Truck (14K)", capacity: 14000, compartments: [5000, 5000, 4000], preferred: true },
  { id: "t12k",     name: "Transport 12K",        capacity: 12000, compartments: [4000, 4000, 4000], preferred: false },
  { id: "t16k",     name: "Transport 16K",        capacity: 16000, compartments: [4000, 4000, 4000, 4000], preferred: false },
  { id: "t23k",     name: "Transport 23K",        capacity: 23000, compartments: [5000, 5000, 5000, 4000, 4000], preferred: false },
];

// ── Logistics Engine ───────────────────────────────────────────────────────────
const isDepotClosed = (dt) => {
  const day = dt.getDay();
  const ds = dt.toISOString().split("T")[0];
  return day === 0 || INDIAN_HOLIDAYS.includes(ds) || dt.getHours() >= 17;
};

// Advanced order engine — zero opportunity cost optimiser
const computeOrderAlert = (usableStock, avgSales, minOrder, maxOrder, availableSpace, salesHistory7) => {
  if (!avgSales || avgSales <= 0) return null;
  try {
    const daysLeft = usableStock > 0 ? usableStock / avgSales : 0;
    const now = new Date();
    const runsOut = new Date(now.getTime() + daysLeft * 86400000);
    const urgency = daysLeft <= 1 ? "CRITICAL" : daysLeft <= 2 ? "HIGH" : daysLeft <= 4 ? "MEDIUM" : "LOW";

    // 3-day demand forecast using recent trend
    const recentTrend = salesHistory7 && salesHistory7.length >= 3
      ? salesHistory7.slice(-3).reduce((a, b) => a + b, 0) / 3
      : avgSales;
    const day1 = Math.round(recentTrend * 1.0);
    const day2 = Math.round(recentTrend * 1.0);
    const day3 = Math.round(recentTrend * 1.0);
    const forecastNeeded = day1 + day2 + day3;

    // Opportunity cost analysis:
    // - Bulk order = lock capital + space, risk overflow
    // - Under order = pump runs dry = lost sales (opportunity cost)
    // Perfect order covers: current gap + 7-day buffer, never overflow
    const gapToFill   = Math.max(0, availableSpace);                 // actual free space
    const sevenDayNeed = Math.ceil((avgSales * 7) / 1000) * 1000;   // 7-day rolling demand
    const idealQty     = Math.min(sevenDayNeed, Math.floor(availableSpace / 1000) * 1000);
    const cappedQty    = Math.min(maxOrder, Math.max(minOrder, idealQty));
    const suggestedQty = Math.max(minOrder, Math.min(cappedQty, Math.floor(availableSpace / 1000) * 1000));

    const overOrderRisk   = suggestedQty > availableSpace ? suggestedQty - availableSpace : 0;
    const underOrderRisk  = suggestedQty < forecastNeeded ? forecastNeeded - suggestedQty : 0;
    const capitalLocked   = suggestedQty * 90; // approx cost per litre locked in stock

    const truck = TRUCK_TYPES.find(t => t.preferred && t.capacity >= suggestedQty) ||
      TRUCK_TYPES.find(t => t.capacity >= suggestedQty) ||
      TRUCK_TYPES[TRUCK_TYPES.length - 1];

    let departure = new Date(now);
    for (let i = 0; i < 96; i++) {
      const arr = new Date(departure.getTime() + 7 * 3600000);
      if (!isDepotClosed(arr) && arr.getHours() >= 6 && departure.getHours() >= 6) break;
      departure = new Date(departure.getTime() + 1800000);
    }
    const mustLeaveBy = new Date(runsOut.getTime() - 16 * 3600000);

    return {
      daysLeft: daysLeft.toFixed(1),
      runsOut, urgency, suggestedQty, truck, mustLeaveBy, departure,
      avgSales: Math.round(avgSales), forecastNeeded, availableSpace,
      day1, day2, day3, idealQty, overOrderRisk, underOrderRisk, capitalLocked,
      sevenDayNeed, recentTrend: Math.round(recentTrend)
    };
  } catch { return null; }
};

// ── Date helpers ───────────────────────────────────────────────────────────────
const isWithin24h = (dateStr) => {
  try { return (new Date() - new Date(dateStr + "T00:00:00")) < 86400000; } catch { return true; }
};

// ── Data generators ────────────────────────────────────────────────────────────
const genMonthly = () => ["Jan","Feb","Mar","Apr","May","Jun"].map(m => ({
  month: m, petrol: 0, diesel: 0, profit: 0, expenses: 0
}));

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  inp:     { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"11px 14px", color:"#f1f5f9", fontSize:13, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border 0.15s" },
  inpErr:  { background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.55)", borderRadius:10, padding:"11px 14px", color:"#f1f5f9", fontSize:13, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box" },
  card:    { background:"rgba(13,27,42,0.92)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:22 },
  btn:     (color="#f59e0b") => ({ background:`linear-gradient(135deg,${color},${color}cc)`, color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }),
  ghostBtn:{ background:"rgba(255,255,255,0.05)", color:"#64748b", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
};

// ── Small shared components ────────────────────────────────────────────────────
const Label = ({ children, req }) => <label style={{ color:"#94a3b8", fontSize:11, fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.6px" }}>{children}{req && <span style={{ color:"#f87171", marginLeft:3 }}>*</span>}</label>;
const FieldErr = ({ msg }) => msg ? <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5 }}><span style={{ color:"#f87171", fontSize:11 }}>{msg}</span></div> : null;
const Toast = ({ msg, type="success" }) => msg ? <div style={{ background:type==="success"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.1)", border:`1px solid ${type==="success"?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`, borderRadius:12, padding:"12px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10, color:type==="success"?"#34d399":"#f87171", fontSize:13, fontWeight:600 }}>{msg}</div> : null;
const SyncBadge = ({ syncing }) => <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", background:syncing?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)", border:`1px solid ${syncing?"rgba(245,158,11,0.2)":"rgba(16,185,129,0.2)"}`, borderRadius:6 }}><div style={{ width:6, height:6, borderRadius:"50%", background:syncing?"#f59e0b":"#34d399" }} /><span style={{ color:syncing?"#f59e0b":"#34d399", fontSize:10, fontWeight:700 }}>{syncing?"Saving...":"Saved ✓"}</span></div>;
const ErrBanner = ({ errors }) => !errors?.length ? null : <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}><p style={{ color:"#fca5a5", fontSize:13, fontWeight:700, margin:"0 0 6px" }}>Fix the following:</p><ul style={{ color:"#f87171", fontSize:12, margin:0, paddingLeft:16 }}>{errors.map((e,i) => <li key={i}>{e}</li>)}</ul></div>;
const LockedBar = () => <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"10px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:8, color:"#f87171", fontSize:12, fontWeight:600 }}>🔒 Locked — Staff can only edit today's data. Contact Owner for historical edits.</div>;

const ConfirmModal = ({ open, title, msg, onOk, onCancel, okLabel="Proceed", danger=false }) => {
  if (!open) return null;
  return <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
    <div style={{ ...S.card, border:`1px solid ${danger?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.3)"}`, width:420, boxShadow:"0 20px 60px rgba(0,0,0,0.8)" }}>
      <h3 style={{ color:danger?"#fca5a5":"#f59e0b", fontSize:16, fontWeight:800, margin:"0 0 10px" }}>⚠ {title}</h3>
      <p style={{ color:"#94a3b8", fontSize:13, margin:"0 0 20px", lineHeight:1.7 }}>{msg}</p>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onOk} style={{ flex:1, background:danger?"linear-gradient(135deg,#ef4444,#dc2626)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{okLabel}</button>
        <button onClick={onCancel} style={{ flex:1, ...S.ghostBtn }}>Cancel</button>
      </div>
    </div>
  </div>;
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color="#f59e0b", icon, trend }) => {
  const rgb = color==="#f59e0b"?"245,158,11":color==="#3b82f6"?"59,130,246":color==="#10b981"?"16,185,129":color==="#8b5cf6"?"139,92,246":"239,68,68";
  return <div style={{ ...S.card, border:`1px solid rgba(${rgb},0.22)`, position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, right:0, width:100, height:100, background:`radial-gradient(circle at top right,rgba(${rgb},0.1),transparent)`, borderRadius:"0 18px 0 100%" }} />
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:"0 0 8px", letterSpacing:"0.9px", textTransform:"uppercase" }}>{label}</p>
        <p style={{ color:"#f1f5f9", fontSize:26, fontWeight:800, margin:0, letterSpacing:"-0.5px" }}>{value}</p>
        {sub && <p style={{ color:"#94a3b8", fontSize:12, margin:"4px 0 0" }}>{sub}</p>}
        {trend !== undefined && <p style={{ color:trend>=0?"#34d399":"#f87171", fontSize:12, margin:"6px 0 0", fontWeight:600 }}>{trend>=0?"↑":"↓"} {Math.abs(trend)}%</p>}
      </div>
      <div style={{ width:46, height:46, background:`rgba(${rgb},0.14)`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", color, fontSize:22, flexShrink:0 }}>{icon}</div>
    </div>
  </div>;
};

// ── Tank Gauge ─────────────────────────────────────────────────────────────────
const TankGauge = ({ label, current, capacity, color, lowAlert, buffer }) => {
  const pct       = Math.min((current / capacity) * 100, 100);
  const bufferPct = capacity > 0 ? Math.min(((buffer||0) / capacity) * 100, 100) : 0;
  const usable    = Math.max(0, current - (buffer||0));
  const isLow     = usable < (lowAlert||500);
  return <div style={{ ...S.card, textAlign:"center", padding:"16px 12px" }}>
    <p style={{ color:"#94a3b8", fontSize:9, fontWeight:700, margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.8px", lineHeight:1.3 }}>{label}</p>
    <div style={{ position:"relative", width:56, height:100, margin:"0 auto 10px", borderRadius:"6px 6px 4px 4px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:`linear-gradient(0deg,${color}cc,${color}55)`, transition:"height 0.6s" }} />
      {bufferPct > 0 && <div style={{ position:"absolute", left:0, right:0, bottom:`${bufferPct}%`, height:2, background:"#ef4444", zIndex:2 }} />}
      {[25,50,75].map(t => <div key={t} style={{ position:"absolute", left:0, right:0, bottom:`${t}%`, height:1, background:"rgba(255,255,255,0.1)" }} />)}
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ color:"#f1f5f9", fontSize:11, fontWeight:700, textShadow:"0 1px 4px rgba(0,0,0,0.9)" }}>{pct.toFixed(0)}%</span></div>
    </div>
    <p style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, margin:"0 0 1px" }}>{current.toLocaleString()}L</p>
    <p style={{ color:"#34d399", fontSize:10, margin:"0 0 1px", fontWeight:600 }}>Usable: {usable.toLocaleString()}L</p>
    <p style={{ color:"#ef4444", fontSize:9, margin:"0 0 4px" }}>Buffer: {(buffer||0).toLocaleString()}L</p>
    {isLow && <span style={{ background:"rgba(239,68,68,0.15)", color:"#f87171", fontSize:9, padding:"2px 7px", borderRadius:4, fontWeight:700 }}>⚠ LOW</span>}
  </div>;
};

// ── Stock Visual Panel ─────────────────────────────────────────────────────────
const StockPanel = ({ tanks, settings, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const [su, setSu] = useState("all"), [sf, setSf] = useState("both");
  const shown = su === "all" ? Object.keys(uc) : [su];
  const tl = [];
  shown.forEach(uid => {
    const u = uc[uid], t = tanks[uid]; if (!t || !u) return;
    if (sf !== "diesel") tl.push({ label:`${u.name} Petrol`, current:t.petrol.current, capacity:t.petrol.capacity, color:"#f59e0b", low:settings.lowStockAlert, buffer:t.petrol.buffer||0 });
    if (sf !== "petrol") tl.push({ label:`${u.name} Diesel`, current:t.diesel.current, capacity:t.diesel.capacity, color:"#3b82f6", low:settings.lowStockAlert, buffer:t.diesel.buffer||0 });
  });
  const tb = a => ({ padding:"6px 12px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, background:a?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(255,255,255,0.06)", color:a?"#fff":"#64748b" });
  return <div>
    <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
      <span style={{ color:"#64748b", fontSize:11, fontWeight:600 }}>Unit:</span>
      {[["all","All"], ...Object.entries(uc).map(([k,u]) => [k,u.name])].map(([v,l]) => <button key={v} onClick={() => setSu(v)} style={tb(su===v)}>{l}</button>)}
      <span style={{ color:"#64748b", fontSize:11, fontWeight:600, marginLeft:8 }}>Fuel:</span>
      {[["both","Both"],["petrol","Petrol"],["diesel","Diesel"]].map(([v,l]) => <button key={v} onClick={() => setSf(v)} style={tb(sf===v)}>{l}</button>)}
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:8, marginBottom:16 }}>{tl.map(t => <TankGauge key={t.label} label={t.label} current={t.current} capacity={t.capacity} color={t.color} lowAlert={t.low} buffer={t.buffer} />)}</div>
    <ResponsiveContainer width="100%" height={140}><BarChart data={tl.map(t => ({ name:t.label.replace(" Petrol","P").replace(" Diesel","D"), val:t.current }))} barSize={22}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="name" tick={{ fill:"#64748b", fontSize:9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill:"#64748b", fontSize:9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f1f5f9", fontSize:11 }} formatter={v => [`${v.toLocaleString()} L`,""]} /><Bar dataKey="val" radius={[5,5,0,0]}>{tl.map((t,i) => <Cell key={i} fill={t.color} />)}</Bar></BarChart></ResponsiveContainer>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════
const LoginPage = ({ onLogin, staffList }) => {
  const [email, setEmail]   = useState(""), [password, setPassword] = useState(""), [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [showPwd, setShowPwd] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError("");
    await new Promise(r => setTimeout(r,600));
    const el = email.toLowerCase().trim(), pl = password.toLowerCase().trim();
    if (role === "owner") {
      if (el===OWNER_CRED.email.toLowerCase() && pl===OWNER_CRED.password.toLowerCase()) onLogin({ email, role:"owner", name:"Owner — KC Sarswat", staffId:null });
      else setError("Invalid owner credentials.");
    } else {
      const found = staffList.find(s => makeStaffEmail(s.name).toLowerCase()===el && s.password.toLowerCase()===pl && s.active);
      if (found) onLogin({ email, role:"staff", name:found.name, staffId:found.id });
      else setError("Staff credentials not found or account inactive.");
    }
    setLoading(false);
  };

  return <div style={{ minHeight:"100vh", display:"flex", fontFamily:"'Sora',sans-serif", background:"#060d18" }}>
    <div style={{ flex:1, position:"relative", display:"flex", flexDirection:"column", justifyContent:"flex-end", overflow:"hidden", background:"linear-gradient(180deg,#0a0f1a,#0d1c2e 40%,#102238)" }}>
      <svg style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:520, opacity:0.9 }} viewBox="0 0 520 420" fill="none">
        <rect x="0" y="360" width="520" height="60" fill="#050d18" />
        <rect x="70" y="100" width="18" height="260" rx="4" fill="#1a3a5c" />
        <rect x="432" y="100" width="18" height="260" rx="4" fill="#1a3a5c" />
        <rect x="30" y="80" width="460" height="28" rx="6" fill="#f59e0b" />
        <rect x="30" y="80" width="460" height="8" rx="4" fill="#fbbf24" />
        <text x="260" y="98" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">HINDUSTAN PETROLEUM</text>
        <rect x="140" y="200" width="80" height="155" rx="8" fill="#0f2744" stroke="#1e4a7a" strokeWidth="2" />
        <rect x="152" y="214" width="56" height="32" rx="2" fill="#0a4a2e" />
        <text x="180" y="226" textAnchor="middle" fill="#34d399" fontSize="8" fontFamily="monospace">102.84</text>
        <text x="180" y="237" textAnchor="middle" fill="#34d399" fontSize="6" fontFamily="monospace">₹/LITRE</text>
        <rect x="148" y="258" width="64" height="22" rx="4" fill="#f59e0b" opacity="0.9" />
        <text x="180" y="273" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">PETROL</text>
        <rect x="148" y="286" width="64" height="22" rx="4" fill="#3b82f6" opacity="0.9" />
        <text x="180" y="301" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">DIESEL</text>
        <path d="M220 300 Q250 280 240 320 Q230 355 220 355" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" fill="none" />
        <rect x="300" y="200" width="80" height="155" rx="8" fill="#0f2744" stroke="#1e4a7a" strokeWidth="2" />
        <rect x="312" y="214" width="56" height="32" rx="2" fill="#0a3a4a" />
        <text x="340" y="226" textAnchor="middle" fill="#60a5fa" fontSize="8" fontFamily="monospace">89.62</text>
        <text x="340" y="237" textAnchor="middle" fill="#60a5fa" fontSize="6" fontFamily="monospace">₹/LITRE</text>
        <rect x="308" y="258" width="64" height="22" rx="4" fill="#f59e0b" opacity="0.9" />
        <text x="340" y="273" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">PETROL</text>
        <rect x="308" y="286" width="64" height="22" rx="4" fill="#3b82f6" opacity="0.9" />
        <text x="340" y="301" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">DIESEL</text>
        <circle cx="260" cy="170" r="24" fill="#f59e0b" />
        <text x="260" y="175" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">HP</text>
      </svg>
      <div style={{ position:"relative", zIndex:2, padding:"40px 44px", background:"linear-gradient(0deg,rgba(6,13,24,0.97),transparent)" }}>
        <h2 style={{ color:"#f1f5f9", fontSize:26, fontWeight:800, margin:"0 0 6px", letterSpacing:"-0.5px" }}>Shree K C Sarswat<br /><span style={{ color:"#f59e0b" }}>Auto Fuel Station</span></h2>
        <p style={{ color:"#475569", fontSize:13, margin:0, lineHeight:1.5 }}>3 Units · 7 Machines · HPCL Distributor · Lunkaransar, RJ</p>
      </div>
    </div>
    <div style={{ width:400, background:"#07111e", borderLeft:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", justifyContent:"center", padding:"44px 40px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ width:48, height:48, background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>⛽</div>
        <div><p style={{ color:"#f1f5f9", fontSize:15, fontWeight:800, margin:0 }}>KC Sarswat ERP</p><p style={{ color:"#475569", fontSize:11, margin:0 }}>Station Management System</p></div>
      </div>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Welcome back</h1>
      <p style={{ color:"#475569", fontSize:13, margin:"0 0 22px" }}>Sign in to your dashboard</p>
      <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:18, border:"1px solid rgba(255,255,255,0.07)" }}>
        {[["owner","👑 Owner"],["staff","👤 Staff"]].map(([r,l]) => (
          <button key={r} onClick={() => { setRole(r); setEmail(""); setPassword(""); setError(""); }} style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, background:role===r?"linear-gradient(135deg,#f59e0b,#d97706)":"transparent", color:role===r?"#fff":"#64748b" }}>{l}</button>
        ))}
      </div>
      <div style={{ marginBottom:14 }}>
        <Label>Email</Label>
        <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()} placeholder={role==="owner"?"owner@kcsarswat.in":"yournamekc@gmail.com"} style={{ ...S.inp, fontSize:14 }} />
      </div>
      <div style={{ marginBottom:18, position:"relative" }}>
        <Label>Password</Label>
        <input type={showPwd?"text":"password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()} style={{ ...S.inp, fontSize:14, paddingRight:44 }} />
        <button onClick={() => setShowPwd(!showPwd)} style={{ position:"absolute", right:12, top:34, background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:16, padding:4 }}>{showPwd?"🙈":"👁"}</button>
      </div>
      {error && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:14, color:"#f87171", fontSize:12, fontWeight:600 }}>⚠ {error}</div>}
      <button onClick={handleLogin} disabled={loading} style={{ width:"100%", background:loading?"rgba(245,158,11,0.4)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:12, padding:"14px 0", fontSize:14, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(245,158,11,0.35)" }}>
        {loading?"Signing in...":"Sign In →"}
      </button>
      <div style={{ marginTop:16, padding:"10px 14px", background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:10 }}>
        <p style={{ color:"#60a5fa", fontSize:10, fontWeight:700, margin:"0 0 4px" }}>STAFF LOGIN FORMAT</p>
        <p style={{ color:"#475569", fontSize:11, margin:0, lineHeight:1.7 }}>Email: <span style={{ color:"#93c5fd" }}>firstnamelastnameKC@gmail.com</span><br />Password: <span style={{ color:"#93c5fd" }}>firstnamelastname@123</span></p>
      </div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════════════
const Sidebar = ({ active, setActive, user, onLogout, collapsed, setCollapsed }) => {
  const ownerNav = [
    { id:"dashboard", label:"Dashboard",    icon:"📊" },
    { id:"sales",     label:"Sales Entry",  icon:"🧾" },
    { id:"stock",     label:"Stock",        icon:"📦" },
    { id:"supply",    label:"Fuel Supply",  icon:"🚛" },
    { id:"logistics", label:"Order Alerts", icon:"🔔" },
    { id:"expenses",  label:"Expenses",     icon:"💸" },
    { id:"staff",     label:"Staff",        icon:"👥" },
    { id:"transport", label:"Transport",    icon:"🚚" },
    { id:"reports",   label:"Reports",      icon:"📈" },
    { id:"settings",  label:"Settings",     icon:"⚙️" },
  ];
  const staffNav = [
    { id:"sales",  label:"Sales Entry", icon:"🧾" },
    { id:"stock",  label:"Stock",       icon:"📦" },
    { id:"supply", label:"Fuel Supply", icon:"🚛" },
  ];
  const nav = user.role === "owner" ? ownerNav : staffNav;
  return <div style={{ width:collapsed?64:224, background:"linear-gradient(180deg,#06111e,#08192a)", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", transition:"width 0.25s", overflow:"hidden", flexShrink:0, height:"100vh" }}>
    <div style={{ padding:collapsed?"16px 14px":"16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:34, height:34, background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>⛽</div>
      {!collapsed && <div><p style={{ color:"#f1f5f9", fontSize:12, fontWeight:800, margin:0, whiteSpace:"nowrap" }}>KC Sarswat</p><p style={{ color:"#334155", fontSize:10, margin:0 }}>Lunkaransar, RJ</p></div>}
      <button onClick={() => setCollapsed(!collapsed)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"#334155", fontSize:16, padding:4, flexShrink:0 }}>{collapsed?"›":"‹"}</button>
    </div>
    {!collapsed && <div style={{ margin:"8px 8px 0", padding:"8px 12px", background:user.role==="owner"?"rgba(245,158,11,0.08)":"rgba(59,130,246,0.08)", borderRadius:10, border:`1px solid ${user.role==="owner"?"rgba(245,158,11,0.15)":"rgba(59,130,246,0.15)"}` }}>
      <p style={{ color:user.role==="owner"?"#f59e0b":"#60a5fa", fontSize:10, fontWeight:700, margin:"0 0 2px", textTransform:"uppercase", letterSpacing:"0.5px" }}>{user.role==="owner"?"👑 Owner":"👤 Staff"}</p>
      <p style={{ color:"#64748b", fontSize:10, margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.name}</p>
    </div>}
    <nav style={{ flex:1, padding:"8px 6px", overflowY:"auto" }}>
      {nav.map(item => <button key={item.id} onClick={() => setActive(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, marginBottom:2, transition:"all 0.15s", background:active===item.id?"linear-gradient(135deg,rgba(245,158,11,0.16),rgba(217,119,6,0.08))":"transparent", color:active===item.id?"#f59e0b":"#475569", borderLeft:active===item.id?"2px solid #f59e0b":"2px solid transparent" }}>
        <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
        {!collapsed && <span style={{ whiteSpace:"nowrap" }}>{item.label}</span>}
      </button>)}
    </nav>
    <div style={{ padding:"8px 6px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
      <button onClick={onLogout} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:10, border:"none", cursor:"pointer", background:"rgba(239,68,68,0.08)", color:"#f87171", fontFamily:"inherit", fontSize:12, fontWeight:600 }}>
        <span style={{ fontSize:15 }}>🚪</span>{!collapsed && "Sign Out"}
      </button>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════
const Dashboard = ({ settings, tanks, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fbGet("sales").then(data => { setSalesData(data && data.length > 0 ? data : []); setLoading(false); });
  }, []);

  const daily = useMemo(() => {
    return Array.from({ length:7 }, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - (6-i));
      const ds = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("en-IN", { month:"short", day:"numeric" });
      let petrol=0, diesel=0;
      salesData.filter(s => s.date===ds).forEach(s => {
        if (s.readings) Object.values(s.readings).forEach(r => {
          const po=parseFloat(r.petrolOpen||0), pc=parseFloat(r.petrolClose||0);
          const dop=parseFloat(r.dieselOpen||0), dc=parseFloat(r.dieselClose||0);
          if (pc>po) petrol += pc-po;
          if (dc>dop) diesel += dc-dop;
        });
      });
      return { date:dayLabel, petrol:Math.round(petrol), diesel:Math.round(diesel) };
    });
  }, [salesData]);

  const today = daily[daily.length-1];
  const todayRevenue = today.petrol * settings.petrolPrice + today.diesel * settings.dieselPrice;

  const monthly = useMemo(() => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months.map(month => {
      const mIdx = months.indexOf(month);
      let petrol=0, diesel=0;
      salesData.filter(s => { const d = new Date(s.date); return d.getMonth()===mIdx; }).forEach(s => {
        if (s.readings) Object.values(s.readings).forEach(r => {
          const po=parseFloat(r.petrolOpen||0), pc=parseFloat(r.petrolClose||0);
          const dop=parseFloat(r.dieselOpen||0), dc=parseFloat(r.dieselClose||0);
          if (pc>po) petrol += pc-po;
          if (dc>dop) diesel += dc-dop;
        });
      });
      const profit = petrol*4.0 + diesel*2.5;
      return { month, petrol:Math.round(petrol), diesel:Math.round(diesel), profit:Math.round(profit), expenses:0 };
    });
  }, [salesData]);

  const hasData = salesData.length > 0;
  const noDataBox = <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 0", gap:8 }}>
    <span style={{ fontSize:36 }}>📭</span>
    <p style={{ color:"#475569", fontSize:13, margin:0 }}>No data yet — start entering sales</p>
  </div>;

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Owner Dashboard</h1>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>{new Date().toLocaleDateString("en-IN",{ weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
    {loading ? <div style={{ color:"#475569", textAlign:"center", padding:40 }}>⏳ Loading...</div> : <>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14, marginBottom:20 }}>
      <StatCard label="Petrol Today"   value={`${today.petrol.toLocaleString()} L`}          sub={`₹${(today.petrol*settings.petrolPrice).toLocaleString("en-IN",{maximumFractionDigits:0})}`} color="#f59e0b" icon="⛽" />
      <StatCard label="Diesel Today"   value={`${today.diesel.toLocaleString()} L`}           sub={`₹${(today.diesel*settings.dieselPrice).toLocaleString("en-IN",{maximumFractionDigits:0})}`} color="#3b82f6" icon="🔵" />
      <StatCard label="Total Litres"   value={`${(today.petrol+today.diesel).toLocaleString()} L`} sub="All units today" color="#10b981" icon="📦" />
      <StatCard label="Today Revenue"  value={`₹${todayRevenue.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub="Petrol + Diesel" color="#8b5cf6" icon="💰" />
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
      <div style={S.card}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Daily Sales — 7 Days</h3>
        {hasData
          ? <ResponsiveContainer width="100%" height={180}><BarChart data={daily} barSize={12}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="date" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f1f5f9", fontSize:11 }} /><Legend wrapperStyle={{ fontSize:11, color:"#64748b" }} /><Bar dataKey="petrol" name="Petrol (L)" fill="#f59e0b" radius={[5,5,0,0]} /><Bar dataKey="diesel" name="Diesel (L)" fill="#3b82f6" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer>
          : noDataBox}
      </div>
      <div style={S.card}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Monthly Sales</h3>
        {hasData
          ? <ResponsiveContainer width="100%" height={180}><BarChart data={monthly.filter(m => m.petrol>0||m.diesel>0)} barSize={12}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="month" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f1f5f9", fontSize:11 }} /><Legend wrapperStyle={{ fontSize:11, color:"#64748b" }} /><Bar dataKey="petrol" name="Petrol (L)" fill="#f59e0b" radius={[5,5,0,0]} /><Bar dataKey="diesel" name="Diesel (L)" fill="#3b82f6" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer>
          : noDataBox}
      </div>
    </div>
    <div style={S.card}><h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🛢 Live Tank Stock</h3><StockPanel tanks={tanks} settings={settings} unitConfig={uc} /></div>
    </>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SALES ENTRY — also auto-reduces tank stock on save
// ════════════════════════════════════════════════════════════════════════
const SalesView = ({ user, unitConfig, tanks, setTanks }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const allM = Object.entries(uc).flatMap(([uid,u]) => u.machines.map(id => ({ id, unit:uid })));
  const emptyR = allM.reduce((a,m) => ({ ...a, [m.id]:{ petrolOpen:"", petrolClose:"", dieselOpen:"", dieselClose:"" } }), {});
  const [date,setDate] = useState(TODAY), [shift,setShift] = useState("Day Shift");
  const [readings,setReadings] = useState(emptyR), [fe,setFe] = useState({});
  const [errors,setErrors] = useState([]), [saved,setSaved] = useState(false), [saving,setSaving] = useState(false);
  const locked = user.role==="staff" && !isWithin24h(date);
  const upd = (mId,field,val) => { setReadings(p => ({ ...p, [mId]:{ ...p[mId], [field]:val } })); setFe(p => ({ ...p, [mId+field]:"" })); };
  const calc = (o,c) => { const ov=parseFloat(o), cv=parseFloat(c); if(isNaN(ov)||isNaN(cv)) return null; if(cv<ov) return { error:"Closing<Opening" }; return { litres:(cv-ov).toFixed(2) }; };
  const validate = () => { const errs=[], nfe={}; allM.forEach(({ id:mId }) => { const r=readings[mId]; ["petrol","diesel"].forEach(f => { const o=r[`${f}Open`], c=r[`${f}Close`]; if(o===""&&c!=="") { errs.push(`Machine ${mId} ${f}: Opening missing`); nfe[mId+`${f}Open`]="Required"; } if(o!==""&&c==="") { errs.push(`Machine ${mId} ${f}: Closing missing`); nfe[mId+`${f}Close`]="Required"; } if(o!==""&&c!==""&&parseFloat(c)<parseFloat(o)) { errs.push(`Machine ${mId} ${f}: Closing<Opening`); nfe[mId+`${f}Close`]="Invalid"; } }); }); setFe(nfe); setErrors(errs); return errs.length===0; };

  const handleSave = async () => {
    if (locked || !validate()) return;
    setSaving(true);

    // Calculate total litres sold per unit per fuel type
    const unitSales = {};
    allM.forEach(({ id:mId, unit:uid }) => {
      const r = readings[mId];
      if (!unitSales[uid]) unitSales[uid] = { petrol:0, diesel:0 };
      const ps = calc(r.petrolOpen, r.petrolClose);
      const ds = calc(r.dieselOpen, r.dieselClose);
      if (ps?.litres) unitSales[uid].petrol += parseFloat(ps.litres);
      if (ds?.litres) unitSales[uid].diesel += parseFloat(ds.litres);
    });

    // Save sales record
    await fbAdd("sales", { date, shift, staffName:user.name, staffId:user.staffId||"owner", readings, savedAt:new Date().toISOString() });

    // Auto-reduce tank stock based on sales
    if (setTanks) {
      const updatedTanks = JSON.parse(JSON.stringify(tanks));
      Object.entries(unitSales).forEach(([uid, sold]) => {
        if (updatedTanks[uid]) {
          if (sold.petrol > 0) {
            updatedTanks[uid].petrol.current = Math.max(0, (updatedTanks[uid].petrol.current || 0) - sold.petrol);
          }
          if (sold.diesel > 0) {
            updatedTanks[uid].diesel.current = Math.max(0, (updatedTanks[uid].diesel.current || 0) - sold.diesel);
          }
        }
      });
      setTanks(updatedTanks);
      await fbSet("tanks", "main", updatedTanks);
    }

    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Sales Entry</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Enter meter readings{user.role==="staff" && <span style={{ color:"#f59e0b", marginLeft:6 }}>· Today only editable</span>}</p></div>
      {(saving||saved) && <SyncBadge syncing={saving} />}
    </div>
    {locked && <LockedBar />}
    <div style={{ ...S.card, background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.15)", marginBottom:16, padding:"12px 16px" }}>
      <p style={{ color:"#34d399", fontSize:12, fontWeight:700, margin:0 }}>ℹ️ Tank stock automatically reduces by litres sold when you save</p>
    </div>
    <div style={{ display:"flex", gap:12, marginBottom:18, flexWrap:"wrap" }}>
      <div><Label>Date</Label><input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={user.role==="staff"} style={{ ...S.inp, width:160 }} /></div>
      <div><Label>Shift</Label><select value={shift} onChange={e => setShift(e.target.value)} style={{ ...S.inp, width:160 }}>{SHIFTS.map(s => <option key={s} style={{ background:"#07111e" }}>{s}</option>)}</select></div>
    </div>
    <ErrBanner errors={errors} />
    <Toast msg={saved ? `✓ Sales saved & stock updated — ${date} · ${shift}` : null} />
    {Object.entries(uc).map(([uid,unit]) => (
      <div key={uid} style={{ ...S.card, marginBottom:14, opacity:locked?0.5:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
          <span style={{ fontSize:20 }}>⛽</span>
          <div><h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>{unit.name}</h3>{user.role==="owner" && <p style={{ color:"#475569", fontSize:11, margin:0 }}>Petrol ₹{unit.petrolMargin}/L · Diesel ₹{unit.dieselMargin}/L</p>}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:12 }}>
          {unit.machines.map(mId => {
            const r = readings[mId] || { petrolOpen:"", petrolClose:"", dieselOpen:"", dieselClose:"" };
            const ps=calc(r.petrolOpen,r.petrolClose), ds=calc(r.dieselOpen,r.dieselClose);
            const profit = user.role==="owner" ? ((ps?.litres?parseFloat(ps.litres)*unit.petrolMargin:0)+(ds?.litres?parseFloat(ds.litres)*unit.dieselMargin:0)) : 0;
            return <div key={mId} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:14 }}>
              <p style={{ color:"#475569", fontSize:12, fontWeight:700, margin:"0 0 10px" }}>MACHINE {mId}</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[{ label:"⛽ Petrol", ok:"petrolOpen", ck:"petrolClose", s:ps, c:"#f59e0b" },{ label:"🔵 Diesel", ok:"dieselOpen", ck:"dieselClose", s:ds, c:"#3b82f6" }].map(f => (
                  <div key={f.label}>
                    <p style={{ color:f.c, fontSize:12, fontWeight:700, margin:"0 0 6px" }}>{f.label}</p>
                    <div style={{ display:"flex", gap:6 }}>
                      <div style={{ flex:1 }}><label style={{ color:"#475569", fontSize:10, display:"block", marginBottom:2, fontWeight:600 }}>Opening</label><input type="number" placeholder="0.00" value={r[f.ok]} onChange={e => upd(mId,f.ok,e.target.value)} disabled={locked} style={fe[mId+f.ok]?S.inpErr:S.inp} /></div>
                      <div style={{ flex:1 }}><label style={{ color:"#475569", fontSize:10, display:"block", marginBottom:2, fontWeight:600 }}>Closing</label><input type="number" placeholder="0.00" value={r[f.ck]} onChange={e => upd(mId,f.ck,e.target.value)} disabled={locked} style={fe[mId+f.ck]?S.inpErr:S.inp} /></div>
                    </div>
                    {f.s?.litres && <p style={{ color:f.c, fontSize:11, margin:"4px 0 0", fontWeight:700 }}>{f.s.litres} L sold</p>}
                    {f.s?.error && <p style={{ color:"#f87171", fontSize:11, margin:"4px 0 0" }}>{f.s.error}</p>}
                  </div>
                ))}
              </div>
              {user.role==="owner" && profit>0 && <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(16,185,129,0.08)", borderRadius:8, border:"1px solid rgba(16,185,129,0.15)" }}><p style={{ color:"#34d399", fontSize:12, margin:0, fontWeight:700 }}>Est. Profit: ₹{profit.toFixed(2)}</p></div>}
            </div>;
          })}
        </div>
      </div>
    ))}
    <button onClick={handleSave} disabled={saving||locked} style={{ background:(saving||locked)?"rgba(245,158,11,0.4)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:12, padding:"13px 32px", fontSize:14, fontWeight:800, cursor:(saving||locked)?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8 }}>
      {saving?"Saving & updating stock...":"💾 Save Sales + Update Stock"}
    </button>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// STOCK
// ════════════════════════════════════════════════════════════════════════
const StockView = ({ tanks, settings, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Stock Management</h1>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>Live fuel tank levels · Stock auto-updates on sales &amp; supply entries</p>
    <div style={S.card}><StockPanel tanks={tanks} settings={settings} unitConfig={uc} /></div>
    <div style={{ ...S.card, marginTop:16 }}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Tank Summary</h3>
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:500 }}>
        <thead><tr>{["Unit","Fuel","Current (L)","Capacity (L)","Buffer (L)","Usable (L)","Fill %","Status"].map(h => <th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</th>)}</tr></thead>
        <tbody>{Object.entries(uc).flatMap(([uid,unit]) => [["petrol","Petrol","#f59e0b"],["diesel","Diesel","#3b82f6"]].map(([fk,fn,col]) => {
          const t=tanks[uid]?.[fk]; if(!t) return null;
          const usable=Math.max(0,(t.current||0)-(t.buffer||0));
          const pct=((t.current/t.capacity)*100).toFixed(1), low=usable<settings.lowStockAlert;
          return <tr key={uid+fk} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:600, padding:"10px 12px" }}>{unit.name}</td>
            <td style={{ padding:"10px 12px" }}><span style={{ color:col, fontSize:13, fontWeight:700 }}>{fn}</span></td>
            <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, padding:"10px 12px" }}>{(t.current||0).toLocaleString()}</td>
            <td style={{ color:"#64748b", fontSize:13, padding:"10px 12px" }}>{t.capacity.toLocaleString()}</td>
            <td style={{ color:"#ef4444", fontSize:13, padding:"10px 12px" }}>{(t.buffer||0).toLocaleString()}</td>
            <td style={{ color:"#34d399", fontSize:13, fontWeight:700, padding:"10px 12px" }}>{usable.toLocaleString()}</td>
            <td style={{ padding:"10px 12px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:60, height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}><div style={{ height:"100%", width:`${pct}%`, background:low?"#ef4444":col, borderRadius:3 }} /></div><span style={{ color:"#64748b", fontSize:12 }}>{pct}%</span></div></td>
            <td style={{ padding:"10px 12px" }}>{low?<span style={{ background:"rgba(239,68,68,0.12)", color:"#f87171", fontSize:10, padding:"3px 7px", borderRadius:4, fontWeight:700 }}>⚠ LOW</span>:<span style={{ background:"rgba(16,185,129,0.1)", color:"#34d399", fontSize:10, padding:"3px 7px", borderRadius:4, fontWeight:700 }}>OK</span>}</td>
          </tr>;
        }))}</tbody>
      </table></div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SUPPLY — auto-increases tank stock on save
// ════════════════════════════════════════════════════════════════════════
const SupplyView = ({ user, unitConfig, tanks, setTanks }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const ef = { date:TODAY, fuelType:"Petrol", unit:Object.keys(uc)[0]||"unit1", litres:"", truck:"", supplier:"HPCL" };
  const [supply,setSupply] = useState([]), [loading,setLoading] = useState(true), [show,setShow] = useState(false);
  const [editId,setEditId] = useState(null), [form,setForm] = useState(ef), [errors,setErrors] = useState([]);
  const [fe,setFe] = useState({}), [saved,setSaved] = useState(false), [saving,setSaving] = useState(false);
  useEffect(() => { fbGet("supply").then(data => { if(data&&data.length>0) setSupply(data.sort((a,b) => b.date.localeCompare(a.date))); setLoading(false); }); },[]);
  const canEdit = r => user.role==="owner" || isWithin24h(r.date);
  const validate = () => { const errs=[],nfe={}; if(!form.litres||parseFloat(form.litres)<=0){errs.push("Litres > 0 required");nfe.litres="Required";} if(!form.truck.trim()){errs.push("Truck number required");nfe.truck="Required";} if(!form.supplier.trim()){errs.push("Supplier required");nfe.supplier="Required";} setErrors(errs); setFe(nfe); return errs.length===0; };

  const add = async () => {
    if(!validate()) return;
    setSaving(true);
    const litresNum = parseFloat(form.litres);
    const entry = { ...form, litres:litresNum, savedAt:new Date().toISOString(), savedBy:user.name };

    if(editId) {
      const fbId = supply.find(s => s.id===editId)?._fbId;
      const oldEntry = supply.find(s => s.id===editId);
      if(fbId) await fbUpdate("supply", fbId, entry);
      setSupply(p => p.map(s => s.id===editId ? { ...s, ...entry } : s));

      // Adjust tank: remove old, add new
      if(setTanks && oldEntry) {
        const updatedTanks = JSON.parse(JSON.stringify(tanks));
        const fuelKey = (oldEntry.fuelType||"Petrol").toLowerCase();
        const uid = oldEntry.unit;
        if(updatedTanks[uid]?.[fuelKey]) {
          updatedTanks[uid][fuelKey].current = Math.min(
            updatedTanks[uid][fuelKey].capacity,
            Math.max(0, (updatedTanks[uid][fuelKey].current||0) - (oldEntry.litres||0) + litresNum)
          );
          setTanks(updatedTanks);
          await fbSet("tanks","main",updatedTanks);
        }
      }
    } else {
      const fbId = await fbAdd("supply", entry);
      setSupply(p => [{ ...entry, id:`s${Date.now()}`, _fbId:fbId }, ...p]);

      // Auto-increase tank stock
      if(setTanks) {
        const updatedTanks = JSON.parse(JSON.stringify(tanks));
        const fuelKey = form.fuelType.toLowerCase();
        const uid = form.unit;
        if(updatedTanks[uid]?.[fuelKey]) {
          updatedTanks[uid][fuelKey].current = Math.min(
            updatedTanks[uid][fuelKey].capacity,
            (updatedTanks[uid][fuelKey].current||0) + litresNum
          );
          setTanks(updatedTanks);
          await fbSet("tanks","main",updatedTanks);
        }
      }
    }

    setSaving(false); setEditId(null); setForm(ef); setShow(false); setErrors([]); setFe({});
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const startEdit = s => { setForm({ date:s.date, fuelType:s.fuelType, unit:s.unit, litres:String(s.litres), truck:s.truck, supplier:s.supplier }); setEditId(s.id); setShow(true); };
  const cancel = () => { setShow(false); setEditId(null); setForm(ef); setErrors([]); setFe({}); };

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Fuel Supply</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Tanker deliveries{user.role==="staff" && <span style={{ color:"#f59e0b", marginLeft:6 }}>· Staff: today only editable</span>}</p></div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>{(saving||saved) && <SyncBadge syncing={saving} />}<button onClick={() => { cancel(); setShow(true); }} style={{ ...S.btn() }}><span>+</span> Add Supply</button></div>
    </div>
    <div style={{ ...S.card, background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.15)", marginBottom:16, padding:"12px 16px" }}>
      <p style={{ color:"#34d399", fontSize:12, fontWeight:700, margin:0 }}>ℹ️ Adding supply automatically increases tank stock · Tank capacity is respected (cannot overflow)</p>
    </div>
    {loading && <div style={{ ...S.card, textAlign:"center", color:"#475569", padding:40 }}>⏳ Loading...</div>}
    <Toast msg={saved?"✅ Supply saved — tank stock increased ☁️":null} />
    {show && <div style={{ ...S.card, border:`1px solid ${editId?"rgba(59,130,246,0.3)":"rgba(245,158,11,0.2)"}`, marginBottom:16 }}>
      <h3 style={{ color:editId?"#60a5fa":"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>{editId?"Edit Entry":"New Supply"}</h3>
      <ErrBanner errors={errors} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label req>Date</Label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date:e.target.value }))} style={S.inp} /></div>
        <div><Label req>Unit</Label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit:e.target.value }))} style={S.inp}>{Object.entries(uc).map(([k,u]) => <option key={k} value={k} style={{ background:"#07111e" }}>{u.name}</option>)}</select></div>
        <div><Label req>Fuel</Label><select value={form.fuelType} onChange={e => setForm(p => ({ ...p, fuelType:e.target.value }))} style={S.inp}><option style={{ background:"#07111e" }}>Petrol</option><option style={{ background:"#07111e" }}>Diesel</option></select></div>
        <div><Label req>Litres</Label><input type="number" value={form.litres} onChange={e => { setForm(p => ({ ...p, litres:e.target.value })); setFe(p => ({ ...p, litres:"" })); }} style={fe.litres?S.inpErr:S.inp} /><FieldErr msg={fe.litres} /></div>
        <div><Label req>Truck No.</Label><input value={form.truck} onChange={e => { setForm(p => ({ ...p, truck:e.target.value })); setFe(p => ({ ...p, truck:"" })); }} placeholder="RJ-XX-XX-XXXX" style={fe.truck?S.inpErr:S.inp} /><FieldErr msg={fe.truck} /></div>
        <div><Label req>Supplier</Label><input value={form.supplier} onChange={e => { setForm(p => ({ ...p, supplier:e.target.value })); setFe(p => ({ ...p, supplier:"" })); }} style={fe.supplier?S.inpErr:S.inp} /><FieldErr msg={fe.supplier} /></div>
      </div>
      {form.litres && form.unit && form.fuelType && (
        <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10 }}>
          <p style={{ color:"#34d399", fontSize:12, fontWeight:700, margin:0 }}>
            📥 Will add {parseFloat(form.litres||0).toLocaleString()} L to {uc[form.unit]?.name} {form.fuelType} tank
            {tanks[form.unit]?.[form.fuelType.toLowerCase()] && ` · New level: ~${Math.min(tanks[form.unit][form.fuelType.toLowerCase()].capacity, (tanks[form.unit][form.fuelType.toLowerCase()].current||0)+parseFloat(form.litres||0)).toLocaleString()} L`}
          </p>
        </div>
      )}
      <div style={{ marginTop:14, display:"flex", gap:10 }}>
        <button onClick={add} disabled={saving} style={{ background:saving?"rgba(16,185,129,0.4)":editId?"linear-gradient(135deg,#3b82f6,#2563eb)":"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{saving?"Saving...":editId?"Update":"Save & Update Stock"}</button>
        <button onClick={cancel} style={S.ghostBtn}>Cancel</button>
      </div>
    </div>}
    <div style={S.card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Supply Records <span style={{ color:"#34d399", fontSize:10 }}>☁️</span></h3>
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:580 }}>
        <thead><tr>{["Date","Unit","Fuel","Litres","Truck","Supplier",""].map(h => <th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{supply.map(s => <tr key={s.id||s._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
          <td style={{ padding:"10px 10px" }}><span style={{ color:s.date===TODAY?"#f59e0b":"#64748b", fontSize:12, fontWeight:s.date===TODAY?700:400 }}>{s.date}{s.date===TODAY && <span style={{ marginLeft:6, background:"rgba(245,158,11,0.15)", color:"#f59e0b", fontSize:9, padding:"1px 5px", borderRadius:3, fontWeight:700 }}>TODAY</span>}</span></td>
          <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:600, padding:"10px 10px" }}>{uc[s.unit]?.name||s.unit}</td>
          <td style={{ padding:"10px 10px" }}><span style={{ color:s.fuelType==="Petrol"?"#f59e0b":"#3b82f6", fontSize:12, fontWeight:700 }}>{s.fuelType}</span></td>
          <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:700, padding:"10px 10px" }}>{s.litres?.toLocaleString()}L</td>
          <td style={{ color:"#64748b", fontSize:11, padding:"10px 10px", fontFamily:"monospace" }}>{s.truck}</td>
          <td style={{ color:"#64748b", fontSize:12, padding:"10px 10px" }}>{s.supplier}</td>
          <td style={{ padding:"10px 10px" }}>{canEdit(s)?<button onClick={() => startEdit(s)} style={{ background:"rgba(59,130,246,0.1)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.2)", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✏ Edit</button>:<span style={{ color:"#334155", fontSize:11 }}>🔒 Locked</span>}</td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// LOGISTICS / SMART ORDER ALERTS — advanced, redesigned UI
// ════════════════════════════════════════════════════════════════════════
const LogisticsView = ({ tanks, settings, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedFuel, setSelectedFuel] = useState("petrol");
  const [customAvg, setCustomAvg] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const minOrder = settings.minOrderLitres || 12000;
  const maxOrder = settings.maxOrderLitres || 23000;

  useEffect(() => {
    fbGet("sales").then(data => { setSalesData(data||[]); setLoadingSales(false); });
  }, []);

  // Usable stock (current - buffer) per selection
  const { usableStock, availableSpace, totalCapacity, totalCurrent } = useMemo(() => {
    const units = selectedUnit==="all" ? Object.keys(uc) : [selectedUnit];
    let usable=0, space=0, cap=0, cur=0;
    units.forEach(uid => {
      const t = tanks[uid]?.[selectedFuel]; if(!t) return;
      const buf = t.buffer||0;
      usable += Math.max(0, (t.current||0) - buf);
      space  += Math.max(0, t.capacity - (t.current||0));
      cap    += t.capacity;
      cur    += t.current||0;
    });
    return { usableStock:usable, availableSpace:space, totalCapacity:cap, totalCurrent:cur };
  }, [selectedUnit, selectedFuel, tanks, uc]);

  // 7-day daily sales history for trend analysis
  const { autoAvg, salesHistory7 } = useMemo(() => {
    if(!salesData.length) return { autoAvg:0, salesHistory7:[] };
    const hist = [];
    for(let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.toISOString().split("T")[0];
      let dayTotal = 0;
      salesData.filter(s => s.date===ds).forEach(s => {
        if(!s.readings) return;
        Object.entries(s.readings).forEach(([mId,r]) => {
          const mUnit = Object.entries(uc).find(([uid,u]) => (u.machines||[]).includes(mId))?.[0];
          if(selectedUnit!=="all" && mUnit!==selectedUnit) return;
          if(selectedFuel==="petrol") {
            const o=parseFloat(r.petrolOpen||0), c=parseFloat(r.petrolClose||0);
            if(c>o) dayTotal += c-o;
          } else {
            const o=parseFloat(r.dieselOpen||0), c=parseFloat(r.dieselClose||0);
            if(c>o) dayTotal += c-o;
          }
        });
      });
      hist.push(dayTotal);
    }
    const nonZero = hist.filter(v => v>0);
    const avg = nonZero.length>0 ? nonZero.reduce((a,b)=>a+b,0)/nonZero.length : hist.reduce((a,b)=>a+b,0)/7;
    return { autoAvg:avg, salesHistory7:hist };
  }, [salesData, selectedUnit, selectedFuel, uc]);

  const fallbackAvg = selectedFuel==="petrol" ? 820 : 1250;
  const avgSales = customAvg ? parseFloat(customAvg)||fallbackAvg : (autoAvg>0 ? autoAvg : fallbackAvg);
  const usingAutoAvg = !customAvg && autoAvg>0;

  const alert = useMemo(() =>
    computeOrderAlert(usableStock, avgSales, minOrder, maxOrder, availableSpace, salesHistory7),
    [usableStock, avgSales, minOrder, maxOrder, availableSpace, salesHistory7]
  );

  const fmtDt = dt => dt ? dt.toLocaleString("en-IN",{ weekday:"short", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const urgencyColor = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#f59e0b", LOW:"#34d399" };
  const urgencyBg    = { CRITICAL:"rgba(239,68,68,0.06)", HIGH:"rgba(249,115,22,0.06)", MEDIUM:"rgba(245,158,11,0.06)", LOW:"rgba(52,211,153,0.06)" };
  const urgencyEmoji = { CRITICAL:"🚨", HIGH:"⚠️", MEDIUM:"📋", LOW:"✅" };
  const urgencyMsg   = { CRITICAL:"Place order IMMEDIATELY", HIGH:"Order today", MEDIUM:"Plan order this week", LOW:"Stock is adequate" };

  const tb = (active) => ({
    padding:"8px 16px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700,
    background:active?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(255,255,255,0.06)",
    color:active?"#fff":"#64748b", transition:"all 0.15s"
  });

  // Trend chart data
  const trendData = salesHistory7.map((v,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    return { day:d.toLocaleDateString("en-IN",{ weekday:"short" }), sales:Math.round(v), avg:Math.round(avgSales) };
  });

  // Stock depletion projection for next 7 days
  const projectionData = Array.from({ length:8 }, (_,i) => {
    const projected = Math.max(0, usableStock - avgSales*i);
    const d = new Date(); d.setDate(d.getDate()+i);
    const label = i===0?"Now":`Day ${i}`;
    return { label, stock:Math.round(projected), threshold:settings.lowStockAlert };
  });

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>

    {/* Header */}
    <div style={{ marginBottom:20 }}>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🔔 Smart Order Planner</h1>
      <p style={{ color:"#64748b", fontSize:13, margin:0 }}>
        AI-powered supply optimiser · zero opportunity cost · 3-day advance forecasting
        {loadingSales && " · ⏳ Loading sales..."}
      </p>
    </div>

    {/* Step 1: Select unit + fuel */}
    <div style={{ ...S.card, marginBottom:16, background:"rgba(59,130,246,0.04)", border:"1px solid rgba(59,130,246,0.15)" }}>
      <p style={{ color:"#60a5fa", fontSize:11, fontWeight:700, margin:"0 0 10px", textTransform:"uppercase", letterSpacing:"0.6px" }}>Step 1 — Select what to analyse</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
        <div>
          <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px" }}>Unit</p>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {[["all","🏢 All Units"], ...Object.entries(uc).map(([k,u]) => [k,`⛽ ${u.name}`])].map(([v,l]) => <button key={v} onClick={() => setSelectedUnit(v)} style={tb(selectedUnit===v)}>{l}</button>)}
          </div>
        </div>
        <div>
          <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px" }}>Fuel Type</p>
          <div style={{ display:"flex", gap:5 }}>
            <button onClick={() => setSelectedFuel("petrol")} style={{ ...tb(selectedFuel==="petrol"), background:selectedFuel==="petrol"?"linear-gradient(135deg,#f59e0b,#d97706)":undefined }}>⛽ Petrol</button>
            <button onClick={() => setSelectedFuel("diesel")} style={{ ...tb(selectedFuel==="diesel"), background:selectedFuel==="diesel"?"linear-gradient(135deg,#3b82f6,#2563eb)":undefined }}>🔵 Diesel</button>
          </div>
        </div>
      </div>
    </div>

    {/* Step 2: Stock snapshot */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
      {[
        { label:"Tank Capacity",  value:`${totalCapacity.toLocaleString()} L`, sub:"Total installed", color:"#64748b", icon:"🏭" },
        { label:"Current Stock",  value:`${totalCurrent.toLocaleString()} L`,  sub:`${((totalCurrent/Math.max(totalCapacity,1))*100).toFixed(0)}% full`, color:"#3b82f6", icon:"🛢" },
        { label:"Usable Stock",   value:`${usableStock.toLocaleString()} L`,   sub:"After buffer deducted", color:"#f59e0b", icon:"✅" },
        { label:"Free Space",     value:`${availableSpace.toLocaleString()} L`, sub:"Can receive now", color:"#10b981", icon:"📥" },
        { label:"Avg Daily Sale", value:`${Math.round(avgSales).toLocaleString()} L`, sub:usingAutoAvg?"7-day real avg":"Manual override", color:"#8b5cf6", icon:"📊" },
        alert ? { label:"Days Left",  value:`${alert.daysLeft} days`, sub:alert.urgency==="CRITICAL"?"CRITICAL!":alert.urgency==="LOW"?"Healthy":alert.urgency, color:urgencyColor[alert.urgency], icon:urgencyEmoji[alert.urgency] } : null
      ].filter(Boolean).map(item => (
        <div key={item.label} style={{ background:"rgba(13,27,42,0.92)", border:`1px solid rgba(${item.color==="#f59e0b"?"245,158,11":item.color==="#3b82f6"?"59,130,246":item.color==="#10b981"?"16,185,129":item.color==="#8b5cf6"?"139,92,246":item.color==="#ef4444"?"239,68,68":"100,116,139"},0.2)`, borderRadius:14, padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:0, textTransform:"uppercase", letterSpacing:"0.5px" }}>{item.label}</p>
            <span style={{ fontSize:16 }}>{item.icon}</span>
          </div>
          <p style={{ color:"#f1f5f9", fontSize:20, fontWeight:800, margin:"0 0 2px" }}>{item.value}</p>
          <p style={{ color:item.color, fontSize:11, margin:0, fontWeight:600 }}>{item.sub}</p>
        </div>
      ))}
    </div>

    {/* Urgency Banner */}
    {alert && <div style={{ ...S.card, border:`2px solid ${urgencyColor[alert.urgency]}44`, background:urgencyBg[alert.urgency], marginBottom:16, padding:"16px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:`${urgencyColor[alert.urgency]}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, flexShrink:0 }}>{urgencyEmoji[alert.urgency]}</div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <span style={{ background:urgencyColor[alert.urgency], color:"#fff", fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:6 }}>{alert.urgency}</span>
            <h2 style={{ color:urgencyColor[alert.urgency], fontSize:17, fontWeight:800, margin:0 }}>{urgencyMsg[alert.urgency]}</h2>
          </div>
          <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>
            {alert.daysLeft} days of usable stock remaining · {Math.round(avgSales).toLocaleString()} L/day avg ·
            Runs out: <span style={{ color:urgencyColor[alert.urgency], fontWeight:700 }}>{fmtDt(alert.runsOut)}</span>
          </p>
        </div>
        {/* Radial-style countdown */}
        <div style={{ textAlign:"center", flexShrink:0, padding:"10px 16px", background:"rgba(0,0,0,0.3)", borderRadius:14 }}>
          <p style={{ color:urgencyColor[alert.urgency], fontSize:36, fontWeight:900, margin:0, lineHeight:1 }}>{alert.daysLeft}</p>
          <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:0, textTransform:"uppercase" }}>Days Left</p>
        </div>
      </div>
    </div>}

    {/* 3-Day Forecast + stock depletion chart */}
    {alert && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
      {/* 3-Day demand forecast */}
      <div style={{ ...S.card }}>
        <h3 style={{ color:"#a78bfa", fontSize:13, fontWeight:700, margin:"0 0 12px" }}>📅 3-Day Demand Forecast</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            { d:1, qty:alert.day1 },
            { d:2, qty:alert.day2 },
            { d:3, qty:alert.day3 },
          ].map(({ d, qty }) => {
            const dt = new Date(); dt.setDate(dt.getDate()+d);
            const stockAfter = Math.max(0, usableStock - qty*d);
            const pct = Math.min(100, (stockAfter / Math.max(usableStock,1))*100);
            const col = pct < 15 ? "#ef4444" : pct < 40 ? "#f97316" : pct < 70 ? "#f59e0b" : "#34d399";
            const isHoliday = INDIAN_HOLIDAYS.includes(dt.toISOString().split("T")[0]);
            const isSunday = dt.getDay()===0;
            return <div key={d} style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 14px", border:`1px solid ${col}33` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div>
                  <span style={{ color:"#f1f5f9", fontSize:12, fontWeight:700 }}>Day {d} — {dt.toLocaleDateString("en-IN",{ weekday:"short", month:"short", day:"numeric" })}</span>
                  {(isHoliday||isSunday) && <span style={{ marginLeft:6, background:"rgba(139,92,246,0.2)", color:"#a78bfa", fontSize:9, padding:"1px 6px", borderRadius:4, fontWeight:700 }}>HOLIDAY · Lower demand</span>}
                </div>
                <span style={{ color:"#f87171", fontSize:12, fontWeight:700 }}>−{qty.toLocaleString()} L</span>
              </div>
              <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:3, overflow:"hidden", marginBottom:4 }}>
                <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:3, transition:"width 0.5s" }} />
              </div>
              <p style={{ color:col, fontSize:11, margin:0, fontWeight:600 }}>Remaining after: {stockAfter.toLocaleString()} L</p>
            </div>;
          })}
        </div>
        <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:8 }}>
          <p style={{ color:"#a78bfa", fontSize:11, fontWeight:700, margin:0 }}>3-Day Total Need: {alert.forecastNeeded.toLocaleString()} L</p>
        </div>
      </div>

      {/* Sales trend + stock projection chart */}
      <div style={{ ...S.card }}>
        <h3 style={{ color:"#60a5fa", fontSize:13, fontWeight:700, margin:"0 0 12px" }}>📈 Stock Depletion Projection</h3>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={projectionData}>
            <defs>
              <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={urgencyColor[alert.urgency]} stopOpacity={0.25} />
                <stop offset="95%" stopColor={urgencyColor[alert.urgency]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f1f5f9", fontSize:11 }} formatter={(v,n) => [`${v.toLocaleString()} L`, n==="stock"?"Projected Stock":"Low Alert"]} />
            <Area type="monotone" dataKey="stock" name="stock" stroke={urgencyColor[alert.urgency]} fill="url(#stockGrad)" strokeWidth={2} dot={{ fill:urgencyColor[alert.urgency], r:3 }} />
            <Area type="monotone" dataKey="threshold" name="threshold" stroke="#ef4444" fill="none" strokeWidth={1} strokeDasharray="4 4" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <p style={{ color:"#475569", fontSize:10, margin:"4px 0 0", textAlign:"center" }}>Red dashed = low-stock threshold</p>
      </div>
    </div>}

    {/* Override avg + auto-avg info */}
    <div style={{ ...S.card, marginBottom:16 }}>
      <h3 style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, margin:"0 0 12px" }}>⚙️ Step 2 — Adjust Daily Average (optional)</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"flex-end" }}>
        <div>
          <Label>Override Daily Average (L/day)</Label>
          <input type="number" value={customAvg} onChange={e => setCustomAvg(e.target.value)}
            placeholder={`Auto-calculated: ${Math.round(autoAvg>0?autoAvg:fallbackAvg)} L/day from last 7 days`} style={S.inp} />
          <p style={{ color:"#475569", fontSize:11, margin:"5px 0 0" }}>
            {usingAutoAvg
              ? `✅ Using real Firebase data: ${Math.round(autoAvg)} L/day average over last 7 days`
              : customAvg ? `⚡ Manual override active: ${customAvg} L/day`
              : `⚠ No sales data — using estimated ${fallbackAvg} L/day default`}
          </p>
        </div>
        {customAvg && <button onClick={() => setCustomAvg("")} style={{ background:"rgba(239,68,68,0.1)", color:"#f87171", border:"1px solid rgba(239,68,68,0.2)", borderRadius:9, padding:"10px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>✕ Clear</button>}
      </div>
      {salesHistory7.some(v=>v>0) && <div style={{ marginTop:12 }}>
        <p style={{ color:"#64748b", fontSize:11, fontWeight:600, margin:"0 0 6px" }}>Last 7 Days Trend</p>
        <ResponsiveContainer width="100%" height={60}>
          <BarChart data={trendData} barSize={16}>
            <XAxis dataKey="day" tick={{ fill:"#475569", fontSize:9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#f1f5f9", fontSize:10 }} formatter={v => [`${v.toLocaleString()} L`,""]} />
            <Bar dataKey="sales" fill={selectedFuel==="petrol"?"#f59e0b":"#3b82f6"} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>}
    </div>

    {/* Perfect Order Recommendation */}
    {alert && <div style={{ ...S.card, border:"2px solid rgba(52,211,153,0.3)", background:"rgba(16,185,129,0.04)", marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <div style={{ width:48, height:48, background:"rgba(16,185,129,0.15)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🎯</div>
        <div>
          <h3 style={{ color:"#34d399", fontSize:15, fontWeight:800, margin:0 }}>Perfect Order Recommendation</h3>
          <p style={{ color:"#64748b", fontSize:12, margin:0 }}>Calculated to minimise both opportunity cost and dead capital</p>
        </div>
      </div>

      {/* Main recommendation */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
        {[
          { label:"7-Day Demand",      value:`${alert.sevenDayNeed.toLocaleString()} L`,   sub:"covers 7 days at avg pace",      color:"#94a3b8", big:false },
          { label:"Free Tank Space",   value:`${alert.availableSpace.toLocaleString()} L`, sub:"max you can physically receive", color:"#10b981", big:false },
          { label:"ORDER THIS MUCH",   value:`${alert.suggestedQty.toLocaleString()} L`,   sub:"optimised, zero overflow",       color:"#34d399", big:true  },
          { label:"Truck Required",    value:alert.truck.name.split("(")[0].trim(),         sub:`Capacity: ${alert.truck.capacity.toLocaleString()} L`, color:"#f59e0b", big:false },
        ].map(item => (
          <div key={item.label} style={{ background:item.big?"rgba(52,211,153,0.1)":"rgba(255,255,255,0.03)", borderRadius:12, padding:"14px 16px", border:item.big?"1px solid rgba(52,211,153,0.35)":"1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.5px" }}>{item.label}</p>
            <p style={{ color:item.color, fontSize:item.big?24:16, fontWeight:800, margin:"0 0 2px" }}>{item.value}</p>
            <p style={{ color:"#475569", fontSize:10, margin:0 }}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Opportunity Cost Analysis */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        {/* Over-order risk */}
        <div style={{ background:alert.overOrderRisk>0?"rgba(239,68,68,0.06)":"rgba(52,211,153,0.06)", border:`1px solid ${alert.overOrderRisk>0?"rgba(239,68,68,0.2)":"rgba(52,211,153,0.2)"}`, borderRadius:12, padding:"12px 14px" }}>
          <p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 6px", textTransform:"uppercase" }}>Over-Order Risk</p>
          {alert.overOrderRisk>0 ? <>
            <p style={{ color:"#f87171", fontSize:16, fontWeight:800, margin:"0 0 2px" }}>⚠ {alert.overOrderRisk.toLocaleString()} L</p>
            <p style={{ color:"#64748b", fontSize:11, margin:0 }}>Would overflow tank — capped to available space</p>
          </> : <>
            <p style={{ color:"#34d399", fontSize:16, fontWeight:800, margin:"0 0 2px" }}>✅ None</p>
            <p style={{ color:"#64748b", fontSize:11, margin:0 }}>Order fits within tank capacity</p>
          </>}
        </div>
        {/* Under-order risk */}
        <div style={{ background:alert.underOrderRisk>0?"rgba(245,158,11,0.06)":"rgba(52,211,153,0.06)", border:`1px solid ${alert.underOrderRisk>0?"rgba(245,158,11,0.2)":"rgba(52,211,153,0.2)"}`, borderRadius:12, padding:"12px 14px" }}>
          <p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 6px", textTransform:"uppercase" }}>3-Day Coverage Gap</p>
          {alert.underOrderRisk>0 ? <>
            <p style={{ color:"#f59e0b", fontSize:16, fontWeight:800, margin:"0 0 2px" }}>⚠ {alert.underOrderRisk.toLocaleString()} L</p>
            <p style={{ color:"#64748b", fontSize:11, margin:0 }}>3-day demand exceeds order — check tank space</p>
          </> : <>
            <p style={{ color:"#34d399", fontSize:16, fontWeight:800, margin:"0 0 2px" }}>✅ Covered</p>
            <p style={{ color:"#64748b", fontSize:11, margin:0 }}>Order fully covers next 3 days</p>
          </>}
        </div>
      </div>

      {/* Timing */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10, marginBottom:14 }}>
        {[
          { label:"📅 Stock Runs Out",    value:fmtDt(alert.runsOut),    color:urgencyColor[alert.urgency] },
          { label:"🕐 Must Leave By",     value:fmtDt(alert.mustLeaveBy), color:"#f59e0b" },
          { label:"🚛 Earliest Depart",   value:fmtDt(alert.departure),  color:"#3b82f6" },
        ].map(item => (
          <div key={item.label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 14px", border:"1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 4px", textTransform:"uppercase", letterSpacing:"0.4px" }}>{item.label}</p>
            <p style={{ color:item.color, fontSize:13, fontWeight:700, margin:0 }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Truck compartments */}
      <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:"12px 14px", border:"1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.5px" }}>🚛 {alert.truck.name} — Compartments</p>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {alert.truck.compartments.map((c,i) => <span key={i} style={{ background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:8, padding:"5px 12px", color:"#34d399", fontSize:13, fontWeight:700 }}>{(c/1000).toFixed(0)}K L</span>)}
        </div>
        {alert.truck.preferred && <p style={{ color:"#059669", fontSize:12, margin:"8px 0 0", fontWeight:600 }}>✓ Your preferred personal truck</p>}
      </div>

      {/* Logistics rules */}
      <div style={{ marginTop:12, background:"rgba(59,130,246,0.05)", border:"1px solid rgba(59,130,246,0.12)", borderRadius:10, padding:"10px 14px" }}>
        <p style={{ color:"#60a5fa", fontSize:11, fontWeight:700, margin:"0 0 4px" }}>📋 Rules Applied in This Calculation</p>
        <p style={{ color:"#475569", fontSize:11, margin:0, lineHeight:1.9 }}>
          • 7h travel each way · Depot closes 5:00 PM sharp<br />
          • No driving 11 PM – 6 AM · Closed Sundays &amp; Indian holidays<br />
          • Orders rounded to nearest 1,000 L · Min {minOrder.toLocaleString()} L · Max {maxOrder.toLocaleString()} L<br />
          • Buffer stock per-tank deducted before usable stock calculation<br />
          • Perfect order = 7-day demand, capped to available space — no overflow, no pump dryout
        </p>
      </div>
    </div>}

    {/* No alert state */}
    {!alert && <div style={{ ...S.card, textAlign:"center", padding:"50px 20px" }}>
      <p style={{ fontSize:42, margin:"0 0 12px" }}>✅</p>
      <p style={{ fontSize:16, fontWeight:800, color:"#34d399", margin:"0 0 6px" }}>Stock levels are healthy</p>
      <p style={{ fontSize:13, color:"#64748b", margin:"0 0 4px" }}>No action required right now</p>
      {usableStock===0 && <p style={{ fontSize:12, color:"#475569", marginTop:10 }}>→ Set current tank levels in <b style={{ color:"#f1f5f9" }}>Settings → Tanks</b> to enable alerts</p>}
    </div>}

    {/* Truck Reference */}
    <div style={{ ...S.card, marginTop:16 }}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🚛 Truck Reference Guide</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:10 }}>
        {TRUCK_TYPES.map(t => (
          <div key={t.id} style={{ background:t.preferred?"rgba(245,158,11,0.06)":"rgba(255,255,255,0.03)", border:`1px solid ${t.preferred?"rgba(245,158,11,0.3)":"rgba(255,255,255,0.07)"}`, borderRadius:12, padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <p style={{ color:t.preferred?"#f59e0b":"#f1f5f9", fontSize:13, fontWeight:700, margin:0 }}>{t.name}</p>
              {t.preferred && <span style={{ background:"rgba(245,158,11,0.15)", color:"#f59e0b", fontSize:9, padding:"2px 6px", borderRadius:4, fontWeight:700 }}>PREFERRED</span>}
            </div>
            <p style={{ color:"#475569", fontSize:11, margin:"0 0 6px" }}>Total: {t.capacity.toLocaleString()} L</p>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>{t.compartments.map((c,i) => <span key={i} style={{ background:"rgba(59,130,246,0.1)", color:"#60a5fa", fontSize:10, padding:"2px 6px", borderRadius:4, fontWeight:600 }}>{(c/1000).toFixed(0)}K</span>)}</div>
          </div>
        ))}
      </div>
    </div>

  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════════════════
const ExpensesView = ({ staffList }) => {
  const [expenses,setExpenses] = useState([]), [loading,setLoading] = useState(true), [show,setShow] = useState(false);
  const [form,setForm] = useState({ date:TODAY, category:"Cleaning", amount:"", note:"", custom:"" });
  const [errors,setErrors] = useState([]), [fe,setFe] = useState({}), [saved,setSaved] = useState(false), [saving,setSaving] = useState(false);
  useEffect(() => { fbGet("expenses").then(data => { if(data&&data.length>0) setExpenses(data.sort((a,b)=>b.date.localeCompare(a.date))); setLoading(false); }); },[]);
  const validate = () => { const errs=[],nfe={}; if(!form.amount||parseFloat(form.amount)<=0){errs.push("Amount required");nfe.amount="Required";} if(form.category==="Custom"&&!form.custom.trim()){errs.push("Custom category name required");nfe.custom="Required";} setErrors(errs); setFe(nfe); return errs.length===0; };
  const add = async () => { if(!validate()) return; setSaving(true); const entry = { ...form, amount:parseFloat(form.amount), category:form.category==="Custom"?form.custom:form.category, savedAt:new Date().toISOString() }; const fbId = await fbAdd("expenses",entry); setExpenses(p => [{ ...entry, id:fbId||`e${Date.now()}`, _fbId:fbId },...p]); setForm({ date:TODAY, category:"Cleaning", amount:"", note:"", custom:"" }); setShow(false); setErrors([]); setFe({}); setSaving(false); setSaved(true); setTimeout(() => setSaved(false),3000); };
  const total = expenses.reduce((a,e)=>a+(e.amount||0),0);
  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Expenses</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Operational costs</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge syncing={saving} />}<button onClick={() => setShow(!show)} style={{ ...S.btn("#ef4444") }}>+ Add Expense</button></div>
    </div>
    <StatCard label="Total Expenses" value={`₹${total.toLocaleString("en-IN")}`} sub={`${expenses.length} entries`} color="#ef4444" icon="💸" />
    <Toast msg={saved?"Expense saved ☁️":null} />
    {show&&<div style={{ ...S.card, border:"1px solid rgba(239,68,68,0.2)", marginTop:16, marginBottom:16 }}>
      <h3 style={{ color:"#f87171", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Expense</h3>
      <ErrBanner errors={errors} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label req>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={S.inp}/></div>
        <div><Label req>Category</Label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={S.inp}>{EXPENSE_CATS.map(c=><option key={c} style={{background:"#07111e"}}>{c}</option>)}</select></div>
        {form.category==="Custom"&&<div><Label req>Custom Name</Label><input value={form.custom} onChange={e=>{setForm(p=>({...p,custom:e.target.value}));setFe(p=>({...p,custom:""}));}} style={fe.custom?S.inpErr:S.inp}/><FieldErr msg={fe.custom}/></div>}
        <div><Label req>Amount ₹</Label><input type="number" value={form.amount} onChange={e=>{setForm(p=>({...p,amount:e.target.value}));setFe(p=>({...p,amount:""}));}} style={fe.amount?S.inpErr:S.inp}/><FieldErr msg={fe.amount}/></div>
        <div><Label>Note</Label><input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} style={S.inp}/></div>
      </div>
      <div style={{ marginTop:12, display:"flex", gap:10 }}><button onClick={add} disabled={saving} style={{ background:saving?"rgba(239,68,68,0.4)":"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{saving?"Saving...":"Save"}</button><button onClick={()=>setShow(false)} style={S.ghostBtn}>Cancel</button></div>
    </div>}
    {loading&&<div style={{...S.card,textAlign:"center",color:"#475569",padding:30,marginTop:14}}>⏳ Loading...</div>}
    <div style={{...S.card,marginTop:16}}>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:420}}>
        <thead><tr>{["Date","Category","Amount","Note"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{expenses.map(e=><tr key={e.id||e._fbId} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
          <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{e.date}</td>
          <td style={{color:"#f1f5f9",fontSize:12,fontWeight:700,padding:"10px 10px"}}>{e.category}</td>
          <td style={{color:"#f87171",fontSize:13,fontWeight:800,padding:"10px 10px"}}>₹{(e.amount||0).toLocaleString("en-IN")}</td>
          <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{e.note||"—"}</td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// STAFF
// ════════════════════════════════════════════════════════════════════════
const StaffView = ({ staffList, setStaffList, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const [showForm,setShowForm] = useState(false), [showTransfer,setShowTransfer] = useState(null), [transferUnit,setTransferUnit] = useState(Object.keys(uc)[0]);
  const [showPwdEdit,setShowPwdEdit] = useState(null), [newPwd,setNewPwd] = useState(""), [pwdSaved,setPwdSaved] = useState(false);
  const [errors,setErrors] = useState([]), [fe,setFe] = useState({}), [saving,setSaving] = useState(false);
  const [form,setForm] = useState({ name:"", role:"Pump Operator", salary:"", joining:TODAY, unit:Object.keys(uc)[0]||"unit1" });
  useEffect(() => { fbGet("staff").then(data => { if(data&&data.length>0) setStaffList(data.map(s=>({...s,id:s.id||s._fbId}))); }); },[]);
  const validate = () => { const errs=[],nfe={}; if(!form.name.trim()){errs.push("Name required");nfe.name="Required";} if(!form.salary||parseFloat(form.salary)<=0){errs.push("Salary required");nfe.salary="Required";} if(!form.role.trim()){errs.push("Role required");nfe.role="Required";} setErrors(errs); setFe(nfe); return errs.length===0; };
  const addStaff = async () => { if(!validate()) return; setSaving(true); const nm={ name:form.name, role:form.role, salary:parseFloat(form.salary), joining:form.joining, unit:form.unit, active:true, password:makeStaffPassword(form.name) }; const fbId=await fbAdd("staff",nm); setStaffList(p=>[...p,{...nm,id:fbId||`s${Date.now()}`,_fbId:fbId}]); setSaving(false); setForm({name:"",role:"Pump Operator",salary:"",joining:TODAY,unit:Object.keys(uc)[0]}); setShowForm(false); setErrors([]); setFe({}); };
  const toggle = async id => { const s=staffList.find(x=>x.id===id); if(!s) return; if(s._fbId) await fbUpdate("staff",s._fbId,{active:!s.active}); setStaffList(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x)); };
  const remove = async id => { const s=staffList.find(x=>x.id===id); if(s?._fbId) await fbDelete("staff",s._fbId); setStaffList(p=>p.filter(x=>x.id!==id)); };
  const doTransfer = async id => { const s=staffList.find(x=>x.id===id); if(s?._fbId) await fbUpdate("staff",s._fbId,{unit:transferUnit}); setStaffList(p=>p.map(x=>x.id===id?{...x,unit:transferUnit}:x)); setShowTransfer(null); };
  const savePwd = async id => { if(!newPwd.trim()) return; const s=staffList.find(x=>x.id===id); if(s?._fbId) await fbUpdate("staff",s._fbId,{password:newPwd.trim()}); setStaffList(p=>p.map(x=>x.id===id?{...x,password:newPwd.trim()}:x)); setShowPwdEdit(null); setNewPwd(""); setPwdSaved(true); setTimeout(()=>setPwdSaved(false),3000); };
  const total = staffList.filter(s=>s.active).reduce((a,s)=>a+(s.salary||0),0);
  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Staff Management</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Owner only</p></div>
      <button onClick={() => setShowForm(!showForm)} style={{ ...S.btn() }}>+ Add Staff</button>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
      <StatCard label="Active Staff" value={staffList.filter(s=>s.active).length} sub={`${staffList.filter(s=>!s.active).length} inactive`} color="#10b981" icon="👥" />
      <StatCard label="Monthly Payroll" value={`₹${total.toLocaleString("en-IN")}`} sub="Active only" color="#ef4444" icon="💸" />
    </div>
    <Toast msg={pwdSaved?"Password updated ☁️":null} />
    {showForm&&<div style={{ ...S.card, border:"1px solid rgba(245,158,11,0.2)", marginBottom:16 }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 8px" }}>Add New Staff</h3>
      {form.name&&<div style={{ marginBottom:10, padding:"8px 12px", background:"rgba(59,130,246,0.08)", borderRadius:8 }}><p style={{ color:"#60a5fa", fontSize:11, margin:0 }}>Login: <b>{makeStaffEmail(form.name)}</b> · Password: <b>{makeStaffPassword(form.name)}</b></p></div>}
      <ErrBanner errors={errors} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label req>Full Name</Label><input value={form.name} onChange={e=>{setForm(p=>({...p,name:e.target.value}));setFe(p=>({...p,name:""}));}} style={fe.name?S.inpErr:S.inp}/><FieldErr msg={fe.name}/></div>
        <div><Label req>Role</Label><input value={form.role} onChange={e=>{setForm(p=>({...p,role:e.target.value}));setFe(p=>({...p,role:""}));}} style={fe.role?S.inpErr:S.inp}/></div>
        <div><Label req>Salary</Label><input type="number" value={form.salary} onChange={e=>{setForm(p=>({...p,salary:e.target.value}));setFe(p=>({...p,salary:""}));}} style={fe.salary?S.inpErr:S.inp}/><FieldErr msg={fe.salary}/></div>
        <div><Label>Joining Date</Label><input type="date" value={form.joining} onChange={e=>setForm(p=>({...p,joining:e.target.value}))} style={S.inp}/></div>
        <div><Label>Unit</Label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={S.inp}>{Object.entries(uc).map(([k,u])=><option key={k} value={k} style={{background:"#07111e"}}>{u.name}</option>)}</select></div>
      </div>
      <div style={{ marginTop:12, display:"flex", gap:10 }}><button onClick={addStaff} disabled={saving} style={{ background:saving?"rgba(16,185,129,0.4)":"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{saving?"Saving...":"Save"}</button><button onClick={()=>setShowForm(false)} style={S.ghostBtn}>Cancel</button></div>
    </div>}
    {showTransfer&&<div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div style={{ ...S.card, border:"1px solid rgba(245,158,11,0.3)", width:340 }}>
        <h3 style={{ color:"#f59e0b", fontSize:15, fontWeight:700, margin:"0 0 12px" }}>Transfer Staff</h3>
        <p style={{ color:"#64748b", fontSize:13, margin:"0 0 12px" }}>Move <b style={{ color:"#f1f5f9" }}>{staffList.find(s=>s.id===showTransfer)?.name}</b> to:</p>
        <div><Label>New Unit</Label><select value={transferUnit} onChange={e=>setTransferUnit(e.target.value)} style={S.inp}>{Object.entries(uc).map(([k,u])=><option key={k} value={k} style={{background:"#07111e"}}>{u.name}</option>)}</select></div>
        <div style={{ marginTop:14, display:"flex", gap:10 }}><button onClick={()=>doTransfer(showTransfer)} style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Transfer</button><button onClick={()=>setShowTransfer(null)} style={S.ghostBtn}>Cancel</button></div>
      </div>
    </div>}
    {showPwdEdit&&<div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
      <div style={{ ...S.card, border:"1px solid rgba(139,92,246,0.3)", width:360 }}>
        <h3 style={{ color:"#a78bfa", fontSize:15, fontWeight:700, margin:"0 0 8px" }}>Change Password</h3>
        <p style={{ color:"#475569", fontSize:13, margin:"0 0 12px" }}>For: <b style={{ color:"#f1f5f9" }}>{staffList.find(s=>s.id===showPwdEdit)?.name}</b></p>
        <div style={{ marginBottom:14 }}><Label req>New Password</Label><input value={newPwd} onChange={e=>setNewPwd(e.target.value)} style={S.inp}/></div>
        <div style={{ display:"flex", gap:10 }}><button onClick={()=>savePwd(showPwdEdit)} style={{ background:"linear-gradient(135deg,#8b5cf6,#7c3aed)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Save</button><button onClick={()=>{setShowPwdEdit(null);setNewPwd("");}} style={S.ghostBtn}>Cancel</button></div>
      </div>
    </div>}
    {Object.entries(uc).map(([uid,unit]) => {
      const us = staffList.filter(s=>s.unit===uid); if(!us.length) return null;
      return <div key={uid} style={{ marginBottom:20 }}>
        <h3 style={{ color:"#f59e0b", fontSize:12, fontWeight:700, margin:"0 0 10px", letterSpacing:"0.6px", textTransform:"uppercase" }}>⛽ {unit.name} — {us.length} staff</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:12 }}>
          {us.map(s => <div key={s.id} style={{ ...S.card, border:`1px solid ${s.active?"rgba(16,185,129,0.16)":"rgba(255,255,255,0.05)"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:40, height:40, background:s.active?"rgba(16,185,129,0.12)":"rgba(100,116,139,0.08)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{s.active?"👤":"👻"}</div>
                <div><p style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>{s.name}</p><p style={{ color:"#475569", fontSize:12, margin:"2px 0 0" }}>{s.role}</p></div>
              </div>
              <span style={{ background:s.active?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color:s.active?"#34d399":"#f87171", fontSize:10, padding:"3px 9px", borderRadius:5, fontWeight:700 }}>{s.active?"Active":"Inactive"}</span>
            </div>
            <div style={{ marginBottom:10, padding:"6px 10px", background:"rgba(59,130,246,0.06)", borderRadius:8 }}><p style={{ color:"#60a5fa", fontSize:10, margin:0, fontFamily:"monospace" }}>{makeStaffEmail(s.name)}</p></div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderTop:"1px solid rgba(255,255,255,0.04)" }}><span style={{ color:"#475569", fontSize:12 }}>Salary</span><span style={{ color:"#f59e0b", fontSize:14, fontWeight:800 }}>₹{(s.salary||0).toLocaleString("en-IN")}</span></div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", marginBottom:10, borderBottom:"1px solid rgba(255,255,255,0.04)" }}><span style={{ color:"#475569", fontSize:12 }}>Joined</span><span style={{ color:"#64748b", fontSize:12 }}>{new Date(s.joining).toLocaleDateString("en-IN")}</span></div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <button onClick={() => { setShowTransfer(s.id); setTransferUnit(s.unit); }} style={{ flex:1, minWidth:70, background:"rgba(245,158,11,0.08)", color:"#f59e0b", border:"1px solid rgba(245,158,11,0.2)", borderRadius:8, padding:"7px 0", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>⇄ Transfer</button>
              <button onClick={() => { setShowPwdEdit(s.id); setNewPwd(s.password||""); }} style={{ flex:1, minWidth:70, background:"rgba(139,92,246,0.08)", color:"#a78bfa", border:"1px solid rgba(139,92,246,0.2)", borderRadius:8, padding:"7px 0", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🔑 Pwd</button>
              <button onClick={() => toggle(s.id)} style={{ flex:1, minWidth:70, background:s.active?"rgba(239,68,68,0.07)":"rgba(16,185,129,0.07)", color:s.active?"#f87171":"#34d399", border:`1px solid ${s.active?"rgba(239,68,68,0.2)":"rgba(16,185,129,0.2)"}`, borderRadius:8, padding:"7px 0", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{s.active?"Deactivate":"Activate"}</button>
              <button onClick={() => remove(s.id)} style={{ background:"rgba(239,68,68,0.07)", color:"#f87171", border:"1px solid rgba(239,68,68,0.15)", borderRadius:8, padding:"7px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
            </div>
          </div>)}
        </div>
      </div>;
    })}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// TRANSPORT
// ════════════════════════════════════════════════════════════════════════
const TransportView = () => {
  const [trips,setTrips] = useState([]), [loading,setLoading] = useState(true), [show,setShow] = useState(false);
  const [errors,setErrors] = useState([]), [fe,setFe] = useState({}), [saved,setSaved] = useState(false), [saving,setSaving] = useState(false);
  const [form,setForm] = useState({ date:TODAY, truck:"", km:"", rate:"28", driverPay:"", diesel:"", loading:"", unloading:"" });
  useEffect(() => { fbGet("transport").then(data => { if(data&&data.length>0) setTrips(data.sort((a,b)=>b.date.localeCompare(a.date))); setLoading(false); }); },[]);
  const calcP = t => (parseFloat(t.km||0)*parseFloat(t.rate||0))-((parseFloat(t.driverPay||0)+parseFloat(t.diesel||0)+parseFloat(t.loading||0)+parseFloat(t.unloading||0)));
  const tInc=trips.reduce((s,t)=>s+(t.km*t.rate||0),0), tExp=trips.reduce((s,t)=>s+((t.driverPay||0)+(t.diesel||0)+(t.loading||0)+(t.unloading||0)),0);
  const validate = () => { const errs=[],nfe={}; if(!form.truck.trim()){errs.push("Truck number required");nfe.truck="Required";} if(!form.km||parseFloat(form.km)<=0){errs.push("KM > 0 required");nfe.km="Required";} if(!form.rate||parseFloat(form.rate)<=0){errs.push("Rate required");nfe.rate="Required";} setErrors(errs); setFe(nfe); return errs.length===0; };
  const add = async () => { if(!validate()) return; setSaving(true); const entry={ ...form, km:parseFloat(form.km), rate:parseFloat(form.rate), driverPay:parseFloat(form.driverPay||0), diesel:parseFloat(form.diesel||0), loading:parseFloat(form.loading||0), unloading:parseFloat(form.unloading||0), savedAt:new Date().toISOString() }; const fbId=await fbAdd("transport",entry); setTrips(p=>[{...entry,id:fbId||`t${Date.now()}`,_fbId:fbId},...p]); setForm({date:TODAY,truck:"",km:"",rate:"28",driverPay:"",diesel:"",loading:"",unloading:""}); setShow(false); setErrors([]); setFe({}); setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000); };
  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Transport Income</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Pump ↔ Depot trips</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge syncing={saving} />}<button onClick={() => { setShow(!show); setErrors([]); setFe({}); }} style={{ ...S.btn("#8b5cf6") }}>+ Add Trip</button></div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:20 }}>
      <StatCard label="Total Income"   value={`₹${tInc.toLocaleString("en-IN")}`} sub={`${trips.length} trips`} color="#8b5cf6" icon="🚚" />
      <StatCard label="Total Expenses" value={`₹${tExp.toLocaleString("en-IN")}`} color="#ef4444" icon="💸" />
      <StatCard label="Net Profit"     value={`₹${(tInc-tExp).toLocaleString("en-IN")}`} color="#10b981" icon="💰" />
    </div>
    {loading&&<div style={{...S.card,textAlign:"center",color:"#475569",padding:30,marginBottom:14}}>⏳ Loading...</div>}
    <Toast msg={saved?"Trip saved ☁️":null} />
    {show&&<div style={{ ...S.card, border:"1px solid rgba(139,92,246,0.25)", marginBottom:16 }}>
      <h3 style={{ color:"#a78bfa", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Trip</h3>
      <ErrBanner errors={errors} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
        {[["Date","date","date"],["Truck No.","truck","text"],["Distance KM","km","number"],["Rate/KM ₹","rate","number"],["Driver Pay","driverPay","number"],["Diesel Cost","diesel","number"],["Loading ₹","loading","number"],["Unloading ₹","unloading","number"]].map(([l,k,t]) => (
          <div key={k}><Label>{l}</Label><input type={t} value={form[k]} onChange={e=>{setForm(p=>({...p,[k]:e.target.value}));setFe(p=>({...p,[k]:""}));}} style={fe[k]?S.inpErr:S.inp}/><FieldErr msg={fe[k]}/></div>
        ))}
      </div>
      {form.km&&form.rate&&<div style={{ marginTop:10, padding:"8px 12px", background:"rgba(139,92,246,0.08)", borderRadius:8 }}><span style={{ color:"#a78bfa", fontSize:13, fontWeight:700 }}>Est. Profit: ₹{calcP(form).toLocaleString("en-IN")}</span></div>}
      <div style={{ marginTop:12, display:"flex", gap:10 }}><button onClick={add} disabled={saving} style={{ background:saving?"rgba(139,92,246,0.4)":"linear-gradient(135deg,#8b5cf6,#7c3aed)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{saving?"Saving...":"Save"}</button><button onClick={()=>{setShow(false);setErrors([]);setFe({});}} style={S.ghostBtn}>Cancel</button></div>
    </div>}
    <div style={S.card}><div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
      <thead><tr>{["Date","Truck","KM","Income","Expenses","Profit"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
      <tbody>{trips.map(t => {
        const inc=t.km*t.rate, exp=(t.driverPay||0)+(t.diesel||0)+(t.loading||0)+(t.unloading||0), p=inc-exp;
        return <tr key={t.id||t._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
          <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{t.date}</td>
          <td style={{color:"#f1f5f9",fontSize:12,fontFamily:"monospace",fontWeight:700,padding:"10px 10px"}}>{t.truck}</td>
          <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{t.km}km</td>
          <td style={{color:"#a78bfa",fontSize:13,fontWeight:700,padding:"10px 10px"}}>₹{inc.toLocaleString("en-IN")}</td>
          <td style={{color:"#f87171",fontSize:13,padding:"10px 10px"}}>₹{exp.toLocaleString("en-IN")}</td>
          <td style={{padding:"10px 10px"}}><span style={{color:p>=0?"#34d399":"#f87171",fontSize:13,fontWeight:800}}>₹{p.toLocaleString("en-IN")}</span></td>
        </tr>;
      })}</tbody>
    </table></div></div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════════════════════
const ReportsView = ({ unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const monthly = useMemo(genMonthly,[]);
  const [tab,setTab] = useState("summary"), [unitFilter,setUnitFilter] = useState("all");
  const tb = a => ({ padding:"7px 14px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, background:tab===a?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(255,255,255,0.05)", color:tab===a?"#fff":"#64748b" });
  const ub = a => ({ padding:"6px 12px", borderRadius:7, border:`1px solid ${unitFilter===a?"rgba(59,130,246,0.3)":"transparent"}`, cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700, background:unitFilter===a?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.04)", color:unitFilter===a?"#60a5fa":"#64748b" });
  const unitLabel = unitFilter==="all"?"All Units Combined":uc[unitFilter]?.name;
  const pl = { revenue:0, cost:0, gross:0, opex:0, ebitda:0, dep:0, ebit:0, tax:0, net:0 };
  const adj = (v) => unitFilter==="all"?v:Math.round(v/3);
  const exportCSV = (type) => {
    let csv = "";
    if(type==="pl") csv=`Trading P&L — ${unitLabel}\n\nParticulars,Amount (₹)\nRevenue from Operations,${adj(pl.revenue)}\nCost of Goods Sold,(${adj(pl.cost)})\nGross Profit,${adj(pl.gross)}\nOperating Expenses,(${adj(pl.opex)})\nEBITDA,${adj(pl.ebitda)}\nDepreciation,(${adj(pl.dep)})\nEBIT,${adj(pl.ebit)}\nTax 25%,(${adj(pl.tax)})\nNet Profit,${adj(pl.net)}\n`;
    else if(type==="balance") csv=`Balance Sheet — ${unitLabel}\n\nASSETS,Amount\nInventory,340000\nCash,285000\nReceivables,62000\nFixed Assets,1355000\nTotal,1957000\n\nLIABILITIES,Amount\nOwner Equity,1132000\nTerm Loans,450000\nTrade Payables,145000\nOther,230000\nTotal,1957000\n`;
    else csv=`Lubricant Sales — ${unitLabel}\n\nNo data yet.\n`;
    const blob=new Blob([csv],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${type}-${unitFilter}-${TODAY}.csv`; a.click();
  };
  const r = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Reports & Analytics</h1>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 18px" }}>Owner access — ICAI-aligned statements · Export CSV</p>
    <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
      <span style={{ color:"#64748b", fontSize:11, fontWeight:600 }}>Filter:</span>
      {[["all","All Units"],...Object.entries(uc).map(([k,u])=>[k,u.name])].map(([v,l])=><button key={v} onClick={()=>setUnitFilter(v)} style={ub(v)}>{l}</button>)}
    </div>
    <div style={{ display:"flex", gap:4, marginBottom:16, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:4, border:"1px solid rgba(255,255,255,0.06)", flexWrap:"wrap" }}>
      {[["summary","📊 Summary"],["pl","📈 P&L"],["balance","🏦 Balance Sheet"],["lubricants","🛢 Lubricants"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={tb(k)}>{l}</button>)}
    </div>
    <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
      <span style={{ color:"#64748b", fontSize:11, fontWeight:600 }}>Export CSV:</span>
      {[["pl","P&L"],["balance","Balance Sheet"],["lubricants","Lubricants"]].map(([t,l])=><button key={t} onClick={()=>exportCSV(t)} style={{ background:"rgba(16,185,129,0.1)", color:"#34d399", border:"1px solid rgba(16,185,129,0.25)", borderRadius:8, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>⬇ {l}</button>)}
      <span style={{ color:"#475569", fontSize:10 }}>For PDF: Ctrl+P → Save as PDF</span>
    </div>
    {tab==="summary"&&<>
      <div style={{ ...S.card, marginBottom:16 }}><h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Revenue vs Expenses — {unitLabel}</h3><ResponsiveContainer width="100%" height={230}><BarChart data={monthly} barSize={18}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="month" tick={{fill:"#475569",fontSize:11}} axisLine={false} tickLine={false} /><YAxis tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{background:"#0a1628",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#f1f5f9",fontSize:11}} formatter={v=>[`₹${v.toLocaleString("en-IN")}`,""]} /><Legend wrapperStyle={{fontSize:11,color:"#64748b"}} /><Bar dataKey="profit" name="Gross Profit" fill="#10b981" radius={[5,5,0,0]} /><Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div>
      <div style={S.card}><h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Monthly Summary</h3><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Month","Petrol(L)","Diesel(L)","Gross Profit","Expenses","Net Profit"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{monthly.map(m=>{const net=m.profit-m.expenses;return <tr key={m.month} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}><td style={{color:"#f1f5f9",fontSize:13,fontWeight:700,padding:"10px 10px"}}>{m.month}</td><td style={{color:"#f59e0b",fontSize:13,padding:"10px 10px"}}>{m.petrol.toLocaleString()}</td><td style={{color:"#3b82f6",fontSize:13,padding:"10px 10px"}}>{m.diesel.toLocaleString()}</td><td style={{color:"#34d399",fontSize:13,fontWeight:700,padding:"10px 10px"}}>₹{m.profit.toLocaleString("en-IN")}</td><td style={{color:"#f87171",fontSize:13,padding:"10px 10px"}}>₹{m.expenses.toLocaleString("en-IN")}</td><td style={{padding:"10px 10px"}}><span style={{color:net>=0?"#34d399":"#f87171",fontSize:13,fontWeight:800}}>₹{net.toLocaleString("en-IN")}</span></td></tr>;})} </tbody></table></div>
    </>}
    {tab==="pl"&&<div style={S.card}>
      <h3 style={{ color:"#f1f5f9", fontSize:16, fontWeight:800, margin:"0 0 4px" }}>Trading & Profit & Loss Account</h3>
      <p style={{ color:"#64748b", fontSize:12, margin:"0 0 18px" }}>{unitLabel} · FY 2025–26 · As per ICAI (AS-9, AS-26)</p>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><th style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"10px 14px",borderBottom:"2px solid rgba(255,255,255,0.1)",textTransform:"uppercase"}}>Particulars</th><th style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"right",padding:"10px 14px",borderBottom:"2px solid rgba(255,255,255,0.1)",textTransform:"uppercase"}}>Amount (₹)</th></tr></thead>
        <tbody>{[
          {l:"I. Revenue from Operations",v:r(adj(pl.revenue)),bold:true,c:"#f1f5f9"},
          {l:"II. Cost of Goods Sold",v:`(${r(adj(pl.cost))})`,c:"#f87171"},
          {l:"III. Gross Profit",v:r(adj(pl.gross)),bold:true,c:"#34d399",border:true},
          {l:"IV. Operating Expenses",v:`(${r(adj(pl.opex))})`,c:"#f87171"},
          {l:"   - Staff Salaries",v:r(adj(Math.round(pl.opex*0.55))),small:true,c:"#64748b"},
          {l:"   - Electricity & Utilities",v:r(adj(Math.round(pl.opex*0.2))),small:true,c:"#64748b"},
          {l:"   - Maintenance",v:r(adj(Math.round(pl.opex*0.25))),small:true,c:"#64748b"},
          {l:"V. EBITDA",v:r(adj(pl.ebitda)),bold:true,c:"#f59e0b",border:true},
          {l:"VI. Depreciation",v:`(${r(adj(pl.dep))})`,c:"#f87171"},
          {l:"VII. EBIT",v:r(adj(pl.ebit)),bold:true,c:"#f59e0b"},
          {l:"VIII. Tax @ 25%",v:`(${r(adj(pl.tax))})`,c:"#f87171"},
          {l:"IX. Net Profit After Tax",v:r(adj(pl.net)),bold:true,c:"#34d399",border:true,large:true},
        ].map((row,i)=><tr key={i} style={{borderBottom:row.border?"2px solid rgba(255,255,255,0.1)":"1px solid rgba(255,255,255,0.03)",background:row.large?"rgba(16,185,129,0.05)":"transparent"}}>
          <td style={{color:row.c||"#64748b",fontSize:row.small?11:row.large?14:13,fontWeight:row.bold?700:400,padding:`${row.bold?11:8}px 14px`}}>{row.l}</td>
          <td style={{color:row.c||"#64748b",fontSize:row.small?11:row.large?14:13,fontWeight:row.bold?800:500,padding:`${row.bold?11:8}px 14px`,textAlign:"right",fontFamily:"monospace"}}>{row.v}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {tab==="balance"&&<div style={S.card}>
      <h3 style={{ color:"#f1f5f9", fontSize:16, fontWeight:800, margin:"0 0 4px" }}>Balance Sheet</h3>
      <p style={{ color:"#64748b", fontSize:12, margin:"0 0 18px" }}>{unitLabel} · 31 March 2026</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div><h4 style={{ color:"#f59e0b", fontSize:13, fontWeight:700, margin:"0 0 10px", borderBottom:"1px solid rgba(245,158,11,0.2)", paddingBottom:8 }}>ASSETS</h4>
          {[["Current Assets",""],["  Inventory (Fuel+Lube)","₹0"],["  Cash & Bank","₹0"],["  Receivables","₹0"],["Total Current Assets","₹0"],[""],["Fixed Assets",""],["  Plant & Machinery","₹0"],["  Vehicles","₹0"],["  Furniture","₹0"],["Total Fixed Assets","₹0"],[""],["TOTAL ASSETS","₹0"]].map(([k,v],i)=>k?<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:k.startsWith("Total")||k==="TOTAL ASSETS"?"1px solid rgba(255,255,255,0.08)":"none"}}><span style={{color:k.startsWith("Total")||k==="TOTAL ASSETS"?"#f1f5f9":k.startsWith("  ")?"#64748b":"#94a3b8",fontSize:k==="TOTAL ASSETS"?13:12,fontWeight:k.startsWith("Total")||k==="TOTAL ASSETS"?700:400}}>{k}</span><span style={{color:k==="TOTAL ASSETS"?"#f59e0b":"#f1f5f9",fontSize:12,fontWeight:k.startsWith("Total")||k==="TOTAL ASSETS"?700:500,fontFamily:"monospace"}}>{v}</span></div>:<div key={i} style={{height:8}}/>)}</div>
        <div><h4 style={{ color:"#3b82f6", fontSize:13, fontWeight:700, margin:"0 0 10px", borderBottom:"1px solid rgba(59,130,246,0.2)", paddingBottom:8 }}>LIABILITIES & EQUITY</h4>
          {[["Owner's Equity",""],["  Capital","₹0"],["  Retained Earnings","₹0"],["Total Equity","₹0"],[""],["Current Liabilities",""],["  Trade Payables","₹0"],["  Borrowings","₹0"],["Total Current Liab.","₹0"],[""],["Non-Current Liab.",""],["  Term Loans","₹0"],["Total NC Liab.","₹0"],[""],["TOTAL LIAB. & EQUITY","₹0"]].map(([k,v],i)=>k?<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:k.startsWith("Total")||k==="TOTAL LIAB. & EQUITY"?"1px solid rgba(255,255,255,0.08)":"none"}}><span style={{color:k.startsWith("Total")||k==="TOTAL LIAB. & EQUITY"?"#f1f5f9":k.startsWith("  ")?"#64748b":"#94a3b8",fontSize:k==="TOTAL LIAB. & EQUITY"?13:12,fontWeight:k.startsWith("Total")||k==="TOTAL LIAB. & EQUITY"?700:400}}>{k}</span><span style={{color:k==="TOTAL LIAB. & EQUITY"?"#3b82f6":"#f1f5f9",fontSize:12,fontWeight:k.startsWith("Total")||k==="TOTAL LIAB. & EQUITY"?700:500,fontFamily:"monospace"}}>{v}</span></div>:<div key={i} style={{height:8}}/>)}</div>
      </div>
    </div>}
    {tab==="lubricants"&&<div style={S.card}>
      <h3 style={{ color:"#f1f5f9", fontSize:16, fontWeight:800, margin:"0 0 4px" }}>Lubricant Sales Report</h3>
      <p style={{ color:"#64748b", fontSize:12, margin:"0 0 18px" }}>{unitLabel}</p>
      <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Product","Qty","Rate","Total","Margin"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"10px 12px",borderBottom:"2px solid rgba(255,255,255,0.1)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody><tr><td colSpan={5} style={{color:"#475569",fontSize:13,textAlign:"center",padding:"40px 0",fontStyle:"italic"}}>No lubricant sales data yet.</td></tr></tbody></table>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════
const SettingsView = ({ settings, setSettings, tanks, setTanks, unitConfig, setUnitConfig, onFactoryReset }) => {
  const [local,setLocal]   = useState(settings), [lt,setLt] = useState(tanks), [luc,setLuc] = useState(unitConfig);
  const [saved,setSaved]   = useState(false), [saving,setSaving] = useState(false), [tab,setTab] = useState("prices");
  const [showReset,setShowReset] = useState(false), [resetPwd,setResetPwd] = useState(""), [resetErr,setResetErr] = useState(""), [resetStep,setResetStep] = useState(1), [resetting,setResetting] = useState(false);
  const [rateConfirm,setRateConfirm] = useState(false), [pendingSave,setPendingSave] = useState(false);
  const [newUnitName,setNewUnitName] = useState(""), [renamingUnit,setRenamingUnit] = useState(null), [renameVal,setRenameVal] = useState("");
  const [newMachineName,setNewMachineName] = useState(""), [addMachineUnit,setAddMachineUnit] = useState(null);

  useEffect(() => {
    fbGet("settings").then(data => { if(data&&data.length>0){ const s=data[0]; const m={...INITIAL_SETTINGS,...s}; setLocal(m); setSettings(m); } });
    fbGet("tanks").then(data => { if(data&&data.length>0){ const t=data[0]; if(t.unit1){ setLt(t); setTanks(t); } } });
  },[]);

  const priceChanged = local.petrolPrice!==settings.petrolPrice || local.dieselPrice!==settings.dieselPrice;
  const save = async () => {
    if(priceChanged&&!pendingSave){ setRateConfirm(true); setPendingSave(true); return; }
    setPendingSave(false); setSaving(true);
    await fbSet("settings","main",local); await fbSet("tanks","main",lt);
    setSettings(local); setTanks(lt); setUnitConfig(luc);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const updT = (uid,fk,field,val) => setLt(p => ({ ...p, [uid]:{ ...p[uid], [fk]:{ ...p[uid][fk], [field]:parseFloat(val)||0 } } }));
  const updM = (uid,field,val) => setLuc(p => ({ ...p, [uid]:{ ...p[uid], [field]:parseFloat(val)||0 } }));
  const addUnit = () => { if(!newUnitName.trim()) return; const k=`unit${Date.now()}`; setLuc(p=>({...p,[k]:{name:newUnitName.trim(),machines:[],petrolMargin:4.00,dieselMargin:2.50}})); setLt(p=>({...p,[k]:{petrol:{capacity:10000,current:0,buffer:1000},diesel:{capacity:15000,current:0,buffer:1500}}})); setNewUnitName(""); };
  const removeUnit = (uid) => { setLuc(p=>{const n={...p};delete n[uid];return n;}); setLt(p=>{const n={...p};delete n[uid];return n;}); };
  const renameUnit = (uid) => { if(!renameVal.trim()) return; setLuc(p=>({...p,[uid]:{...p[uid],name:renameVal.trim()}})); setRenamingUnit(null); setRenameVal(""); };
  const addMachine = (uid) => { if(!newMachineName.trim()) return; setLuc(p=>({...p,[uid]:{...p[uid],machines:[...(p[uid].machines||[]),newMachineName.trim()]}})); setNewMachineName(""); setAddMachineUnit(null); };
  const removeMachine = (uid,mId) => setLuc(p=>({...p,[uid]:{...p[uid],machines:p[uid].machines.filter(m=>m!==mId)}}));
  const handleReset = async () => {
    setResetErr("");
    if(resetPwd.toLowerCase()!==OWNER_CRED.password.toLowerCase()){ setResetErr("Incorrect password."); return; }
    setResetting(true);
    await fbNukeAll();
    onFactoryReset();
    setResetting(false); setShowReset(false); setResetPwd(""); setResetStep(1);
  };

  const tabs = [["prices","⛽ Prices"],["tanks","🪣 Tanks"],["margins","📊 Margins"],["units","🏢 Units"],["logistics","🚛 Logistics"],["alerts","🔔 Alerts"],["info","ℹ️ Info"],["reset","🗑️ Reset"]];
  const tb = a => ({ padding:"7px 13px", borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, background:tab===a?(a==="reset"?"linear-gradient(135deg,#ef4444,#dc2626)":"linear-gradient(135deg,#f59e0b,#d97706)"):"rgba(255,255,255,0.05)", color:tab===a?"#fff":"#64748b" });

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <ConfirmModal open={rateConfirm} title="Rate Change Warning" msg="Changing fuel prices or margins will ONLY affect future transactions. All past data stays untouched. Proceed?" onOk={() => { setRateConfirm(false); save(); }} onCancel={() => { setRateConfirm(false); setPendingSave(false); }} okLabel="Yes, Update" />
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:0 }}>Settings</h1>
      {(saving||saved) && <SyncBadge syncing={saving} />}
    </div>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 16px" }}>Owner full access · saved to Firebase</p>
    <div style={{ display:"flex", gap:4, marginBottom:18, background:"rgba(255,255,255,0.03)", borderRadius:12, padding:4, border:"1px solid rgba(255,255,255,0.06)", flexWrap:"wrap" }}>{tabs.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={tb(k)}>{l}</button>)}</div>

    {tab==="prices" && <div style={{ ...S.card, maxWidth:420 }}>
      <h3 style={{ color:"#f59e0b", fontSize:15, fontWeight:700, margin:"0 0 14px" }}>⛽ Live Fuel Prices</h3>
      {priceChanged && <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:14, color:"#f59e0b", fontSize:12, fontWeight:600 }}>⚠ Rate changed — will apply to future transactions only</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div><Label>Petrol (₹/L)</Label><input type="number" step="0.01" value={local.petrolPrice} onChange={e=>setLocal(p=>({...p,petrolPrice:parseFloat(e.target.value)}))} style={S.inp}/></div>
        <div><Label>Diesel (₹/L)</Label><input type="number" step="0.01" value={local.dieselPrice} onChange={e=>setLocal(p=>({...p,dieselPrice:parseFloat(e.target.value)}))} style={S.inp}/></div>
      </div>
    </div>}

    {tab==="tanks" && <div>
      <div style={{ ...S.card, background:"rgba(16,185,129,0.04)", border:"1px solid rgba(16,185,129,0.15)", marginBottom:14, padding:"12px 16px" }}>
        <p style={{ color:"#34d399", fontSize:12, fontWeight:700, margin:0 }}>
          ℹ️ Buffer = dead/unusable stock physically trapped at tank bottom. Set this per tank.
          Stock auto-updates when you save sales (reduces) or fuel supply (increases).
        </p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:14 }}>
        {Object.entries(lt).filter(([k])=>k!=="_fbId"&&k!=="savedAt").map(([uid]) => <div key={uid} style={{ ...S.card, border:"1px solid rgba(245,158,11,0.15)" }}>
          <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 12px" }}>{luc[uid]?.name||uid}</h3>
          {[["petrol","⛽ Petrol","#f59e0b"],["diesel","🔵 Diesel","#3b82f6"]].map(([fk,fname,col]) => {
            const t = lt[uid]?.[fk]; if(!t) return null;
            const usable = Math.max(0, (t.current||0)-(t.buffer||0));
            const fillPct = t.capacity > 0 ? ((t.current||0)/t.capacity*100).toFixed(0) : 0;
            return <div key={fk} style={{ marginBottom:12, padding:14, background:"rgba(255,255,255,0.03)", borderRadius:12, border:`1px solid ${col}22` }}>
              <p style={{ color:col, fontSize:12, fontWeight:700, margin:"0 0 10px" }}>{fname}</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <div><Label>Capacity (L)</Label><input type="number" value={t.capacity||0} onChange={e=>updT(uid,fk,"capacity",e.target.value)} style={S.inp}/></div>
                <div><Label>Current (L)</Label><input type="number" value={t.current||0} onChange={e=>updT(uid,fk,"current",e.target.value)} style={S.inp}/><p style={{ color:"#64748b", fontSize:10, margin:"3px 0 0" }}>{fillPct}% full</p></div>
                <div>
                  <Label>Buffer (L)</Label>
                  <input type="number" value={t.buffer??1000} onChange={e=>updT(uid,fk,"buffer",e.target.value)} style={{ ...S.inp, borderColor:"rgba(239,68,68,0.35)" }}/>
                  <p style={{ color:"#ef4444", fontSize:10, margin:"3px 0 0" }}>Dead/unusable</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, padding:"8px 12px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
                <div style={{ flex:1, textAlign:"center" }}><p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 2px" }}>CAPACITY</p><p style={{ color:"#64748b", fontSize:13, fontWeight:700, margin:0 }}>{(t.capacity||0).toLocaleString()} L</p></div>
                <div style={{ width:1, background:"rgba(255,255,255,0.06)" }}/>
                <div style={{ flex:1, textAlign:"center" }}><p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 2px" }}>CURRENT</p><p style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, margin:0 }}>{(t.current||0).toLocaleString()} L</p></div>
                <div style={{ width:1, background:"rgba(255,255,255,0.06)" }}/>
                <div style={{ flex:1, textAlign:"center" }}><p style={{ color:"#ef4444", fontSize:10, fontWeight:700, margin:"0 0 2px" }}>BUFFER</p><p style={{ color:"#ef4444", fontSize:13, fontWeight:700, margin:0 }}>{(t.buffer||0).toLocaleString()} L</p></div>
                <div style={{ width:1, background:"rgba(255,255,255,0.06)" }}/>
                <div style={{ flex:1, textAlign:"center" }}><p style={{ color:"#34d399", fontSize:10, fontWeight:700, margin:"0 0 2px" }}>USABLE</p><p style={{ color:"#34d399", fontSize:13, fontWeight:800, margin:0 }}>{usable.toLocaleString()} L</p></div>
              </div>
            </div>;
          })}
        </div>)}
      </div>
    </div>}

    {tab==="margins" && <div>
      {priceChanged && <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:14, color:"#f59e0b", fontSize:12, fontWeight:600 }}>⚠ Changes apply to future transactions only — past data protected</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))", gap:14 }}>
        {Object.entries(luc).map(([uid,unit]) => <div key={uid} style={{ ...S.card, border:"1px solid rgba(16,185,129,0.15)" }}>
          <h3 style={{ color:"#34d399", fontSize:14, fontWeight:700, margin:"0 0 12px" }}>{unit.name}</h3>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1, padding:12, background:"rgba(245,158,11,0.06)", borderRadius:10 }}><p style={{ color:"#f59e0b", fontSize:11, fontWeight:700, margin:"0 0 8px" }}>⛽ Petrol (₹/L)</p><input type="number" step="0.01" value={unit.petrolMargin} onChange={e=>updM(uid,"petrolMargin",e.target.value)} style={S.inp}/></div>
            <div style={{ flex:1, padding:12, background:"rgba(59,130,246,0.06)", borderRadius:10 }}><p style={{ color:"#3b82f6", fontSize:11, fontWeight:700, margin:"0 0 8px" }}>🔵 Diesel (₹/L)</p><input type="number" step="0.01" value={unit.dieselMargin} onChange={e=>updM(uid,"dieselMargin",e.target.value)} style={S.inp}/></div>
          </div>
        </div>)}
      </div>
    </div>}

    {tab==="units" && <div>
      <div style={{ ...S.card, border:"1px solid rgba(245,158,11,0.2)", marginBottom:18, maxWidth:440 }}>
        <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 12px" }}>➕ Add New Unit</h3>
        <div style={{ display:"flex", gap:10 }}><div style={{ flex:1 }}><Label>Unit Name</Label><input value={newUnitName} onChange={e=>setNewUnitName(e.target.value)} placeholder="e.g. Unit 4" style={S.inp}/></div><button onClick={addUnit} style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:10, padding:"0 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginTop:20 }}>Add</button></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))", gap:14 }}>
        {Object.entries(luc).map(([uid,unit]) => <div key={uid} style={{ ...S.card, border:"1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            {renamingUnit===uid ? <div style={{ display:"flex", gap:8, flex:1 }}>
              <input value={renameVal} onChange={e=>setRenameVal(e.target.value)} style={{ ...S.inp, flex:1 }} autoFocus/>
              <button onClick={()=>renameUnit(uid)} style={{ background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✓</button>
              <button onClick={()=>setRenamingUnit(null)} style={{ ...S.ghostBtn, padding:"8px 10px" }}>✕</button>
            </div> : <>
              <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>{unit.name}</h3>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>{setRenamingUnit(uid);setRenameVal(unit.name);}} style={{ background:"rgba(59,130,246,0.1)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.2)", borderRadius:7, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Rename</button>
                <button onClick={()=>removeUnit(uid)} style={{ background:"rgba(239,68,68,0.08)", color:"#f87171", border:"1px solid rgba(239,68,68,0.15)", borderRadius:7, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Remove</button>
              </div>
            </>}
          </div>
          <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.5px" }}>Machines ({(unit.machines||[]).length})</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {(unit.machines||[]).map(m => <div key={m} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:7, padding:"4px 8px" }}>
              <span style={{ color:"#f59e0b", fontSize:12, fontWeight:700 }}>{m}</span>
              <button onClick={()=>removeMachine(uid,m)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", padding:"0 2px", fontSize:14, lineHeight:1 }}>×</button>
            </div>)}
            {addMachineUnit===uid ? <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input value={newMachineName} onChange={e=>setNewMachineName(e.target.value)} placeholder="e.g. M8" style={{ ...S.inp, width:80, padding:"5px 8px", fontSize:12 }} autoFocus/>
              <button onClick={()=>addMachine(uid)} style={{ background:"rgba(16,185,129,0.2)", color:"#34d399", border:"none", borderRadius:6, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Add</button>
              <button onClick={()=>setAddMachineUnit(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:13 }}>✕</button>
            </div> : <button onClick={()=>{setAddMachineUnit(uid);setNewMachineName("");}} style={{ background:"rgba(255,255,255,0.04)", color:"#64748b", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>+ Machine</button>}
          </div>
        </div>)}
      </div>
    </div>}

    {tab==="logistics" && <div style={{ ...S.card, maxWidth:500 }}>
      <h3 style={{ color:"#10b981", fontSize:15, fontWeight:700, margin:"0 0 14px" }}>🚛 Logistics Parameters</h3>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div><Label>Minimum Order (L)</Label><input type="number" value={local.minOrderLitres} onChange={e=>setLocal(p=>({...p,minOrderLitres:parseFloat(e.target.value)||12000}))} style={S.inp}/><p style={{ color:"#475569", fontSize:11, margin:"4px 0 0" }}>Smallest order the depot accepts</p></div>
        <div><Label>Maximum Order (L)</Label><input type="number" value={local.maxOrderLitres} onChange={e=>setLocal(p=>({...p,maxOrderLitres:parseFloat(e.target.value)||23000}))} style={S.inp}/><p style={{ color:"#475569", fontSize:11, margin:"4px 0 0" }}>Largest truck capacity available</p></div>
        <div style={{ padding:"12px 14px", background:"rgba(59,130,246,0.06)", borderRadius:10, border:"1px solid rgba(59,130,246,0.15)" }}>
          <p style={{ color:"#60a5fa", fontSize:12, fontWeight:700, margin:"0 0 6px" }}>Fixed Parameters</p>
          <p style={{ color:"#64748b", fontSize:12, margin:0, lineHeight:1.7 }}>• Travel: 7h each way · Depot closes 5PM<br />• No driving: 11PM–6AM · Closed Sundays &amp; holidays<br />• Orders in multiples of 1,000 L<br />• Buffer stock configured per-tank in Tanks tab</p>
        </div>
      </div>
    </div>}

    {tab==="alerts" && <div style={{ ...S.card, maxWidth:420 }}>
      <h3 style={{ color:"#f87171", fontSize:15, fontWeight:700, margin:"0 0 14px" }}>🔔 Alert Thresholds</h3>
      <div><Label>Low Stock Alert (Litres of usable stock)</Label><input type="number" value={local.lowStockAlert} onChange={e=>setLocal(p=>({...p,lowStockAlert:parseFloat(e.target.value)}))} style={S.inp}/><p style={{ color:"#334155", fontSize:11, margin:"6px 0 0" }}>Tanks below this usable level show ⚠ LOW warning</p></div>
    </div>}

    {tab==="info" && <div style={{ ...S.card, maxWidth:460 }}>
      <h3 style={{ color:"#64748b", fontSize:15, fontWeight:700, margin:"0 0 14px" }}>ℹ️ Station Information</h3>
      {[
        ["Station",    "Shree K C Sarswat Auto Fuel Station"],
        ["Location",   "Lunkaransar, Rajasthan 334603"],
        ["Units",      `${Object.keys(luc).length} Units · ${Object.values(luc).reduce((a,u)=>a+(u.machines||[]).length,0)} Machines`],
        ["Distributor","HPCL"],
        ["Firebase",   "kc-sarswat-erp-9dced"],
        ["Owner Login","owner@kcsarswat.in"],
        ["Built By",   "Ashish Sarswat"],
        ["Version",    "2.0 · Smart Order Planner"],
      ].map(([k,v]) => <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ color:"#475569", fontSize:12, fontWeight:600 }}>{k}</span>
        <span style={{ color: k==="Built By" ? "#f59e0b" : "#94a3b8", fontSize:12, fontWeight: k==="Built By" ? 700 : 400 }}>{v}</span>
      </div>)}
    </div>}

    {tab==="reset" && <div style={{ maxWidth:520 }}>
      <div style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:18, padding:22, marginBottom:18 }}>
        <h3 style={{ color:"#fca5a5", fontSize:15, fontWeight:800, margin:"0 0 6px" }}>🗑️ Factory Reset — Erase All Data</h3>
        <p style={{ color:"#64748b", fontSize:13, margin:0, lineHeight:1.6 }}>Resets local state to defaults. Firebase cloud data is preserved. <b style={{ color:"#f87171" }}>Cannot be undone.</b></p>
      </div>
      {!showReset ? <button onClick={()=>setShowReset(true)} style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", border:"none", borderRadius:12, padding:"13px 28px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 20px rgba(239,68,68,0.35)" }}>Initiate Factory Reset</button>
        : <div style={{ ...S.card, border:"1px solid rgba(239,68,68,0.3)" }}>
          {resetStep===1&&<><h3 style={{ color:"#f87171", fontSize:15, fontWeight:700, margin:"0 0 8px" }}>🔒 Verify Identity</h3><p style={{ color:"#64748b", fontSize:13, margin:"0 0 14px" }}>Enter owner password:</p><div style={{ marginBottom:14 }}><Label>Owner Password</Label><input type="password" value={resetPwd} onChange={e=>{setResetPwd(e.target.value);setResetErr("");}} style={resetErr?S.inpErr:S.inp}/>{resetErr&&<p style={{ color:"#f87171", fontSize:12, margin:"6px 0 0", fontWeight:600 }}>{resetErr}</p>}</div><div style={{ display:"flex", gap:10 }}><button onClick={()=>{if(!resetPwd){setResetErr("Password required");return;}if(resetPwd.toLowerCase()!==OWNER_CRED.password.toLowerCase()){setResetErr("Incorrect password.");return;}setResetStep(2);}} style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Verify →</button><button onClick={()=>{setShowReset(false);setResetPwd("");setResetErr("");setResetStep(1);}} style={S.ghostBtn}>Cancel</button></div></>}
          {resetStep===2&&<><h3 style={{ color:"#f87171", fontSize:15, fontWeight:700, margin:"0 0 8px" }}>⚠ Final Confirmation</h3><p style={{ color:"#64748b", fontSize:13, margin:"0 0 16px", lineHeight:1.6 }}>This will wipe ALL local sales, inventory, and transaction data to zero. Returns app to brand-new state. Firebase cloud data remains intact.</p><div style={{ display:"flex", gap:10 }}><button onClick={handleReset} disabled={resetting} style={{ background:resetting?"rgba(239,68,68,0.4)":"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", border:"none", borderRadius:10, padding:"12px 24px", fontSize:13, fontWeight:800, cursor:resetting?"not-allowed":"pointer", fontFamily:"inherit" }}>{resetting?"Resetting...":"🗑️ Yes, Reset Everything"}</button><button onClick={()=>{setShowReset(false);setResetPwd("");setResetErr("");setResetStep(1);}} style={S.ghostBtn}>Cancel</button></div></>}
        </div>}
    </div>}

    {tab!=="reset" && <button onClick={save} disabled={saving} style={{ marginTop:24, background:saving?"rgba(245,158,11,0.4)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:14, padding:"13px 32px", fontSize:14, fontWeight:800, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit", boxShadow:"0 4px 24px rgba(245,158,11,0.4)", display:"flex", alignItems:"center", gap:8 }}>{saving?"💾 Saving...":"💾 Save All Settings"}</button>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]           = useState(null);
  const [active,setActive]       = useState("sales");
  const [collapsed,setCollapsed] = useState(false);
  const [settings,setSettings]   = useState(INITIAL_SETTINGS);
  const [tanks,setTanks]         = useState(INITIAL_TANKS);
  const [unitConfig,setUnitConfig] = useState(UNIT_CONFIG_INIT);
  const [staffList,setStaffList]  = useState(INITIAL_STAFF);
  const [resetKey,setResetKey]    = useState(0);

  const handleLogin = u => { setUser(u); setActive(u.role==="owner"?"dashboard":"sales"); };
  const handleFactoryReset = () => { setSettings(INITIAL_SETTINGS); setTanks(INITIAL_TANKS); setUnitConfig(UNIT_CONFIG_INIT); setStaffList(INITIAL_STAFF); setResetKey(k=>k+1); setActive("dashboard"); };

  if(!user) return <LoginPage onLogin={handleLogin} staffList={staffList} />;

  const renderView = () => {
    const key = resetKey;
    if(user.role==="owner") {
      switch(active) {
        case "dashboard": return <Dashboard   key={key} settings={settings} tanks={tanks} unitConfig={unitConfig} />;
        case "sales":     return <SalesView   key={key} user={user} unitConfig={unitConfig} tanks={tanks} setTanks={setTanks} />;
        case "stock":     return <StockView   tanks={tanks} settings={settings} unitConfig={unitConfig} />;
        case "supply":    return <SupplyView  key={key} user={user} unitConfig={unitConfig} tanks={tanks} setTanks={setTanks} />;
        case "logistics": return <LogisticsView tanks={tanks} settings={settings} unitConfig={unitConfig} />;
        case "expenses":  return <ExpensesView key={key} staffList={staffList} />;
        case "staff":     return <StaffView   staffList={staffList} setStaffList={setStaffList} unitConfig={unitConfig} />;
        case "transport": return <TransportView key={key} />;
        case "reports":   return <ReportsView unitConfig={unitConfig} />;
        case "settings":  return <SettingsView settings={settings} setSettings={setSettings} tanks={tanks} setTanks={setTanks} unitConfig={unitConfig} setUnitConfig={setUnitConfig} onFactoryReset={handleFactoryReset} />;
        default:          return <div style={{ padding:40, color:"#334155" }}>Page not found</div>;
      }
    } else {
      switch(active) {
        case "sales":  return <SalesView  key={key} user={user} unitConfig={unitConfig} tanks={tanks} setTanks={setTanks} />;
        case "stock":  return <StockView  tanks={tanks} settings={settings} unitConfig={unitConfig} />;
        case "supply": return <SupplyView key={key} user={user} unitConfig={unitConfig} tanks={tanks} setTanks={setTanks} />;
        default:       return <div style={{ padding:40, color:"#334155" }}>Page not found</div>;
      }
    }
  };

  return <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Sora',sans-serif;background:#060d18;color:#f1f5f9}
      ::-webkit-scrollbar{width:5px;height:5px}
      ::-webkit-scrollbar-track{background:rgba(255,255,255,0.02)}
      ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
      input:focus,select:focus{border-color:rgba(245,158,11,0.45)!important;outline:none!important}
      button:active{transform:scale(0.97)}
    `}</style>
    <div style={{ display:"flex", height:"100vh", background:"#060d18", overflow:"hidden" }}>
      <Sidebar active={active} setActive={setActive} user={user} onLogout={() => setUser(null)} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ height:52, background:"rgba(6,13,24,0.98)", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", padding:"0 20px", gap:12, flexShrink:0 }}>
          <p style={{ color:"#334155", fontSize:12, flex:1, margin:0, fontWeight:600 }}><span style={{ color:"#f59e0b", fontWeight:800 }}>Shree K C Sarswat</span> · Petrol ERP · <span style={{ color:user.role==="owner"?"#f59e0b":"#60a5fa", fontWeight:700 }}>{user.role==="owner"?"👑 Owner":"👤 "+user.name}</span></p>
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.15)", borderRadius:6 }}><div style={{ width:5, height:5, borderRadius:"50%", background:"#34d399" }} /><span style={{ color:"#34d399", fontSize:10, fontWeight:700 }}>Firebase Live</span></div>
          <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:8, padding:"4px 12px" }}><span style={{ color:"#f59e0b", fontSize:12, fontWeight:800 }}>⛽ ₹{settings.petrolPrice}</span></div>
          <div style={{ background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:8, padding:"4px 12px" }}><span style={{ color:"#3b82f6", fontSize:12, fontWeight:800 }}>🔵 ₹{settings.dieselPrice}</span></div>
        </div>
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>{renderView()}</div>
      </div>
    </div>
  </>;
}
