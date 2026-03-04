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


// ── Nuke ALL Firebase collections (full cloud wipe) ───────────────────────────
const fbNukeCollection = async (col) => {
  try {
    const snap = await getDocs(collection(db, col));
    if (snap.empty) return true;
    const batches = [];
    let batch = writeBatch(db);
    let count = 0;
    snap.docs.forEach(d => {
      batch.delete(d.ref);
      count++;
      if (count === 499) { batches.push(batch); batch = writeBatch(db); count = 0; }
    });
    batches.push(batch);
    await Promise.all(batches.map(b => b.commit()));
    return true;
  } catch { return false; }
};
const fbNukeAll = async () => {
  await Promise.all(["sales","supply","expenses","transport","staff","settings","tanks"].map(c => fbNukeCollection(c)));
};

// ── Constants ──────────────────────────────────────────────────────────────────
const makeStaffEmail = (name) => name.toLowerCase().replace(/\s+/g, "") + "kc@gmail.com";
const makeStaffPassword = (name) => name.toLowerCase().replace(/\s+/g, "") + "@123";
const OWNER_CRED = { email: "owner@kcsarswat.in", password: "KCSarswat@2025" };
const TODAY = new Date().toISOString().split("T")[0];
const EXPENSE_CATS = ["Cleaning", "Maintenance", "Generator Diesel", "Electricity Bill", "Water Bill", "Staff Salary", "Custom"];
const SHIFTS = ["Day Shift", "Night Shift"];

const UNIT_CONFIG_INIT = {
  unit1: { name: "Unit 1", machines: ["M1", "M2", "M3"], petrolMargin: 4.27, dieselMargin: 2.72 },
  unit2: { name: "Unit 2", machines: ["M4", "M5"], petrolMargin: 3.79, dieselMargin: 2.28 },
  unit3: { name: "Unit 3", machines: ["M6", "M7"], petrolMargin: 4.14, dieselMargin: 2.63 },
};
const INITIAL_SETTINGS = { petrolPrice: 102.84, dieselPrice: 89.62, lowStockAlert: 500, deadLevelStock: 1500, minOrderLitres: 12000, maxOrderLitres: 23000 };
const INITIAL_TANKS = {
  unit1: { petrol: { capacity: 10000, current: 4200 }, diesel: { capacity: 15000, current: 7800 } },
  unit2: { petrol: { capacity: 8000, current: 2100 }, diesel: { capacity: 12000, current: 5400 } },
  unit3: { petrol: { capacity: 8000, current: 3600 }, diesel: { capacity: 12000, current: 9200 } },
};
const INITIAL_STAFF = [
  { id: "s1", name: "Ramesh Kumar", role: "Pump Operator", salary: 12000, joining: "2022-03-15", active: true, unit: "unit1", password: makeStaffPassword("Ramesh Kumar") },
  { id: "s2", name: "Suresh Sharma", role: "Cashier", salary: 14000, joining: "2021-08-10", active: true, unit: "unit2", password: makeStaffPassword("Suresh Sharma") },
  { id: "s3", name: "Manoj Patel", role: "Pump Operator", salary: 11500, joining: "2023-01-20", active: true, unit: "unit1", password: makeStaffPassword("Manoj Patel") },
  { id: "s4", name: "Dinesh Verma", role: "Supervisor", salary: 18000, joining: "2020-06-05", active: true, unit: "unit3", password: makeStaffPassword("Dinesh Verma") },
  { id: "s5", name: "Bharat Saini", role: "Driver", salary: 16000, joining: "2022-11-12", active: false, unit: "unit2", password: makeStaffPassword("Bharat Saini") },
];

const INDIAN_HOLIDAYS = [
  "2025-01-26", "2025-03-25", "2025-03-29", "2025-04-14", "2025-08-15", "2025-10-02", "2025-10-20", "2025-10-23", "2025-12-25",
  "2026-01-01", "2026-01-26", "2026-03-17", "2026-04-14", "2026-08-15", "2026-10-02"
];
const TRUCK_TYPES = [
  { id: "personal", name: "Personal Truck (14K)", capacity: 14000, compartments: [5000, 5000, 4000], preferred: true },
  { id: "t12k", name: "Transport 12K", capacity: 12000, compartments: [4000, 4000, 4000], preferred: false },
  { id: "t16k", name: "Transport 16K", capacity: 16000, compartments: [4000, 4000, 4000, 4000], preferred: false },
  { id: "t23k", name: "Transport 23K", capacity: 23000, compartments: [5000, 5000, 5000, 4000, 4000], preferred: false },
];

// ── Logistics Engine ───────────────────────────────────────────────────────────
const isDepotClosed = (dt) => {
  const day = dt.getDay();
  const ds = dt.toISOString().split("T")[0];
  return day === 0 || INDIAN_HOLIDAYS.includes(ds) || dt.getHours() >= 17;
};
const computeOrderAlert = (currentStock, avgSales, deadLevel, minOrder, maxOrder) => {
  if (!avgSales || avgSales <= 0 || currentStock <= 0) return null;
  try {
    const daysLeft = currentStock / avgSales;
    const now = new Date();
    const runsOut = new Date(now.getTime() + daysLeft * 86400000);
    const urgency = daysLeft <= 1 ? "CRITICAL" : daysLeft <= 2 ? "HIGH" : daysLeft <= 4 ? "MEDIUM" : "LOW";
    const rawQty = Math.ceil((avgSales * 7) / 1000) * 1000;
    const suggestedQty = Math.min(maxOrder, Math.max(minOrder, rawQty));
    const truck = TRUCK_TYPES.find(t => t.preferred && t.capacity >= suggestedQty) ||
      TRUCK_TYPES.find(t => t.capacity >= suggestedQty) ||
      TRUCK_TYPES[TRUCK_TYPES.length - 1];
    // Simple departure calc: need to leave early enough to arrive before 5PM
    // 7h travel, depot open 6AM-5PM Mon-Sat
    let departure = new Date(now);
    for (let i = 0; i < 10; i++) {
      const arr = new Date(departure.getTime() + 7 * 3600000);
      if (!isDepotClosed(arr) && arr.getHours() >= 6) break;
      departure = new Date(departure.getTime() + 3600000);
    }
    const mustLeaveBy = new Date(runsOut.getTime() - 16 * 3600000);
    return { daysLeft: daysLeft.toFixed(1), runsOut, urgency, suggestedQty, truck, mustLeaveBy, departure, avgSales: Math.round(avgSales) };
  } catch { return null; }
};

// ── Date helpers ───────────────────────────────────────────────────────────────
const isWithin24h = (dateStr) => {
  try { return (new Date() - new Date(dateStr + "T00:00:00")) < 86400000; } catch { return true; }
};

// ── Data generators ────────────────────────────────────────────────────────────
const genMonthly = () => ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => ({
  month: m, petrol: 0, diesel: 0, profit: 0, expenses: 0
}));
const genDaily = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i));
  return { date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), petrol: 0, diesel: 0 };
});

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  inp: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "border 0.15s" },
  inpErr: { background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.55)", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
  card: { background: "rgba(13,27,42,0.92)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 22 },
  btn: (color = "#f59e0b") => ({ background: `linear-gradient(135deg,${color},${color}cc)`, color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }),
  ghostBtn: { background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
};

// ── Small shared components ────────────────────────────────────────────────────
const Label = ({ children, req }) => <label style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>{children}{req && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}</label>;
const FieldErr = ({ msg }) => msg ? <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}><span style={{ color: "#f87171", fontSize: 11 }}>{msg}</span></div> : null;
const Toast = ({ msg, type = "success" }) => msg ? <div style={{ background: type === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)", border: `1px solid ${type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 12, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, color: type === "success" ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 600 }}>{msg}</div> : null;
const SyncBadge = ({ syncing }) => <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: syncing ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${syncing ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`, borderRadius: 6 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: syncing ? "#f59e0b" : "#34d399" }} /><span style={{ color: syncing ? "#f59e0b" : "#34d399", fontSize: 10, fontWeight: 700 }}>{syncing ? "Saving..." : "Saved ✓"}</span></div>;
const ErrBanner = ({ errors }) => !errors?.length ? null : <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}><p style={{ color: "#fca5a5", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Fix the following:</p><ul style={{ color: "#f87171", fontSize: 12, margin: 0, paddingLeft: 16 }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul></div>;
const LockedBar = () => <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "#f87171", fontSize: 12, fontWeight: 600 }}>🔒 Locked — Staff can only edit today's data. Contact Owner for historical edits.</div>;

const ConfirmModal = ({ open, title, msg, onOk, onCancel, okLabel = "Proceed", danger = false }) => {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
    <div style={{ ...S.card, border: `1px solid ${danger ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.3)"}`, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
      <h3 style={{ color: danger ? "#fca5a5" : "#f59e0b", fontSize: 16, fontWeight: 800, margin: "0 0 10px" }}>⚠ {title}</h3>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 20px", lineHeight: 1.7 }}>{msg}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onOk} style={{ flex: 1, background: danger ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{okLabel}</button>
        <button onClick={onCancel} style={{ flex: 1, ...S.ghostBtn }}>Cancel</button>
      </div>
    </div>
  </div>;
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = "#f59e0b", icon, trend }) => {
  const rgb = color === "#f59e0b" ? "245,158,11" : color === "#3b82f6" ? "59,130,246" : color === "#10b981" ? "16,185,129" : color === "#8b5cf6" ? "139,92,246" : "239,68,68";
  return <div style={{ ...S.card, border: `1px solid rgba(${rgb},0.22)`, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: 100, background: `radial-gradient(circle at top right,rgba(${rgb},0.1),transparent)`, borderRadius: "0 18px 0 100%" }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.9px", textTransform: "uppercase" }}>{label}</p>
        <p style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>{value}</p>
        {sub && <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0" }}>{sub}</p>}
        {trend !== undefined && <p style={{ color: trend >= 0 ? "#34d399" : "#f87171", fontSize: 12, margin: "6px 0 0", fontWeight: 600 }}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%</p>}
      </div>
      <div style={{ width: 46, height: 46, background: `rgba(${rgb},0.14)`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 22, flexShrink: 0 }}>{icon}</div>
    </div>
  </div>;
};

// ── Tank Gauge ─────────────────────────────────────────────────────────────────
const TankGauge = ({ label, current, capacity, color, lowAlert }) => {
  const pct = Math.min((current / capacity) * 100, 100), isLow = current < lowAlert;
  return <div style={{ ...S.card, textAlign: "center", padding: "16px 12px" }}>
    <p style={{ color: "#94a3b8", fontSize: 9, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.8px", lineHeight: 1.3 }}>{label}</p>
    <div style={{ position: "relative", width: 56, height: 100, margin: "0 auto 10px", borderRadius: "6px 6px 4px 4px", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.1)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct}%`, background: `linear-gradient(0deg,${color}cc,${color}55)`, transition: "height 0.6s" }} />
      {[25, 50, 75].map(t => <div key={t} style={{ position: "absolute", left: 0, right: 0, bottom: `${t}%`, height: 1, background: "rgba(255,255,255,0.1)" }} />)}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#f1f5f9", fontSize: 11, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{pct.toFixed(0)}%</span></div>
    </div>
    <p style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>{current.toLocaleString()}L</p>
    <p style={{ color: "#475569", fontSize: 10, margin: "0 0 4px" }}>/{capacity.toLocaleString()}L</p>
    {isLow && <span style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>⚠ LOW</span>}
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
    if (sf !== "diesel") tl.push({ label: `${u.name} Petrol`, current: t.petrol.current, capacity: t.petrol.capacity, color: "#f59e0b", low: settings.lowStockAlert });
    if (sf !== "petrol") tl.push({ label: `${u.name} Diesel`, current: t.diesel.current, capacity: t.diesel.capacity, color: "#3b82f6", low: settings.lowStockAlert });
  });
  const tb = a => ({ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: a ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)", color: a ? "#fff" : "#64748b" });
  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>Unit:</span>
      {[["all", "All"], ...Object.entries(uc).map(([k, u]) => [k, u.name])].map(([v, l]) => <button key={v} onClick={() => setSu(v)} style={tb(su === v)}>{l}</button>)}
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>Fuel:</span>
      {[["both", "Both"], ["petrol", "Petrol"], ["diesel", "Diesel"]].map(([v, l]) => <button key={v} onClick={() => setSf(v)} style={tb(sf === v)}>{l}</button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8, marginBottom: 16 }}>{tl.map(t => <TankGauge key={t.label} label={t.label} current={t.current} capacity={t.capacity} color={t.color} lowAlert={t.low} />)}</div>
    <ResponsiveContainer width="100%" height={140}><BarChart data={tl.map(t => ({ name: t.label.replace(" Petrol", "P").replace(" Diesel", "D"), val: t.current }))} barSize={22}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} formatter={v => [`${v.toLocaleString()} L`, ""]} /><Bar dataKey="val" radius={[5, 5, 0, 0]}>{tl.map((t, i) => <Cell key={i} fill={t.color} />)}</Bar></BarChart></ResponsiveContainer>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════
const LoginPage = ({ onLogin, staffList }) => {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [showPwd, setShowPwd] = useState(false);

  const handleLogin = async () => {
    setLoading(true); setError("");
    await new Promise(r => setTimeout(r, 600));
    const el = email.toLowerCase().trim(), pl = password.toLowerCase().trim();
    if (role === "owner") {
      if (el === OWNER_CRED.email.toLowerCase() && pl === OWNER_CRED.password.toLowerCase()) onLogin({ email, role: "owner", name: "Owner — KC Sarswat", staffId: null });
      else setError("Invalid owner credentials.");
    } else {
      const found = staffList.find(s => makeStaffEmail(s.name).toLowerCase() === el && s.password.toLowerCase() === pl && s.active);
      if (found) onLogin({ email, role: "staff", name: found.name, staffId: found.id });
      else setError("Staff credentials not found or account inactive.");
    }
    setLoading(false);
  };

  return <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Sora',sans-serif", background: "#060d18" }}>
    {/* Left panel */}
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden", background: "linear-gradient(180deg,#0a0f1a,#0d1c2e 40%,#102238)" }}>
      <svg style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, opacity: 0.9 }} viewBox="0 0 520 420" fill="none">
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
        <path d="M300 300 Q270 280 280 320 Q290 355 300 355" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="260" cy="170" r="24" fill="#f59e0b" />
        <text x="260" y="175" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">HP</text>
      </svg>
      <div style={{ position: "relative", zIndex: 2, padding: "40px 44px", background: "linear-gradient(0deg,rgba(6,13,24,0.97),transparent)" }}>
        <h2 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Shree K C Sarswat<br /><span style={{ color: "#f59e0b" }}>Auto Fuel Station</span></h2>
        <p style={{ color: "#475569", fontSize: 13, margin: 0, lineHeight: 1.5 }}>3 Units · 7 Machines · HPCL Distributor · Lunkaransar, RJ</p>
      </div>
    </div>
    {/* Right login panel */}
    <div style={{ width: 400, background: "#07111e", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "44px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⛽</div>
        <div><p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800, margin: 0 }}>KC Sarswat ERP</p><p style={{ color: "#475569", fontSize: 11, margin: 0 }}>Station Management System</p></div>
      </div>
      <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Welcome back</h1>
      <p style={{ color: "#475569", fontSize: 13, margin: "0 0 22px" }}>Sign in to your dashboard</p>
      {/* Role toggle */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 18, border: "1px solid rgba(255,255,255,0.07)" }}>
        {[["owner", "👑 Owner"], ["staff", "👤 Staff"]].map(([r, l]) => (
          <button key={r} onClick={() => { setRole(r); setEmail(""); setPassword(""); setError(""); }} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: role === r ? "linear-gradient(135deg,#f59e0b,#d97706)" : "transparent", color: role === r ? "#fff" : "#64748b" }}>{l}</button>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <Label>Email</Label>
        <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder={role === "owner" ? "owner@kcsarswat.in" : "yournamekc@gmail.com"} style={{ ...S.inp, fontSize: 14 }} />
      </div>
      <div style={{ marginBottom: 18, position: "relative" }}>
        <Label>Password</Label>
        <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...S.inp, fontSize: 14, paddingRight: 44 }} />
        <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: 34, background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 16, padding: 4 }}>{showPwd ? "🙈" : "👁"}</button>
      </div>
      {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f87171", fontSize: 12, fontWeight: 600 }}>⚠ {error}</div>}
      <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: loading ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}>
        {loading ? "Signing in..." : "Sign In →"}
      </button>
      <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10 }}>
        <p style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700, margin: "0 0 4px" }}>STAFF LOGIN FORMAT</p>
        <p style={{ color: "#475569", fontSize: 11, margin: 0, lineHeight: 1.7 }}>Email: <span style={{ color: "#93c5fd" }}>firstnamelastnameKC@gmail.com</span><br />Password: <span style={{ color: "#93c5fd" }}>firstnamelastname@123</span></p>
      </div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════════════
const Sidebar = ({ active, setActive, user, onLogout, collapsed, setCollapsed }) => {
  const ownerNav = [{ id: "dashboard", label: "Dashboard", icon: "📊" }, { id: "sales", label: "Sales Entry", icon: "🧾" }, { id: "stock", label: "Stock", icon: "📦" }, { id: "supply", label: "Fuel Supply", icon: "🚛" }, { id: "logistics", label: "Order Alerts", icon: "🔔" }, { id: "expenses", label: "Expenses", icon: "💸" }, { id: "staff", label: "Staff", icon: "👥" }, { id: "transport", label: "Transport", icon: "🚚" }, { id: "reports", label: "Reports", icon: "📈" }, { id: "settings", label: "Settings", icon: "⚙️" }];
  const staffNav = [{ id: "sales", label: "Sales Entry", icon: "🧾" }, { id: "stock", label: "Stock", icon: "📦" }, { id: "supply", label: "Fuel Supply", icon: "🚛" }];
  const nav = user.role === "owner" ? ownerNav : staffNav;
  return <div style={{ width: collapsed ? 64 : 224, background: "linear-gradient(180deg,#06111e,#08192a)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", transition: "width 0.25s", overflow: "hidden", flexShrink: 0, height: "100vh" }}>
    <div style={{ padding: collapsed ? "16px 14px" : "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>⛽</div>
      {!collapsed && <div><p style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 800, margin: 0, whiteSpace: "nowrap" }}>KC Sarswat</p><p style={{ color: "#334155", fontSize: 10, margin: 0 }}>Lunkaransar, RJ</p></div>}
      <button onClick={() => setCollapsed(!collapsed)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#334155", fontSize: 16, padding: 4, flexShrink: 0 }}>{collapsed ? "›" : "‹"}</button>
    </div>
    {!collapsed && <div style={{ margin: "8px 8px 0", padding: "8px 12px", background: user.role === "owner" ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)", borderRadius: 10, border: `1px solid ${user.role === "owner" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)"}` }}>
      <p style={{ color: user.role === "owner" ? "#f59e0b" : "#60a5fa", fontSize: 10, fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{user.role === "owner" ? "👑 Owner" : "👤 Staff"}</p>
      <p style={{ color: "#64748b", fontSize: 10, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
    </div>}
    <nav style={{ flex: 1, padding: "8px 6px", overflowY: "auto" }}>
      {nav.map(item => <button key={item.id} onClick={() => setActive(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, marginBottom: 2, transition: "all 0.15s", background: active === item.id ? "linear-gradient(135deg,rgba(245,158,11,0.16),rgba(217,119,6,0.08))" : "transparent", color: active === item.id ? "#f59e0b" : "#475569", borderLeft: active === item.id ? "2px solid #f59e0b" : "2px solid transparent" }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
        {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
      </button>)}
    </nav>
    <div style={{ padding: "8px 6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.08)", color: "#f87171", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
        <span style={{ fontSize: 15 }}>🚪</span>{!collapsed && "Sign Out"}
      </button>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════
const Dashboard = ({ settings, tanks }) => {
  const monthly = useMemo(genMonthly, []), daily = useMemo(genDaily, []);
  const today = daily[daily.length - 1];
  const profit = 0; // Will show real data once sales are entered
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Owner Dashboard</h1>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 20px" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 20 }}>
      <StatCard label="Petrol Today" value={`${today.petrol.toLocaleString()} L`} sub={`₹${(today.petrol * settings.petrolPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} color="#f59e0b" icon="⛽" trend={5.2} />
      <StatCard label="Diesel Today" value={`${today.diesel.toLocaleString()} L`} sub={`₹${(today.diesel * settings.dieselPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} color="#3b82f6" icon="🔵" trend={-1.8} />
      <StatCard label="Total Litres" value={`${(today.petrol + today.diesel).toLocaleString()} L`} sub="All units" color="#10b981" icon="📦" trend={2.1} />
      <StatCard label="Gross Profit" value={`₹${profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="After margins" color="#8b5cf6" icon="💰" trend={3.4} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
      <div style={S.card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Daily Sales — 7 Days</h3><ResponsiveContainer width="100%" height={180}><BarChart data={daily} barSize={12}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} /><Bar dataKey="petrol" name="Petrol (L)" fill="#f59e0b" radius={[5, 5, 0, 0]} /><Bar dataKey="diesel" name="Diesel (L)" fill="#3b82f6" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div style={S.card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Monthly Profit</h3><ResponsiveContainer width="100%" height={180}><AreaChart data={monthly}><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} formatter={v => [`₹${v.toLocaleString("en-IN")}`, ""]} /><Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#pg)" /></AreaChart></ResponsiveContainer></div>
    </div>
    <div style={S.card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>🛢 Live Tank Stock</h3><StockPanel tanks={tanks} settings={settings} /></div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SALES ENTRY
// ════════════════════════════════════════════════════════════════════════
const SalesView = ({ user, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const allM = Object.entries(uc).flatMap(([uid, u]) => u.machines.map(id => ({ id, unit: uid })));
  const emptyR = allM.reduce((a, m) => ({ ...a, [m.id]: { petrolOpen: "", petrolClose: "", dieselOpen: "", dieselClose: "" } }), {});
  const [date, setDate] = useState(TODAY), [shift, setShift] = useState("Day Shift");
  const [readings, setReadings] = useState(emptyR), [fe, setFe] = useState({});
  const [errors, setErrors] = useState([]), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  const locked = user.role === "staff" && !isWithin24h(date);
  const upd = (mId, field, val) => { setReadings(p => ({ ...p, [mId]: { ...p[mId], [field]: val } })); setFe(p => ({ ...p, [mId + field]: "" })); };
  const calc = (o, c) => { const ov = parseFloat(o), cv = parseFloat(c); if (isNaN(ov) || isNaN(cv)) return null; if (cv < ov) return { error: "Closing<Opening" }; return { litres: (cv - ov).toFixed(2) }; };
  const validate = () => { const errs = [], nfe = {}; allM.forEach(({ id: mId }) => { const r = readings[mId];["petrol", "diesel"].forEach(f => { const o = r[`${f}Open`], c = r[`${f}Close`]; if (o === "" && c !== "") { errs.push(`Machine ${mId} ${f}: Opening missing`); nfe[mId + `${f}Open`] = "Required"; } if (o !== "" && c === "") { errs.push(`Machine ${mId} ${f}: Closing missing`); nfe[mId + `${f}Close`] = "Required"; } if (o !== "" && c !== "" && parseFloat(c) < parseFloat(o)) { errs.push(`Machine ${mId} ${f}: Closing<Opening`); nfe[mId + `${f}Close`] = "Invalid"; } }); }); setFe(nfe); setErrors(errs); return errs.length === 0; };
  const handleSave = async () => { if (locked || !validate()) return; setSaving(true); await fbAdd("sales", { date, shift, staffName: user.name, staffId: user.staffId || "owner", readings, savedAt: new Date().toISOString() }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000); };
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Sales Entry</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Enter meter readings{user.role === "staff" && <span style={{ color: "#f59e0b", marginLeft: 6 }}>· Today only editable</span>}</p></div>
      {(saving || saved) && <SyncBadge syncing={saving} />}
    </div>
    {locked && <LockedBar />}
    <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div><Label>Date</Label><input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={user.role === "staff"} style={{ ...S.inp, width: 160 }} /></div>
      <div><Label>Shift</Label><select value={shift} onChange={e => setShift(e.target.value)} style={{ ...S.inp, width: 160 }}>{SHIFTS.map(s => <option key={s} style={{ background: "#07111e" }}>{s}</option>)}</select></div>
    </div>
    <ErrBanner errors={errors} />
    <Toast msg={saved ? `✓ Sales saved — ${date} · ${shift}` : null} />
    {Object.entries(uc).map(([uid, unit]) => (
      <div key={uid} style={{ ...S.card, marginBottom: 14, opacity: locked ? 0.5 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 20 }}>⛽</span>
          <div><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>{unit.name}</h3>{user.role === "owner" && <p style={{ color: "#475569", fontSize: 11, margin: 0 }}>Petrol ₹{unit.petrolMargin}/L · Diesel ₹{unit.dieselMargin}/L</p>}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          {unit.machines.map(mId => {
            const r = readings[mId] || { petrolOpen: "", petrolClose: "", dieselOpen: "", dieselClose: "" };
            const ps = calc(r.petrolOpen, r.petrolClose), ds = calc(r.dieselOpen, r.dieselClose);
            const profit = user.role === "owner" ? ((ps?.litres ? parseFloat(ps.litres) * unit.petrolMargin : 0) + (ds?.litres ? parseFloat(ds.litres) * unit.dieselMargin : 0)) : 0;
            return <div key={mId} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
              <p style={{ color: "#475569", fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>MACHINE {mId}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ label: "⛽ Petrol", ok: "petrolOpen", ck: "petrolClose", s: ps, c: "#f59e0b" }, { label: "🔵 Diesel", ok: "dieselOpen", ck: "dieselClose", s: ds, c: "#3b82f6" }].map(f => (
                  <div key={f.label}>
                    <p style={{ color: f.c, fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{f.label}</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}><label style={{ color: "#475569", fontSize: 10, display: "block", marginBottom: 2, fontWeight: 600 }}>Opening</label><input type="number" placeholder="0.00" value={r[f.ok]} onChange={e => upd(mId, f.ok, e.target.value)} disabled={locked} style={fe[mId + f.ok] ? S.inpErr : S.inp} /></div>
                      <div style={{ flex: 1 }}><label style={{ color: "#475569", fontSize: 10, display: "block", marginBottom: 2, fontWeight: 600 }}>Closing</label><input type="number" placeholder="0.00" value={r[f.ck]} onChange={e => upd(mId, f.ck, e.target.value)} disabled={locked} style={fe[mId + f.ck] ? S.inpErr : S.inp} /></div>
                    </div>
                    {f.s?.litres && <p style={{ color: f.c, fontSize: 11, margin: "4px 0 0", fontWeight: 700 }}>{f.s.litres} L sold</p>}
                    {f.s?.error && <p style={{ color: "#f87171", fontSize: 11, margin: "4px 0 0" }}>{f.s.error}</p>}
                  </div>
                ))}
              </div>
              {user.role === "owner" && profit > 0 && <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.15)" }}><p style={{ color: "#34d399", fontSize: 12, margin: 0, fontWeight: 700 }}>Est. Profit: ₹{profit.toFixed(2)}</p></div>}
            </div>;
          })}
        </div>
      </div>
    ))}
    <button onClick={handleSave} disabled={saving || locked} style={{ background: (saving || locked) ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 14, fontWeight: 800, cursor: (saving || locked) ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
      {saving ? "Saving..." : "💾 Save to Firebase"}
    </button>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// STOCK
// ════════════════════════════════════════════════════════════════════════
const StockView = ({ tanks, settings, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Stock Management</h1>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 20px" }}>Live fuel tank levels</p>
    <div style={S.card}><StockPanel tanks={tanks} settings={settings} unitConfig={uc} /></div>
    <div style={{ ...S.card, marginTop: 16 }}>
      <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Tank Summary</h3>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
        <thead><tr>{["Unit", "Fuel", "Current (L)", "Capacity (L)", "Fill %", "Status"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead>
        <tbody>{Object.entries(uc).flatMap(([uid, unit]) => [["petrol", "Petrol", "#f59e0b"], ["diesel", "Diesel", "#3b82f6"]].map(([fk, fn, col]) => {
          const t = tanks[uid]?.[fk]; if (!t) return null;
          const pct = ((t.current / t.capacity) * 100).toFixed(1), low = t.current < settings.lowStockAlert;
          return <tr key={uid + fk} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, padding: "10px 12px" }}>{unit.name}</td>
            <td style={{ padding: "10px 12px" }}><span style={{ color: col, fontSize: 13, fontWeight: 700 }}>{fn}</span></td>
            <td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "10px 12px" }}>{t.current.toLocaleString()}</td>
            <td style={{ color: "#64748b", fontSize: 13, padding: "10px 12px" }}>{t.capacity.toLocaleString()}</td>
            <td style={{ padding: "10px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 60, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: low ? "#ef4444" : col, borderRadius: 3 }} /></div><span style={{ color: "#64748b", fontSize: 12 }}>{pct}%</span></div></td>
            <td style={{ padding: "10px 12px" }}>{low ? <span style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", fontSize: 10, padding: "3px 7px", borderRadius: 4, fontWeight: 700 }}>⚠ LOW</span> : <span style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", fontSize: 10, padding: "3px 7px", borderRadius: 4, fontWeight: 700 }}>OK</span>}</td>
          </tr>;
        }))}</tbody>
      </table></div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SUPPLY
// ════════════════════════════════════════════════════════════════════════
const SupplyView = ({ user, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const ef = { date: TODAY, fuelType: "Petrol", unit: Object.keys(uc)[0] || "unit1", litres: "", truck: "", supplier: "HPCL" };
  const [supply, setSupply] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null), [form, setForm] = useState(ef), [errors, setErrors] = useState([]);
  const [fe, setFe] = useState({}), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  useEffect(() => { fbGet("supply").then(data => { if (data && data.length > 0) setSupply(data.sort((a, b) => b.date.localeCompare(a.date))); setLoading(false); }); }, []);
  const canEdit = r => user.role === "owner" || isWithin24h(r.date);
  const validate = () => { const errs = [], nfe = {}; if (!form.litres || parseFloat(form.litres) <= 0) { errs.push("Litres > 0 required"); nfe.litres = "Required"; } if (!form.truck.trim()) { errs.push("Truck number required"); nfe.truck = "Required"; } if (!form.supplier.trim()) { errs.push("Supplier required"); nfe.supplier = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const add = async () => { if (!validate()) return; setSaving(true); const entry = { ...form, litres: parseFloat(form.litres), savedAt: new Date().toISOString(), savedBy: user.name }; if (editId) { const fbId = supply.find(s => s.id === editId)?._fbId; if (fbId) await fbUpdate("supply", fbId, entry); setSupply(p => p.map(s => s.id === editId ? { ...s, ...entry } : s)); } else { const fbId = await fbAdd("supply", entry); setSupply(p => [{ ...entry, id: `s${Date.now()}`, _fbId: fbId }, ...p]); } setSaving(false); setEditId(null); setForm(ef); setShow(false); setErrors([]); setFe({}); setSaved(true); setTimeout(() => setSaved(false), 3000); };
  const startEdit = s => { setForm({ date: s.date, fuelType: s.fuelType, unit: s.unit, litres: String(s.litres), truck: s.truck, supplier: s.supplier }); setEditId(s.id); setShow(true); };
  const cancel = () => { setShow(false); setEditId(null); setForm(ef); setErrors([]); setFe({}); };
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Fuel Supply</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Tanker deliveries{user.role === "staff" && <span style={{ color: "#f59e0b", marginLeft: 6 }}>· Staff: today only editable</span>}</p></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{(saving || saved) && <SyncBadge syncing={saving} />}<button onClick={() => { cancel(); setShow(true); }} style={{ ...S.btn() }}><span>+</span> Add Supply</button></div>
    </div>
    {loading && <div style={{ ...S.card, textAlign: "center", color: "#475569", padding: 40 }}>⏳ Loading...</div>}
    <Toast msg={saved ? "Supply saved ☁️" : null} />
    {show && <div style={{ ...S.card, border: `1px solid ${editId ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.2)"}`, marginBottom: 16 }}>
      <h3 style={{ color: editId ? "#60a5fa" : "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>{editId ? "Edit Entry" : "New Supply"}</h3>
      <ErrBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
        <div><Label req>Date</Label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={S.inp} /></div>
        <div><Label req>Unit</Label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={S.inp}>{Object.entries(uc).map(([k, u]) => <option key={k} value={k} style={{ background: "#07111e" }}>{u.name}</option>)}</select></div>
        <div><Label req>Fuel</Label><select value={form.fuelType} onChange={e => setForm(p => ({ ...p, fuelType: e.target.value }))} style={S.inp}><option style={{ background: "#07111e" }}>Petrol</option><option style={{ background: "#07111e" }}>Diesel</option></select></div>
        <div><Label req>Litres</Label><input type="number" value={form.litres} onChange={e => { setForm(p => ({ ...p, litres: e.target.value })); setFe(p => ({ ...p, litres: "" })); }} style={fe.litres ? S.inpErr : S.inp} /><FieldErr msg={fe.litres} /></div>
        <div><Label req>Truck No.</Label><input value={form.truck} onChange={e => { setForm(p => ({ ...p, truck: e.target.value })); setFe(p => ({ ...p, truck: "" })); }} placeholder="RJ-XX-XX-XXXX" style={fe.truck ? S.inpErr : S.inp} /><FieldErr msg={fe.truck} /></div>
        <div><Label req>Supplier</Label><input value={form.supplier} onChange={e => { setForm(p => ({ ...p, supplier: e.target.value })); setFe(p => ({ ...p, supplier: "" })); }} style={fe.supplier ? S.inpErr : S.inp} /><FieldErr msg={fe.supplier} /></div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button onClick={add} disabled={saving} style={{ background: saving ? "rgba(16,185,129,0.4)" : editId ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : editId ? "Update" : "Save"}</button>
        <button onClick={cancel} style={S.ghostBtn}>Cancel</button>
      </div>
    </div>}
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>Supply Records <span style={{ color: "#34d399", fontSize: 10 }}>☁️</span></h3>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
        <thead><tr>{["Date", "Unit", "Fuel", "Litres", "Truck", "Supplier", ""].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{supply.map(s => <tr key={s.id || s._fbId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <td style={{ padding: "10px 10px" }}><span style={{ color: s.date === TODAY ? "#f59e0b" : "#64748b", fontSize: 12, fontWeight: s.date === TODAY ? 700 : 400 }}>{s.date}{s.date === TODAY && <span style={{ marginLeft: 6, background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>TODAY</span>}</span></td>
          <td style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 600, padding: "10px 10px" }}>{uc[s.unit]?.name || s.unit}</td>
          <td style={{ padding: "10px 10px" }}><span style={{ color: s.fuelType === "Petrol" ? "#f59e0b" : "#3b82f6", fontSize: 12, fontWeight: 700 }}>{s.fuelType}</span></td>
          <td style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700, padding: "10px 10px" }}>{s.litres?.toLocaleString()}L</td>
          <td style={{ color: "#64748b", fontSize: 11, padding: "10px 10px", fontFamily: "monospace" }}>{s.truck}</td>
          <td style={{ color: "#64748b", fontSize: 12, padding: "10px 10px" }}>{s.supplier}</td>
          <td style={{ padding: "10px 10px" }}>{canEdit(s) ? <button onClick={() => startEdit(s)} style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✏ Edit</button> : <span style={{ color: "#334155", fontSize: 11 }}>🔒 Locked</span>}</td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// LOGISTICS / ORDER ALERTS
// ════════════════════════════════════════════════════════════════════════
const LogisticsView = ({ tanks, settings, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedFuel, setSelectedFuel] = useState("petrol");
  const [customAvg, setCustomAvg] = useState("");
  const deadLevel = settings.deadLevelStock || 1500;
  const minOrder = settings.minOrderLitres || 12000;
  const maxOrder = settings.maxOrderLitres || 23000;

  const usableStock = useMemo(() => {
    const units = selectedUnit === "all" ? Object.keys(uc) : [selectedUnit];
    return units.reduce((sum, uid) => {
      const t = tanks[uid]?.[selectedFuel]; if (!t) return sum;
      return sum + Math.max(0, t.current - deadLevel);
    }, 0);
  }, [selectedUnit, selectedFuel, tanks, uc, deadLevel]);

  const defaultAvg = selectedFuel === "petrol" ? 820 : 1250;
  const avgSales = customAvg ? parseFloat(customAvg) || defaultAvg : defaultAvg;

  const alert = useMemo(() => computeOrderAlert(usableStock, avgSales, deadLevel, minOrder, maxOrder), [usableStock, avgSales, deadLevel, minOrder, maxOrder]);

  const tb = a => ({ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: a ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)", color: a ? "#fff" : "#64748b" });
  const fmtDt = dt => dt ? dt.toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const urgencyColor = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#34d399" };
  const urgencyEmoji = { CRITICAL: "🚨", HIGH: "⚠️", MEDIUM: "📋", LOW: "✅" };

  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>🚛 Smart Order Alerts</h1>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 20px" }}>Logistics engine — predicts ordering needs based on 7-day sales average</p>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>Unit:</span>
      {[["all", "All Units"], ...Object.entries(uc).map(([k, u]) => [k, u.name])].map(([v, l]) => <button key={v} onClick={() => setSelectedUnit(v)} style={tb(selectedUnit === v)}>{l}</button>)}
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>Fuel:</span>
      {[["petrol", "⛽ Petrol"], ["diesel", "🔵 Diesel"]].map(([v, l]) => <button key={v} onClick={() => setSelectedFuel(v)} style={tb(selectedFuel === v)}>{l}</button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 }}>
      <StatCard label="Usable Stock" value={`${usableStock.toLocaleString()} L`} sub={`Dead level: ${deadLevel.toLocaleString()}L/unit`} color="#3b82f6" icon="🛢" />
      <StatCard label="Avg Daily Sales" value={`${Math.round(avgSales)} L`} sub="Estimated 7-day avg" color="#f59e0b" icon="📊" />
      {alert && <StatCard label="Days Remaining" value={alert.daysLeft} sub="Until critical" color={urgencyColor[alert.urgency]} icon={urgencyEmoji[alert.urgency]} />}
      {alert && <StatCard label="Suggested Order" value={`${alert.suggestedQty.toLocaleString()} L`} sub={alert.truck.name} color="#10b981" icon="🚚" />}
    </div>
    {/* Override avg */}
    <div style={{ ...S.card, marginBottom: 16, maxWidth: 360 }}>
      <h3 style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.6px" }}>Override Daily Average</h3>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><input type="number" value={customAvg} onChange={e => setCustomAvg(e.target.value)} placeholder={`Default: ${defaultAvg} L/day`} style={S.inp} /></div>
        {customAvg && <button onClick={() => setCustomAvg("")} style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "none", borderRadius: 10, padding: "0 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Reset</button>}
      </div>
    </div>
    {alert ? <div style={{ ...S.card, border: `2px solid ${urgencyColor[alert.urgency]}44`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 36 }}>{urgencyEmoji[alert.urgency]}</span>
        <div>
          <h2 style={{ color: urgencyColor[alert.urgency], fontSize: 18, fontWeight: 800, margin: 0 }}>{alert.urgency} — {alert.daysLeft} days of stock remaining</h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>{Math.round(avgSales)} L/day avg · {selectedFuel} · {selectedUnit === "all" ? "All Units" : uc[selectedUnit]?.name}</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 18 }}>
        {[{ label: "📅 Stock Runs Out", value: fmtDt(alert.runsOut), color: urgencyColor[alert.urgency] }, { label: "🕐 Must Leave By", value: fmtDt(alert.mustLeaveBy), color: "#f59e0b" }, { label: "🚛 Soonest Departure", value: fmtDt(alert.departure), color: "#3b82f6" }].map(item => <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</p>
          <p style={{ color: item.color, fontSize: 13, fontWeight: 700, margin: 0 }}>{item.value}</p>
        </div>)}
      </div>
      <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: 18 }}>
        <h3 style={{ color: "#34d399", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>🚚 Recommended: {alert.truck.name}</h3>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div><p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase" }}>Capacity</p><p style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>{alert.truck.capacity.toLocaleString()} L</p></div>
          <div><p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 4px", textTransform: "uppercase" }}>Order Qty</p><p style={{ color: "#34d399", fontSize: 18, fontWeight: 800, margin: 0 }}>{alert.suggestedQty.toLocaleString()} L</p></div>
          <div><p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase" }}>Compartments</p><div style={{ display: "flex", gap: 6 }}>{alert.truck.compartments.map((c, i) => <span key={i} style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "4px 10px", color: "#34d399", fontSize: 13, fontWeight: 700 }}>{(c / 1000).toFixed(0)}K</span>)}</div></div>
        </div>
        {alert.truck.preferred && <p style={{ color: "#059669", fontSize: 12, margin: "10px 0 0", fontWeight: 600 }}>✓ Personal Truck — preferred unless need exceeds 14,000L</p>}
      </div>
      <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 12 }}>
        <p style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>📋 Logistics Rules</p>
        <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.7 }}>• Travel time: 7h each way (Unit ↔ Jodhpur Depot)<br />• Depot closes: 5:00 PM · No driving: 11 PM – 6 AM<br />• Closed: Sundays & Indian national holidays<br />• Orders: multiples of 1,000 L · Min {minOrder.toLocaleString()} L · Max {maxOrder.toLocaleString()} L<br />• Dead stock buffer: {deadLevel.toLocaleString()} L (never counted as usable)</p>
      </div>
    </div> : <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
      <p style={{ fontSize: 36, margin: "0 0 8px" }}>✅</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#34d399", margin: "0 0 4px" }}>Stock levels are healthy</p>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>No order action needed at this time</p>
    </div>}
    <div style={{ ...S.card, marginTop: 16 }}>
      <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>🚛 Truck Reference</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        {TRUCK_TYPES.map(t => <div key={t.id} style={{ background: t.preferred ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${t.preferred ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <p style={{ color: t.preferred ? "#f59e0b" : "#f1f5f9", fontSize: 13, fontWeight: 700, margin: 0 }}>{t.name}</p>
            {t.preferred && <span style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>PREFERRED</span>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{t.compartments.map((c, i) => <span key={i} style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{(c / 1000).toFixed(0)}K</span>)}</div>
        </div>)}
      </div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════════════════
const ExpensesView = () => {
  const ef = { date: TODAY, category: "Cleaning", amount: "", note: "" };
  const [expenses, setExpenses] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null), [form, setForm] = useState(ef), [errors, setErrors] = useState([]);
  const [fe, setFe] = useState({}), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  useEffect(() => { fbGet("expenses").then(data => { if (data && data.length > 0) setExpenses(data.sort((a, b) => b.date.localeCompare(a.date))); else setExpenses([{ id: "e1", date: TODAY, category: "Electricity Bill", amount: 4200, note: "Monthly electricity" }]); setLoading(false); }); }, []);
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const validate = () => { const errs = [], nfe = {}; if (!form.amount || parseFloat(form.amount) <= 0) { errs.push("Amount > 0"); nfe.amount = "Required"; } if (!form.note.trim()) { errs.push("Note required"); nfe.note = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const save = async () => { if (!validate()) return; setSaving(true); const entry = { ...form, amount: parseFloat(form.amount), savedAt: new Date().toISOString() }; if (editId) { const fbId = expenses.find(e => e.id === editId)?._fbId; if (fbId) await fbUpdate("expenses", fbId, entry); setExpenses(p => p.map(e => e.id === editId ? { ...e, ...entry } : e)); } else { const fbId = await fbAdd("expenses", entry); setExpenses(p => [{ ...entry, id: `e${Date.now()}`, _fbId: fbId }, ...p]); } setSaving(false); setEditId(null); setForm(ef); setShow(false); setErrors([]); setFe({}); setSaved(true); setTimeout(() => setSaved(false), 3000); };
  const startEdit = e => { setForm({ date: e.date, category: e.category, amount: String(e.amount), note: e.note }); setEditId(e.id); setShow(true); };
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Expenses</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Owner access only</p></div>
      <div style={{ display: "flex", gap: 8 }}>{(saving || saved) && <SyncBadge syncing={saving} />}<button onClick={() => { setShow(!show); setEditId(null); setForm(ef); setErrors([]); setFe({}); }} style={{ ...S.btn() }}>+ Add</button></div>
    </div>
    {loading && <div style={{ ...S.card, textAlign: "center", color: "#475569", padding: 40 }}>⏳ Loading...</div>}
    <Toast msg={saved ? "Expense saved ☁️" : null} />
    {show && <div style={{ ...S.card, border: `1px solid ${editId ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.2)"}`, marginBottom: 16 }}>
      <h3 style={{ color: editId ? "#60a5fa" : "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>{editId ? "Edit" : "New Expense"}</h3>
      <ErrBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <div><Label req>Date</Label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={S.inp} /></div>
        <div><Label req>Category</Label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={S.inp}>{EXPENSE_CATS.map(c => <option key={c} style={{ background: "#07111e" }}>{c}</option>)}</select></div>
        <div><Label req>Amount (₹)</Label><input type="number" value={form.amount} onChange={e => { setForm(p => ({ ...p, amount: e.target.value })); setFe(p => ({ ...p, amount: "" })); }} style={fe.amount ? S.inpErr : S.inp} /><FieldErr msg={fe.amount} /></div>
        <div><Label req>Note</Label><input value={form.note} onChange={e => { setForm(p => ({ ...p, note: e.target.value })); setFe(p => ({ ...p, note: "" })); }} style={fe.note ? S.inpErr : S.inp} /><FieldErr msg={fe.note} /></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={save} disabled={saving} style={{ background: saving ? "rgba(16,185,129,0.4)" : editId ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : editId ? "Update" : "Save"}</button><button onClick={() => { setShow(false); setErrors([]); setFe({}); }} style={S.ghostBtn}>Cancel</button></div>
    </div>}
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>All Expenses</h3><span style={{ color: "#f87171", fontWeight: 800, fontSize: 15 }}>Total: ₹{total.toLocaleString("en-IN")}</span></div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Date", "Category", "Amount", "Note", ""].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{expenses.map(e => <tr key={e.id || e._fbId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <td style={{ padding: "10px 10px" }}><span style={{ color: e.date === TODAY ? "#34d399" : "#64748b", fontSize: 12 }}>{e.date}{e.date === TODAY && <span style={{ marginLeft: 4, background: "rgba(16,185,129,0.12)", color: "#34d399", fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>TODAY</span>}</span></td>
          <td style={{ padding: "10px 10px" }}><span style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, padding: "3px 8px", borderRadius: 5, fontWeight: 700 }}>{e.category}</span></td>
          <td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "10px 10px" }}>₹{(e.amount || 0).toLocaleString("en-IN")}</td>
          <td style={{ color: "#475569", fontSize: 12, padding: "10px 10px" }}>{e.note}</td>
          <td style={{ padding: "10px 10px" }}><button onClick={() => startEdit(e)} style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✏ Edit</button></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// STAFF
// ════════════════════════════════════════════════════════════════════════
const StaffView = ({ staffList, setStaffList, unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const [showForm, setShowForm] = useState(false), [showTransfer, setShowTransfer] = useState(null), [transferUnit, setTransferUnit] = useState(Object.keys(uc)[0]);
  const [showPwdEdit, setShowPwdEdit] = useState(null), [newPwd, setNewPwd] = useState(""), [pwdSaved, setPwdSaved] = useState(false);
  const [errors, setErrors] = useState([]), [fe, setFe] = useState({}), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Pump Operator", salary: "", joining: TODAY, unit: Object.keys(uc)[0] || "unit1" });
  useEffect(() => { fbGet("staff").then(data => { if (data && data.length > 0) setStaffList(data.map(s => ({ ...s, id: s.id || s._fbId }))); }); }, []);
  const validate = () => { const errs = [], nfe = {}; if (!form.name.trim()) { errs.push("Name required"); nfe.name = "Required"; } if (!form.salary || parseFloat(form.salary) <= 0) { errs.push("Salary required"); nfe.salary = "Required"; } if (!form.role.trim()) { errs.push("Role required"); nfe.role = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const addStaff = async () => { if (!validate()) return; setSaving(true); const nm = { name: form.name, role: form.role, salary: parseFloat(form.salary), joining: form.joining, unit: form.unit, active: true, password: makeStaffPassword(form.name) }; const fbId = await fbAdd("staff", nm); setStaffList(p => [...p, { ...nm, id: fbId || `s${Date.now()}`, _fbId: fbId }]); setSaving(false); setForm({ name: "", role: "Pump Operator", salary: "", joining: TODAY, unit: Object.keys(uc)[0] }); setShowForm(false); setErrors([]); setFe({}); };
  const toggle = async id => { const s = staffList.find(x => x.id === id); if (!s) return; if (s._fbId) await fbUpdate("staff", s._fbId, { active: !s.active }); setStaffList(p => p.map(x => x.id === id ? { ...x, active: !x.active } : x)); };
  const remove = async id => { const s = staffList.find(x => x.id === id); if (s?._fbId) await fbDelete("staff", s._fbId); setStaffList(p => p.filter(x => x.id !== id)); };
  const doTransfer = async id => { const s = staffList.find(x => x.id === id); if (s?._fbId) await fbUpdate("staff", s._fbId, { unit: transferUnit }); setStaffList(p => p.map(x => x.id === id ? { ...x, unit: transferUnit } : x)); setShowTransfer(null); };
  const savePwd = async id => { if (!newPwd.trim()) return; const s = staffList.find(x => x.id === id); if (s?._fbId) await fbUpdate("staff", s._fbId, { password: newPwd.trim() }); setStaffList(p => p.map(x => x.id === id ? { ...x, password: newPwd.trim() } : x)); setShowPwdEdit(null); setNewPwd(""); setPwdSaved(true); setTimeout(() => setPwdSaved(false), 3000); };
  const total = staffList.filter(s => s.active).reduce((a, s) => a + (s.salary || 0), 0);
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Staff Management</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Owner only</p></div>
      <button onClick={() => setShowForm(!showForm)} style={{ ...S.btn() }}>+ Add Staff</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
      <StatCard label="Active Staff" value={staffList.filter(s => s.active).length} sub={`${staffList.filter(s => !s.active).length} inactive`} color="#10b981" icon="👥" />
      <StatCard label="Monthly Payroll" value={`₹${total.toLocaleString("en-IN")}`} sub="Active only" color="#ef4444" icon="💸" />
    </div>
    <Toast msg={pwdSaved ? "Password updated ☁️" : null} />
    {showForm && <div style={{ ...S.card, border: "1px solid rgba(245,158,11,0.2)", marginBottom: 16 }}>
      <h3 style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Add New Staff</h3>
      {form.name && <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(59,130,246,0.08)", borderRadius: 8 }}><p style={{ color: "#60a5fa", fontSize: 11, margin: 0 }}>Login: <b>{makeStaffEmail(form.name)}</b> · Password: <b>{makeStaffPassword(form.name)}</b></p></div>}
      <ErrBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
        <div><Label req>Full Name</Label><input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFe(p => ({ ...p, name: "" })); }} style={fe.name ? S.inpErr : S.inp} /><FieldErr msg={fe.name} /></div>
        <div><Label req>Role</Label><input value={form.role} onChange={e => { setForm(p => ({ ...p, role: e.target.value })); setFe(p => ({ ...p, role: "" })); }} style={fe.role ? S.inpErr : S.inp} /></div>
        <div><Label req>Salary</Label><input type="number" value={form.salary} onChange={e => { setForm(p => ({ ...p, salary: e.target.value })); setFe(p => ({ ...p, salary: "" })); }} style={fe.salary ? S.inpErr : S.inp} /><FieldErr msg={fe.salary} /></div>
        <div><Label>Joining Date</Label><input type="date" value={form.joining} onChange={e => setForm(p => ({ ...p, joining: e.target.value }))} style={S.inp} /></div>
        <div><Label>Unit</Label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={S.inp}>{Object.entries(uc).map(([k, u]) => <option key={k} value={k} style={{ background: "#07111e" }}>{u.name}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={addStaff} disabled={saving} style={{ background: saving ? "rgba(16,185,129,0.4)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : "Save"}</button><button onClick={() => setShowForm(false)} style={S.ghostBtn}>Cancel</button></div>
    </div>}
    {/* Transfer modal */}
    {showTransfer && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ ...S.card, border: "1px solid rgba(245,158,11,0.3)", width: 340 }}>
        <h3 style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Transfer Staff</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px" }}>Move <b style={{ color: "#f1f5f9" }}>{staffList.find(s => s.id === showTransfer)?.name}</b> to:</p>
        <div><Label>New Unit</Label><select value={transferUnit} onChange={e => setTransferUnit(e.target.value)} style={S.inp}>{Object.entries(uc).map(([k, u]) => <option key={k} value={k} style={{ background: "#07111e" }}>{u.name}</option>)}</select></div>
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}><button onClick={() => doTransfer(showTransfer)} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Transfer</button><button onClick={() => setShowTransfer(null)} style={S.ghostBtn}>Cancel</button></div>
      </div>
    </div>}
    {/* Password modal */}
    {showPwdEdit && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ ...S.card, border: "1px solid rgba(139,92,246,0.3)", width: 360 }}>
        <h3 style={{ color: "#a78bfa", fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>Change Password</h3>
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 12px" }}>For: <b style={{ color: "#f1f5f9" }}>{staffList.find(s => s.id === showPwdEdit)?.name}</b></p>
        <div style={{ marginBottom: 14 }}><Label req>New Password</Label><input value={newPwd} onChange={e => setNewPwd(e.target.value)} style={S.inp} /></div>
        <div style={{ display: "flex", gap: 10 }}><button onClick={() => savePwd(showPwdEdit)} style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button><button onClick={() => { setShowPwdEdit(null); setNewPwd(""); }} style={S.ghostBtn}>Cancel</button></div>
      </div>
    </div>}
    {Object.entries(uc).map(([uid, unit]) => {
      const us = staffList.filter(s => s.unit === uid); if (!us.length) return null;
      return <div key={uid} style={{ marginBottom: 20 }}>
        <h3 style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, margin: "0 0 10px", letterSpacing: "0.6px", textTransform: "uppercase" }}>⛽ {unit.name} — {us.length} staff</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          {us.map(s => <div key={s.id} style={{ ...S.card, border: `1px solid ${s.active ? "rgba(16,185,129,0.16)" : "rgba(255,255,255,0.05)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, background: s.active ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{s.active ? "👤" : "👻"}</div>
                <div><p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>{s.name}</p><p style={{ color: "#475569", fontSize: 12, margin: "2px 0 0" }}>{s.role}</p></div>
              </div>
              <span style={{ background: s.active ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: s.active ? "#34d399" : "#f87171", fontSize: 10, padding: "3px 9px", borderRadius: 5, fontWeight: 700 }}>{s.active ? "Active" : "Inactive"}</span>
            </div>
            <div style={{ marginBottom: 10, padding: "6px 10px", background: "rgba(59,130,246,0.06)", borderRadius: 8 }}><p style={{ color: "#60a5fa", fontSize: 10, margin: 0, fontFamily: "monospace" }}>{makeStaffEmail(s.name)}</p></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#475569", fontSize: 12 }}>Salary</span><span style={{ color: "#f59e0b", fontSize: 14, fontWeight: 800 }}>₹{(s.salary || 0).toLocaleString("en-IN")}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#475569", fontSize: 12 }}>Joined</span><span style={{ color: "#64748b", fontSize: 12 }}>{new Date(s.joining).toLocaleDateString("en-IN")}</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => { setShowTransfer(s.id); setTransferUnit(s.unit); }} style={{ flex: 1, minWidth: 70, background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⇄ Transfer</button>
              <button onClick={() => { setShowPwdEdit(s.id); setNewPwd(s.password || ""); }} style={{ flex: 1, minWidth: 70, background: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔑 Pwd</button>
              <button onClick={() => toggle(s.id)} style={{ flex: 1, minWidth: 70, background: s.active ? "rgba(239,68,68,0.07)" : "rgba(16,185,129,0.07)", color: s.active ? "#f87171" : "#34d399", border: `1px solid ${s.active ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`, borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{s.active ? "Deactivate" : "Activate"}</button>
              <button onClick={() => remove(s.id)} style={{ background: "rgba(239,68,68,0.07)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
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
  const [trips, setTrips] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(false);
  const [errors, setErrors] = useState([]), [fe, setFe] = useState({}), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: TODAY, truck: "", km: "", rate: "28", driverPay: "", diesel: "", loading: "", unloading: "" });
  useEffect(() => { fbGet("transport").then(data => { if (data && data.length > 0) setTrips(data.sort((a, b) => b.date.localeCompare(a.date))); setLoading(false); }); }, []);
  const calcP = t => (parseFloat(t.km || 0) * parseFloat(t.rate || 0)) - (parseFloat(t.driverPay || 0) + parseFloat(t.diesel || 0) + parseFloat(t.loading || 0) + parseFloat(t.unloading || 0));
  const tInc = trips.reduce((s, t) => s + (t.km * t.rate || 0), 0), tExp = trips.reduce((s, t) => s + ((t.driverPay || 0) + (t.diesel || 0) + (t.loading || 0) + (t.unloading || 0)), 0);
  const validate = () => { const errs = [], nfe = {}; if (!form.truck.trim()) { errs.push("Truck number required"); nfe.truck = "Required"; } if (!form.km || parseFloat(form.km) <= 0) { errs.push("KM > 0 required"); nfe.km = "Required"; } if (!form.rate || parseFloat(form.rate) <= 0) { errs.push("Rate required"); nfe.rate = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const add = async () => { if (!validate()) return; setSaving(true); const entry = { ...form, km: parseFloat(form.km), rate: parseFloat(form.rate), driverPay: parseFloat(form.driverPay || 0), diesel: parseFloat(form.diesel || 0), loading: parseFloat(form.loading || 0), unloading: parseFloat(form.unloading || 0), savedAt: new Date().toISOString() }; const fbId = await fbAdd("transport", entry); setTrips(p => [{ ...entry, id: fbId || `t${Date.now()}`, _fbId: fbId }, ...p]); setForm({ date: TODAY, truck: "", km: "", rate: "28", driverPay: "", diesel: "", loading: "", unloading: "" }); setShow(false); setErrors([]); setFe({}); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000); };
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Transport Income</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Pump ↔ Depot trips</p></div>
      <div style={{ display: "flex", gap: 8 }}>{(saving || saved) && <SyncBadge syncing={saving} />}<button onClick={() => { setShow(!show); setErrors([]); setFe({}); }} style={{ ...S.btn("#8b5cf6") }}>+ Add Trip</button></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
      <StatCard label="Total Income" value={`₹${tInc.toLocaleString("en-IN")}`} sub={`${trips.length} trips`} color="#8b5cf6" icon="🚚" />
      <StatCard label="Total Expenses" value={`₹${tExp.toLocaleString("en-IN")}`} color="#ef4444" icon="💸" />
      <StatCard label="Net Profit" value={`₹${(tInc - tExp).toLocaleString("en-IN")}`} color="#10b981" icon="💰" />
    </div>
    {loading && <div style={{ ...S.card, textAlign: "center", color: "#475569", padding: 30, marginBottom: 14 }}>⏳ Loading...</div>}
    <Toast msg={saved ? "Trip saved ☁️" : null} />
    {show && <div style={{ ...S.card, border: "1px solid rgba(139,92,246,0.25)", marginBottom: 16 }}>
      <h3 style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>New Trip</h3>
      <ErrBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        {[["Date", "date", "date"], ["Truck No.", "truck", "text"], ["Distance KM", "km", "number"], ["Rate/KM ₹", "rate", "number"], ["Driver Pay", "driverPay", "number"], ["Diesel Cost", "diesel", "number"], ["Loading ₹", "loading", "number"], ["Unloading ₹", "unloading", "number"]].map(([l, k, t]) => (
          <div key={k}><Label>{l}</Label><input type={t} value={form[k]} onChange={e => { setForm(p => ({ ...p, [k]: e.target.value })); setFe(p => ({ ...p, [k]: "" })); }} style={fe[k] ? S.inpErr : S.inp} /><FieldErr msg={fe[k]} /></div>
        ))}
      </div>
      {form.km && form.rate && <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(139,92,246,0.08)", borderRadius: 8 }}><span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>Est. Profit: ₹{calcP(form).toLocaleString("en-IN")}</span></div>}
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={add} disabled={saving} style={{ background: saving ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : "Save"}</button><button onClick={() => { setShow(false); setErrors([]); setFe({}); }} style={S.ghostBtn}>Cancel</button></div>
    </div>}
    <div style={S.card}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
      <thead><tr>{["Date", "Truck", "KM", "Income", "Expenses", "Profit"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
      <tbody>{trips.map(t => {
        const inc = t.km * t.rate, exp = (t.driverPay || 0) + (t.diesel || 0) + (t.loading || 0) + (t.unloading || 0), p = inc - exp; return <tr key={t.id || t._fbId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <td style={{ color: "#64748b", fontSize: 12, padding: "10px 10px" }}>{t.date}</td>
          <td style={{ color: "#f1f5f9", fontSize: 12, fontFamily: "monospace", fontWeight: 700, padding: "10px 10px" }}>{t.truck}</td>
          <td style={{ color: "#64748b", fontSize: 12, padding: "10px 10px" }}>{t.km}km</td>
          <td style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, padding: "10px 10px" }}>₹{inc.toLocaleString("en-IN")}</td>
          <td style={{ color: "#f87171", fontSize: 13, padding: "10px 10px" }}>₹{exp.toLocaleString("en-IN")}</td>
          <td style={{ padding: "10px 10px" }}><span style={{ color: p >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 800 }}>₹{p.toLocaleString("en-IN")}</span></td>
        </tr>;
      })}
      </tbody>
    </table></div></div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════════════════════════════════
const ReportsView = ({ unitConfig }) => {
  const uc = unitConfig || UNIT_CONFIG_INIT;
  const monthly = useMemo(genMonthly, []);
  const [tab, setTab] = useState("summary"), [unitFilter, setUnitFilter] = useState("all");
  const tb = a => ({ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: tab === a ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.05)", color: tab === a ? "#fff" : "#64748b" });
  const ub = a => ({ padding: "6px 12px", borderRadius: 7, border: `1px solid ${unitFilter === a ? "rgba(59,130,246,0.3)" : "transparent"}`, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: unitFilter === a ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)", color: unitFilter === a ? "#60a5fa" : "#64748b" });
  const unitLabel = unitFilter === "all" ? "All Units Combined" : uc[unitFilter]?.name;
  const pl = { revenue: 0, cost: 0, gross: 0, opex: 0, ebitda: 0, dep: 0, ebit: 0, tax: 0, net: 0 };
  const adj = (v) => unitFilter === "all" ? v : Math.round(v / 3);
  const exportCSV = (type) => {
    let csv = "";
    if (type === "pl") csv = `Trading P&L — ${unitLabel}\n\nParticulars,Amount (₹)\nRevenue from Operations,${adj(pl.revenue)}\nCost of Goods Sold,(${adj(pl.cost)})\nGross Profit,${adj(pl.gross)}\nOperating Expenses,(${adj(pl.opex)})\nEBITDA,${adj(pl.ebitda)}\nDepreciation,(${adj(pl.dep)})\nEBIT,${adj(pl.ebit)}\nTax 25%,(${adj(pl.tax)})\nNet Profit,${adj(pl.net)}\n`;
    else if (type === "balance") csv = `Balance Sheet — ${unitLabel}\n\nASSETS,Amount\nInventory,340000\nCash,285000\nReceivables,62000\nFixed Assets,1355000\nTotal,1957000\n\nLIABILITIES,Amount\nOwner Equity,1132000\nTerm Loans,450000\nTrade Payables,145000\nOther,230000\nTotal,1957000\n`;
    else csv = `Lubricant Sales — ${unitLabel}\n\nProduct,Qty,Rate,Amount\n(No data yet)\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${type}-${unitFilter}-${TODAY}.csv`; a.click();
  };
  const r = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Reports & Analytics</h1>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 18px" }}>Owner access — ICAI-aligned statements · Export CSV</p>
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>Filter:</span>
      {[["all", "All Units"], ...Object.entries(uc).map(([k, u]) => [k, u.name])].map(([v, l]) => <button key={v} onClick={() => setUnitFilter(v)} style={ub(v)}>{l}</button>)}
    </div>
    <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
      {[["summary", "📊 Summary"], ["pl", "📈 P&L"], ["balance", "🏦 Balance Sheet"], ["lubricants", "🛢 Lubricants"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={tb(k)}>{l}</button>)}
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>Export CSV:</span>
      {[["pl", "P&L"], ["balance", "Balance Sheet"], ["lubricants", "Lubricants"]].map(([t, l]) => <button key={t} onClick={() => exportCSV(t)} style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>⬇ {l}</button>)}
      <span style={{ color: "#475569", fontSize: 10 }}>For PDF: Ctrl+P → Save as PDF</span>
    </div>
    {tab === "summary" && <>
      <div style={{ ...S.card, marginBottom: 16 }}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Revenue vs Expenses — {unitLabel}</h3><ResponsiveContainer width="100%" height={230}><BarChart data={monthly} barSize={18}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} formatter={v => [`₹${v.toLocaleString("en-IN")}`, ""]} /><Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} /><Bar dataKey="profit" name="Gross Profit" fill="#10b981" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div style={S.card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Monthly Summary</h3><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Month", "Petrol(L)", "Diesel(L)", "Gross Profit", "Expenses", "Net Profit"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead><tbody>{monthly.map(m => { const net = m.profit - m.expenses; return <tr key={m.month} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}><td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "10px 10px" }}>{m.month}</td><td style={{ color: "#f59e0b", fontSize: 13, padding: "10px 10px" }}>{m.petrol.toLocaleString()}</td><td style={{ color: "#3b82f6", fontSize: 13, padding: "10px 10px" }}>{m.diesel.toLocaleString()}</td><td style={{ color: "#34d399", fontSize: 13, fontWeight: 700, padding: "10px 10px" }}>₹{m.profit.toLocaleString("en-IN")}</td><td style={{ color: "#f87171", fontSize: 13, padding: "10px 10px" }}>₹{m.expenses.toLocaleString("en-IN")}</td><td style={{ padding: "10px 10px" }}><span style={{ color: net >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 800 }}>₹{net.toLocaleString("en-IN")}</span></td></tr>; })} </tbody></table></div>
    </>}
    {tab === "pl" && <div style={S.card}>
      <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Trading & Profit & Loss Account</h3>
      <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 18px" }}>{unitLabel} · FY 2025–26 · As per ICAI (AS-9, AS-26)</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "10px 14px", borderBottom: "2px solid rgba(255,255,255,0.1)", textTransform: "uppercase" }}>Particulars</th><th style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "right", padding: "10px 14px", borderBottom: "2px solid rgba(255,255,255,0.1)", textTransform: "uppercase" }}>Amount (₹)</th></tr></thead>
        <tbody>{[
          { l: "I. Revenue from Operations", v: r(adj(pl.revenue)), bold: true, c: "#f1f5f9" },
          { l: "II. Cost of Goods Sold", v: `(${r(adj(pl.cost))})`, c: "#f87171" },
          { l: "III. Gross Profit", v: r(adj(pl.gross)), bold: true, c: "#34d399", border: true },
          { l: "IV. Operating Expenses", v: `(${r(adj(pl.opex))})`, c: "#f87171" },
          { l: "   - Staff Salaries", v: r(adj(Math.round(pl.opex * 0.55))), small: true, c: "#64748b" },
          { l: "   - Electricity & Utilities", v: r(adj(Math.round(pl.opex * 0.2))), small: true, c: "#64748b" },
          { l: "   - Maintenance", v: r(adj(Math.round(pl.opex * 0.25))), small: true, c: "#64748b" },
          { l: "V. EBITDA", v: r(adj(pl.ebitda)), bold: true, c: "#f59e0b", border: true },
          { l: "VI. Depreciation", v: `(${r(adj(pl.dep))})`, c: "#f87171" },
          { l: "VII. EBIT", v: r(adj(pl.ebit)), bold: true, c: "#f59e0b" },
          { l: "VIII. Tax @ 25%", v: `(${r(adj(pl.tax))})`, c: "#f87171" },
          { l: "IX. Net Profit After Tax", v: r(adj(pl.net)), bold: true, c: "#34d399", border: true, large: true },
        ].map((row, i) => <tr key={i} style={{ borderBottom: row.border ? "2px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.03)", background: row.large ? "rgba(16,185,129,0.05)" : "transparent" }}>
          <td style={{ color: row.c || "#64748b", fontSize: row.small ? 11 : row.large ? 14 : 13, fontWeight: row.bold ? 700 : 400, padding: `${row.bold ? 11 : 8}px 14px` }}>{row.l}</td>
          <td style={{ color: row.c || "#64748b", fontSize: row.small ? 11 : row.large ? 14 : 13, fontWeight: row.bold ? 800 : 500, padding: `${row.bold ? 11 : 8}px 14px`, textAlign: "right", fontFamily: "monospace" }}>{row.v}</td>
        </tr>)}</tbody>
      </table>
      <p style={{ color: "#334155", fontSize: 10, margin: "14px 0 0", fontStyle: "italic" }}>Per ICAI AS-9 (Revenue Recognition) & AS-26. Indicative figures.</p>
    </div>}
    {tab === "balance" && <div style={S.card}>
      <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Balance Sheet</h3>
      <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 18px" }}>{unitLabel} · 31 March 2026 · Schedule III, Companies Act 2013</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <h4 style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, margin: "0 0 10px", borderBottom: "1px solid rgba(245,158,11,0.2)", paddingBottom: 8 }}>ASSETS</h4>
          {[["Current Assets", ""], ["  Inventory (Fuel+Lube)", "₹0"], ["  Cash & Bank", "₹0"], ["  Receivables", "₹0"], ["Total Current Assets", "₹0"], [""], ["Fixed Assets", ""], ["  Plant & Machinery", "₹0"], ["  Vehicles", "₹0"], ["  Furniture", "₹0"], ["Total Fixed Assets", "₹0"], [""], ["TOTAL ASSETS", "₹0"]].map(([k, v], i) => k ? <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: k.startsWith("Total") || k === "TOTAL ASSETS" ? "1px solid rgba(255,255,255,0.08)" : "none" }}><span style={{ color: k.startsWith("Total") || k === "TOTAL ASSETS" ? "#f1f5f9" : k.startsWith("  ") ? "#64748b" : "#94a3b8", fontSize: k === "TOTAL ASSETS" ? 13 : 12, fontWeight: k.startsWith("Total") || k === "TOTAL ASSETS" ? 700 : 400 }}>{k}</span><span style={{ color: k === "TOTAL ASSETS" ? "#f59e0b" : "#f1f5f9", fontSize: 12, fontWeight: k.startsWith("Total") || k === "TOTAL ASSETS" ? 700 : 500, fontFamily: "monospace" }}>{v}</span></div> : <div key={i} style={{ height: 8 }} />)}
        </div>
        <div>
          <h4 style={{ color: "#3b82f6", fontSize: 13, fontWeight: 700, margin: "0 0 10px", borderBottom: "1px solid rgba(59,130,246,0.2)", paddingBottom: 8 }}>LIABILITIES & EQUITY</h4>
          {[["Owner's Equity", ""], ["  Capital", "₹0"], ["  Retained Earnings", "₹0"], ["Total Equity", "₹0"], [""], ["Current Liabilities", ""], ["  Trade Payables", "₹0"], ["  Borrowings", "₹0"], ["Total Current Liab.", "₹0"], [""], ["Non-Current Liab.", ""], ["  Term Loans", "₹0"], ["Total NC Liab.", "₹0"], [""], ["TOTAL LIAB. & EQUITY", "₹0"]].map(([k, v], i) => k ? <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: k.startsWith("Total") || k === "TOTAL LIAB. & EQUITY" ? "1px solid rgba(255,255,255,0.08)" : "none" }}><span style={{ color: k.startsWith("Total") || k === "TOTAL LIAB. & EQUITY" ? "#f1f5f9" : k.startsWith("  ") ? "#64748b" : "#94a3b8", fontSize: k === "TOTAL LIAB. & EQUITY" ? 13 : 12, fontWeight: k.startsWith("Total") || k === "TOTAL LIAB. & EQUITY" ? 700 : 400 }}>{k}</span><span style={{ color: k === "TOTAL LIAB. & EQUITY" ? "#3b82f6" : "#f1f5f9", fontSize: 12, fontWeight: k.startsWith("Total") || k === "TOTAL LIAB. & EQUITY" ? 700 : 500, fontFamily: "monospace" }}>{v}</span></div> : <div key={i} style={{ height: 8 }} />)}
        </div>
      </div>
    </div>}
    {tab === "lubricants" && <div style={S.card}>
      <h3 style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 800, margin: "0 0 4px" }}>Lubricant Sales Report</h3>
      <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 18px" }}>{unitLabel}</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Product", "Qty", "Rate", "Total", "Margin"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "10px 12px", borderBottom: "2px solid rgba(255,255,255,0.1)", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody><tr><td colSpan={5} style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "40px 0", fontStyle: "italic" }}>No lubricant data yet. Add sales entries to see reports.</td></tr></tbody>
        </tbody>
      </table>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════
const SettingsView = ({ settings, setSettings, tanks, setTanks, unitConfig, setUnitConfig, onFactoryReset }) => {
  const [local, setLocal] = useState(settings), [lt, setLt] = useState(tanks), [luc, setLuc] = useState(unitConfig);
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [tab, setTab] = useState("prices");
  const [showReset, setShowReset] = useState(false), [resetPwd, setResetPwd] = useState(""), [resetErr, setResetErr] = useState(""), [resetStep, setResetStep] = useState(1), [resetting, setResetting] = useState(false);
  const [rateConfirm, setRateConfirm] = useState(false), [pendingSave, setPendingSave] = useState(false);
  const [newUnitName, setNewUnitName] = useState(""), [renamingUnit, setRenamingUnit] = useState(null), [renameVal, setRenameVal] = useState("");
  const [newMachineName, setNewMachineName] = useState(""), [addMachineUnit, setAddMachineUnit] = useState(null);

  useEffect(() => {
    fbGet("settings").then(data => { if (data && data.length > 0) { const s = data[0]; const m = { ...INITIAL_SETTINGS, ...s }; setLocal(m); setSettings(m); } });
    fbGet("tanks").then(data => { if (data && data.length > 0) { const t = data[0]; if (t.unit1) { setLt(t); setTanks(t); } } });
  }, []);

  const priceChanged = local.petrolPrice !== settings.petrolPrice || local.dieselPrice !== settings.dieselPrice;
  const save = async () => {
    if (priceChanged && !pendingSave) { setRateConfirm(true); setPendingSave(true); return; }
    setPendingSave(false); setSaving(true);
    await fbSet("settings", "main", local); await fbSet("tanks", "main", lt);
    setSettings(local); setTanks(lt); setUnitConfig(luc);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const updT = (uid, fk, field, val) => setLt(p => ({ ...p, [uid]: { ...p[uid], [fk]: { ...p[uid][fk], [field]: parseFloat(val) || 0 } } }));
  const updM = (uid, field, val) => setLuc(p => ({ ...p, [uid]: { ...p[uid], [field]: parseFloat(val) || 0 } }));

  const addUnit = () => { if (!newUnitName.trim()) return; const k = `unit${Date.now()}`; setLuc(p => ({ ...p, [k]: { name: newUnitName.trim(), machines: [], petrolMargin: 4.00, dieselMargin: 2.50 } })); setLt(p => ({ ...p, [k]: { petrol: { capacity: 10000, current: 0 }, diesel: { capacity: 15000, current: 0 } } })); setNewUnitName(""); };
  const removeUnit = (uid) => { setLuc(p => { const n = { ...p }; delete n[uid]; return n; }); setLt(p => { const n = { ...p }; delete n[uid]; return n; }); };
  const renameUnit = (uid) => { if (!renameVal.trim()) return; setLuc(p => ({ ...p, [uid]: { ...p[uid], name: renameVal.trim() } })); setRenamingUnit(null); setRenameVal(""); };
  const addMachine = (uid) => { if (!newMachineName.trim()) return; setLuc(p => ({ ...p, [uid]: { ...p[uid], machines: [...(p[uid].machines || []), newMachineName.trim()] } })); setNewMachineName(""); setAddMachineUnit(null); };
  const removeMachine = (uid, mId) => setLuc(p => ({ ...p, [uid]: { ...p[uid], machines: p[uid].machines.filter(m => m !== mId) } }));
  const handleReset = async () => {
    setResetErr("");
    if (resetPwd.toLowerCase() !== OWNER_CRED.password.toLowerCase()) { setResetErr("Incorrect password."); return; }
    setResetting(true);
    await fbNukeAll(); // DELETE ALL FIREBASE CLOUD DATA
    onFactoryReset();  // RESET LOCAL STATE
    setResetting(false); setShowReset(false); setResetPwd(""); setResetStep(1);
  };

  const tabs = [["prices", "⛽ Prices"], ["tanks", "🪣 Tanks"], ["margins", "📊 Margins"], ["units", "🏢 Units"], ["logistics", "🚛 Logistics"], ["alerts", "🔔 Alerts"], ["info", "ℹ️ Info"], ["reset", "🗑️ Reset"]];
  const tb = a => ({ padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: tab === a ? (a === "reset" ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#f59e0b,#d97706)") : "rgba(255,255,255,0.05)", color: tab === a ? "#fff" : "#64748b" });

  return <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
    <ConfirmModal open={rateConfirm} title="Rate Change Warning" msg="Changing fuel prices or margins will ONLY affect future transactions. All past data stays untouched. Proceed?" onOk={() => { setRateConfirm(false); save(); }} onCancel={() => { setRateConfirm(false); setPendingSave(false); }} okLabel="Yes, Update" />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
      <h1 style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 800, margin: 0 }}>Settings</h1>
      {(saving || saved) && <SyncBadge syncing={saving} />}
    </div>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 16px" }}>Owner full access · saved to Firebase</p>
    <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={tb(k)}>{l}</button>)}</div>

    {tab === "prices" && <div style={{ ...S.card, maxWidth: 420 }}>
      <h3 style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>⛽ Live Fuel Prices</h3>
      {priceChanged && <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠ Rate changed — will apply to future transactions only</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div><Label>Petrol (₹/L)</Label><input type="number" step="0.01" value={local.petrolPrice} onChange={e => setLocal(p => ({ ...p, petrolPrice: parseFloat(e.target.value) }))} style={S.inp} /></div>
        <div><Label>Diesel (₹/L)</Label><input type="number" step="0.01" value={local.dieselPrice} onChange={e => setLocal(p => ({ ...p, dieselPrice: parseFloat(e.target.value) }))} style={S.inp} /></div>
      </div>
    </div>}

    {tab === "tanks" && <div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>{Object.entries(lt).filter(([k]) => k !== "_fbId" && k !== "savedAt").map(([uid]) => <div key={uid} style={{ ...S.card, border: "1px solid rgba(245,158,11,0.15)" }}>
      <h3 style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>{luc[uid]?.name || uid}</h3>
      {[["petrol", "⛽ Petrol", "#f59e0b"], ["diesel", "🔵 Diesel", "#3b82f6"]].map(([fk, fname, col]) => <div key={fk} style={{ marginBottom: 12, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
        <p style={{ color: col, fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>{fname}</p>
        <div style={{ display: "flex", gap: 10 }}><div style={{ flex: 1 }}><Label>Capacity (L)</Label><input type="number" value={lt[uid]?.[fk]?.capacity || 0} onChange={e => updT(uid, fk, "capacity", e.target.value)} style={S.inp} /></div><div style={{ flex: 1 }}><Label>Current (L)</Label><input type="number" value={lt[uid]?.[fk]?.current || 0} onChange={e => updT(uid, fk, "current", e.target.value)} style={S.inp} /></div></div>
      </div>)}
    </div>)}</div></div>}

    {tab === "margins" && <div>
      {priceChanged && <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠ Changes apply to future transactions only — past data protected</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 14 }}>{Object.entries(luc).map(([uid, unit]) => <div key={uid} style={{ ...S.card, border: "1px solid rgba(16,185,129,0.15)" }}>
        <h3 style={{ color: "#34d399", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>{unit.name}</h3>
        <div style={{ display: "flex", gap: 12 }}><div style={{ flex: 1, padding: 12, background: "rgba(245,158,11,0.06)", borderRadius: 10 }}><p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>⛽ Petrol (₹/L)</p><input type="number" step="0.01" value={unit.petrolMargin} onChange={e => updM(uid, "petrolMargin", e.target.value)} style={S.inp} /></div><div style={{ flex: 1, padding: 12, background: "rgba(59,130,246,0.06)", borderRadius: 10 }}><p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>🔵 Diesel (₹/L)</p><input type="number" step="0.01" value={unit.dieselMargin} onChange={e => updM(uid, "dieselMargin", e.target.value)} style={S.inp} /></div></div>
      </div>)}</div>
    </div>}

    {tab === "units" && <div>
      <div style={{ ...S.card, border: "1px solid rgba(245,158,11,0.2)", marginBottom: 18, maxWidth: 440 }}>
        <h3 style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>➕ Add New Unit</h3>
        <div style={{ display: "flex", gap: 10 }}><div style={{ flex: 1 }}><Label>Unit Name</Label><input value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="e.g. Unit 4" style={S.inp} /></div><button onClick={addUnit} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 10, padding: "0 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 20 }}>Add</button></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>{Object.entries(luc).map(([uid, unit]) => <div key={uid} style={{ ...S.card, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          {renamingUnit === uid ? <div style={{ display: "flex", gap: 8, flex: 1 }}>
            <input value={renameVal} onChange={e => setRenameVal(e.target.value)} style={{ ...S.inp, flex: 1 }} autoFocus />
            <button onClick={() => renameUnit(uid)} style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
            <button onClick={() => setRenamingUnit(null)} style={{ ...S.ghostBtn, padding: "8px 10px" }}>✕</button>
          </div> : <>
            <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>{unit.name}</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setRenamingUnit(uid); setRenameVal(unit.name); }} style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Rename</button>
              <button onClick={() => removeUnit(uid)} style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
            </div>
          </>}
        </div>
        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Machines ({(unit.machines || []).length})</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {(unit.machines || []).map(m => <div key={m} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 7, padding: "4px 8px" }}>
            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>{m}</span>
            <button onClick={() => removeMachine(uid, m)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "0 2px", fontSize: 14, lineHeight: 1 }}>×</button>
          </div>)}
          {addMachineUnit === uid ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={newMachineName} onChange={e => setNewMachineName(e.target.value)} placeholder="e.g. M8" style={{ ...S.inp, width: 80, padding: "5px 8px", fontSize: 12 }} autoFocus />
            <button onClick={() => addMachine(uid)} style={{ background: "rgba(16,185,129,0.2)", color: "#34d399", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            <button onClick={() => setAddMachineUnit(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13 }}>✕</button>
          </div> : <button onClick={() => { setAddMachineUnit(uid); setNewMachineName(""); }} style={{ background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>+ Machine</button>}
        </div>
      </div>)}</div>
    </div>}

    {tab === "logistics" && <div style={{ ...S.card, maxWidth: 460 }}>
      <h3 style={{ color: "#10b981", fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>🚛 Logistics Parameters</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div><Label>Dead Stock Buffer (L per unit)</Label><input type="number" value={local.deadLevelStock} onChange={e => setLocal(p => ({ ...p, deadLevelStock: parseFloat(e.target.value) || 1500 }))} style={S.inp} /><p style={{ color: "#475569", fontSize: 11, margin: "4px 0 0" }}>Recommended 1,500–2,000 L. Never counted as usable.</p></div>
        <div><Label>Minimum Order (L)</Label><input type="number" value={local.minOrderLitres} onChange={e => setLocal(p => ({ ...p, minOrderLitres: parseFloat(e.target.value) || 12000 }))} style={S.inp} /></div>
        <div><Label>Maximum Order (L)</Label><input type="number" value={local.maxOrderLitres} onChange={e => setLocal(p => ({ ...p, maxOrderLitres: parseFloat(e.target.value) || 23000 }))} style={S.inp} /></div>
        <div style={{ padding: "12px 14px", background: "rgba(59,130,246,0.06)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.15)" }}>
          <p style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>Fixed Parameters</p>
          <p style={{ color: "#64748b", fontSize: 12, margin: 0, lineHeight: 1.7 }}>• Travel: 7h each way · Depot closes 5PM<br />• No driving: 11PM–6AM · Closed Sundays & holidays<br />• Orders in multiples of 1,000 L</p>
        </div>
      </div>
    </div>}

    {tab === "alerts" && <div style={{ ...S.card, maxWidth: 420 }}>
      <h3 style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>🔔 Alert Thresholds</h3>
      <div><Label>Low Stock Alert (Litres)</Label><input type="number" value={local.lowStockAlert} onChange={e => setLocal(p => ({ ...p, lowStockAlert: parseFloat(e.target.value) }))} style={S.inp} /><p style={{ color: "#334155", fontSize: 11, margin: "6px 0 0" }}>Tanks below this show ⚠ LOW warning</p></div>
    </div>}

    {tab === "info" && <div style={{ ...S.card, maxWidth: 460 }}>
      <h3 style={{ color: "#64748b", fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>ℹ️ Station Information</h3>
      {[["Station", "Shree K C Sarswat Auto Fuel Station"], ["Location", "Lunkaransar, Rajasthan 334603"], ["Units", `${Object.keys(luc).length} Units · ${Object.values(luc).reduce((a, u) => a + (u.machines || []).length, 0)} Machines`], ["Distributor", "HPCL"], ["Firebase", "kc-sarswat-erp-9dced"], ["Owner Login", "owner@kcsarswat.in"]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>{k}</span><span style={{ color: "#94a3b8", fontSize: 12 }}>{v}</span></div>)}
    </div>}

    {tab === "reset" && <div style={{ maxWidth: 520 }}>
      <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 18, padding: 22, marginBottom: 18 }}>
        <h3 style={{ color: "#fca5a5", fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>🗑️ Factory Reset — Erase All Data</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0, lineHeight: 1.6 }}>Permanently deletes ALL Firebase cloud data (sales, supply, expenses, staff, transport) AND resets app to zero. <b style={{ color: "#f87171" }}>Cannot be undone — Firebase data gone forever.</b></p>
      </div>
      {!showReset ? <button onClick={() => setShowReset(true)} style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(239,68,68,0.35)" }}>Initiate Factory Reset</button>
        : <div style={{ ...S.card, border: "1px solid rgba(239,68,68,0.3)" }}>
          {resetStep === 1 && <><h3 style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>🔒 Verify Identity</h3><p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>Enter owner password:</p><div style={{ marginBottom: 14 }}><Label>Owner Password</Label><input type="password" value={resetPwd} onChange={e => { setResetPwd(e.target.value); setResetErr(""); }} style={resetErr ? S.inpErr : S.inp} />{resetErr && <p style={{ color: "#f87171", fontSize: 12, margin: "6px 0 0", fontWeight: 600 }}>{resetErr}</p>}</div><div style={{ display: "flex", gap: 10 }}><button onClick={() => { if (!resetPwd) { setResetErr("Password required"); return; } if (resetPwd.toLowerCase() !== OWNER_CRED.password.toLowerCase()) { setResetErr("Incorrect password."); return; } setResetStep(2); }} style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Verify →</button><button onClick={() => { setShowReset(false); setResetPwd(""); setResetErr(""); setResetStep(1); }} style={S.ghostBtn}>Cancel</button></div></>}
          {resetStep === 2 && <><h3 style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>⚠ Final Confirmation</h3><p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>This will PERMANENTLY DELETE all Firebase cloud data AND reset everything to zero. Your client starts completely fresh with no history.</p><div style={{ display: "flex", gap: 10 }}><button onClick={handleReset} disabled={resetting} style={{ background: resetting ? "rgba(239,68,68,0.4)" : "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 13, fontWeight: 800, cursor: resetting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{resetting ? "Resetting..." : "🗑️ Yes, Reset Everything"}</button><button onClick={() => { setShowReset(false); setResetPwd(""); setResetErr(""); setResetStep(1); }} style={S.ghostBtn}>Cancel</button></div></>}
        </div>}
    </div>}

    {tab !== "reset" && <button onClick={save} disabled={saving} style={{ marginTop: 24, background: saving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 32px", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(245,158,11,0.4)", display: "flex", alignItems: "center", gap: 8 }}>{saving ? "💾 Saving..." : "💾 Save All Settings"}</button>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null), [active, setActive] = useState("sales"), [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState(INITIAL_SETTINGS), [tanks, setTanks] = useState(INITIAL_TANKS);
  const [unitConfig, setUnitConfig] = useState(UNIT_CONFIG_INIT);
  const [staffList, setStaffList] = useState(INITIAL_STAFF);
  const [resetKey, setResetKey] = useState(0);

  const handleLogin = u => { setUser(u); setActive(u.role === "owner" ? "dashboard" : "sales"); };
  const handleFactoryReset = () => { setSettings(INITIAL_SETTINGS); setTanks(INITIAL_TANKS); setUnitConfig(UNIT_CONFIG_INIT); setStaffList(INITIAL_STAFF); setResetKey(k => k + 1); setActive("dashboard"); };

  if (!user) return <LoginPage onLogin={handleLogin} staffList={staffList} />;

  const renderView = () => {
    const key = resetKey;
    if (user.role === "owner") {
      switch (active) {
        case "dashboard": return <Dashboard key={key} settings={settings} tanks={tanks} />;
        case "sales": return <SalesView key={key} user={user} unitConfig={unitConfig} />;
        case "stock": return <StockView tanks={tanks} settings={settings} unitConfig={unitConfig} />;
        case "supply": return <SupplyView key={key} user={user} unitConfig={unitConfig} />;
        case "logistics": return <LogisticsView tanks={tanks} settings={settings} unitConfig={unitConfig} />;
        case "expenses": return <ExpensesView key={key} />;
        case "staff": return <StaffView staffList={staffList} setStaffList={setStaffList} unitConfig={unitConfig} />;
        case "transport": return <TransportView key={key} />;
        case "reports": return <ReportsView unitConfig={unitConfig} />;
        case "settings": return <SettingsView settings={settings} setSettings={setSettings} tanks={tanks} setTanks={setTanks} unitConfig={unitConfig} setUnitConfig={setUnitConfig} onFactoryReset={handleFactoryReset} />;
        default: return <div style={{ padding: 40, color: "#334155" }}>Page not found</div>;
      }
    } else {
      switch (active) {
        case "sales": return <SalesView key={key} user={user} unitConfig={unitConfig} />;
        case "stock": return <StockView tanks={tanks} settings={settings} unitConfig={unitConfig} />;
        case "supply": return <SupplyView key={key} user={user} unitConfig={unitConfig} />;
        default: return <div style={{ padding: 40, color: "#334155" }}>Page not found</div>;
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
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
    <div style={{ display: "flex", height: "100vh", background: "#060d18", overflow: "hidden" }}>
      <Sidebar active={active} setActive={setActive} user={user} onLogout={() => setUser(null)} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ height: 52, background: "rgba(6,13,24,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
          <p style={{ color: "#334155", fontSize: 12, flex: 1, margin: 0, fontWeight: 600 }}><span style={{ color: "#f59e0b", fontWeight: 800 }}>Shree K C Sarswat</span> · Petrol ERP · <span style={{ color: user.role === "owner" ? "#f59e0b" : "#60a5fa", fontWeight: 700 }}>{user.role === "owner" ? "👑 Owner" : "👤 " + user.name}</span></p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 6 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399" }} /><span style={{ color: "#34d399", fontSize: 10, fontWeight: 700 }}>Firebase Live</span></div>
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, padding: "4px 12px" }}><span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 800 }}>⛽ ₹{settings.petrolPrice}</span></div>
          <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: "4px 12px" }}><span style={{ color: "#3b82f6", fontSize: 12, fontWeight: 800 }}>🔵 ₹{settings.dieselPrice}</span></div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>{renderView()}</div>
      </div>
    </div>
  </>;
}
