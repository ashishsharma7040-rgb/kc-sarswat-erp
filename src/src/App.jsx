import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config — YOUR credentials ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDaEiDYTu8cq78vTYrPmQtQJB_W_3t-dmQ",
  authDomain: "kc-sarswat-erp-9dced.firebaseapp.com",
  projectId: "kc-sarswat-erp-9dced",
  storageBucket: "kc-sarswat-erp-9dced.firebasestorage.app",
  messagingSenderId: "657914614372",
  appId: "1:657914614372:web:d33b53f68f80d542874571"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── Firebase helpers ──────────────────────────────────────────────────────────
const fbGet = async (col) => {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(d => ({ ...d.data(), _fbId: d.id }));
  } catch { return null; }
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

// ── Helper: generate staff credentials from name ───────────────────────────────
const makeStaffEmail = (name) => name.toLowerCase().replace(/\s+/g, "") + "kc@gmail.com";
const makeStaffPassword = (name) => name.toLowerCase().replace(/\s+/g, "") + "@123";

// ── Owner credential ───────────────────────────────────────────────────────────
const OWNER_CRED = { email: "owner@kcsarswat.in", password: "KCSarswat@2025" };

const UNIT_CONFIG_INIT = {
  unit1: { name: "Unit 1", machines: ["M1", "M2", "M3"], petrolMargin: 4.27, dieselMargin: 2.72 },
  unit2: { name: "Unit 2", machines: ["M4", "M5"], petrolMargin: 3.79, dieselMargin: 2.28 },
  unit3: { name: "Unit 3", machines: ["M6", "M7"], petrolMargin: 4.14, dieselMargin: 2.63 },
};
const INITIAL_SETTINGS = { petrolPrice: 102.84, dieselPrice: 89.62, lowStockAlert: 500 };
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
const TODAY = new Date().toISOString().split("T")[0];
const EXPENSE_CATS = ["Cleaning", "Maintenance", "Generator Diesel", "Electricity Bill", "Water Bill", "Staff Salary", "Custom"];
const SHIFTS = ["Day Shift", "Night Shift"];
const genMonthly = () => ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => ({ month: m, petrol: Math.floor(8000 + Math.random() * 4000), diesel: Math.floor(12000 + Math.random() * 5000), profit: Math.floor(80000 + Math.random() * 30000), expenses: Math.floor(15000 + Math.random() * 8000) }));
const genDaily = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }), petrol: Math.floor(400 + Math.random() * 300), diesel: Math.floor(600 + Math.random() * 400) }; });

// ── Icon ──────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
  const p = { dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", sales: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z", stock: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", supply: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4", expenses: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", staff: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", transport: "M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0H3m18 0h-2", reports: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z", logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1", fuel: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", plus: "M12 4v16m8-8H4", drop: "M12 2.69l5.66 5.66a8 8 0 11-11.31 0z", trend_up: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4", transfer: "M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4", tank: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16", reset: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", lock: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", check: "M5 13l4 4L19 7", key: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z", eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", eyeoff: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21", cloud: "M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" };
  return <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={p[name] || ""} /></svg>;
};

// ── Shared Styles ─────────────────────────────────────────────────────────────
const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", transition: "border 0.15s" };
const inpErr = { ...inp, border: "1px solid rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.06)" };
const card = { background: "rgba(13,27,42,0.92)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 22 };
const getRgb = c => c === "#f59e0b" ? "245,158,11" : c === "#3b82f6" ? "59,130,246" : c === "#10b981" ? "16,185,129" : c === "#8b5cf6" ? "139,92,246" : "239,68,68";
const Label = ({ children, required }) => <label style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.6px" }}>{children}{required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}</label>;
const FieldError = ({ msg }) => msg ? <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}><svg width="11" height="11" fill="none" stroke="#f87171" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg><span style={{ color: "#f87171", fontSize: 11, fontWeight: 500 }}>{msg}</span></div> : null;
const ValidationBanner = ({ errors }) => !errors || !errors.length ? null : (
  <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
    <div style={{ width: 32, height: 32, background: "rgba(239,68,68,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#ef4444" }}><Icon name="warning" size={16} /></div>
    <div><p style={{ color: "#fca5a5", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Please fix the following before saving:</p><ul style={{ color: "#f87171", fontSize: 12, margin: 0, paddingLeft: 16 }}>{errors.map((e, i) => <li key={i} style={{ marginBottom: 2 }}>{e}</li>)}</ul></div>
  </div>
);
const SuccessToast = ({ msg }) => msg ? <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.08))", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, color: "#34d399", fontSize: 13, fontWeight: 600 }}><Icon name="check" size={16} />{msg}</div> : null;
const SyncBadge = ({ syncing }) => <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: syncing ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${syncing ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`, borderRadius: 6 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: syncing ? "#f59e0b" : "#34d399", boxShadow: syncing ? "0 0 6px #f59e0b" : "0 0 6px #34d399" }} /><span style={{ color: syncing ? "#f59e0b" : "#34d399", fontSize: 10, fontWeight: 700 }}>{syncing ? "Saving..." : "Cloud Saved"}</span></div>;

const StatCard = ({ label, value, sub, color = "#f59e0b", icon, trend }) => {
  const rgb = getRgb(color);
  return <div style={{ ...card, border: `1px solid rgba(${rgb},0.22)`, position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: 100, background: `radial-gradient(circle at top right,rgba(${rgb},0.1),transparent)`, borderRadius: "0 18px 0 100%" }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div><p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.9px", textTransform: "uppercase" }}>{label}</p><p style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>{value}</p>{sub && <p style={{ color: "#94a3b8", fontSize: 12, margin: "4px 0 0" }}>{sub}</p>}{trend !== undefined && <p style={{ color: trend >= 0 ? "#34d399" : "#f87171", fontSize: 12, margin: "6px 0 0", fontWeight: 600 }}>{trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs yesterday</p>}</div>
      <div style={{ width: 46, height: 46, background: `rgba(${rgb},0.14)`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}><Icon name={icon} size={22} /></div>
    </div>
  </div>;
};

// ── Tank Gauge ────────────────────────────────────────────────────────────────
const TankGauge = ({ label, current, capacity, color, lowAlert }) => {
  const pct = Math.min((current / capacity) * 100, 100), isLow = current < lowAlert;
  return <div style={{ ...card, textAlign: "center", padding: "18px 14px" }}>
    <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.8px", lineHeight: 1.3 }}>{label}</p>
    <div style={{ position: "relative", width: 60, height: 110, margin: "0 auto 12px", borderRadius: "7px 7px 5px 5px", background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${getRgb(color)},0.2)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct}%`, background: `linear-gradient(0deg,${color}cc,${color}55)`, transition: "height 0.6s ease" }} />
      {[25, 50, 75].map(t => <div key={t} style={{ position: "absolute", left: 0, right: 0, bottom: `${t}%`, height: 1, background: "rgba(255,255,255,0.1)" }} />)}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{pct.toFixed(0)}%</span></div>
    </div>
    <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>{current.toLocaleString()} L</p>
    <p style={{ color: "#475569", fontSize: 10, margin: "0 0 6px" }}>/ {capacity.toLocaleString()} L</p>
    {isLow && <span style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>⚠ LOW</span>}
  </div>;
};

const StockVisualPanel = ({ tanks, settings }) => {
  const [su, setSu] = useState("all"), [sf, setSf] = useState("both");
  const shown = su === "all" ? Object.keys(UNIT_CONFIG_INIT) : [su];
  const tl = []; shown.forEach(uid => { const u = UNIT_CONFIG_INIT[uid], t = tanks[uid]; if (!t) return; if (sf !== "diesel") tl.push({ label: `${u.name} — Petrol`, current: t.petrol.current, capacity: t.petrol.capacity, color: "#f59e0b", low: settings.lowStockAlert }); if (sf !== "petrol") tl.push({ label: `${u.name} — Diesel`, current: t.diesel.current, capacity: t.diesel.capacity, color: "#3b82f6", low: settings.lowStockAlert }); });
  const btn = a => ({ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, transition: "all 0.15s", background: a ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(255,255,255,0.06)", color: a ? "#fff" : "#64748b" });
  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 11, marginRight: 2, fontWeight: 600 }}>Unit:</span>
      {[["all", "All"], ["unit1", "Unit 1"], ["unit2", "Unit 2"], ["unit3", "Unit 3"]].map(([v, l]) => <button key={v} onClick={() => setSu(v)} style={btn(su === v)}>{l}</button>)}
      <span style={{ color: "#64748b", fontSize: 11, marginLeft: 10, marginRight: 2, fontWeight: 600 }}>Fuel:</span>
      {[["both", "Both"], ["petrol", "Petrol"], ["diesel", "Diesel"]].map(([v, l]) => <button key={v} onClick={() => setSf(v)} style={btn(sf === v)}>{l}</button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, marginBottom: 18 }}>{tl.map(t => <TankGauge key={t.label} label={t.label} current={t.current} capacity={t.capacity} color={t.color} lowAlert={t.low} />)}</div>
    <ResponsiveContainer width="100%" height={150}><BarChart data={tl.map(t => ({ name: t.label, val: t.current, pct: Math.round((t.current / t.capacity) * 100) }))} barSize={26}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} formatter={(v, n, pr) => [`${v.toLocaleString()} L (${pr.payload.pct}%)`, ""]} /><Bar dataKey="val" radius={[5, 5, 0, 0]}>{tl.map((t, i) => <Cell key={i} fill={t.color} />)}</Bar></BarChart></ResponsiveContainer>
  </div>;
};

// ── LOGIN PAGE ─────────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin, staffList }) => {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [role, setRole] = useState("owner"), [loading, setLoading] = useState(false), [error, setError] = useState(""), [showPwd, setShowPwd] = useState(false);
  const handleLogin = async () => {
    setLoading(true); setError("");
    await new Promise(r => setTimeout(r, 800));
    const el = email.toLowerCase().trim(), pl = password.toLowerCase().trim();
    if (role === "owner") {
      if (el === OWNER_CRED.email.toLowerCase() && pl === OWNER_CRED.password.toLowerCase()) { onLogin({ email, role: "owner", name: "Owner — KC Sarswat", staffId: null }); }
      else setError("Invalid owner credentials. Please try again.");
    } else {
      const found = staffList.find(s => makeStaffEmail(s.name).toLowerCase() === el && s.password.toLowerCase() === pl && s.active);
      if (found) onLogin({ email, role: "staff", name: found.name, staffId: found.id });
      else setError("Staff credentials not found or account inactive.");
    }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Sora',sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: "100vh", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#0a0f1a 0%,#0d1c2e 30%,#102238 60%,#0a1520 100%)" }} />
        <svg style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, opacity: 0.92 }} viewBox="0 0 520 420" fill="none">
          <rect x="0" y="360" width="520" height="60" fill="#050d18" />
          <rect x="0" y="355" width="520" height="8" fill="#0e2235" rx="1" />
          <rect x="70" y="100" width="18" height="260" rx="4" fill="#1a3a5c" />
          <rect x="432" y="100" width="18" height="260" rx="4" fill="#1a3a5c" />
          <rect x="30" y="80" width="460" height="28" rx="6" fill="#f59e0b" />
          <rect x="30" y="80" width="460" height="8" rx="4" fill="#fbbf24" />
          <rect x="30" y="100" width="460" height="5" fill="rgba(0,0,0,0.3)" />
          <rect x="160" y="84" width="200" height="20" rx="4" fill="#d97706" />
          <text x="260" y="98" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">HINDUSTAN PETROLEUM</text>
          <rect x="140" y="200" width="80" height="155" rx="8" fill="#0f2744" />
          <rect x="140" y="200" width="80" height="155" rx="8" stroke="#1e4a7a" strokeWidth="2" />
          <rect x="152" y="214" width="56" height="32" rx="2" fill="#0a4a2e" />
          <text x="180" y="226" textAnchor="middle" fill="#34d399" fontSize="8" fontFamily="monospace">102.84</text>
          <text x="180" y="237" textAnchor="middle" fill="#34d399" fontSize="6" fontFamily="monospace">₹/LITRE</text>
          <rect x="148" y="258" width="64" height="22" rx="4" fill="#f59e0b" opacity="0.9" />
          <text x="180" y="273" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">PETROL</text>
          <rect x="148" y="286" width="64" height="22" rx="4" fill="#3b82f6" opacity="0.9" />
          <text x="180" y="301" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">DIESEL</text>
          <path d="M220 300 Q250 280 240 320 Q230 355 220 355" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="218" cy="355" r="6" fill="#d97706" />
          <rect x="300" y="200" width="80" height="155" rx="8" fill="#0f2744" />
          <rect x="300" y="200" width="80" height="155" rx="8" stroke="#1e4a7a" strokeWidth="2" />
          <rect x="312" y="214" width="56" height="32" rx="2" fill="#0a3a4a" />
          <text x="340" y="226" textAnchor="middle" fill="#60a5fa" fontSize="8" fontFamily="monospace">89.62</text>
          <text x="340" y="237" textAnchor="middle" fill="#60a5fa" fontSize="6" fontFamily="monospace">₹/LITRE</text>
          <rect x="308" y="258" width="64" height="22" rx="4" fill="#f59e0b" opacity="0.9" />
          <text x="340" y="273" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">PETROL</text>
          <rect x="308" y="286" width="64" height="22" rx="4" fill="#3b82f6" opacity="0.9" />
          <text x="340" y="301" textAnchor="middle" fill="white" fontSize="7" fontFamily="sans-serif" fontWeight="bold">DIESEL</text>
          <path d="M300 300 Q270 280 280 320 Q290 355 300 355" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="302" cy="355" r="6" fill="#2563eb" />
          <line x1="80" y1="363" x2="440" y2="363" stroke="#1e4a7a" strokeWidth="1.5" strokeDasharray="10 6" />
          <circle cx="260" cy="170" r="24" fill="#f59e0b" />
          <circle cx="260" cy="170" r="20" fill="#d97706" />
          <text x="260" y="167" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">HP</text>
          <text x="260" y="178" textAnchor="middle" fill="white" fontSize="5" fontFamily="sans-serif">PETROLEUM</text>
          {[[60, 60], [90, 30], [450, 50], [480, 80], [430, 20]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.5" fill="#fbbf24" opacity="0.6" />)}
        </svg>
        <div style={{ position: "relative", zIndex: 2, padding: "40px 44px", background: "linear-gradient(0deg,rgba(6,13,24,0.97) 0%,transparent 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399" }} />
            <span style={{ color: "#64748b", fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 600 }}>Live · Lunkaransar Station</span>
          </div>
          <h2 style={{ color: "#f1f5f9", fontSize: 28, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px", lineHeight: 1.2 }}>Shree K C Sarswat<br /><span style={{ color: "#f59e0b" }}>Auto Fuel Station</span></h2>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>3 Units · 7 Machines · HPCL Distributor<br />Lunkaransar, Rajasthan 334603</p>
          <div style={{ display: "flex", gap: 16 }}>
            {[{ label: "Petrol", price: "₹102.84", color: "#f59e0b" }, { label: "Diesel", price: "₹89.62", color: "#3b82f6" }].map(f => (
              <div key={f.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 16px" }}>
                <p style={{ color: f.color, fontSize: 10, fontWeight: 700, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.label}</p>
                <p style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>{f.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ width: 400, background: "#07111e", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "44px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, background: "radial-gradient(circle,rgba(245,158,11,0.05),transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: 180, height: 180, background: "radial-gradient(circle,rgba(59,130,246,0.04),transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(245,158,11,0.35)", flexShrink: 0 }}>
              <svg width="26" height="26" fill="white" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <div><p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800, margin: "0 0 2px", letterSpacing: "-0.3px" }}>KC Sarswat ERP</p><p style={{ color: "#475569", fontSize: 11, margin: 0, letterSpacing: "0.3px" }}>Station Management System</p></div>
          </div>
          {/* Cloud badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, padding: "7px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8 }}>
            <Icon name="cloud" size={13} /><span style={{ color: "#34d399", fontSize: 11, fontWeight: 700 }}>Firebase Cloud Connected — All devices sync in real-time</span>
          </div>
          <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.5px" }}>Welcome back</h1>
          <p style={{ color: "#475569", fontSize: 13, margin: "0 0 24px" }}>Sign in to access your dashboard</p>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)" }}>
            {[["owner", "👑 Owner"], ["staff", "👤 Staff"]].map(([r, l]) => (
              <button key={r} onClick={() => { setRole(r); setEmail(""); setPassword(""); setError(""); }} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, transition: "all 0.2s", background: role === r ? "linear-gradient(135deg,#f59e0b,#d97706)" : "transparent", color: role === r ? "#fff" : "#64748b", boxShadow: role === r ? "0 2px 12px rgba(245,158,11,0.3)" : "none" }}>{l}</button>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Email Address</Label>
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder={role === "owner" ? "owner@kcsarswat.in" : "yournamekc@gmail.com"} style={{ ...inp, fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20, position: "relative" }}>
            <Label>Password</Label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...inp, fontSize: 14, paddingRight: 44 }} />
              <button onClick={() => setShowPwd(!showPwd)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}><Icon name={showPwd ? "eyeoff" : "eye"} size={16} /></button>
            </div>
          </div>
          {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Icon name="warning" size={14} /><span style={{ color: "#f87171", fontSize: 13 }}>{error}</span></div>}
          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", background: loading ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: loading ? "none" : "0 4px 24px rgba(245,158,11,0.4)", letterSpacing: "0.2px", transition: "all 0.2s" }}>
            {loading ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Signing in...</span> : "Sign In →"}
          </button>
          {role === "staff" && <p style={{ color: "#334155", fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>Login ID: <span style={{ color: "#475569" }}>yournamekc@gmail.com</span><br />Password: <span style={{ color: "#475569" }}>yourname@123</span></p>}
        </div>
      </div>
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ active, setActive, user, onLogout, collapsed, setCollapsed }) => {
  const ownerNav = [{ id: "dashboard", label: "Dashboard", icon: "dashboard" }, { id: "sales", label: "Sales Entry", icon: "sales" }, { id: "stock", label: "Stock", icon: "stock" }, { id: "supply", label: "Fuel Supply", icon: "supply" }, { id: "expenses", label: "Expenses", icon: "expenses" }, { id: "staff", label: "Staff", icon: "staff" }, { id: "transport", label: "Transport", icon: "transport" }, { id: "reports", label: "Reports", icon: "reports" }, { id: "settings", label: "Settings", icon: "settings" }];
  const staffNav = [{ id: "sales", label: "Sales Entry", icon: "sales" }, { id: "stock", label: "Stock", icon: "stock" }, { id: "supply", label: "Fuel Supply", icon: "supply" }];
  const nav = user.role === "owner" ? ownerNav : staffNav;
  return (
    <div style={{ width: collapsed ? 68 : 232, background: "linear-gradient(180deg,#06111e,#08192a)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", transition: "width 0.25s", overflow: "hidden", flexShrink: 0, height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: collapsed ? "18px 14px" : "18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 10px rgba(245,158,11,0.3)" }}>
          <svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        </div>
        {!collapsed && <div><p style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 800, margin: 0, whiteSpace: "nowrap" }}>KC Sarswat Fuel</p><p style={{ color: "#334155", fontSize: 10, margin: 0 }}>Lunkaransar, RJ</p></div>}
        <button onClick={() => setCollapsed(!collapsed)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#334155", padding: 4, borderRadius: 4, flexShrink: 0 }}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} /></svg></button>
      </div>
      {!collapsed && <div style={{ margin: "10px 10px 0", padding: "8px 12px", background: user.role === "owner" ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)", borderRadius: 10, border: `1px solid ${user.role === "owner" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)"}` }}>
        <p style={{ color: user.role === "owner" ? "#f59e0b" : "#60a5fa", fontSize: 10, fontWeight: 700, margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{user.role === "owner" ? "👑 Owner Access" : "👤 Staff Access"}</p>
        {user.role === "staff" && <p style={{ color: "#334155", fontSize: 10, margin: 0 }}>{user.name}</p>}
      </div>}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {nav.map(item => <button key={item.id} onClick={() => setActive(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, marginBottom: 2, transition: "all 0.15s", background: active === item.id ? "linear-gradient(135deg,rgba(245,158,11,0.16),rgba(217,119,6,0.08))" : "transparent", color: active === item.id ? "#f59e0b" : "#475569", borderLeft: active === item.id ? "2px solid #f59e0b" : "2px solid transparent" }}><Icon name={item.icon} size={16} />{!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}</button>)}
      </nav>
      <div style={{ padding: "10px 8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {!collapsed && <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 6 }}><p style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700, margin: 0 }}>{user.name}</p><p style={{ color: "#334155", fontSize: 11, margin: "2px 0 0", textTransform: "capitalize" }}>{user.role}</p></div>}
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 11, border: "none", cursor: "pointer", background: "rgba(239,68,68,0.08)", color: "#f87171", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}><Icon name="logout" size={16} />{!collapsed && "Sign Out"}</button>
      </div>
    </div>
  );
};

// ── Owner Dashboard ───────────────────────────────────────────────────────────
const OwnerDashboard = ({ settings, tanks }) => {
  const monthly = useMemo(genMonthly, []), daily = useMemo(genDaily, []);
  const today = daily[daily.length - 1], profit = today.petrol * settings.petrolPrice * 0.042 + today.diesel * settings.dieselPrice * 0.028;
  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ marginBottom: 22 }}><h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Owner Dashboard</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
      <StatCard label="Petrol Sales Today" value={`${today.petrol.toLocaleString()} L`} sub={`₹${(today.petrol * settings.petrolPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} color="#f59e0b" icon="drop" trend={5.2} />
      <StatCard label="Diesel Sales Today" value={`${today.diesel.toLocaleString()} L`} sub={`₹${(today.diesel * settings.dieselPrice).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} color="#3b82f6" icon="drop" trend={-1.8} />
      <StatCard label="Total Litres Today" value={`${(today.petrol + today.diesel).toLocaleString()} L`} sub="All units combined" color="#10b981" icon="fuel" trend={2.1} />
      <StatCard label="Gross Profit Today" value={`₹${profit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} sub="After margins" color="#8b5cf6" icon="trend_up" trend={3.4} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
      <div style={card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Daily Sales — 7 Days</h3><ResponsiveContainer width="100%" height={190}><BarChart data={daily} barSize={12}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} /><Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} /><Bar dataKey="petrol" name="Petrol (L)" fill="#f59e0b" radius={[5, 5, 0, 0]} /><Bar dataKey="diesel" name="Diesel (L)" fill="#3b82f6" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div style={card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Monthly Profit Trend</h3><ResponsiveContainer width="100%" height={190}><AreaChart data={monthly}><defs><linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} formatter={v => [`₹${v.toLocaleString("en-IN")}`, "Profit"]} /><Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#pg2)" /></AreaChart></ResponsiveContainer></div>
    </div>
    <div style={card}><h3 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="tank" size={16} /> Live Tank Stock</h3><StockVisualPanel tanks={tanks} settings={settings} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 14 }}>{[{ label: "Monthly Revenue", value: "₹28.4L", color: "#10b981" }, { label: "Monthly Expenses", value: "₹4.2L", color: "#ef4444" }, { label: "Transport Income", value: "₹84,200", color: "#8b5cf6" }, { label: "Active Staff", value: "4", color: "#3b82f6" }].map(s => <div key={s.label} style={{ ...card, padding: "16px 18px" }}><p style={{ color: "#334155", fontSize: 11, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{s.label}</p><p style={{ color: s.color, fontSize: 20, fontWeight: 800, margin: 0 }}>{s.value}</p></div>)}</div>
  </div>;
};

// ── Stock View ────────────────────────────────────────────────────────────────
const StockView = ({ tanks, settings }) => <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
  <h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Stock Management</h1>
  <p style={{ color: "#334155", fontSize: 13, margin: "0 0 20px" }}>Live fuel tank levels — filter by unit and fuel type</p>
  <div style={card}><StockVisualPanel tanks={tanks} settings={settings} /></div>
  <div style={{ ...card, marginTop: 16 }}>
    <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Tank Summary Table</h3>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{["Unit", "Fuel", "Current (L)", "Capacity (L)", "Fill %", "Status"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead>
      <tbody>{Object.entries(UNIT_CONFIG_INIT).flatMap(([uid, unit]) => [["petrol", "Petrol", "#f59e0b"], ["diesel", "Diesel", "#3b82f6"]].map(([fk, fn, col]) => { const t = tanks[uid]?.[fk]; if (!t) return null; const pct = ((t.current / t.capacity) * 100).toFixed(1), low = t.current < settings.lowStockAlert; return <tr key={uid + fk} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}><td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, padding: "11px 12px" }}>{unit.name}</td><td style={{ padding: "11px 12px" }}><span style={{ color: col, fontSize: 13, fontWeight: 700 }}>{fn}</span></td><td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "11px 12px" }}>{t.current.toLocaleString()}</td><td style={{ color: "#64748b", fontSize: 13, padding: "11px 12px" }}>{t.capacity.toLocaleString()}</td><td style={{ padding: "11px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 60, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: low ? "#ef4444" : col, borderRadius: 3 }} /></div><span style={{ color: "#64748b", fontSize: 12 }}>{pct}%</span></div></td><td style={{ padding: "11px 12px" }}>{low ? <span style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", fontSize: 10, padding: "3px 7px", borderRadius: 4, fontWeight: 700 }}>⚠ LOW</span> : <span style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", fontSize: 10, padding: "3px 7px", borderRadius: 4, fontWeight: 700 }}>OK</span>}</td></tr>; }))}</tbody>
    </table>
  </div>
</div>;

// ── Sales Entry — Firebase connected ─────────────────────────────────────────
const SalesView = ({ user, unitConfig }) => {
  const [date, setDate] = useState(TODAY), [shift, setShift] = useState("Day Shift"), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [errors, setErrors] = useState([]);
  const allM = Object.entries(unitConfig).flatMap(([uid, u]) => u.machines.map(id => ({ id, unit: uid })));
  const [readings, setReadings] = useState(allM.reduce((a, m) => ({ ...a, [m.id]: { petrolOpen: "", petrolClose: "", dieselOpen: "", dieselClose: "" } }), {}));
  const [fe, setFe] = useState({});
  const upd = (mId, field, val) => { setReadings(p => ({ ...p, [mId]: { ...p[mId], [field]: val } })); setFe(p => ({ ...p, [mId + field]: "" })); };
  const calc = (o, c) => { const ov = parseFloat(o), cv = parseFloat(c); if (isNaN(ov) || isNaN(cv)) return null; if (cv < ov) return { error: "Closing must be ≥ Opening" }; return { litres: (cv - ov).toFixed(2) }; };
  const validate = () => { const errs = [], nfe = {}; allM.forEach(({ id: mId }) => { const r = readings[mId]; ["petrol", "diesel"].forEach(f => { const o = r[`${f}Open`], c = r[`${f}Close`]; if (o === "" && c !== "") { errs.push(`Machine ${mId} ${f}: Opening missing`); nfe[mId + `${f}Open`] = "Required"; } if (o !== "" && c === "") { errs.push(`Machine ${mId} ${f}: Closing missing`); nfe[mId + `${f}Close`] = "Required"; } if (o !== "" && c !== "" && parseFloat(c) < parseFloat(o)) { errs.push(`Machine ${mId} ${f}: Closing < Opening`); nfe[mId + `${f}Close`] = "Must be ≥ Opening"; } }); }); setFe(nfe); setErrors(errs); return errs.length === 0; };
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const salesData = { date, shift, staffName: user.name, staffId: user.staffId || "owner", readings, savedAt: new Date().toISOString(), unitConfig: Object.fromEntries(Object.entries(unitConfig).map(([k, v]) => [k, { petrolMargin: v.petrolMargin, dieselMargin: v.dieselMargin }])) };
    await fbAdd("sales", salesData);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };
  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Sales Entry</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Enter meter readings for each machine</p></div>
      {saving || saved ? <SyncBadge syncing={saving} /> : null}
    </div>
    <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <div><Label>Date</Label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: 160 }} /></div>
      <div><Label>Shift</Label><select value={shift} onChange={e => setShift(e.target.value)} style={{ ...inp, width: 160 }}>{SHIFTS.map(s => <option key={s} value={s} style={{ background: "#07111e" }}>{s}</option>)}</select></div>
    </div>
    <ValidationBanner errors={errors} /><SuccessToast msg={saved ? `✓ Sales saved to Firebase — ${date} · ${shift}` : null} />
    {Object.entries(unitConfig).map(([uid, unit]) => (
      <div key={uid} style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, background: "rgba(245,158,11,0.12)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}><Icon name="fuel" size={15} /></div>
          <div><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>{unit.name}</h3>{user.role === "owner" && <p style={{ color: "#334155", fontSize: 11, margin: 0 }}>Petrol ₹{unit.petrolMargin}/L · Diesel ₹{unit.dieselMargin}/L</p>}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12 }}>
          {unit.machines.map(mId => {
            const r = readings[mId]; const ps = calc(r.petrolOpen, r.petrolClose), ds = calc(r.dieselOpen, r.dieselClose); const profit = user.role === "owner" ? ((ps?.litres ? parseFloat(ps.litres) * unit.petrolMargin : 0) + (ds?.litres ? parseFloat(ds.litres) * unit.dieselMargin : 0)) : 0;
            return <div key={mId} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
              <p style={{ color: "#475569", fontSize: 12, fontWeight: 700, margin: "0 0 10px", letterSpacing: "0.5px" }}>MACHINE {mId}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ label: "⛽ Petrol", ok: "petrolOpen", ck: "petrolClose", sales: ps, color: "#f59e0b" }, { label: "🔵 Diesel", ok: "dieselOpen", ck: "dieselClose", sales: ds, color: "#3b82f6" }].map(f => (
                  <div key={f.label}>
                    <p style={{ color: f.color, fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{f.label}</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1 }}><label style={{ color: "#334155", fontSize: 10, display: "block", marginBottom: 2, fontWeight: 600 }}>Opening</label><input type="number" placeholder="0.00" value={r[f.ok]} onChange={e => upd(mId, f.ok, e.target.value)} style={fe[mId + f.ok] ? inpErr : inp} /><FieldError msg={fe[mId + f.ok]} /></div>
                      <div style={{ flex: 1 }}><label style={{ color: "#334155", fontSize: 10, display: "block", marginBottom: 2, fontWeight: 600 }}>Closing</label><input type="number" placeholder="0.00" value={r[f.ck]} onChange={e => upd(mId, f.ck, e.target.value)} style={fe[mId + f.ck] ? inpErr : inp} /><FieldError msg={fe[mId + f.ck]} /></div>
                    </div>
                    {f.sales?.litres && <p style={{ color: f.color, fontSize: 11, margin: "4px 0 0", fontWeight: 700 }}>= {f.sales.litres} L sold</p>}
                  </div>
                ))}
              </div>
              {user.role === "owner" && profit > 0 && <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.15)" }}><p style={{ color: "#34d399", fontSize: 12, margin: 0, fontWeight: 700 }}>Est. Profit: ₹{profit.toFixed(2)}</p></div>}
            </div>;
          })}
        </div>
      </div>
    ))}
    <button onClick={handleSave} disabled={saving} style={{ background: saving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(245,158,11,0.35)", display: "flex", alignItems: "center", gap: 8 }}>
      {saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Saving to Cloud...</> : <><Icon name="cloud" size={15} /> Save to Firebase</>}
    </button>
  </div>;
};

// ── Supply View — Firebase connected ─────────────────────────────────────────
const SupplyView = ({ user }) => {
  const [supply, setSupply] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(false), [editId, setEditId] = useState(null), [errors, setErrors] = useState([]), [fe, setFe] = useState({}), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  const emptyForm = { date: TODAY, fuelType: "Petrol", unit: "unit1", litres: "", truck: "", supplier: "HPCL" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fbGet("supply").then(data => {
      if (data) setSupply(data.sort((a, b) => b.date.localeCompare(a.date)));
      else setSupply([{ id: "sup1", date: TODAY, fuelType: "Petrol", unit: "unit1", litres: 8000, truck: "RJ-13-TA-1234", supplier: "HPCL" }]);
      setLoading(false);
    });
  }, []);

  const validate = () => { const errs = [], nfe = {}; if (!form.litres || parseFloat(form.litres) <= 0) { errs.push("Litres must be > 0"); nfe.litres = "Required"; } if (!form.truck.trim()) { errs.push("Truck number required"); nfe.truck = "Required"; } if (!form.supplier.trim()) { errs.push("Supplier required"); nfe.supplier = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const canEdit = r => user.role === "owner" || r.date === TODAY;
  const add = async () => {
    if (!validate()) return;
    setSaving(true);
    const entry = { ...form, litres: parseFloat(form.litres), savedAt: new Date().toISOString(), savedBy: user.name };
    if (editId) {
      const fbId = supply.find(s => s.id === editId)?._fbId;
      if (fbId) await fbUpdate("supply", fbId, entry);
      setSupply(p => p.map(s => s.id === editId ? { ...s, ...entry } : s));
    } else {
      const fbId = await fbAdd("supply", entry);
      setSupply(p => [{ ...entry, id: `s${Date.now()}`, _fbId: fbId }, ...p]);
    }
    setSaving(false); setEditId(null); setForm(emptyForm); setShow(false); setErrors([]); setFe({}); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };
  const startEdit = s => { setForm({ date: s.date, fuelType: s.fuelType, unit: s.unit, litres: String(s.litres), truck: s.truck, supplier: s.supplier }); setEditId(s.id); setErrors([]); setFe({}); setShow(true); };
  const cancel = () => { setShow(false); setEditId(null); setForm(emptyForm); setErrors([]); setFe({}); };

  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Fuel Supply</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Tanker deliveries · {user.role === "staff" && <span style={{ color: "#f59e0b", fontWeight: 600 }}>Staff: today's entries editable only</span>}</p></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {saving || saved ? <SyncBadge syncing={saving} /> : null}
        <button onClick={() => { cancel(); setShow(true); }} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 14px rgba(245,158,11,0.3)" }}><Icon name="plus" size={14} /> Add Supply</button>
      </div>
    </div>
    {loading ? <div style={{ ...card, textAlign: "center", color: "#475569", padding: 40 }}>⏳ Loading from Firebase...</div> : null}
    <SuccessToast msg={saved ? "Supply saved to Firebase ☁️" : null} />
    {show && <div style={{ ...card, border: `1px solid ${editId ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.2)"}`, marginBottom: 16 }}>
      <h3 style={{ color: editId ? "#60a5fa" : "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>{editId ? <><Icon name="edit" size={14} /> Edit Entry</> : <><Icon name="plus" size={14} /> New Supply</>}</h3>
      <ValidationBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
        <div><Label required>Date</Label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} /></div>
        <div><Label required>Unit</Label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={inp}>{Object.entries(UNIT_CONFIG_INIT).map(([k, u]) => <option key={k} value={k} style={{ background: "#07111e" }}>{u.name}</option>)}</select></div>
        <div><Label required>Fuel</Label><select value={form.fuelType} onChange={e => setForm(p => ({ ...p, fuelType: e.target.value }))} style={inp}><option style={{ background: "#07111e" }}>Petrol</option><option style={{ background: "#07111e" }}>Diesel</option></select></div>
        <div><Label required>Litres</Label><input type="number" value={form.litres} onChange={e => { setForm(p => ({ ...p, litres: e.target.value })); setFe(p => ({ ...p, litres: "" })); }} style={fe.litres ? inpErr : inp} /><FieldError msg={fe.litres} /></div>
        <div><Label required>Truck No.</Label><input value={form.truck} onChange={e => { setForm(p => ({ ...p, truck: e.target.value })); setFe(p => ({ ...p, truck: "" })); }} placeholder="RJ-XX-XX-XXXX" style={fe.truck ? inpErr : inp} /><FieldError msg={fe.truck} /></div>
        <div><Label required>Supplier</Label><input value={form.supplier} onChange={e => { setForm(p => ({ ...p, supplier: e.target.value })); setFe(p => ({ ...p, supplier: "" })); }} style={fe.supplier ? inpErr : inp} /><FieldError msg={fe.supplier} /></div>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button onClick={add} disabled={saving} style={{ background: saving ? "rgba(16,185,129,0.4)" : editId ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : editId ? "Update" : "Save to Firebase"}</button>
        <button onClick={cancel} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </div>}
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>Supply Records <span style={{ color: "#34d399", fontSize: 10, fontWeight: 600 }}>☁️ Firebase</span></h3>
        {user.role === "staff" && <span style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, padding: "5px 10px", color: "#f59e0b", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Icon name="lock" size={11} /> Today only editable</span>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Date", "Unit", "Fuel", "Litres", "Truck", "Supplier", ""].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead>
        <tbody>{supply.map(s => <tr key={s.id || s._fbId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: s.date === TODAY ? "rgba(245,158,11,0.02)" : "transparent" }}>
          <td style={{ padding: "11px 12px" }}><span style={{ color: s.date === TODAY ? "#f59e0b" : "#64748b", fontSize: 13, fontWeight: s.date === TODAY ? 700 : 400 }}>{s.date}{s.date === TODAY && <span style={{ marginLeft: 6, background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>TODAY</span>}</span></td>
          <td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, padding: "11px 12px" }}>{UNIT_CONFIG_INIT[s.unit]?.name || s.unit}</td>
          <td style={{ padding: "11px 12px" }}><span style={{ color: s.fuelType === "Petrol" ? "#f59e0b" : "#3b82f6", fontSize: 13, fontWeight: 700 }}>{s.fuelType}</span></td>
          <td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "11px 12px" }}>{s.litres?.toLocaleString()} L</td>
          <td style={{ color: "#64748b", fontSize: 12, padding: "11px 12px", fontFamily: "monospace" }}>{s.truck}</td>
          <td style={{ color: "#64748b", fontSize: 13, padding: "11px 12px" }}>{s.supplier}</td>
          <td style={{ padding: "11px 12px" }}>{canEdit(s) ? <button onClick={() => startEdit(s)} style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Icon name="edit" size={11} /> Edit</button> : <span style={{ color: "#334155", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><Icon name="lock" size={11} /> Locked</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
};

// ── Expenses — Firebase connected ─────────────────────────────────────────────
const ExpensesView = () => {
  const [expenses, setExpenses] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(false), [editId, setEditId] = useState(null), [errors, setErrors] = useState([]), [fe, setFe] = useState({}), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  const emptyF = { date: TODAY, category: "Cleaning", amount: "", note: "" };
  const [form, setForm] = useState(emptyF);

  useEffect(() => {
    fbGet("expenses").then(data => {
      if (data && data.length > 0) setExpenses(data.sort((a, b) => b.date.localeCompare(a.date)));
      else setExpenses([{ id: "e1", date: TODAY, category: "Electricity Bill", amount: 4200, note: "Monthly electricity", _fbId: null }]);
      setLoading(false);
    });
  }, []);

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const validate = () => { const errs = [], nfe = {}; if (!form.amount || parseFloat(form.amount) <= 0) { errs.push("Amount > 0 required"); nfe.amount = "Required"; } if (!form.note.trim()) { errs.push("Note required"); nfe.note = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const entry = { ...form, amount: parseFloat(form.amount), savedAt: new Date().toISOString() };
    if (editId) {
      const fbId = expenses.find(e => e.id === editId)?._fbId;
      if (fbId) await fbUpdate("expenses", fbId, entry);
      setExpenses(p => p.map(e => e.id === editId ? { ...e, ...entry } : e));
    } else {
      const fbId = await fbAdd("expenses", entry);
      setExpenses(p => [{ ...entry, id: `e${Date.now()}`, _fbId: fbId }, ...p]);
    }
    setSaving(false); setEditId(null); setForm(emptyF); setShow(false); setErrors([]); setFe({}); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };
  const startEdit = e => { setForm({ date: e.date, category: e.category, amount: String(e.amount), note: e.note }); setEditId(e.id); setErrors([]); setFe({}); setShow(true); };
  const cancel = () => { setShow(false); setEditId(null); setForm(emptyF); setErrors([]); setFe({}); };

  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Expenses</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Owner access only</p></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {saving || saved ? <SyncBadge syncing={saving} /> : null}
        <button onClick={() => { cancel(); setShow(true); }} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 14px rgba(245,158,11,0.3)" }}><Icon name="plus" size={14} /> Add</button>
      </div>
    </div>
    {loading && <div style={{ ...card, textAlign: "center", color: "#475569", padding: 40, marginBottom: 14 }}>⏳ Loading from Firebase...</div>}
    <SuccessToast msg={saved ? "Expense saved to Firebase ☁️" : null} />
    {show && <div style={{ ...card, border: `1px solid ${editId ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.2)"}`, marginBottom: 16 }}>
      <h3 style={{ color: editId ? "#60a5fa" : "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>{editId ? "Edit Expense" : "New Expense"}</h3>
      <ValidationBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(158px,1fr))", gap: 12 }}>
        <div><Label required>Date</Label><input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp} /></div>
        <div><Label required>Category</Label><select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inp}>{EXPENSE_CATS.map(c => <option key={c} style={{ background: "#07111e" }}>{c}</option>)}</select></div>
        <div><Label required>Amount (₹)</Label><input type="number" value={form.amount} onChange={e => { setForm(p => ({ ...p, amount: e.target.value })); setFe(p => ({ ...p, amount: "" })); }} style={fe.amount ? inpErr : inp} /><FieldError msg={fe.amount} /></div>
        <div><Label required>Note</Label><input value={form.note} onChange={e => { setForm(p => ({ ...p, note: e.target.value })); setFe(p => ({ ...p, note: "" })); }} style={fe.note ? inpErr : inp} /><FieldError msg={fe.note} /></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={save} disabled={saving} style={{ background: saving ? "rgba(16,185,129,0.4)" : editId ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : editId ? "Update" : "Save"}</button><button onClick={cancel} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div>
    </div>}
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>All Expenses <span style={{ color: "#34d399", fontSize: 10, fontWeight: 600 }}>☁️ Firebase</span></h3><span style={{ color: "#f87171", fontWeight: 800, fontSize: 15 }}>Total: ₹{total.toLocaleString("en-IN")}</span></div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Date", "Category", "Amount", "Note", ""].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead>
        <tbody>{expenses.map(e => <tr key={e.id || e._fbId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}><td style={{ padding: "11px 12px" }}><span style={{ color: e.date === TODAY ? "#34d399" : "#64748b", fontSize: 13 }}>{e.date}{e.date === TODAY && <span style={{ marginLeft: 6, background: "rgba(16,185,129,0.12)", color: "#34d399", fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>TODAY</span>}</span></td><td style={{ padding: "11px 12px" }}><span style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, padding: "3px 8px", borderRadius: 5, fontWeight: 700 }}>{e.category}</span></td><td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "11px 12px" }}>₹{(e.amount || 0).toLocaleString("en-IN")}</td><td style={{ color: "#475569", fontSize: 12, padding: "11px 12px" }}>{e.note}</td><td style={{ padding: "11px 12px" }}><button onClick={() => startEdit(e)} style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}><Icon name="edit" size={11} /> Edit</button></td></tr>)}</tbody>
      </table>
    </div>
  </div>;
};

// ── Staff Management — Firebase connected ─────────────────────────────────────
const StaffView = ({ staffList, setStaffList }) => {
  const [showForm, setShowForm] = useState(false), [showTransfer, setShowTransfer] = useState(null), [transferUnit, setTransferUnit] = useState("unit1");
  const [showPwdEdit, setShowPwdEdit] = useState(null), [newPwd, setNewPwd] = useState(""), [pwdSaved, setPwdSaved] = useState(false);
  const [errors, setErrors] = useState([]), [fe, setFe] = useState({}), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Pump Operator", salary: "", joining: TODAY, unit: "unit1" });

  useEffect(() => {
    fbGet("staff").then(data => {
      if (data && data.length > 0) setStaffList(data.map(s => ({ ...s, id: s.id || s._fbId })));
    });
  }, []);

  const validate = () => { const errs = [], nfe = {}; if (!form.name.trim()) { errs.push("Name required"); nfe.name = "Required"; } if (!form.salary || parseFloat(form.salary) <= 0) { errs.push("Salary > 0 required"); nfe.salary = "Required"; } if (!form.role.trim()) { errs.push("Role required"); nfe.role = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const addStaff = async () => {
    if (!validate()) return;
    setSaving(true);
    const newMember = { name: form.name, role: form.role, salary: parseFloat(form.salary), joining: form.joining, unit: form.unit, active: true, password: makeStaffPassword(form.name) };
    const fbId = await fbAdd("staff", newMember);
    setStaffList(p => [...p, { ...newMember, id: fbId || `s${Date.now()}`, _fbId: fbId }]);
    setSaving(false); setForm({ name: "", role: "Pump Operator", salary: "", joining: TODAY, unit: "unit1" }); setShowForm(false); setErrors([]); setFe({});
  };
  const toggle = async id => {
    const s = staffList.find(s => s.id === id); if (!s) return;
    const updated = { active: !s.active };
    if (s._fbId) await fbUpdate("staff", s._fbId, updated);
    setStaffList(p => p.map(x => x.id === id ? { ...x, active: !x.active } : x));
  };
  const remove = async id => {
    const s = staffList.find(s => s.id === id);
    if (s?._fbId) await fbDelete("staff", s._fbId);
    setStaffList(p => p.filter(x => x.id !== id));
  };
  const doTransfer = async id => {
    const s = staffList.find(s => s.id === id);
    if (s?._fbId) await fbUpdate("staff", s._fbId, { unit: transferUnit });
    setStaffList(p => p.map(x => x.id === id ? { ...x, unit: transferUnit } : x)); setShowTransfer(null);
  };
  const savePwd = async id => {
    if (!newPwd.trim()) return;
    const s = staffList.find(s => s.id === id);
    if (s?._fbId) await fbUpdate("staff", s._fbId, { password: newPwd.toLowerCase().trim() });
    setStaffList(p => p.map(x => x.id === id ? { ...x, password: newPwd.toLowerCase().trim() } : x));
    setShowPwdEdit(null); setNewPwd(""); setPwdSaved(true); setTimeout(() => setPwdSaved(false), 3000);
  };
  const total = staffList.filter(s => s.active).reduce((a, s) => a + (s.salary || 0), 0);

  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Staff Management</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Owner only — add, transfer, remove, manage credentials</p></div>
      <button onClick={() => { setShowForm(!showForm); setErrors([]); setFe({}); }} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 14px rgba(245,158,11,0.3)" }}><Icon name="plus" size={14} /> Add Staff</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
      <StatCard label="Active Staff" value={staffList.filter(s => s.active).length} sub={`${staffList.filter(s => !s.active).length} inactive`} color="#10b981" icon="staff" />
      <StatCard label="Monthly Payroll" value={`₹${total.toLocaleString("en-IN")}`} sub="Active only" color="#ef4444" icon="expenses" />
      <StatCard label="Total Staff" value={staffList.length} color="#3b82f6" icon="staff" />
    </div>
    <SuccessToast msg={pwdSaved ? "Password updated in Firebase ☁️" : null} />
    {showForm && <div style={{ ...card, border: "1px solid rgba(245,158,11,0.2)", marginBottom: 16 }}>
      <h3 style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>Add New Staff Member</h3>
      {form.name && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(59,130,246,0.08)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.15)" }}><p style={{ color: "#60a5fa", fontSize: 11, margin: 0, fontWeight: 600 }}>Login ID: <span style={{ color: "#93c5fd" }}>{makeStaffEmail(form.name)}</span> &nbsp;&nbsp; Password: <span style={{ color: "#93c5fd" }}>{makeStaffPassword(form.name)}</span></p></div>}
      <ValidationBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 12 }}>
        <div><Label required>Full Name</Label><input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFe(p => ({ ...p, name: "" })); }} style={fe.name ? inpErr : inp} /><FieldError msg={fe.name} /></div>
        <div><Label required>Role</Label><input value={form.role} onChange={e => { setForm(p => ({ ...p, role: e.target.value })); setFe(p => ({ ...p, role: "" })); }} style={fe.role ? inpErr : inp} /><FieldError msg={fe.role} /></div>
        <div><Label required>Salary (₹/mo)</Label><input type="number" value={form.salary} onChange={e => { setForm(p => ({ ...p, salary: e.target.value })); setFe(p => ({ ...p, salary: "" })); }} style={fe.salary ? inpErr : inp} /><FieldError msg={fe.salary} /></div>
        <div><Label>Joining Date</Label><input type="date" value={form.joining} onChange={e => setForm(p => ({ ...p, joining: e.target.value }))} style={inp} /></div>
        <div><Label required>Assign Unit</Label><select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} style={inp}>{Object.entries(UNIT_CONFIG_INIT).map(([k, u]) => <option key={k} value={k} style={{ background: "#07111e" }}>{u.name}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={addStaff} disabled={saving} style={{ background: saving ? "rgba(16,185,129,0.4)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : "Save to Firebase"}</button><button onClick={() => { setShowForm(false); setErrors([]); setFe({}); }} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div>
    </div>}
    {showTransfer && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ ...card, border: "1px solid rgba(245,158,11,0.3)", width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        <h3 style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="transfer" size={16} /> Transfer Staff</h3>
        <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>Move <strong style={{ color: "#f1f5f9" }}>{staffList.find(s => s.id === showTransfer)?.name}</strong> to:</p>
        <div><Label>New Unit</Label><select value={transferUnit} onChange={e => setTransferUnit(e.target.value)} style={inp}>{Object.entries(UNIT_CONFIG_INIT).map(([k, u]) => <option key={k} value={k} style={{ background: "#07111e" }}>{u.name}</option>)}</select></div>
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}><button onClick={() => doTransfer(showTransfer)} style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Transfer</button><button onClick={() => setShowTransfer(null)} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div>
      </div>
    </div>}
    {showPwdEdit && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ ...card, border: "1px solid rgba(139,92,246,0.3)", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        <h3 style={{ color: "#a78bfa", fontSize: 15, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="key" size={16} /> Change Password</h3>
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 16px" }}>Update password for <strong style={{ color: "#f1f5f9" }}>{staffList.find(s => s.id === showPwdEdit)?.name}</strong></p>
        <div style={{ marginBottom: 10 }}><Label>Current Login ID</Label><div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", color: "#60a5fa", fontSize: 12, fontFamily: "monospace" }}>{makeStaffEmail(staffList.find(s => s.id === showPwdEdit)?.name || "")}</div></div>
        <div style={{ marginBottom: 14 }}><Label required>New Password</Label><input value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="new password" style={inp} /></div>
        <div style={{ display: "flex", gap: 10 }}><button onClick={() => savePwd(showPwdEdit)} style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save to Firebase</button><button onClick={() => { setShowPwdEdit(null); setNewPwd(""); }} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div>
      </div>
    </div>}
    {Object.entries(UNIT_CONFIG_INIT).map(([uid, unit]) => {
      const us = staffList.filter(s => s.unit === uid); if (!us.length) return null; return (
        <div key={uid} style={{ marginBottom: 20 }}>
          <h3 style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, margin: "0 0 10px", letterSpacing: "0.6px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}><Icon name="fuel" size={12} /> {unit.name} — {us.length} staff</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 12 }}>
            {us.map(s => <div key={s.id} style={{ ...card, border: `1px solid ${s.active ? "rgba(16,185,129,0.16)" : "rgba(255,255,255,0.05)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: s.active ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: s.active ? "#34d399" : "#475569" }}><Icon name="staff" size={18} /></div>
                  <div><p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: 0 }}>{s.name}</p><p style={{ color: "#475569", fontSize: 12, margin: "2px 0 0" }}>{s.role}</p></div>
                </div>
                <span style={{ background: s.active ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: s.active ? "#34d399" : "#f87171", fontSize: 10, padding: "3px 9px", borderRadius: 5, fontWeight: 700 }}>{s.active ? "Active" : "Inactive"}</span>
              </div>
              <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(59,130,246,0.06)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.1)" }}>
                <p style={{ color: "#60a5fa", fontSize: 10, margin: 0, fontWeight: 600, fontFamily: "monospace" }}>{makeStaffEmail(s.name)}</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#475569", fontSize: 12 }}>Salary</span><span style={{ color: "#f59e0b", fontSize: 14, fontWeight: 800 }}>₹{(s.salary || 0).toLocaleString("en-IN")}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#475569", fontSize: 12 }}>Joined</span><span style={{ color: "#64748b", fontSize: 12 }}>{new Date(s.joining).toLocaleDateString("en-IN")}</span></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => { setShowTransfer(s.id); setTransferUnit(s.unit); }} style={{ flex: 1, minWidth: 70, background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}><Icon name="transfer" size={10} /> Transfer</button>
                <button onClick={() => { setShowPwdEdit(s.id); setNewPwd(s.password || ""); }} style={{ flex: 1, minWidth: 70, background: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}><Icon name="key" size={10} /> Password</button>
                <button onClick={() => toggle(s.id)} style={{ flex: 1, minWidth: 70, background: s.active ? "rgba(239,68,68,0.07)" : "rgba(16,185,129,0.07)", color: s.active ? "#f87171" : "#34d399", border: `1px solid ${s.active ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`, borderRadius: 8, padding: "7px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{s.active ? "Deactivate" : "Activate"}</button>
                <button onClick={() => remove(s.id)} style={{ background: "rgba(239,68,68,0.07)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "7px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
              </div>
            </div>)}
          </div>
        </div>
      );
    })}
  </div>;
};

// ── Transport — Firebase connected ────────────────────────────────────────────
const TransportView = () => {
  const [trips, setTrips] = useState([]), [loading, setLoading] = useState(true), [show, setShow] = useState(false), [errors, setErrors] = useState([]), [fe, setFe] = useState({}), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: TODAY, truck: "", km: "", rate: "28", driverPay: "", diesel: "", loading: "", unloading: "" });

  useEffect(() => {
    fbGet("transport").then(data => {
      if (data && data.length > 0) setTrips(data.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    });
  }, []);

  const calcP = t => (parseFloat(t.km || 0) * parseFloat(t.rate || 0)) - (parseFloat(t.driverPay || 0) + parseFloat(t.diesel || 0) + parseFloat(t.loading || 0) + parseFloat(t.unloading || 0));
  const tInc = trips.reduce((s, t) => s + (t.km * t.rate || 0), 0), tExp = trips.reduce((s, t) => s + ((t.driverPay || 0) + (t.diesel || 0) + (t.loading || 0) + (t.unloading || 0)), 0);
  const validate = () => { const errs = [], nfe = {}; if (!form.truck.trim()) { errs.push("Truck number required"); nfe.truck = "Required"; } if (!form.km || parseFloat(form.km) <= 0) { errs.push("Distance (KM) > 0 required"); nfe.km = "Required"; } if (!form.rate || parseFloat(form.rate) <= 0) { errs.push("Rate/KM required"); nfe.rate = "Required"; } setErrors(errs); setFe(nfe); return errs.length === 0; };
  const add = async () => {
    if (!validate()) return;
    setSaving(true);
    const entry = { ...form, km: parseFloat(form.km), rate: parseFloat(form.rate), driverPay: parseFloat(form.driverPay || 0), diesel: parseFloat(form.diesel || 0), loading: parseFloat(form.loading || 0), unloading: parseFloat(form.unloading || 0), savedAt: new Date().toISOString() };
    const fbId = await fbAdd("transport", entry);
    setTrips(p => [{ ...entry, id: fbId || `t${Date.now()}`, _fbId: fbId }, ...p]);
    setForm({ date: TODAY, truck: "", km: "", rate: "28", driverPay: "", diesel: "", loading: "", unloading: "" }); setShow(false); setErrors([]); setFe({}); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div><h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Transport Income</h1><p style={{ color: "#334155", fontSize: 13, margin: 0 }}>Pump ↔ Depot trip tracking</p></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {saving || saved ? <SyncBadge syncing={saving} /> : null}
        <button onClick={() => { setShow(!show); setErrors([]); setFe({}); }} style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={14} /> Add Trip</button>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
      <StatCard label="Total Income" value={`₹${tInc.toLocaleString("en-IN")}`} sub={`${trips.length} trips`} color="#8b5cf6" icon="transport" />
      <StatCard label="Total Expenses" value={`₹${tExp.toLocaleString("en-IN")}`} color="#ef4444" icon="expenses" />
      <StatCard label="Net Profit" value={`₹${(tInc - tExp).toLocaleString("en-IN")}`} color="#10b981" icon="trend_up" />
    </div>
    {loading && <div style={{ ...card, textAlign: "center", color: "#475569", padding: 30, marginBottom: 14 }}>⏳ Loading from Firebase...</div>}
    <SuccessToast msg={saved ? "Trip saved to Firebase ☁️" : null} />
    {show && <div style={{ ...card, border: "1px solid rgba(139,92,246,0.25)", marginBottom: 16 }}>
      <h3 style={{ color: "#a78bfa", fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>New Trip</h3>
      <ValidationBanner errors={errors} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        {[["Date", "date", "date", false], ["Truck No.", "truck", "text", true], ["Distance (KM)", "km", "number", true], ["Rate/KM (₹)", "rate", "number", true], ["Driver Pay", "driverPay", "number", false], ["Diesel Cost", "diesel", "number", false], ["Loading (₹)", "loading", "number", false], ["Unloading (₹)", "unloading", "number", false]].map(([l, k, t, req]) => (
          <div key={k}><Label required={req}>{l}</Label><input type={t} value={form[k]} onChange={e => { setForm(p => ({ ...p, [k]: e.target.value })); setFe(p => ({ ...p, [k]: "" })); }} style={fe[k] ? inpErr : inp} /><FieldError msg={fe[k]} /></div>
        ))}
      </div>
      {form.km && form.rate && <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(139,92,246,0.08)", borderRadius: 8 }}><span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>Est. Profit: ₹{calcP(form).toLocaleString("en-IN")}</span></div>}
      <div style={{ marginTop: 12, display: "flex", gap: 10 }}><button onClick={add} disabled={saving} style={{ background: saving ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "Saving..." : "Save to Firebase"}</button><button onClick={() => { setShow(false); setErrors([]); setFe({}); }} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div>
    </div>}
    <div style={card}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}><thead><tr>{["Date", "Truck", "KM", "Income", "Expenses", "Profit"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead><tbody>{trips.map(t => { const inc = t.km * t.rate, exp = (t.driverPay || 0) + (t.diesel || 0) + (t.loading || 0) + (t.unloading || 0), p = inc - exp; return <tr key={t.id || t._fbId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}><td style={{ color: "#64748b", fontSize: 13, padding: "11px 12px" }}>{t.date}</td><td style={{ color: "#f1f5f9", fontSize: 12, fontFamily: "monospace", fontWeight: 700, padding: "11px 12px" }}>{t.truck}</td><td style={{ color: "#64748b", fontSize: 13, padding: "11px 12px" }}>{t.km} km</td><td style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700, padding: "11px 12px" }}>₹{inc.toLocaleString("en-IN")}</td><td style={{ color: "#f87171", fontSize: 13, padding: "11px 12px" }}>₹{exp.toLocaleString("en-IN")}</td><td style={{ padding: "11px 12px" }}><span style={{ color: p >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 800 }}>₹{p.toLocaleString("en-IN")}</span></td></tr>; })}</tbody></table></div></div>
  </div>;
};

// ── Reports ───────────────────────────────────────────────────────────────────
const ReportsView = () => {
  const monthly = useMemo(genMonthly, []);
  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Reports & Analytics</h1>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 20px" }}>Owner access only</p>
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>{["Daily Sales", "Monthly Summary", "Stock Report", "Expense Report", "Transport Report"].map(r => <button key={r} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", borderRadius: 10, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}><Icon name="download" size={12} /> {r}</button>)}</div>
    <div style={{ ...card, marginBottom: 16 }}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Revenue vs Expenses</h3><ResponsiveContainer width="100%" height={240}><BarChart data={monthly} barSize={20}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" /><XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f1f5f9", fontSize: 11 }} formatter={v => [`₹${v.toLocaleString("en-IN")}`, ""]} /><Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} /><Bar dataKey="profit" name="Gross Profit" fill="#10b981" radius={[5, 5, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
    <div style={card}><h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Monthly Summary</h3><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Month", "Petrol (L)", "Diesel (L)", "Gross Profit", "Expenses", "Net Profit"].map(h => <th key={h} style={{ color: "#334155", fontSize: 11, fontWeight: 700, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>)}</tr></thead><tbody>{monthly.map(m => { const net = m.profit - m.expenses; return <tr key={m.month} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}><td style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700, padding: "11px 12px" }}>{m.month} 2025</td><td style={{ color: "#f59e0b", fontSize: 13, padding: "11px 12px" }}>{m.petrol.toLocaleString()}</td><td style={{ color: "#3b82f6", fontSize: 13, padding: "11px 12px" }}>{m.diesel.toLocaleString()}</td><td style={{ color: "#34d399", fontSize: 13, fontWeight: 700, padding: "11px 12px" }}>₹{m.profit.toLocaleString("en-IN")}</td><td style={{ color: "#f87171", fontSize: 13, padding: "11px 12px" }}>₹{m.expenses.toLocaleString("en-IN")}</td><td style={{ padding: "11px 12px" }}><span style={{ color: net >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 800 }}>₹{net.toLocaleString("en-IN")}</span></td></tr>; })}</tbody></table></div>
  </div>;
};

// ── Settings — Firebase connected ─────────────────────────────────────────────
const SettingsView = ({ settings, setSettings, tanks, setTanks, unitConfig, setUnitConfig, onFactoryReset }) => {
  const [local, setLocal] = useState(settings), [lt, setLt] = useState(tanks), [luc, setLuc] = useState(unitConfig), [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [tab, setTab] = useState("prices");
  const [showReset, setShowReset] = useState(false), [resetPwd, setResetPwd] = useState(""), [resetErr, setResetErr] = useState(""), [resetStep, setResetStep] = useState(1), [resetting, setResetting] = useState(false);

  useEffect(() => {
    fbGet("settings").then(data => {
      if (data && data.length > 0) { const s = data[0]; setLocal({ petrolPrice: s.petrolPrice || 102.84, dieselPrice: s.dieselPrice || 89.62, lowStockAlert: s.lowStockAlert || 500 }); setSettings({ petrolPrice: s.petrolPrice || 102.84, dieselPrice: s.dieselPrice || 89.62, lowStockAlert: s.lowStockAlert || 500 }); }
    });
    fbGet("tanks").then(data => {
      if (data && data.length > 0) { const t = data[0]; if (t.unit1) { setLt(t); setTanks(t); } }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await fbSet("settings", "main", local);
    await fbSet("tanks", "main", lt);
    setSettings(local); setTanks(lt); setUnitConfig(luc);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const updT = (uid, fk, field, val) => setLt(p => ({ ...p, [uid]: { ...p[uid], [fk]: { ...p[uid][fk], [field]: parseFloat(val) || 0 } } }));
  const updMargin = (uid, field, val) => setLuc(p => ({ ...p, [uid]: { ...p[uid], [field]: parseFloat(val) || 0 } }));
  const tabs = [["prices", "⛽ Prices"], ["tanks", "🪣 Tanks"], ["margins", "📊 Margins"], ["alerts", "🔔 Alerts"], ["info", "ℹ️ Info"], ["reset", "🗑️ Reset"]];
  const tb = a => ({ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: tab === a ? (a === "reset" ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#f59e0b,#d97706)") : "rgba(255,255,255,0.05)", color: tab === a ? "#fff" : "#64748b", transition: "all 0.15s" });
  const handleReset = async () => { setResetErr(""); if (resetPwd.toLowerCase() !== OWNER_CRED.password.toLowerCase()) { setResetErr("Incorrect owner password. Reset cancelled."); return; } setResetting(true); await new Promise(r => setTimeout(r, 1500)); onFactoryReset(); setResetting(false); setShowReset(false); setResetPwd(""); setResetStep(1); };

  return <div style={{ padding: 26, overflowY: "auto", flex: 1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
      <h1 style={{ color: "#f1f5f9", fontSize: 23, fontWeight: 800, margin: 0, letterSpacing: "-0.3px" }}>Settings</h1>
      {saving || saved ? <SyncBadge syncing={saving} /> : null}
    </div>
    <p style={{ color: "#334155", fontSize: 13, margin: "0 0 18px" }}>Owner full access — all system configurations · saved to Firebase</p>
    <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 4, border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={tb(k)}>{l}</button>)}</div>

    {tab === "prices" && <div style={{ ...card, maxWidth: 420 }}><h3 style={{ color: "#f59e0b", fontSize: 15, fontWeight: 700, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="fuel" size={16} /> Live Fuel Prices</h3><div style={{ display: "flex", flexDirection: "column", gap: 14 }}><div><Label>Petrol (₹/L)</Label><input type="number" step="0.01" value={local.petrolPrice} onChange={e => setLocal(p => ({ ...p, petrolPrice: parseFloat(e.target.value) }))} style={inp} /></div><div><Label>Diesel (₹/L)</Label><input type="number" step="0.01" value={local.dieselPrice} onChange={e => setLocal(p => ({ ...p, dieselPrice: parseFloat(e.target.value) }))} style={inp} /></div></div></div>}
    {tab === "tanks" && <div><p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Configure tank capacity and stock per unit.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>{Object.entries(lt).filter(([k]) => k !== "_fbId" && k !== "savedAt").map(([uid]) => <div key={uid} style={{ ...card, border: "1px solid rgba(245,158,11,0.15)" }}><h3 style={{ color: "#f59e0b", fontSize: 14, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="tank" size={14} /> {UNIT_CONFIG_INIT[uid]?.name}</h3>{[["petrol", "⛽ Petrol", "#f59e0b"], ["diesel", "🔵 Diesel", "#3b82f6"]].map(([fk, fname, col]) => <div key={fk} style={{ marginBottom: 14, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: `1px solid rgba(${col === "#f59e0b" ? "245,158,11" : "59,130,246"},0.1)` }}><p style={{ color: col, fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>{fname}</p><div style={{ display: "flex", gap: 10 }}><div style={{ flex: 1 }}><Label>Capacity (L)</Label><input type="number" value={lt[uid]?.[fk]?.capacity || 0} onChange={e => updT(uid, fk, "capacity", e.target.value)} style={inp} /></div><div style={{ flex: 1 }}><Label>Current (L)</Label><input type="number" value={lt[uid]?.[fk]?.current || 0} onChange={e => updT(uid, fk, "current", e.target.value)} style={inp} /></div></div></div>)}</div>)}</div></div>}
    {tab === "margins" && <div><p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Edit profit margins per litre for each unit.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>{Object.entries(luc).map(([uid, unit]) => <div key={uid} style={{ ...card, border: "1px solid rgba(16,185,129,0.15)" }}><h3 style={{ color: "#34d399", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>{unit.name} — Profit Margins</h3><div style={{ display: "flex", gap: 12 }}><div style={{ flex: 1, padding: "12px", background: "rgba(245,158,11,0.06)", borderRadius: 10 }}><p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>⛽ Petrol (₹/L)</p><input type="number" step="0.01" value={unit.petrolMargin} onChange={e => updMargin(uid, "petrolMargin", e.target.value)} style={inp} /></div><div style={{ flex: 1, padding: "12px", background: "rgba(59,130,246,0.06)", borderRadius: 10 }}><p style={{ color: "#3b82f6", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>🔵 Diesel (₹/L)</p><input type="number" step="0.01" value={unit.dieselMargin} onChange={e => updMargin(uid, "dieselMargin", e.target.value)} style={inp} /></div></div></div>)}</div></div>}
    {tab === "alerts" && <div style={{ ...card, maxWidth: 420 }}><h3 style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="warning" size={16} /> Alert Thresholds</h3><div><Label>Low Stock Alert (Litres)</Label><input type="number" value={local.lowStockAlert} onChange={e => setLocal(p => ({ ...p, lowStockAlert: parseFloat(e.target.value) }))} style={inp} /><p style={{ color: "#334155", fontSize: 11, margin: "6px 0 0" }}>Tanks below this level show a red warning</p></div></div>}
    {tab === "info" && <div style={{ ...card, maxWidth: 460 }}><h3 style={{ color: "#64748b", fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Station Information</h3>{[["Station Name", "Shree K C Sarswat Auto Fuel Station"], ["Location", "Lunkaransar, Rajasthan 334603"], ["Units", "3 Units · 7 Machines"], ["Distributor", "HPCL"], ["Firebase Project", "kc-sarswat-erp-9dced"], ["Owner Login", "owner@kcsarswat.in"], ["Staff Login", "<name>kc@gmail.com / <name>@123"]].map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>{k}</span><span style={{ color: "#94a3b8", fontSize: 12 }}>{v}</span></div>)}</div>}
    {tab === "reset" && <div style={{ maxWidth: 520 }}>
      <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 18, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, background: "rgba(239,68,68,0.15)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", flexShrink: 0 }}><Icon name="reset" size={22} /></div>
          <div><h3 style={{ color: "#fca5a5", fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>Factory Reset — Erase All Data</h3><p style={{ color: "#64748b", fontSize: 13, margin: 0, lineHeight: 1.6 }}>Resets local state to defaults. Firebase cloud data is preserved. <strong style={{ color: "#f87171" }}>Cannot be undone locally.</strong></p></div>
        </div>
      </div>
      {!showReset ? <button onClick={() => setShowReset(true)} style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 30px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(239,68,68,0.35)" }}><Icon name="reset" size={16} /> Initiate Factory Reset</button>
        : <div style={{ ...card, border: "1px solid rgba(239,68,68,0.3)" }}>
          {resetStep === 1 && <><h3 style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}><Icon name="lock" size={16} /> Verify Owner Identity</h3><p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Enter your owner password to continue:</p><div style={{ marginBottom: 14 }}><Label>Owner Password</Label><input type="password" value={resetPwd} onChange={e => { setResetPwd(e.target.value); setResetErr(""); }} placeholder="Owner password" style={resetErr ? inpErr : inp} />{resetErr && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}><Icon name="warning" size={13} /><span style={{ color: "#f87171", fontSize: 12, fontWeight: 600 }}>{resetErr}</span></div>}</div><div style={{ display: "flex", gap: 10 }}><button onClick={() => { if (!resetPwd) { setResetErr("Password is required"); return; } if (resetPwd.toLowerCase() !== OWNER_CRED.password.toLowerCase()) { setResetErr("Incorrect password."); return; } setResetStep(2); }} style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Verify →</button><button onClick={() => { setShowReset(false); setResetPwd(""); setResetErr(""); setResetStep(1); }} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div></>}
          {resetStep === 2 && <><h3 style={{ color: "#f87171", fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>⚠ Final Confirmation</h3><p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>Reset local app state to defaults?</p><div style={{ display: "flex", gap: 10 }}><button onClick={handleReset} disabled={resetting} style={{ background: resetting ? "rgba(239,68,68,0.4)" : "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 13, fontWeight: 800, cursor: resetting ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>{resetting ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Resetting...</> : <><Icon name="trash" size={14} /> Yes, Reset</>}</button><button onClick={() => { setShowReset(false); setResetPwd(""); setResetErr(""); setResetStep(1); }} style={{ background: "rgba(255,255,255,0.05)", color: "#64748b", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button></div></>}
        </div>}
    </div>}
    {tab !== "reset" && <button onClick={save} disabled={saving} style={{ marginTop: 26, background: saving ? "rgba(245,158,11,0.4)" : "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 14, padding: "13px 32px", fontSize: 14, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 4px 24px rgba(245,158,11,0.4)", display: "flex", alignItems: "center", gap: 8 }}>{saving ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />Saving to Firebase...</> : <><Icon name="cloud" size={15} />Save All Settings to Firebase</>}</button>}
  </div>;
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null), [active, setActive] = useState("sales"), [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState(INITIAL_SETTINGS), [tanks, setTanks] = useState(INITIAL_TANKS);
  const [unitConfig, setUnitConfig] = useState(UNIT_CONFIG_INIT);
  const [staffList, setStaffList] = useState(INITIAL_STAFF);
  const [resetKey, setResetKey] = useState(0);

  const handleLogin = u => { setUser(u); setActive(u.role === "owner" ? "dashboard" : "sales"); };
  const handleFactoryReset = () => { setSettings(INITIAL_SETTINGS); setTanks(INITIAL_TANKS); setUnitConfig(UNIT_CONFIG_INIT); setStaffList(INITIAL_STAFF); setResetKey(k => k + 1); setActive("dashboard"); };

  if (!user) return <LoginPage onLogin={handleLogin} staffList={staffList} />;

  const ownerViews = {
    dashboard: <OwnerDashboard key={resetKey} settings={settings} tanks={tanks} />,
    sales: <SalesView key={resetKey} user={user} unitConfig={unitConfig} />,
    stock: <StockView tanks={tanks} settings={settings} />,
    supply: <SupplyView key={resetKey} user={user} />,
    expenses: <ExpensesView key={resetKey} />,
    staff: <StaffView staffList={staffList} setStaffList={setStaffList} />,
    transport: <TransportView key={resetKey} />,
    reports: <ReportsView key={resetKey} />,
    settings: <SettingsView settings={settings} setSettings={setSettings} tanks={tanks} setTanks={setTanks} unitConfig={unitConfig} setUnitConfig={setUnitConfig} onFactoryReset={handleFactoryReset} />,
  };
  const staffViews = {
    sales: <SalesView key={resetKey} user={user} unitConfig={unitConfig} />,
    stock: <StockView tanks={tanks} settings={settings} />,
    supply: <SupplyView key={resetKey} user={user} />,
  };
  const views = user.role === "owner" ? ownerViews : staffViews;

  return <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Sora',sans-serif;background:#060d18;color:#f1f5f9}
      ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:rgba(255,255,255,0.02)}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
      input:focus,select:focus{border-color:rgba(245,158,11,0.45)!important;box-shadow:0 0 0 3px rgba(245,158,11,0.08)!important}
      button:active{transform:scale(0.97)}@keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
    <div style={{ display: "flex", height: "100vh", background: "#060d18", overflow: "hidden" }}>
      <Sidebar active={active} setActive={setActive} user={user} onLogout={() => setUser(null)} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ height: 52, background: "rgba(6,13,24,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 22px", gap: 14, flexShrink: 0, backdropFilter: "blur(10px)" }}>
          <p style={{ color: "#334155", fontSize: 12, flex: 1, margin: 0, fontWeight: 600 }}><span style={{ color: "#f59e0b", fontWeight: 800 }}>Shree K C Sarswat</span> · Petrol ERP · <span style={{ color: user.role === "owner" ? "#f59e0b" : "#60a5fa", fontWeight: 700 }}>{user.role === "owner" ? "👑 Owner" : "👤 " + user.name}</span></p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 6 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399" }} /><span style={{ color: "#34d399", fontSize: 10, fontWeight: 700 }}>Firebase Live</span></div>
          <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 8, padding: "4px 12px" }}><span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 800 }}>⛽ ₹{settings.petrolPrice}</span></div>
          <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: "4px 12px" }}><span style={{ color: "#3b82f6", fontSize: 12, fontWeight: 800 }}>🔵 ₹{settings.dieselPrice}</span></div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>{views[active] || <div style={{ padding: 40, color: "#334155", fontSize: 14 }}>Page not found</div>}</div>
      </div>
    </div>
  </>;
}
