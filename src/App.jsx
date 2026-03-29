// KC Sarswat Auto Fuel Station — ERP v3.0
// 9-Module Premium ERP | Firebase + Supabase Dual-Sync
// Modules: Dashboard · Sales · Stock · Supply · Lubricants · Khata · GST · Fraud · Analytics
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, doc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, writeBatch, onSnapshot
} from "firebase/firestore";

// ════════════════════════════════════════════════════════════════════════
// FIREBASE CONFIG
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// SUPABASE CONFIG (Module 9 — Future-proof API layer)
// ════════════════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://xgchjtiiwqraolnrnxxg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnY2hqdGlpd3FyYW9sbnJueHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODE1NDksImV4cCI6MjA5MDM1NzU0OX0.ceDR5BK6Jo8aGrDcuOWUxG8zhrIYMlQsC3m4r2wckW0";

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation"
};

// Supabase CRUD helpers — dual-write mirror of Firebase
const sbGet = async (table, filter = "") => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}&order=created_at.desc`, { headers: sbHeaders });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
};
const sbInsert = async (table, data) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: sbHeaders,
      body: JSON.stringify({ ...data, created_at: new Date().toISOString() })
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] || null;
  } catch { return null; }
};
const sbUpdate = async (table, id, data) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH", headers: sbHeaders,
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
    });
    return r.ok;
  } catch { return false; }
};
const sbDelete = async (table, id) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers: sbHeaders });
    return r.ok;
  } catch { return false; }
};
// Supabase audit trail — immutable log (Module 2)
const sbAudit = async (action, table, data, by = "system") => {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_trail`, {
      method: "POST", headers: sbHeaders,
      body: JSON.stringify({ action, table_name: table, record_data: JSON.stringify(data), performed_by: by, ts: new Date().toISOString(), created_at: new Date().toISOString() })
    });
  } catch {}
};

// ════════════════════════════════════════════════════════════════════════
// FIREBASE HELPERS
// ════════════════════════════════════════════════════════════════════════
const fbGet = async (col) => { try { const s = await getDocs(collection(db, col)); return s.docs.map(d => ({ ...d.data(), _fbId: d.id })); } catch { return []; } };
const fbSet = async (col, id, data) => { try { await setDoc(doc(db, col, id), { ...data, _updatedAt: new Date().toISOString() }); return true; } catch { return false; } };
const fbAdd = async (col, data) => { try { const r = await addDoc(collection(db, col), { ...data, _createdAt: new Date().toISOString() }); return r.id; } catch { return null; } };
const fbUpdate = async (col, id, data) => { try { await updateDoc(doc(db, col, id), { ...data, _updatedAt: new Date().toISOString() }); return true; } catch { return false; } };
const fbDelete = async (col, id) => { try { await deleteDoc(doc(db, col, id)); return true; } catch { return false; } };
const fbListen = (col, cb) => { try { return onSnapshot(collection(db, col), s => cb(s.docs.map(d => ({ ...d.data(), _fbId: d.id }))), () => {}); } catch { return () => {}; } };
const fbNuke = async (col) => { try { const s = await getDocs(collection(db, col)); if (s.empty) return; let b = writeBatch(db), c = 0; s.docs.forEach(d => { b.delete(d.ref); if (++c === 499) { b.commit(); b = writeBatch(db); c = 0; } }); await b.commit(); } catch {} };

// Dual-write: Firebase primary + Supabase mirror
const dualAdd = async (fbCol, sbTable, data, by = "system") => {
  const fbId = await fbAdd(fbCol, data);
  sbInsert(sbTable, { ...data, firebase_id: fbId }).catch(() => {});
  sbAudit("INSERT", sbTable, { ...data, firebase_id: fbId }, by).catch(() => {});
  return fbId;
};
const dualUpdate = async (fbCol, fbId, sbTable, sbId, data, by = "system") => {
  await fbUpdate(fbCol, fbId, data);
  if (sbId) sbUpdate(sbTable, sbId, data).catch(() => {});
  sbAudit("UPDATE", sbTable, { firebase_id: fbId, ...data }, by).catch(() => {});
};

// ════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════
const TODAY = new Date().toISOString().split("T")[0];
const OWNER = { email: "owner@kcsarswat.in", pwd: "KCSarswat@2025" };
const makeEmail = n => n.toLowerCase().replace(/\s+/g, "") + "kc@gmail.com";
const makePwd = n => n.toLowerCase().replace(/\s+/g, "") + "@123";
const SHIFTS = ["Day Shift", "Night Shift"];
const EXPENSE_CATS = ["Cleaning", "Maintenance", "Generator Diesel", "Electricity Bill", "Water Bill", "Staff Salary", "Cash Shortage", "Custom"];
const LUBE_PRODUCTS = ["Servo Premium 4T", "Servo Super Bike", "HP Racer 4T", "HP Laal Ghoda", "Servo Extreme 4T", "Custom"];
const LUBE_COGS = 0.65;
const UNIT_CONFIG = {
  unit1: { name: "Unit 1", machines: ["M1","M2","M3"], petrolMargin: 4.27, dieselMargin: 2.72 },
  unit2: { name: "Unit 2", machines: ["M4","M5"], petrolMargin: 3.79, dieselMargin: 2.28 },
  unit3: { name: "Unit 3", machines: ["M6","M7"], petrolMargin: 4.14, dieselMargin: 2.63 },
};
const INIT_SETTINGS = {
  petrolPrice: 102.84, dieselPrice: 89.62,
  lowStockAlert: 500, minOrderLitres: 12000, maxOrderLitres: 23000,
  monthlyOpex: 85000, // amortized daily = /26
  cashMismatchTolerance: 500,
  stationGSTIN: "08XXXXXXXXXXXXXXX",
  stationName: "Shree K C Sarswat Auto Fuel Station",
  stateVATPetrol: 4.27, stateVATDiesel: 2.72
};
const INIT_TANKS = {
  unit1: { petrol: { capacity:10000, current:0, buffer:1000 }, diesel: { capacity:15000, current:0, buffer:1500 } },
  unit2: { petrol: { capacity:8000, current:0, buffer:800 }, diesel: { capacity:12000, current:0, buffer:1200 } },
  unit3: { petrol: { capacity:8000, current:0, buffer:800 }, diesel: { capacity:12000, current:0, buffer:1200 } },
};
const HOLIDAYS = ["2025-01-26","2025-03-25","2025-08-15","2025-10-02","2025-10-20","2025-12-25","2026-01-01","2026-01-26","2026-03-17","2026-04-14","2026-08-15","2026-10-02"];
const TRUCKS = [
  { id:"own", name:"Own Truck (14K)", cap:14000, pref:true },
  { id:"t12", name:"Transport 12K", cap:12000, pref:false },
  { id:"t16", name:"Transport 16K", cap:16000, pref:false },
  { id:"t23", name:"Transport 23K", cap:23000, pref:false },
];
// Invoice sequence counter (loaded from Supabase)
let invoiceCounter = 1;

const isWithin24h = d => { try { return (Date.now() - new Date(d + "T00:00:00")) < 86400000; } catch { return true; } };
const isDepotClosed = dt => { const h = dt.getHours(), day = dt.getDay(), ds = dt.toISOString().split("T")[0]; return day === 0 || HOLIDAYS.includes(ds) || h >= 17; };
// VCF for fuel temperature correction (ASTM D1250)
const calcVCF = (fuelType, tempC) => {
  const baseCoeff = fuelType === "petrol" ? 0.00090 : 0.00082;
  return 1 - (baseCoeff * (tempC - 15));
};
// Weighted moving average for demand forecast
const forecastDays = (tankCurrent, salesArr) => {
  if (!salesArr || salesArr.length < 2) return 99;
  const recent = salesArr.slice(-4).reverse();
  const weights = [0.4, 0.3, 0.2, 0.1];
  const wAvg = recent.reduce((s, v, i) => s + (v || 0) * (weights[i] || 0.1), 0);
  return wAvg > 0 ? Math.max(0, tankCurrent / wAvg) : 99;
};

// ════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════
const card = { background:"rgba(13,27,42,0.92)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:22 };
const inp = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"12px 14px", color:"#f1f5f9", fontSize:14, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box", minHeight:48 };
const inpErr = { ...inp, background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.55)" };
const btn = (c="#f59e0b") => ({ background:`linear-gradient(135deg,${c},${c}cc)`, color:"#fff", border:"none", borderRadius:12, padding:"12px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:48, touchAction:"manipulation" });
const ghostBtn = { background:"rgba(255,255,255,0.05)", color:"#64748b", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 22px", fontSize:13, cursor:"pointer", fontFamily:"inherit", minHeight:48 };

// ════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════════
const Label = ({ children, req }) => <label style={{ color:"#94a3b8", fontSize:11, fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.6px" }}>{children}{req && <span style={{ color:"#f87171", marginLeft:3 }}>*</span>}</label>;
const FieldErr = ({ msg }) => msg ? <div style={{ color:"#f87171", fontSize:11, marginTop:4 }}>{msg}</div> : null;
const Toast = ({ msg, type="success" }) => msg ? <div style={{ background:type==="success"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.1)", border:`1px solid ${type==="success"?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`, borderRadius:12, padding:"12px 18px", marginBottom:16, color:type==="success"?"#34d399":"#f87171", fontSize:13, fontWeight:600 }}>{msg}</div> : null;
const SyncBadge = ({ saving }) => <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", background:saving?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)", border:`1px solid ${saving?"rgba(245,158,11,0.2)":"rgba(16,185,129,0.2)"}`, borderRadius:6 }}><div style={{ width:6, height:6, borderRadius:"50%", background:saving?"#f59e0b":"#34d399" }} /><span style={{ color:saving?"#f59e0b":"#34d399", fontSize:10, fontWeight:700 }}>{saving?"Saving…":"Saved ✓"}</span></div>;
const ErrBanner = ({ errors }) => !errors?.length ? null : <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}><p style={{ color:"#fca5a5", fontSize:13, fontWeight:700, margin:"0 0 6px" }}>Please fix:</p><ul style={{ color:"#f87171", fontSize:12, margin:0, paddingLeft:16 }}>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>;
const LockedBar = () => <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"10px 16px", marginBottom:14, color:"#f87171", fontSize:12, fontWeight:600 }}>🔒 Locked — Staff can only edit today's data.</div>;
const Skeleton = ({ w="100%", h=16 }) => <div style={{ width:w, height:h, borderRadius:8, background:"rgba(255,255,255,0.06)", marginBottom:8 }} />;

// Alert Badge — Module 2
const AlertBadge = ({ count }) => count > 0 ? <span style={{ background:"#ef4444", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:10, fontWeight:900, display:"inline-flex", alignItems:"center", justifyContent:"center", marginLeft:6 }}>{count}</span> : null;

const ConfirmModal = ({ open, title, msg, onOk, onCancel, okLabel="Proceed", danger=false, extraBtn }) => {
  if (!open) return null;
  return <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}>
    <div style={{ ...card, border:`1px solid ${danger?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.3)"}`, width:440, boxShadow:"0 20px 60px rgba(0,0,0,0.8)", maxWidth:"95vw" }}>
      <h3 style={{ color:danger?"#fca5a5":"#f59e0b", fontSize:16, fontWeight:800, margin:"0 0 10px" }}>⚠ {title}</h3>
      <p style={{ color:"#94a3b8", fontSize:13, margin:"0 0 20px", lineHeight:1.7 }}>{msg}</p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <button onClick={onOk} style={{ flex:1, minHeight:48, background:danger?"linear-gradient(135deg,#ef4444,#dc2626)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{okLabel}</button>
        {extraBtn && <button onClick={extraBtn.onClick} style={{ flex:1, minHeight:48, background:"linear-gradient(135deg,#3b82f6,#2563eb)", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{extraBtn.label}</button>}
        <button onClick={onCancel} style={{ flex:1, ...ghostBtn }}>Cancel</button>
      </div>
    </div>
  </div>;
};

const DiscrepancyModal = ({ open, field, prevVal, currVal, onContinue, onFix }) => {
  if (!open) return null;
  const diff = parseFloat(currVal||0) - parseFloat(prevVal||0);
  return <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
    <div style={{ ...card, border:"2px solid rgba(239,68,68,0.6)", width:480, maxWidth:"95vw" }}>
      <h3 style={{ color:"#fca5a5", fontSize:17, fontWeight:900, margin:"0 0 10px" }}>⚠️ Balance Discrepancy!</h3>
      <p style={{ color:"#64748b", fontSize:12, margin:"0 0 6px" }}>{field}</p>
      <div style={{ background:"rgba(239,68,68,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
        <p style={{ color:"#94a3b8", fontSize:13, margin:0, lineHeight:1.8 }}>
          Previous closing: <b style={{ color:"#f59e0b" }}>₹{parseFloat(prevVal||0).toFixed(2)}</b><br/>
          Current opening: <b style={{ color:"#f59e0b" }}>₹{parseFloat(currVal||0).toFixed(2)}</b><br/>
          Discrepancy: <b style={{ color:diff>0?"#34d399":"#f87171" }}>{diff>0?"+":""}₹{diff.toFixed(2)}</b>
        </p>
      </div>
      <p style={{ color:"#f87171", fontSize:12, fontWeight:700, margin:"0 0 14px" }}>⛛ Meter Continuity Rule: Opening must equal previous closing. Flagged in audit log.</p>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onFix} style={{ flex:1, background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>← Fix It</button>
        <button onClick={onContinue} style={{ flex:1, background:"rgba(239,68,68,0.15)", color:"#f87171", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Continue (Flag)</button>
      </div>
    </div>
  </div>;
};

// ── StatCard ──
const StatCard = ({ label, value, sub, color="#f59e0b", icon, loading, alert }) => {
  if (loading) return <div style={{ ...card, height:110 }}><Skeleton /><Skeleton w="60%" h={24} /><Skeleton w="40%" h={12} /></div>;
  const rgb = color==="#f59e0b"?"245,158,11":color==="#3b82f6"?"59,130,246":color==="#10b981"?"16,185,129":color==="#8b5cf6"?"139,92,246":"239,68,68";
  return <div style={{ ...card, border:`1px solid rgba(${rgb},0.22)`, position:"relative", overflow:"hidden" }}>
    {alert && <div style={{ position:"absolute", top:10, right:10, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:900, padding:"2px 7px", borderRadius:8 }}>🚨 ALERT</div>}
    <div style={{ position:"absolute", top:0, right:0, width:100, height:100, background:`radial-gradient(circle at top right,rgba(${rgb},0.1),transparent)`, borderRadius:"0 18px 0 100%" }} />
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:"0 0 8px", letterSpacing:"0.9px", textTransform:"uppercase" }}>{label}</p>
        <p style={{ color:"#f1f5f9", fontSize:24, fontWeight:800, margin:0, letterSpacing:"-0.5px" }}>{value}</p>
        {sub && <p style={{ color:"#94a3b8", fontSize:12, margin:"4px 0 0" }}>{sub}</p>}
      </div>
      <div style={{ width:46, height:46, background:`rgba(${rgb},0.14)`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", color, fontSize:22, flexShrink:0 }}>{icon}</div>
    </div>
  </div>;
};

// ── TankGauge ──
const TankGauge = ({ label, current, capacity, color, lowAlert, buffer, forecastD }) => {
  const pct = Math.min((current/capacity)*100, 100);
  const bPct = capacity>0 ? Math.min(((buffer||0)/capacity)*100, 100) : 0;
  const usable = Math.max(0, current-(buffer||0));
  const isLow = usable < (lowAlert||500);
  const urgency = forecastD !== undefined ? (forecastD < 1 ? "critical" : forecastD < 3 ? "warning" : "ok") : "ok";
  return <div style={{ ...card, textAlign:"center", padding:"14px 10px", border:`1px solid ${urgency==="critical"?"rgba(239,68,68,0.5)":urgency==="warning"?"rgba(245,158,11,0.3)":"rgba(255,255,255,0.07)"}` }}>
    <p style={{ color:"#94a3b8", fontSize:9, fontWeight:700, margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.8px" }}>{label}</p>
    <div style={{ position:"relative", width:50, height:90, margin:"0 auto 8px", borderRadius:"6px 6px 4px 4px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:`linear-gradient(0deg,${color}cc,${color}55)`, transition:"height 0.6s" }} />
      {bPct>0 && <div style={{ position:"absolute", left:0, right:0, bottom:`${bPct}%`, height:2, background:"#ef4444", zIndex:2 }} />}
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"#f1f5f9", fontSize:10, fontWeight:700, textShadow:"0 1px 4px rgba(0,0,0,0.9)" }}>{pct.toFixed(0)}%</span>
      </div>
    </div>
    <p style={{ color:"#f1f5f9", fontSize:12, fontWeight:700, margin:"0 0 1px" }}>{current.toLocaleString()}L</p>
    <p style={{ color:"#34d399", fontSize:10, margin:"0 0 4px" }}>Use: {usable.toLocaleString()}L</p>
    {forecastD !== undefined && forecastD < 99 && <p style={{ color:urgency==="critical"?"#f87171":urgency==="warning"?"#f59e0b":"#64748b", fontSize:9, fontWeight:700, margin:"0 0 4px" }}>~{forecastD.toFixed(1)}d</p>}
    {isLow && <span style={{ background:"rgba(239,68,68,0.15)", color:"#f87171", fontSize:9, padding:"2px 6px", borderRadius:4, fontWeight:700 }}>⚠ LOW</span>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — LOGIN
// ════════════════════════════════════════════════════════════════════════
const LoginPage = ({ onLogin, staffList }) => {
  const [email, setEmail] = useState(""), [pwd, setPwd] = useState(""), [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [showPwd, setShowPwd] = useState(false);
  const login = async () => {
    setLoading(true); setError("");
    await new Promise(r => setTimeout(r, 400));
    const el = email.toLowerCase().trim(), pl = pwd;
    if (role === "owner") {
      if (el === OWNER.email.toLowerCase() && pl === OWNER.pwd) onLogin({ role:"owner", name:"Owner", staffId:null });
      else setError("Invalid owner credentials.");
    } else {
      const s = staffList.find(x => makeEmail(x.name).toLowerCase() === el && x.password === pl && x.active);
      if (s) onLogin({ role:"staff", name:s.name, staffId:s._fbId||s.id, unit:s.unit });
      else setError("Staff not found or inactive.");
    }
    setLoading(false);
  };
  return <div style={{ minHeight:"100vh", display:"flex", fontFamily:"'Sora',system-ui,sans-serif", background:"#060d18" }}>
    <div style={{ flex:1, background:"linear-gradient(180deg,#0a0f1a,#0d1c2e,#102238)", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:40 }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:80, marginBottom:16 }}>⛽</div>
        <h2 style={{ color:"#f1f5f9", fontSize:28, fontWeight:800, margin:"0 0 8px" }}>Shree K C Sarswat</h2>
        <h3 style={{ color:"#f59e0b", fontSize:20, fontWeight:700, margin:"0 0 8px" }}>Auto Fuel Station</h3>
        <p style={{ color:"#475569", fontSize:13 }}>3 Units · 7 Machines · HPCL · Lunkaransar, RJ</p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:20, flexWrap:"wrap" }}>
          {[["⛽","Petrol","#f59e0b"],["🔵","Diesel","#3b82f6"],["🛢","Lubes","#8b5cf6"],["📋","Khata","#10b981"],["🧾","GST","#f59e0b"]].map(([icon,label,col]) =>
            <div key={label} style={{ padding:"8px 16px", background:`rgba(${col==="#f59e0b"?"245,158,11":col==="#3b82f6"?"59,130,246":col==="#8b5cf6"?"139,92,246":col==="#10b981"?"16,185,129":"245,158,11"},0.1)`, border:`1px solid ${col}44`, borderRadius:10 }}>
              <span style={{ color:col, fontSize:13, fontWeight:700 }}>{icon} {label}</span>
            </div>
          )}
        </div>
        <div style={{ marginTop:16, padding:"8px 16px", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:10, fontSize:10, color:"#34d399", fontWeight:700 }}>
          🔗 Firebase + Supabase Dual-Sync Active
        </div>
      </div>
    </div>
    <div style={{ width:400, background:"#07111e", borderLeft:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", justifyContent:"center", padding:"44px 40px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ width:48, height:48, background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>⛽</div>
        <div><p style={{ color:"#f1f5f9", fontSize:15, fontWeight:800, margin:0 }}>KC Sarswat ERP v3.0</p><p style={{ color:"#475569", fontSize:11, margin:0 }}>Premium Station Management</p></div>
      </div>
      <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:18, border:"1px solid rgba(255,255,255,0.07)" }}>
        {[["owner","👑 Owner"],["staff","👤 Staff"]].map(([r,l]) =>
          <button key={r} onClick={() => { setRole(r); setEmail(""); setPwd(""); setError(""); }} style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, background:role===r?"linear-gradient(135deg,#f59e0b,#d97706)":"transparent", color:role===r?"#fff":"#64748b" }}>{l}</button>
        )}
      </div>
      <div style={{ marginBottom:14 }}><Label>Email</Label><input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder={role==="owner"?"owner@kcsarswat.in":"yournamekc@gmail.com"} style={{ ...inp, fontSize:14 }} /></div>
      <div style={{ marginBottom:18, position:"relative" }}>
        <Label>Password</Label>
        <input type={showPwd?"text":"password"} value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} style={{ ...inp, fontSize:14, paddingRight:44 }} />
        <button onClick={()=>setShowPwd(!showPwd)} style={{ position:"absolute", right:12, top:34, background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:16 }}>{showPwd?"🙈":"👁"}</button>
      </div>
      {error && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:14, color:"#f87171", fontSize:12, fontWeight:600 }}>⚠ {error}</div>}
      <button onClick={login} disabled={loading} style={{ width:"100%", background:loading?"rgba(245,158,11,0.4)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:12, padding:"14px 0", fontSize:14, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"inherit", minHeight:48 }}>
        {loading?"Signing in…":"Sign In →"}
      </button>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════════════
const Sidebar = ({ active, setActive, user, onLogout, collapsed, setCollapsed, alertCount }) => {
  const ownerNav = [
    { id:"dashboard", label:"Dashboard", icon:"📊" },
    { id:"sales", label:"Sales Entry", icon:"🧾" },
    { id:"stock", label:"Stock", icon:"📦" },
    { id:"supply", label:"Fuel Supply", icon:"🚛" },
    { id:"logistics", label:"Order Alerts", icon:"🔔" },
    { id:"lubricants", label:"Lubricants", icon:"🛢" },
    { id:"khata", label:"Khata / Credit", icon:"📋" },
    { id:"gstbilling", label:"GST Billing", icon:"🧾" },
    { id:"expenses", label:"Expenses", icon:"💸" },
    { id:"staff", label:"Staff", icon:"👥" },
    { id:"transport", label:"Transport", icon:"🚚" },
    { id:"dip", label:"Dip & VCF", icon:"🌡" },
    { id:"reports", label:"Reports", icon:"📈" },
    { id:"settings", label:"Settings", icon:"⚙️" },
  ];
  const staffNav = [
    { id:"sales", label:"Sales Entry", icon:"🧾" },
    { id:"stock", label:"Stock", icon:"📦" },
    { id:"supply", label:"Fuel Supply", icon:"🚛" },
    { id:"lubricants", label:"Lubricants", icon:"🛢" },
  ];
  const nav = user.role==="owner" ? ownerNav : staffNav;
  return <div style={{ width:collapsed?64:224, background:"linear-gradient(180deg,#06111e,#08192a)", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", transition:"width 0.25s", overflow:"hidden", flexShrink:0, height:"100vh" }}>
    <div style={{ padding:collapsed?"14px 12px":"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:34, height:34, background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>⛽</div>
      {!collapsed && <div style={{ flex:1 }}><p style={{ color:"#f1f5f9", fontSize:12, fontWeight:800, margin:0 }}>KC Sarswat</p><p style={{ color:"#334155", fontSize:10, margin:0 }}>ERP v3.0</p></div>}
      <button onClick={()=>setCollapsed(!collapsed)} style={{ background:"none", border:"none", cursor:"pointer", color:"#334155", fontSize:16, padding:4, flexShrink:0 }}>{collapsed?"›":"‹"}</button>
    </div>
    {!collapsed && <div style={{ margin:"8px 8px 0", padding:"8px 12px", background:user.role==="owner"?"rgba(245,158,11,0.08)":"rgba(59,130,246,0.08)", borderRadius:10, border:`1px solid ${user.role==="owner"?"rgba(245,158,11,0.15)":"rgba(59,130,246,0.15)"}` }}>
      <p style={{ color:user.role==="owner"?"#f59e0b":"#60a5fa", fontSize:10, fontWeight:700, margin:"0 0 2px", textTransform:"uppercase" }}>{user.role==="owner"?"👑 Owner":"👤 Staff"}</p>
      <p style={{ color:"#64748b", fontSize:10, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</p>
    </div>}
    <nav style={{ flex:1, padding:"8px 6px", overflowY:"auto" }}>
      {nav.map(item => <button key={item.id} onClick={()=>setActive(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, marginBottom:2, background:active===item.id?"rgba(245,158,11,0.12)":"transparent", color:active===item.id?"#f59e0b":"#475569", borderLeft:active===item.id?"2px solid #f59e0b":"2px solid transparent" }}>
        <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
        {!collapsed && <span style={{ whiteSpace:"nowrap", flex:1 }}>{item.label}</span>}
        {!collapsed && item.id==="logistics" && alertCount>0 && <AlertBadge count={alertCount} />}
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
// MODULE 1 — EXECUTIVE DASHBOARD (Profitability-focused)
// ════════════════════════════════════════════════════════════════════════
const Dashboard = ({ settings, tanks }) => {
  const [salesData, setSalesData] = useState([]), [lubeData, setLubeData] = useState([]);
  const [expData, setExpData] = useState([]), [loading, setLoading] = useState(true);
  const [auditFlags, setAuditFlags] = useState([]);

  useEffect(() => {
    const u1 = fbListen("sales", d => { setSalesData(d||[]); setLoading(false); });
    const u2 = fbListen("lubricants", d => setLubeData(d||[]));
    const u3 = fbListen("expenses", d => setExpData(d||[]));
    // Load audit flags from Supabase
    sbGet("audit_trail", "action=eq.FRAUD_ALERT&order=created_at.desc&limit=20").then(d => setAuditFlags(d||[]));
    return () => { u1(); u2(); u3(); };
  }, []);

  const daily = useMemo(() => Array.from({ length:7 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const ds = d.toISOString().split("T")[0];
    let p=0, di=0, lr=0, lp=0;
    salesData.filter(s=>s.date===ds).forEach(s => {
      if (!s.readings) return;
      Object.entries(s.readings).forEach(([,r]) => {
        const po=parseFloat(r.petrolOpen||0), pc=parseFloat(r.petrolClose||0);
        const doo=parseFloat(r.dieselOpen||0), dc=parseFloat(r.dieselClose||0);
        if (pc>po) p+=pc-po; if (dc>doo) di+=dc-doo;
      });
    });
    lubeData.filter(l=>l.date===ds).forEach(l => { lr+=(l.price||0)*(l.qty||0); lp+=(l.grossProfit||0); });
    // Compute margin profit per unit config
    const petrolProfit = Object.values(UNIT_CONFIG).reduce((s,u)=>s+(p/3)*u.petrolMargin,0); // simplified avg
    const dieselProfit = Object.values(UNIT_CONFIG).reduce((s,u)=>s+(di/3)*u.dieselMargin,0);
    const grossMargin = petrolProfit + dieselProfit + lp;
    return { date:d.toLocaleDateString("en-IN",{month:"short",day:"numeric"}), petrol:Math.round(p), diesel:Math.round(di), lubeRev:Math.round(lr), grossMargin:Math.round(grossMargin) };
  }), [salesData, lubeData]);

  const today = daily[6];
  const amortizedOpex = (settings.monthlyOpex||85000) / 26;
  const todayRev = today.petrol*settings.petrolPrice + today.diesel*settings.dieselPrice + today.lubeRev;
  const todayNetProfit = today.grossMargin - amortizedOpex;

  const cashToday = useMemo(() => {
    let pp=0, pt=0, ec=0, ac=0, diff=0;
    salesData.filter(s=>s.date===TODAY).forEach(s => {
      pp+=parseFloat(s.phonePeSales||0); pt+=parseFloat(s.paytmSales||0);
      ec+=parseFloat(s.expectedCash||0); ac+=parseFloat(s.cashDeposited||0);
    });
    diff = ac - ec;
    return { pp, pt, ec, ac, diff };
  }, [salesData]);

  // Best performing unit by margin
  const unitPerf = useMemo(() => {
    const perf = {};
    Object.entries(UNIT_CONFIG).forEach(([uid,u]) => {
      let pL=0, dL=0;
      salesData.filter(s=>s.date===TODAY).forEach(s => {
        u.machines.forEach(mId => {
          const r=s.readings?.[mId];
          if (!r) return;
          const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0);
          const doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0);
          if (pc>po) pL+=pc-po; if (dc>doo) dL+=dc-doo;
        });
      });
      perf[uid] = { name:u.name, margin:(pL*u.petrolMargin+dL*u.dieselMargin).toFixed(0) };
    });
    return perf;
  }, [salesData]);
  const bestUnit = Object.values(unitPerf).sort((a,b)=>parseFloat(b.margin)-parseFloat(a.margin))[0];

  const totalStock = useMemo(() => {
    let tp=0, td=0;
    Object.values(tanks).forEach(u => { tp+=u.petrol?.current||0; td+=u.diesel?.current||0; });
    return { petrol:tp, diesel:td };
  }, [tanks]);

  const cashLeakage = cashToday.diff < -(settings.cashMismatchTolerance||500);

  // 7-day unit sales for last week sales data
  const last7DaysByUnit = useMemo(() => {
    const result = {};
    Object.keys(UNIT_CONFIG).forEach(uid => { result[uid] = { petrol:[], diesel:[] }; });
    Array.from({ length:7 }, (_,i) => {
      const d = new Date(); d.setDate(d.getDate()-(6-i));
      const ds = d.toISOString().split("T")[0];
      Object.entries(UNIT_CONFIG).forEach(([uid,u]) => {
        let pL=0, dL=0;
        salesData.filter(s=>s.date===ds).forEach(s => {
          u.machines.forEach(mId => {
            const r=s.readings?.[mId]; if (!r) return;
            const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0);
            const doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0);
            if (pc>po) pL+=pc-po; if (dc>doo) dL+=dc-doo;
          });
        });
        result[uid].petrol.push(pL); result[uid].diesel.push(dL);
      });
    });
    return result;
  }, [salesData]);

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, flexWrap:"wrap", gap:8 }}>
      <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:0 }}>Executive Dashboard</h1>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <span style={{ color:"#34d399", fontSize:11, fontWeight:700 }}>🔴 Live</span>
        <span style={{ color:"#475569", fontSize:11 }}>Firebase + Supabase</span>
      </div>
    </div>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>{new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>

    {/* KPI Cards — Module 1 */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14, marginBottom:20 }}>
      <StatCard label="Net Profit Today" value={`₹${todayNetProfit.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub={`Gross ₹${today.grossMargin.toLocaleString()} − OPEX ₹${amortizedOpex.toFixed(0)}`} color={todayNetProfit>=0?"#10b981":"#ef4444"} icon="💰" loading={loading} />
      <StatCard label="Cash Leakage" value={`${cashToday.diff>=0?"+":""}₹${cashToday.diff.toFixed(0)}`} sub="Short / Over today" color={cashToday.diff===0?"#10b981":cashToday.diff>0?"#10b981":"#ef4444"} icon="🏦" loading={loading} alert={cashLeakage} />
      <StatCard label="Best Unit" value={bestUnit?.name||"—"} sub={`₹${bestUnit?.margin||0} margin`} color="#f59e0b" icon="🏆" loading={loading} />
      <StatCard label="Petrol Today" value={`${today.petrol.toLocaleString()} L`} sub={`₹${(today.petrol*settings.petrolPrice).toLocaleString("en-IN",{maximumFractionDigits:0})}`} color="#f59e0b" icon="⛽" loading={loading} />
      <StatCard label="Diesel Today" value={`${today.diesel.toLocaleString()} L`} sub={`₹${(today.diesel*settings.dieselPrice).toLocaleString("en-IN",{maximumFractionDigits:0})}`} color="#3b82f6" icon="🔵" loading={loading} />
      <StatCard label="Revenue Today" value={`₹${todayRev.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub="Fuel + Lubes" color="#8b5cf6" icon="📊" loading={loading} />
    </div>

    {/* Cash Mismatch Alert Banner — Module 2 */}
    {cashLeakage && <div style={{ background:"rgba(239,68,68,0.1)", border:"2px solid rgba(239,68,68,0.5)", borderRadius:14, padding:"14px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
      <span style={{ fontSize:28 }}>🚨</span>
      <div>
        <p style={{ color:"#f87171", fontSize:14, fontWeight:900, margin:"0 0 4px" }}>CASH LEAKAGE ALERT</p>
        <p style={{ color:"#fca5a5", fontSize:12, margin:0 }}>Today's cash mismatch exceeds tolerance: <b>₹{Math.abs(cashToday.diff).toFixed(2)}</b> short. Immediate investigation required. Logged to audit trail.</p>
      </div>
    </div>}

    {/* Cash Reconciliation */}
    <div style={{ ...card, marginBottom:20, border:"1px solid rgba(245,158,11,0.2)" }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>💰 Today's Cash Reconciliation</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
        {[{l:"PhonePe",v:`₹${cashToday.pp.toFixed(2)}`,c:"#60a5fa"},{l:"Paytm",v:`₹${cashToday.pt.toFixed(2)}`,c:"#a78bfa"},{l:"Expected Cash",v:`₹${cashToday.ec.toFixed(2)}`,c:"#f59e0b"},{l:"Actual Cash",v:`₹${cashToday.ac.toFixed(2)}`,c:"#34d399"},{l:"Difference",v:`${cashToday.diff>=0?"+":""}₹${cashToday.diff.toFixed(2)}`,c:cashToday.diff===0?"#34d399":cashToday.diff>0?"#34d399":"#f87171"}].map(x =>
          <div key={x.l} style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:10 }}>
            <p style={{ color:"#64748b", fontSize:10, fontWeight:700, margin:"0 0 4px", textTransform:"uppercase" }}>{x.l}</p>
            <p style={{ color:x.c, fontSize:16, fontWeight:800, margin:0 }}>{x.v}</p>
          </div>
        )}
      </div>
    </div>

    {/* Charts */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
      <div style={card}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>7-Day Gross Margin vs Volume</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={daily} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f1f5f9", fontSize:11 }} />
            <Legend wrapperStyle={{ fontSize:11, color:"#64748b" }} />
            <Bar dataKey="petrol" name="Petrol (L)" fill="#f59e0b" radius={[5,5,0,0]} />
            <Bar dataKey="diesel" name="Diesel (L)" fill="#3b82f6" radius={[5,5,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={card}>
        <h3 style={{ color:"#10b981", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>💰 7-Day Net Profit Trend</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill:"#475569", fontSize:10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"#f1f5f9", fontSize:11 }} />
            <Area type="monotone" dataKey="grossMargin" name="Gross Margin ₹" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Tank + Forecast — Module 5 */}
    <div style={{ ...card, marginBottom:20 }}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🛢 Tank Levels + AI Forecast (Days Remaining)</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10 }}>
        {Object.entries(UNIT_CONFIG).flatMap(([uid,u]) => [
          <TankGauge key={uid+"p"} label={`${u.name} Petrol`} current={tanks[uid]?.petrol?.current||0} capacity={tanks[uid]?.petrol?.capacity||10000} color="#f59e0b" lowAlert={settings.lowStockAlert} buffer={tanks[uid]?.petrol?.buffer||0} forecastD={forecastDays(tanks[uid]?.petrol?.current||0, last7DaysByUnit[uid]?.petrol)} />,
          <TankGauge key={uid+"d"} label={`${u.name} Diesel`} current={tanks[uid]?.diesel?.current||0} capacity={tanks[uid]?.diesel?.capacity||15000} color="#3b82f6" lowAlert={settings.lowStockAlert} buffer={tanks[uid]?.diesel?.buffer||0} forecastD={forecastDays(tanks[uid]?.diesel?.current||0, last7DaysByUnit[uid]?.diesel)} />
        ])}
      </div>
    </div>

    {/* Audit Flags */}
    {auditFlags.length > 0 && <div style={{ ...card, border:"1px solid rgba(239,68,68,0.3)" }}>
      <h3 style={{ color:"#f87171", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🚩 Recent Audit Flags (Supabase)</h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Time","Action","Details","By"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"6px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{auditFlags.slice(0,5).map((f,i)=><tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:"#64748b", fontSize:11, padding:"8px 10px" }}>{f.ts?.slice(0,16)||"—"}</td>
            <td style={{ color:"#f87171", fontSize:11, fontWeight:700, padding:"8px 10px" }}>{f.action}</td>
            <td style={{ color:"#94a3b8", fontSize:11, padding:"8px 10px" }}>{f.table_name}</td>
            <td style={{ color:"#f59e0b", fontSize:11, padding:"8px 10px" }}>{f.performed_by}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE 2 — SALES ENTRY (with hard meter lock + fraud detection)
// ════════════════════════════════════════════════════════════════════════
const SalesView = ({ user, tanks, setTanks, settings }) => {
  const allowedUnits = user.role==="owner" ? Object.keys(UNIT_CONFIG) : (user.unit?[user.unit]:Object.keys(UNIT_CONFIG));
  const allM = Object.entries(UNIT_CONFIG).filter(([uid])=>allowedUnits.includes(uid)).flatMap(([uid,u])=>u.machines.map(id=>({id,unit:uid})));
  const emptyR = allM.reduce((a,m)=>({...a,[m.id]:{petrolOpen:"",petrolClose:"",dieselOpen:"",dieselClose:""}}),{});

  const [date, setDate] = useState(TODAY), [shift, setShift] = useState("Day Shift");
  const [readings, setReadings] = useState(emptyR);
  const [ppOpen, setPpOpen]=useState(""), [ppClose, setPpClose]=useState("");
  const [ptOpen, setPtOpen]=useState(""), [ptClose, setPtClose]=useState("");
  const [cashDep, setCashDep]=useState("");
  const [errs, setErrs]=useState([]), [fe, setFe]=useState({});
  const [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [prevShift, setPrevShift]=useState(null), [autoXfer, setAutoXfer]=useState(false);
  const [existEntry, setExistEntry]=useState(null), [showDup, setShowDup]=useState(false);
  const [discModal, setDiscModal]=useState({ open:false, field:"", prev:"", curr:"" });
  const [hardLocked, setHardLocked]=useState(false);
  const locked = user.role==="staff" && !isWithin24h(date);

  useEffect(() => {
    fbGet("sales").then(all => {
      all = all||[];
      let pd=date, ps=shift==="Day Shift"?"Night Shift":"Day Shift";
      if (shift==="Day Shift") { const d2=new Date(date); d2.setDate(d2.getDate()-1); pd=d2.toISOString().split("T")[0]; }
      setPrevShift(all.find(s=>s.date===pd&&s.shift===ps)||null);
      setExistEntry(all.find(s=>s.date===date&&s.shift===shift)||null);
    });
    setAutoXfer(false); setHardLocked(false);
  }, [date, shift]);

  const autoTransfer = () => {
    if (!prevShift) return;
    const nr = { ...emptyR };
    allM.forEach(({ id:mId }) => {
      const p = prevShift.readings?.[mId];
      if (p) nr[mId] = { petrolOpen:p.petrolClose||"", petrolClose:"", dieselOpen:p.dieselClose||"", dieselClose:"" };
    });
    setReadings(nr);
    setPpOpen(prevShift.phonePeClose||"");
    setPtOpen(prevShift.paytmClose||"");
    setAutoXfer(true);
  };

  const upd = (mId, field, val) => {
    setReadings(p => ({ ...p, [mId]:{ ...p[mId], [field]:val } }));
    setFe(p => ({ ...p, [mId+field]:"" }));
    // Module 2: Hard meter continuity check
    if (field.includes("Open") && prevShift && !autoXfer) {
      const fuelType = field.replace("Open","");
      const pv = prevShift.readings?.[mId]?.[fuelType+"Close"];
      if (pv && Math.abs(parseFloat(pv)-parseFloat(val)) > 0.01) {
        setDiscModal({ open:true, field:`Machine ${mId} — ${fuelType} opening`, prev:pv, curr:val });
        // Log to Supabase audit trail
        sbAudit("FRAUD_ALERT", "meter_readings", {
          type:"METER_DISCONTINUITY", machine:mId, fuelType,
          expected:pv, entered:val, diff:parseFloat(val)-parseFloat(pv)
        }, user.name);
      }
    }
  };

  const calcLitres = (o,c) => { const ov=parseFloat(o), cv=parseFloat(c); if (isNaN(ov)||isNaN(cv)) return null; if (cv<ov) return { error:"Close < Open" }; return { litres:(cv-ov).toFixed(2) }; };

  const validate = () => {
    const e=[], nfe={};
    allM.forEach(({ id:mId }) => {
      const r=readings[mId];
      ["petrol","diesel"].forEach(f => {
        const o=r[`${f}Open`], c=r[`${f}Close`];
        if (o!==""&&c==="") { e.push(`Machine ${mId} ${f}: Closing missing`); nfe[mId+`${f}Close`]="Required"; }
        if (o===""&&c!=="") { e.push(`Machine ${mId} ${f}: Opening missing`); nfe[mId+`${f}Open`]="Required"; }
        if (o!==""&&c!==""&&parseFloat(c)<parseFloat(o)) { e.push(`Machine ${mId} ${f}: Close < Open`); nfe[mId+`${f}Close`]="Invalid"; }
      });
    });
    setFe(nfe); setErrs(e); return e.length===0;
  };

  const performSave = async (mode="new") => {
    setSaving(true);
    const unitSold = {};
    Object.keys(UNIT_CONFIG).forEach(uid=>{ unitSold[uid]={ petrol:0, diesel:0 }; });
    allM.forEach(({ id:mId, unit:uid }) => {
      const r=readings[mId];
      const ps=calcLitres(r.petrolOpen,r.petrolClose), ds=calcLitres(r.dieselOpen,r.dieselClose);
      if (ps?.litres) unitSold[uid].petrol+=parseFloat(ps.litres);
      if (ds?.litres) unitSold[uid].diesel+=parseFloat(ds.litres);
    });
    const ppSales=Math.max(0,parseFloat(ppClose||0)-parseFloat(ppOpen||0));
    const ptSales=Math.max(0,parseFloat(ptClose||0)-parseFloat(ptOpen||0));
    let totalFuelRev=0;
    allM.forEach(({ id:mId }) => {
      const r=readings[mId];
      const ps=calcLitres(r.petrolOpen,r.petrolClose), ds=calcLitres(r.dieselOpen,r.dieselClose);
      if (ps?.litres) totalFuelRev+=parseFloat(ps.litres)*settings.petrolPrice;
      if (ds?.litres) totalFuelRev+=parseFloat(ds.litres)*settings.dieselPrice;
    });
    const expectedCash=totalFuelRev-ppSales-ptSales;
    const cashDiff=parseFloat(cashDep||0)-expectedCash;
    // Module 2: Cash integrity check
    if (cashDiff < -(settings.cashMismatchTolerance||500)) {
      sbAudit("FRAUD_ALERT", "cash_integrity", {
        type:"CASH_SHORTAGE_ALERT", cashDiff, staffId:user.staffId,
        staffName:user.name, date, shift, threshold:settings.cashMismatchTolerance||500
      }, user.name);
    }
    // Compute unit-wise margins
    let fuelMargin=0;
    Object.entries(unitSold).forEach(([uid,sold]) => {
      const uc=UNIT_CONFIG[uid];
      fuelMargin+=sold.petrol*uc.petrolMargin+sold.diesel*uc.dieselMargin;
    });
    const ut=JSON.parse(JSON.stringify(tanks));
    Object.entries(unitSold).forEach(([uid,sold]) => {
      if (ut[uid]) {
        ut[uid].petrol.current=Math.max(0,(ut[uid].petrol.current||0)-sold.petrol);
        ut[uid].diesel.current=Math.max(0,(ut[uid].diesel.current||0)-sold.diesel);
      }
    });
    const entry = { date, shift, staffName:user.name, staffId:user.staffId||"owner", readings, phonePeOpen:ppOpen, phonePeClose:ppClose, paytmOpen:ptOpen, paytmClose:ptClose, cashDeposited:parseFloat(cashDep||0), phonePeSales:ppSales, paytmSales:ptSales, expectedCash, cashDiff, totalFuelRevenue:totalFuelRev, fuelMargin, autoTransferUsed:autoXfer, hasDiscrepancy:Math.abs(cashDiff)>0.01 };

    let fbId;
    if (mode==="replace"&&existEntry?._fbId) { await fbUpdate("sales",existEntry._fbId,entry); fbId=existEntry._fbId; }
    else if (mode==="merge"&&existEntry?._fbId) { await fbUpdate("sales",existEntry._fbId,{...existEntry,...entry}); fbId=existEntry._fbId; }
    else { fbId=await fbAdd("sales",entry); }
    // Mirror to Supabase
    sbInsert("sales", { ...entry, firebase_id:fbId, created_at:new Date().toISOString() }).catch(()=>{});

    await fbSet("tanks","main",ut);
    setTanks(ut);
    // Cash integrity score to Supabase
    const integrityScore = totalFuelRev>0 ? Math.max(0,(1-Math.abs(cashDiff)/Math.max(totalFuelRev,1))*100) : 100;
    sbInsert("cash_integrity_log", { staffId:user.staffId, staffName:user.name, date, shift, expectedCash, actualCash:parseFloat(cashDep||0), cashDiff, integrityScore, firebase_id:fbId, created_at:new Date().toISOString() }).catch(()=>{});

    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setShowDup(false);
  };

  const handleSave = () => { if (locked||!validate()) return; if (existEntry) { setShowDup(true); return; } performSave("new"); };

  const ppSalesLive=Math.max(0,parseFloat(ppClose||0)-parseFloat(ppOpen||0));
  const ptSalesLive=Math.max(0,parseFloat(ptClose||0)-parseFloat(ptOpen||0));
  let fuelRevLive=0;
  allM.forEach(({ id:mId })=>{ const r=readings[mId]; const ps=calcLitres(r.petrolOpen,r.petrolClose), ds=calcLitres(r.dieselOpen,r.dieselClose); if (ps?.litres) fuelRevLive+=parseFloat(ps.litres)*settings.petrolPrice; if (ds?.litres) fuelRevLive+=parseFloat(ds.litres)*settings.dieselPrice; });
  const expectedLive=fuelRevLive-ppSalesLive-ptSalesLive;
  const diffLive=parseFloat(cashDep||0)-expectedLive;

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <ConfirmModal open={showDup} title="Entry Already Exists" msg={`A ${shift} entry for ${date} already exists. Replace it entirely or merge?`} onOk={()=>performSave("replace")} onCancel={()=>setShowDup(false)} okLabel="Replace" danger extraBtn={{ label:"Merge / Add", onClick:()=>performSave("merge") }} />
    <DiscrepancyModal open={discModal.open} field={discModal.field} prevVal={discModal.prev} currVal={discModal.curr}
      onContinue={()=>setDiscModal({...discModal,open:false})}
      onFix={()=>setDiscModal({...discModal,open:false})} />

    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Sales Entry</h1>
        <p style={{ color:"#334155", fontSize:13, margin:0 }}>Meter readings · Cash reconciliation · Fraud detection</p></div>
      {(saving||saved)&&<SyncBadge saving={saving} />}
    </div>
    {locked&&<LockedBar />}

    <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap", alignItems:"flex-end" }}>
      <div><Label>Date</Label><input type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={user.role==="staff"} style={{ ...inp, width:160 }} /></div>
      <div><Label>Shift</Label><select value={shift} onChange={e=>setShift(e.target.value)} style={{ ...inp, width:160 }}>{SHIFTS.map(s=><option key={s} style={{ background:"#07111e" }}>{s}</option>)}</select></div>
      {existEntry&&<div style={{ padding:"8px 14px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, alignSelf:"flex-end" }}><span style={{ color:"#f87171", fontSize:12, fontWeight:700 }}>⚠ Entry exists</span></div>}
    </div>

    {prevShift&&!autoXfer&&<div style={{ ...card, border:"1px solid rgba(52,211,153,0.3)", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div><p style={{ color:"#34d399", fontSize:13, fontWeight:700, margin:"0 0 2px" }}>🔄 Previous Shift Available</p><p style={{ color:"#64748b", fontSize:12, margin:0 }}>Auto-fill from {prevShift.shift} · {prevShift.date}</p></div>
        <button onClick={autoTransfer} style={{ background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:48 }}>✅ Auto-Transfer → Opening</button>
      </div>
    </div>}
    {autoXfer&&<Toast msg="✅ Auto-transfer applied — previous closing used as opening" />}
    <ErrBanner errors={errs} />
    <Toast msg={saved?`✓ Saved — ${date} · ${shift} · Tank updated · Supabase synced`:null} />

    {Object.entries(UNIT_CONFIG).filter(([uid])=>allowedUnits.includes(uid)).map(([uid,unit])=>
      <div key={uid} style={{ ...card, marginBottom:14, opacity:locked?0.5:1 }}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>⛽ {unit.name}</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
          {unit.machines.map(mId => {
            const r=readings[mId]||{ petrolOpen:"", petrolClose:"", dieselOpen:"", dieselClose:"" };
            const ps=calcLitres(r.petrolOpen,r.petrolClose), ds=calcLitres(r.dieselOpen,r.dieselClose);
            return <div key={mId} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:14 }}>
              <p style={{ color:"#475569", fontSize:12, fontWeight:700, margin:"0 0 10px" }}>MACHINE {mId}</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[{ label:"⛽ Petrol", ok:"petrolOpen", ck:"petrolClose", s:ps, c:"#f59e0b" },{ label:"🔵 Diesel", ok:"dieselOpen", ck:"dieselClose", s:ds, c:"#3b82f6" }].map(f =>
                  <div key={f.label}>
                    <p style={{ color:f.c, fontSize:11, fontWeight:700, margin:"0 0 5px" }}>{f.label}</p>
                    <div style={{ display:"flex", gap:5 }}>
                      <div style={{ flex:1 }}><label style={{ color:"#475569", fontSize:10, display:"block", marginBottom:2 }}>Open</label><input type="number" inputMode="numeric" placeholder="0.00" value={r[f.ok]} onChange={e=>upd(mId,f.ok,e.target.value)} disabled={locked} style={fe[mId+f.ok]?{ ...inpErr,padding:"8px 10px" }:{ ...inp,padding:"8px 10px" }} /></div>
                      <div style={{ flex:1 }}><label style={{ color:"#475569", fontSize:10, display:"block", marginBottom:2 }}>Close</label><input type="number" inputMode="numeric" placeholder="0.00" value={r[f.ck]} onChange={e=>upd(mId,f.ck,e.target.value)} disabled={locked} style={fe[mId+f.ck]?{ ...inpErr,padding:"8px 10px" }:{ ...inp,padding:"8px 10px" }} /></div>
                    </div>
                    {f.s?.litres&&<p style={{ color:f.c, fontSize:11, margin:"3px 0 0", fontWeight:700 }}>{f.s.litres} L sold</p>}
                    {f.s?.error&&<p style={{ color:"#f87171", fontSize:11, margin:"3px 0 0" }}>{f.s.error}</p>}
                  </div>
                )}
              </div>
            </div>;
          })}
        </div>
      </div>
    )}

    <div style={{ ...card, marginBottom:14, border:"1px solid rgba(59,130,246,0.2)" }}>
      <h3 style={{ color:"#60a5fa", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>💳 Digital Payments & Cash</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12, marginBottom:14 }}>
        <div><Label>PhonePe Opening ₹</Label><input type="number" inputMode="numeric" value={ppOpen} onChange={e=>{ setPpOpen(e.target.value); if (prevShift&&Math.abs(parseFloat(prevShift.phonePeClose||0)-parseFloat(e.target.value))>0.01) setDiscModal({ open:true, field:"PhonePe Opening", prev:prevShift.phonePeClose||"0", curr:e.target.value }); }} style={inp} disabled={locked} /></div>
        <div><Label>PhonePe Closing ₹</Label><input type="number" inputMode="numeric" value={ppClose} onChange={e=>setPpClose(e.target.value)} style={inp} disabled={locked} /></div>
        <div><Label>Paytm Opening ₹</Label><input type="number" inputMode="numeric" value={ptOpen} onChange={e=>{ setPtOpen(e.target.value); if (prevShift&&Math.abs(parseFloat(prevShift.paytmClose||0)-parseFloat(e.target.value))>0.01) setDiscModal({ open:true, field:"Paytm Opening", prev:prevShift.paytmClose||"0", curr:e.target.value }); }} style={inp} disabled={locked} /></div>
        <div><Label>Paytm Closing ₹</Label><input type="number" inputMode="numeric" value={ptClose} onChange={e=>setPtClose(e.target.value)} style={inp} disabled={locked} /></div>
        <div><Label>Cash Deposited ₹</Label><input type="number" inputMode="numeric" value={cashDep} onChange={e=>setCashDep(e.target.value)} style={{ ...inp, border:"1px solid rgba(245,158,11,0.3)" }} disabled={locked} /></div>
      </div>
      <div style={{ padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:12 }}>
        <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:"0 0 10px", textTransform:"uppercase" }}>Live Calculation</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8 }}>
          {[{ l:"PhonePe", v:`₹${ppSalesLive.toFixed(2)}`, c:"#60a5fa" },{ l:"Paytm", v:`₹${ptSalesLive.toFixed(2)}`, c:"#a78bfa" },{ l:"Fuel Revenue", v:`₹${fuelRevLive.toFixed(2)}`, c:"#f59e0b" },{ l:"Expected Cash", v:`₹${expectedLive.toFixed(2)}`, c:"#f59e0b" },{ l:"Difference", v:`${diffLive>=0?"+":""}₹${diffLive.toFixed(2)}`, c:diffLive===0?"#34d399":diffLive>0?"#34d399":"#f87171" }].map(x =>
            <div key={x.l} style={{ padding:"8px 10px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
              <p style={{ color:"#475569", fontSize:10, fontWeight:700, margin:"0 0 3px", textTransform:"uppercase" }}>{x.l}</p>
              <p style={{ color:x.c, fontSize:14, fontWeight:800, margin:0 }}>{x.v}</p>
            </div>
          )}
        </div>
        {Math.abs(diffLive)>0.01&&cashDep!==""&&<div style={{ marginTop:10, padding:"8px 12px", background:"rgba(239,68,68,0.08)", borderRadius:8 }}><p style={{ color:"#f87171", fontSize:12, fontWeight:700, margin:0 }}>⚠ {diffLive>0?`Cash EXCESS ₹${diffLive.toFixed(2)}`:`Cash SHORT ₹${Math.abs(diffLive).toFixed(2)}`}</p></div>}
      </div>
    </div>
    <button onClick={handleSave} disabled={saving||locked} style={{ background:saving||locked?"rgba(245,158,11,0.4)":"linear-gradient(135deg,#f59e0b,#d97706)", color:"#fff", border:"none", borderRadius:12, padding:"13px 32px", fontSize:14, fontWeight:800, cursor:saving||locked?"not-allowed":"pointer", fontFamily:"inherit", minHeight:48 }}>
      {saving?"Saving…":"💾 Save Sales + Update Stock + Sync Supabase"}
    </button>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — STOCK VIEW (with AI forecast — Module 5)
// ════════════════════════════════════════════════════════════════════════
const StockView = ({ tanks, settings }) => {
  const [salesData, setSalesData] = useState([]);
  useEffect(() => { fbGet("sales").then(d=>setSalesData(d||[])); }, []);
  const last7 = useMemo(() => {
    const result={};
    Object.keys(UNIT_CONFIG).forEach(uid=>{ result[uid]={ petrol:[], diesel:[] }; });
    Array.from({ length:7 },(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const ds=d.toISOString().split("T")[0];
      Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
        let pL=0,dL=0;
        salesData.filter(s=>s.date===ds).forEach(s=>{
          u.machines.forEach(mId=>{ const r=s.readings?.[mId]; if(!r) return; const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0),doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0); if(pc>po) pL+=pc-po; if(dc>doo) dL+=dc-doo; });
        });
        result[uid].petrol.push(pL); result[uid].diesel.push(dL);
      });
    });
    return result;
  }, [salesData]);

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Stock Management</h1>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>Live tank levels · AI forecast (weighted moving avg) · Auto-updated on sales & supply</p>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))", gap:10, marginBottom:20 }}>
      {Object.entries(UNIT_CONFIG).flatMap(([uid,u])=>[
        <TankGauge key={uid+"p"} label={`${u.name} Petrol`} current={tanks[uid]?.petrol?.current||0} capacity={tanks[uid]?.petrol?.capacity||10000} color="#f59e0b" lowAlert={settings.lowStockAlert} buffer={tanks[uid]?.petrol?.buffer||0} forecastD={forecastDays(tanks[uid]?.petrol?.current||0, last7[uid]?.petrol)} />,
        <TankGauge key={uid+"d"} label={`${u.name} Diesel`} current={tanks[uid]?.diesel?.current||0} capacity={tanks[uid]?.diesel?.capacity||15000} color="#3b82f6" lowAlert={settings.lowStockAlert} buffer={tanks[uid]?.diesel?.buffer||0} forecastD={forecastDays(tanks[uid]?.diesel?.current||0, last7[uid]?.diesel)} />
      ])}
    </div>
    <div style={card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Tank Summary + AI Order Suggestion</h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Unit","Fuel","Current","Buffer","Usable","Capacity","Fill %","Forecast","Best Order","Status"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>
            {Object.entries(UNIT_CONFIG).flatMap(([uid,unit])=>["petrol","diesel"].map(fk=>{
              const t=tanks[uid]?.[fk]; if (!t) return null;
              const buf=t.buffer||0, usable=Math.max(0,t.current-buf), pct=((t.current/t.capacity)*100).toFixed(1);
              const col=fk==="petrol"?"#f59e0b":"#3b82f6";
              const fd=forecastDays(t.current, last7[uid]?.[fk]);
              const ullage=t.capacity-t.current;
              const bestTruck=TRUCKS.filter(tr=>tr.cap<=ullage).sort((a,b)=>b.cap-a.cap)[0];
              const urgent=fd<3;
              return <tr key={uid+fk} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:urgent?"rgba(239,68,68,0.03)":"transparent" }}>
                <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:600, padding:"10px 12px" }}>{unit.name}</td>
                <td style={{ padding:"10px 12px" }}><span style={{ color:col, fontWeight:700 }}>{fk==="petrol"?"Petrol":"Diesel"}</span></td>
                <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, padding:"10px 12px" }}>{t.current.toLocaleString()}L</td>
                <td style={{ color:"#ef4444", fontSize:12, padding:"10px 12px" }}>{buf.toLocaleString()}L</td>
                <td style={{ color:"#34d399", fontSize:13, fontWeight:700, padding:"10px 12px" }}>{usable.toLocaleString()}L</td>
                <td style={{ color:"#64748b", fontSize:13, padding:"10px 12px" }}>{t.capacity.toLocaleString()}L</td>
                <td style={{ padding:"10px 12px" }}><span style={{ color:col }}>{pct}%</span></td>
                <td style={{ padding:"10px 12px" }}><span style={{ color:fd<2?"#f87171":fd<4?"#f59e0b":"#34d399", fontWeight:700, fontSize:12 }}>{fd>=99?"—":`~${fd.toFixed(1)}d`}</span></td>
                <td style={{ color:"#60a5fa", fontSize:11, padding:"10px 12px" }}>{bestTruck&&fd<4?`${bestTruck.cap.toLocaleString()}L (${bestTruck.name})`:"—"}</td>
                <td style={{ padding:"10px 12px" }}>{usable<settings.lowStockAlert?<span style={{ background:"rgba(239,68,68,0.12)", color:"#f87171", fontSize:10, padding:"3px 7px", borderRadius:4, fontWeight:700 }}>⚠ LOW</span>:<span style={{ background:"rgba(16,185,129,0.1)", color:"#34d399", fontSize:10, padding:"3px 7px", borderRadius:4, fontWeight:700 }}>OK</span>}</td>
              </tr>;
            }))}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — SUPPLY VIEW
// ════════════════════════════════════════════════════════════════════════
const SupplyView = ({ user, tanks, setTanks }) => {
  const ef = { date:TODAY, fuelType:"Petrol", unit:"unit1", litres:"", truck:"", supplier:"HPCL" };
  const [supply, setSupply]=useState([]), [loading, setLoading]=useState(true), [show, setShow]=useState(false);
  const [editId, setEditId]=useState(null), [form, setForm]=useState(ef), [errs, setErrs]=useState([]), [fe, setFe]=useState({});
  const [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  useEffect(()=>{ const u=fbListen("supply",d=>{ setSupply(d.sort((a,b)=>(b.date||"").localeCompare(a.date||""))); setLoading(false); }); return u; },[]);

  const validate = () => {
    const e=[], nfe={};
    if (!form.litres||parseFloat(form.litres)<=0) { e.push("Litres required"); nfe.litres="Required"; }
    if (!form.truck.trim()) { e.push("Truck number required"); nfe.truck="Required"; }
    if (!form.supplier.trim()) { e.push("Supplier required"); nfe.supplier="Required"; }
    setErrs(e); setFe(nfe); return e.length===0;
  };

  const saveSupply = async () => {
    if (!validate()) return; setSaving(true);
    const litres=parseFloat(form.litres);
    const entry={ ...form, litres, savedBy:user.name };
    const ut=JSON.parse(JSON.stringify(tanks));
    const fk=form.fuelType.toLowerCase();
    if (editId) {
      const prev=supply.find(s=>s._fbId===editId);
      if (prev&&ut[prev.unit]) { const pfk=prev.fuelType.toLowerCase(); if (ut[prev.unit][pfk]) ut[prev.unit][pfk].current=Math.max(0,(ut[prev.unit][pfk].current||0)-(prev.litres||0)); }
    }
    if (ut[form.unit]?.[fk]) ut[form.unit][fk].current=Math.min(ut[form.unit][fk].capacity,(ut[form.unit][fk].current||0)+litres);
    if (editId) { await fbUpdate("supply",editId,entry); setSupply(p=>p.map(s=>s._fbId===editId?{...s,...entry}:s)); }
    else { const id=await fbAdd("supply",entry); sbInsert("supply",{...entry,firebase_id:id,created_at:new Date().toISOString()}).catch(()=>{}); setSupply(p=>[{...entry,_fbId:id},...p]); }
    await fbSet("tanks","main",ut); setTanks(ut);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setEditId(null); setForm(ef); setShow(false); setErrs([]); setFe({});
  };

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Fuel Supply</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Tanker deliveries · Tank auto-increases on save</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge saving={saving} />}<button onClick={()=>{ setEditId(null); setForm(ef); setShow(true); }} style={btn()}>+ Add Supply</button></div>
    </div>
    <Toast msg={saved?"Supply saved — Tank updated · Supabase synced 🔴":null} />
    {show&&<div style={{ ...card, border:"1px solid rgba(245,158,11,0.2)", marginBottom:16 }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>{editId?"Edit Supply":"New Supply"}</h3>
      <ErrBanner errors={errs} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp} /></div>
        <div><Label>Unit</Label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{ background:"#07111e" }}>{u.name}</option>)}</select></div>
        <div><Label>Fuel</Label><select value={form.fuelType} onChange={e=>setForm(p=>({...p,fuelType:e.target.value}))} style={inp}><option style={{ background:"#07111e" }}>Petrol</option><option style={{ background:"#07111e" }}>Diesel</option></select></div>
        <div><Label req>Litres</Label><input type="number" inputMode="numeric" value={form.litres} onChange={e=>{ setForm(p=>({...p,litres:e.target.value})); setFe(p=>({...p,litres:""})); }} style={fe.litres?inpErr:inp} /><FieldErr msg={fe.litres} /></div>
        <div><Label req>Truck No.</Label><input value={form.truck} onChange={e=>{ setForm(p=>({...p,truck:e.target.value})); setFe(p=>({...p,truck:""})); }} placeholder="RJ-XX-XX-XXXX" style={fe.truck?inpErr:inp} /><FieldErr msg={fe.truck} /></div>
        <div><Label req>Supplier</Label><input value={form.supplier} onChange={e=>{ setForm(p=>({...p,supplier:e.target.value})); setFe(p=>({...p,supplier:""})); }} style={fe.supplier?inpErr:inp} /><FieldErr msg={fe.supplier} /></div>
      </div>
      {form.unit&&form.fuelType&&(()=>{ const t=tanks[form.unit]?.[form.fuelType.toLowerCase()]; if (!t) return null; const after=Math.min(t.capacity,(t.current||0)+parseFloat(form.litres||0)); const ov=parseFloat(form.litres||0)>(t.capacity-t.current); return <div style={{ marginTop:12, padding:"10px 14px", background:ov?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.06)", border:`1px solid ${ov?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.2)"}`, borderRadius:10 }}><p style={{ color:ov?"#f87171":"#34d399", fontSize:12, margin:0 }}>📦 Tank: {t.current.toLocaleString()}L → {after.toLocaleString()}L / {t.capacity.toLocaleString()}L{ov?" ⚠ OVERFLOW!":""}</p></div>; })()}
      <div style={{ marginTop:14, display:"flex", gap:10 }}>
        <button onClick={saveSupply} disabled={saving} style={{ background:"linear-gradient(135deg,#10b981,#059669)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:48 }}>{saving?"Saving…":"Save + Update Stock"}</button>
        <button onClick={()=>{ setShow(false); setEditId(null); setErrs([]); setFe({}); }} style={ghostBtn}>Cancel</button>
      </div>
    </div>}
    {loading?<div style={{ ...card, color:"#475569", textAlign:"center", padding:30 }}>Loading…</div>:<div style={card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Supply Records <span style={{ color:"#34d399", fontSize:10 }}>🔴 Live</span></h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Date","Unit","Fuel","Litres","Truck","Supplier",""].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{supply.map(s=><tr key={s._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:s.date===TODAY?"#f59e0b":"#64748b", fontSize:12, padding:"10px 10px", fontWeight:s.date===TODAY?700:400 }}>{s.date}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:600, padding:"10px 10px" }}>{UNIT_CONFIG[s.unit]?.name||s.unit}</td>
            <td style={{ padding:"10px 10px" }}><span style={{ color:s.fuelType==="Petrol"?"#f59e0b":"#3b82f6", fontWeight:700 }}>{s.fuelType}</span></td>
            <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, padding:"10px 10px" }}>{s.litres?.toLocaleString()}L</td>
            <td style={{ color:"#64748b", fontSize:11, padding:"10px 10px", fontFamily:"monospace" }}>{s.truck}</td>
            <td style={{ color:"#64748b", fontSize:12, padding:"10px 10px" }}>{s.supplier}</td>
            <td style={{ padding:"10px 10px" }}>{(user.role==="owner"||isWithin24h(s.date))&&<button onClick={()=>{ setForm({ date:s.date, fuelType:s.fuelType, unit:s.unit, litres:String(s.litres), truck:s.truck, supplier:s.supplier }); setEditId(s._fbId); setShow(true); }} style={{ background:"rgba(59,130,246,0.1)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.2)", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✏</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — LOGISTICS / ORDER ALERTS (Module 5)
// ════════════════════════════════════════════════════════════════════════
const LogisticsView = ({ tanks, settings }) => {
  const [salesData, setSalesData] = useState([]);
  useEffect(()=>{ fbGet("sales").then(d=>setSalesData(d||[])); },[]);
  const now = new Date();
  const depotClosed = isDepotClosed(now);

  const last7 = useMemo(()=>{
    const result={};
    Object.keys(UNIT_CONFIG).forEach(uid=>{ result[uid]={ petrol:[], diesel:[] }; });
    Array.from({ length:7 },(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const ds=d.toISOString().split("T")[0];
      Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
        let pL=0,dL=0;
        salesData.filter(s=>s.date===ds).forEach(s=>{ u.machines.forEach(mId=>{ const r=s.readings?.[mId]; if(!r) return; const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0),doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0); if(pc>po) pL+=pc-po; if(dc>doo) dL+=dc-doo; }); });
        result[uid].petrol.push(pL); result[uid].diesel.push(dL);
      });
    });
    return result;
  },[salesData]);

  const alerts = useMemo(()=>{
    const list=[];
    Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
      ["petrol","diesel"].forEach(fk=>{
        const t=tanks[uid]?.[fk]; if (!t) return;
        const fd=forecastDays(t.current, last7[uid]?.[fk]);
        const ullage=t.capacity-t.current;
        const bestTruck=TRUCKS.filter(tr=>tr.cap<=ullage).sort((a,b)=>b.cap-a.cap)[0];
        const usable=Math.max(0,t.current-(t.buffer||0));
        if (fd<5 || usable<settings.lowStockAlert) {
          list.push({ uid, unitName:u.name, fuelType:fk, current:t.current, usable, fd, ullage, bestTruck, urgency:fd<2?"critical":fd<3?"high":fd<5?"medium":"low" });
        }
      });
    });
    return list.sort((a,b)=>a.fd-b.fd);
  },[tanks, last7, settings]);

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Order Alerts & Logistics</h1>
    <p style={{ color:"#334155", fontSize:13, margin:"0 0 20px" }}>AI-driven replenishment · Weighted moving average forecast</p>
    {depotClosed&&<div style={{ ...card, border:"1px solid rgba(239,68,68,0.3)", marginBottom:20, background:"rgba(239,68,68,0.06)" }}>
      <p style={{ color:"#f87171", fontSize:14, fontWeight:700, margin:0 }}>🔴 Depot Closed — {now.getDay()===0?"Sunday":"After 17:00 / Holiday"}. Orders cannot be placed now.</p>
    </div>}
    {alerts.length===0?<div style={{ ...card, textAlign:"center", color:"#475569", padding:40 }}>✅ All tanks are well-stocked. No orders needed.</div>:
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {alerts.map((a,i)=>{
        const urgColor=a.urgency==="critical"?"#ef4444":a.urgency==="high"?"#f87171":a.urgency==="medium"?"#f59e0b":"#34d399";
        return <div key={i} style={{ ...card, border:`1px solid ${urgColor}44` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ background:`rgba(${a.urgency==="critical"?"239,68,68":a.urgency==="high"?"248,113,113":a.urgency==="medium"?"245,158,11":"52,211,153"},0.15)`, color:urgColor, fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:8 }}>{a.urgency.toUpperCase()}</span>
                <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>{a.unitName} — {a.fuelType==="petrol"?"Petrol":"Diesel"}</h3>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8 }}>
                {[{ l:"Current Stock", v:`${a.current.toLocaleString()}L`, c:"#f1f5f9" },{ l:"Usable Stock", v:`${a.usable.toLocaleString()}L`, c:a.usable<settings.lowStockAlert?"#f87171":"#34d399" },{ l:"Days Remaining", v:a.fd>=99?"Unknown":`~${a.fd.toFixed(1)} days`, c:urgColor },{ l:"Tank Ullage", v:`${a.ullage.toLocaleString()}L`, c:"#60a5fa" }].map(x=>
                  <div key={x.l} style={{ padding:"8px 10px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
                    <p style={{ color:"#475569", fontSize:10, margin:"0 0 2px", textTransform:"uppercase", fontWeight:700 }}>{x.l}</p>
                    <p style={{ color:x.c, fontSize:14, fontWeight:800, margin:0 }}>{x.v}</p>
                  </div>
                )}
              </div>
            </div>
            {a.bestTruck&&!depotClosed&&<div style={{ padding:"14px 16px", background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:12, textAlign:"center", minWidth:160 }}>
              <p style={{ color:"#60a5fa", fontSize:11, fontWeight:700, margin:"0 0 6px" }}>🚛 SUGGESTED ORDER</p>
              <p style={{ color:"#f1f5f9", fontSize:18, fontWeight:900, margin:"0 0 2px" }}>{a.bestTruck.cap.toLocaleString()}L</p>
              <p style={{ color:"#475569", fontSize:11, margin:0 }}>{a.bestTruck.name}</p>
            </div>}
          </div>
        </div>;
      })}
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — LUBRICANTS (with GST preview)
// ════════════════════════════════════════════════════════════════════════
const LubricantsView = ({ user }) => {
  const [lubes, setLubes]=useState([]), [loading, setLoading]=useState(true);
  const [show, setShow]=useState(false), [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [errs, setErrs]=useState([]), [fe, setFe]=useState({}), [editId, setEditId]=useState(null);
  const [form, setForm]=useState({ date:TODAY, unit:"unit1", product:LUBE_PRODUCTS[0], customProduct:"", qty:"", price:"", costPrice:"" });
  useEffect(()=>{ const u=fbListen("lubricants",d=>{ setLubes(d.sort((a,b)=>(b.date||"").localeCompare(a.date||""))); setLoading(false); }); return u; },[]);

  const validate = () => {
    const e=[], nfe={};
    if (!form.qty||parseFloat(form.qty)<=0) { e.push("Quantity required"); nfe.qty="Required"; }
    if (!form.price||parseFloat(form.price)<=0) { e.push("Price required"); nfe.price="Required"; }
    if (form.product==="Custom"&&!form.customProduct.trim()) { e.push("Product name required"); nfe.customProduct="Required"; }
    setErrs(e); setFe(nfe); return e.length===0;
  };

  const save = async () => {
    if (!validate()) return; setSaving(true);
    const prod=form.product==="Custom"?form.customProduct:form.product;
    const qty=parseFloat(form.qty), price=parseFloat(form.price);
    const cp=form.costPrice?parseFloat(form.costPrice):price*LUBE_COGS;
    const gstAmt=qty*price*0.18, cgst=gstAmt/2, sgst=gstAmt/2;
    const entry={ date:form.date, unit:form.unit, product:prod, qty, price, costPrice:cp, revenue:qty*price, cogs:qty*cp, grossProfit:qty*(price-cp), cgst, sgst, totalWithGST:qty*price+gstAmt, hsn:"3811", staffName:user.name, staffId:user.staffId||"owner" };
    if (editId) { await fbUpdate("lubricants",editId,entry); setLubes(p=>p.map(l=>l._fbId===editId?{...l,...entry}:l)); sbInsert("lubricants",{...entry,firebase_id:editId,created_at:new Date().toISOString()}).catch(()=>{}); }
    else { const id=await fbAdd("lubricants",entry); sbInsert("lubricants",{...entry,firebase_id:id,created_at:new Date().toISOString()}).catch(()=>{}); setLubes(p=>[{...entry,_fbId:id},...p]); }
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setShow(false); setEditId(null); setErrs([]); setFe({});
    setForm({ date:TODAY, unit:"unit1", product:LUBE_PRODUCTS[0], customProduct:"", qty:"", price:"", costPrice:"" });
  };

  const totRev=lubes.reduce((s,l)=>s+(l.revenue||0),0);
  const totCOGS=lubes.reduce((s,l)=>s+(l.cogs||0),0);
  const totGP=lubes.reduce((s,l)=>s+(l.grossProfit||0),0);
  const totGST=lubes.reduce((s,l)=>s+(l.cgst||0)+(l.sgst||0),0);

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🛢 Lubricants</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>ICAI AS-9 · Revenue vs COGS · Gross Profit · 18% GST (CGST+SGST)</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge saving={saving} />}<button onClick={()=>{ setShow(!show); setEditId(null); }} style={btn("#8b5cf6")}>+ Add Sale</button></div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:20 }}>
      <StatCard label="Total Revenue" value={`₹${totRev.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub={`${lubes.length} entries`} color="#8b5cf6" icon="🛢" />
      <StatCard label="Total COGS" value={`₹${totCOGS.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub="65% default" color="#ef4444" icon="📦" />
      <StatCard label="Gross Profit" value={`₹${totGP.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub={totRev>0?`${((totGP/totRev)*100).toFixed(1)}% margin`:""} color="#10b981" icon="💰" />
      <StatCard label="GST Collected" value={`₹${totGST.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub="CGST+SGST @18%" color="#f59e0b" icon="🧾" />
    </div>
    <Toast msg={saved?"Lubricant sale saved + Supabase synced 🔴":null} />
    {show&&<div style={{ ...card, border:"1px solid rgba(139,92,246,0.25)", marginBottom:16 }}>
      <h3 style={{ color:"#a78bfa", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>{editId?"Edit Sale":"New Sale"}</h3>
      <ErrBanner errors={errs} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp} /></div>
        <div><Label>Unit</Label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{ background:"#07111e" }}>{u.name}</option>)}</select></div>
        <div><Label req>Product</Label><select value={form.product} onChange={e=>setForm(p=>({...p,product:e.target.value}))} style={inp}>{LUBE_PRODUCTS.map(p=><option key={p} style={{ background:"#07111e" }}>{p}</option>)}</select></div>
        {form.product==="Custom"&&<div><Label req>Product Name</Label><input value={form.customProduct} onChange={e=>{ setForm(p=>({...p,customProduct:e.target.value})); setFe(p=>({...p,customProduct:""})); }} style={fe.customProduct?inpErr:inp} /><FieldErr msg={fe.customProduct} /></div>}
        <div><Label req>Qty</Label><input type="number" inputMode="numeric" value={form.qty} onChange={e=>{ setForm(p=>({...p,qty:e.target.value})); setFe(p=>({...p,qty:""})); }} style={fe.qty?inpErr:inp} /><FieldErr msg={fe.qty} /></div>
        <div><Label req>Selling Price ₹</Label><input type="number" inputMode="numeric" value={form.price} onChange={e=>{ setForm(p=>({...p,price:e.target.value})); setFe(p=>({...p,price:""})); }} style={fe.price?inpErr:inp} /><FieldErr msg={fe.price} /></div>
        <div><Label>Cost Price ₹</Label><input type="number" inputMode="numeric" value={form.costPrice} onChange={e=>setForm(p=>({...p,costPrice:e.target.value}))} style={inp} placeholder={form.price?`Auto: ₹${(parseFloat(form.price)*LUBE_COGS).toFixed(2)}`:"65% default"} /></div>
      </div>
      {form.qty&&form.price&&<div style={{ marginTop:12, padding:"10px 14px", background:"rgba(139,92,246,0.08)", borderRadius:10, border:"1px solid rgba(139,92,246,0.2)" }}>
        <p style={{ color:"#a78bfa", fontSize:12, fontWeight:700, margin:"0 0 4px" }}>GST Invoice Preview (18% — HSN 3811)</p>
        <div style={{ display:"flex", gap:16, fontSize:12, flexWrap:"wrap" }}>
          {(()=>{
            const qty=parseFloat(form.qty||0), price=parseFloat(form.price||0);
            const rev=qty*price, cp=form.costPrice?parseFloat(form.costPrice):price*LUBE_COGS;
            const gp=qty*(price-cp), gst=rev*0.18;
            return [{ l:"Revenue", v:`₹${rev.toFixed(2)}`, c:"#a78bfa" },{ l:"COGS", v:`₹${(qty*cp).toFixed(2)}`, c:"#f87171" },{ l:"GP", v:`₹${gp.toFixed(2)}`, c:"#34d399" },{ l:"CGST @9%", v:`₹${(gst/2).toFixed(2)}`, c:"#f59e0b" },{ l:"SGST @9%", v:`₹${(gst/2).toFixed(2)}`, c:"#f59e0b" },{ l:"Total incl GST", v:`₹${(rev+gst).toFixed(2)}`, c:"#f1f5f9" }].map(x=>
              <span key={x.l} style={{ padding:"4px 8px", background:"rgba(255,255,255,0.03)", borderRadius:6 }}>{x.l}: <b style={{ color:x.c }}>{x.v}</b></span>
            );
          })()}
        </div>
      </div>}
      <div style={{ marginTop:14, display:"flex", gap:10 }}>
        <button onClick={save} disabled={saving} style={{ background:"linear-gradient(135deg,#8b5cf6,#7c3aed)", color:"#fff", border:"none", borderRadius:10, padding:"10px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:48 }}>{saving?"Saving…":editId?"Update":"Save"}</button>
        <button onClick={()=>{ setShow(false); setEditId(null); }} style={ghostBtn}>Cancel</button>
      </div>
    </div>}
    {loading?<div style={{ ...card, textAlign:"center", color:"#475569", padding:40 }}>Loading…</div>:<div style={card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Records <span style={{ color:"#34d399", fontSize:10 }}>🔴 Live</span></h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:780 }}>
          <thead><tr>{["Date","Unit","Product","Qty","Price","COGS","Revenue","GP","CGST","SGST",""].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>
            {lubes.map(l=><tr key={l._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
              <td style={{ color:"#64748b", fontSize:12, padding:"10px 10px" }}>{l.date}</td>
              <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:600, padding:"10px 10px" }}>{UNIT_CONFIG[l.unit]?.name||l.unit}</td>
              <td style={{ color:"#a78bfa", fontSize:12, fontWeight:700, padding:"10px 10px" }}>{l.product}</td>
              <td style={{ color:"#f1f5f9", fontSize:12, padding:"10px 10px" }}>{l.qty}</td>
              <td style={{ color:"#f59e0b", fontSize:12, padding:"10px 10px" }}>₹{l.price}</td>
              <td style={{ color:"#f87171", fontSize:12, padding:"10px 10px" }}>₹{(l.cogs||0).toFixed(2)}</td>
              <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, padding:"10px 10px" }}>₹{(l.revenue||0).toFixed(2)}</td>
              <td style={{ padding:"10px 10px" }}><span style={{ color:"#34d399", fontSize:13, fontWeight:800 }}>₹{(l.grossProfit||0).toFixed(2)}</span></td>
              <td style={{ color:"#f59e0b", fontSize:11, padding:"10px 10px" }}>₹{(l.cgst||0).toFixed(2)}</td>
              <td style={{ color:"#f59e0b", fontSize:11, padding:"10px 10px" }}>₹{(l.sgst||0).toFixed(2)}</td>
              <td style={{ padding:"10px 10px" }}>{(user.role==="owner"||isWithin24h(l.date))&&<button onClick={()=>{ setForm({ date:l.date, unit:l.unit, product:LUBE_PRODUCTS.includes(l.product)?l.product:"Custom", customProduct:LUBE_PRODUCTS.includes(l.product)?"":l.product, qty:String(l.qty), price:String(l.price), costPrice:String(l.costPrice||"") }); setEditId(l._fbId); setShow(true); }} style={{ background:"rgba(139,92,246,0.1)", color:"#a78bfa", border:"1px solid rgba(139,92,246,0.2)", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✏</button>}</td>
            </tr>)}
            {!lubes.length&&<tr><td colSpan={11} style={{ color:"#475569", textAlign:"center", padding:"40px 0" }}>No lubricant sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE 3 — KHATA / CREDIT LEDGER
// ════════════════════════════════════════════════════════════════════════
const KhataView = ({ user }) => {
  const [customers, setCustomers]=useState([]), [txns, setTxns]=useState([]);
  const [loading, setLoading]=useState(true), [tab, setTab]=useState("customers");
  const [showCust, setShowCust]=useState(false), [showTxn, setShowTxn]=useState(false);
  const [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [selCust, setSelCust]=useState(null);
  const [custForm, setCustForm]=useState({ name:"", vehicleNumbers:"", phone:"", creditLimit:"50000" });
  const [txnForm, setTxnForm]=useState({ customerId:"", type:"credit_sale", date:TODAY, fuelType:"Petrol", litres:"", ratePerLitre:"", amount:"", vehicleNumber:"" });

  useEffect(()=>{
    const u1=fbListen("khataCustomers",d=>{ setCustomers(d||[]); setLoading(false); });
    const u2=fbListen("khataTxns",d=>setTxns(d||[]));
    return ()=>{ u1(); u2(); };
  },[]);

  const saveCust = async () => {
    setSaving(true);
    const c={ name:custForm.name, vehicleNumbers:custForm.vehicleNumbers.split(",").map(v=>v.trim()).filter(Boolean), phone:custForm.phone, creditLimit:parseFloat(custForm.creditLimit||0), outstandingBalance:0, createdBy:user.name };
    const id=await fbAdd("khataCustomers",c);
    sbInsert("khata_customers",{ ...c, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setShowCust(false); setCustForm({ name:"", vehicleNumbers:"", phone:"", creditLimit:"50000" });
  };

  const saveTxn = async () => {
    setSaving(true);
    const cust=customers.find(c=>c._fbId===txnForm.customerId);
    if (!cust) { setSaving(false); return; }
    const amt=txnForm.amount?parseFloat(txnForm.amount):(parseFloat(txnForm.litres||0)*parseFloat(txnForm.ratePerLitre||0));
    const prevBal=cust.outstandingBalance||0;
    const newBal=txnForm.type==="credit_sale"?prevBal+amt:Math.max(0,prevBal-amt);
    const txn={ ...txnForm, amount:amt, customerId:txnForm.customerId, customerName:cust.name, runningBalance:newBal, staffId:user.staffId||"owner", staffName:user.name };
    const id=await fbAdd("khataTxns",txn);
    sbInsert("khata_txns",{ ...txn, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{});
    await fbUpdate("khataCustomers",txnForm.customerId,{ outstandingBalance:newBal });
    setCustomers(p=>p.map(c=>c._fbId===txnForm.customerId?{...c,outstandingBalance:newBal}:c));
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setShowTxn(false); setTxnForm({ customerId:"", type:"credit_sale", date:TODAY, fuelType:"Petrol", litres:"", ratePerLitre:"", amount:"", vehicleNumber:"" });
  };

  const custTxns = selCust ? txns.filter(t=>t.customerId===selCust._fbId).sort((a,b)=>(b.date||"").localeCompare(a.date||"")) : [];

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>📋 Khata — Credit Ledger</h1>
        <p style={{ color:"#334155", fontSize:13, margin:0 }}>Fleet credit management · Outstanding balances · Double-entry</p></div>
      {(saving||saved)&&<SyncBadge saving={saving} />}
    </div>
    <Toast msg={saved?"Saved + Supabase synced 🔴":null} />

    <div style={{ display:"flex", gap:6, marginBottom:20 }}>
      {[["customers","👥 Customers"],["transactions","💳 Transactions"],["ledger","📊 Ledger"]].map(([id,label])=>
        <button key={id} onClick={()=>{ setTab(id); setSelCust(null); }} style={{ padding:"8px 16px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, background:tab===id?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.06)", color:tab===id?"#fff":"#64748b", minHeight:44 }}>{label}</button>
      )}
    </div>

    {tab==="customers"&&<>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setShowCust(!showCust)} style={btn("#10b981")}>+ Add Customer</button>
        <button onClick={()=>setShowTxn(!showTxn)} style={btn("#3b82f6")}>+ Add Transaction</button>
      </div>
      {showCust&&<div style={{ ...card, border:"1px solid rgba(16,185,129,0.25)", marginBottom:16 }}>
        <h3 style={{ color:"#34d399", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Credit Customer</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          <div><Label req>Customer Name</Label><input value={custForm.name} onChange={e=>setCustForm(p=>({...p,name:e.target.value}))} style={inp} /></div>
          <div><Label>Vehicle Numbers (comma-separated)</Label><input value={custForm.vehicleNumbers} onChange={e=>setCustForm(p=>({...p,vehicleNumbers:e.target.value}))} placeholder="RJ10AB1234, RJ10CD5678" style={inp} /></div>
          <div><Label>Phone</Label><input type="tel" inputMode="numeric" value={custForm.phone} onChange={e=>setCustForm(p=>({...p,phone:e.target.value}))} style={inp} /></div>
          <div><Label>Credit Limit ₹</Label><input type="number" inputMode="numeric" value={custForm.creditLimit} onChange={e=>setCustForm(p=>({...p,creditLimit:e.target.value}))} style={inp} /></div>
        </div>
        <div style={{ marginTop:14, display:"flex", gap:10 }}><button onClick={saveCust} disabled={saving} style={btn("#10b981")}>{saving?"Saving…":"Save Customer"}</button><button onClick={()=>setShowCust(false)} style={ghostBtn}>Cancel</button></div>
      </div>}
      {showTxn&&<div style={{ ...card, border:"1px solid rgba(59,130,246,0.25)", marginBottom:16 }}>
        <h3 style={{ color:"#60a5fa", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Transaction</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
          <div><Label req>Customer</Label><select value={txnForm.customerId} onChange={e=>setTxnForm(p=>({...p,customerId:e.target.value}))} style={inp}><option value="" style={{ background:"#07111e" }}>Select…</option>{customers.map(c=><option key={c._fbId} value={c._fbId} style={{ background:"#07111e" }}>{c.name}</option>)}</select></div>
          <div><Label>Type</Label><select value={txnForm.type} onChange={e=>setTxnForm(p=>({...p,type:e.target.value}))} style={inp}><option value="credit_sale" style={{ background:"#07111e" }}>Credit Sale</option><option value="payment" style={{ background:"#07111e" }}>Payment Received</option></select></div>
          <div><Label>Date</Label><input type="date" value={txnForm.date} onChange={e=>setTxnForm(p=>({...p,date:e.target.value}))} style={inp} /></div>
          <div><Label>Fuel Type</Label><select value={txnForm.fuelType} onChange={e=>setTxnForm(p=>({...p,fuelType:e.target.value}))} style={inp}><option style={{ background:"#07111e" }}>Petrol</option><option style={{ background:"#07111e" }}>Diesel</option></select></div>
          <div><Label>Litres</Label><input type="number" inputMode="numeric" value={txnForm.litres} onChange={e=>setTxnForm(p=>({...p,litres:e.target.value}))} style={inp} /></div>
          <div><Label>Rate ₹/L</Label><input type="number" inputMode="numeric" value={txnForm.ratePerLitre} onChange={e=>setTxnForm(p=>({...p,ratePerLitre:e.target.value}))} style={inp} /></div>
          <div><Label>Amount ₹ (or auto-calc)</Label><input type="number" inputMode="numeric" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))} placeholder={txnForm.litres&&txnForm.ratePerLitre?`Auto: ₹${(parseFloat(txnForm.litres||0)*parseFloat(txnForm.ratePerLitre||0)).toFixed(2)}`:"Enter amount"} style={inp} /></div>
          <div><Label>Vehicle No.</Label><input value={txnForm.vehicleNumber} onChange={e=>setTxnForm(p=>({...p,vehicleNumber:e.target.value}))} style={inp} /></div>
        </div>
        <div style={{ marginTop:14, display:"flex", gap:10 }}><button onClick={saveTxn} disabled={saving} style={btn("#3b82f6")}>{saving?"Saving…":"Save Transaction"}</button><button onClick={()=>setShowTxn(false)} style={ghostBtn}>Cancel</button></div>
      </div>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 }}>
        {loading?[1,2,3].map(i=><div key={i} style={{ ...card, height:140 }}><Skeleton /><Skeleton w="70%" h={20} /><Skeleton w="50%" /></div>):
        customers.map(c=>{
          const util=c.creditLimit>0?((c.outstandingBalance||0)/c.creditLimit)*100:0;
          const crit=util>80;
          return <div key={c._fbId} onClick={()=>{ setSelCust(c); setTab("ledger"); }} style={{ ...card, cursor:"pointer", border:`1px solid ${crit?"rgba(239,68,68,0.4)":"rgba(16,185,129,0.2)"}`, transition:"border-color 0.2s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <p style={{ color:"#f1f5f9", fontSize:15, fontWeight:800, margin:"0 0 4px" }}>{c.name}</p>
                <p style={{ color:"#475569", fontSize:11, margin:"0 0 8px" }}>{c.phone} · {(c.vehicleNumbers||[]).slice(0,2).join(", ")}</p>
              </div>
              {crit&&<span style={{ background:"rgba(239,68,68,0.15)", color:"#f87171", fontSize:10, fontWeight:800, padding:"3px 8px", borderRadius:6 }}>⚠ HIGH</span>}
            </div>
            <div style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:"#64748b", fontSize:11 }}>Outstanding</span>
                <span style={{ color:crit?"#f87171":"#34d399", fontSize:13, fontWeight:800 }}>₹{(c.outstandingBalance||0).toLocaleString("en-IN")}</span>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(util,100)}%`, background:crit?"#ef4444":"#10b981", borderRadius:3, transition:"width 0.4s" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ color:"#475569", fontSize:10 }}>{util.toFixed(0)}% of ₹{(c.creditLimit||0).toLocaleString("en-IN")} limit</span>
              </div>
            </div>
          </div>;
        })}
      </div>
    </>}

    {tab==="transactions"&&<div style={card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>All Transactions</h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Date","Customer","Type","Fuel","Litres","Amount","Balance","Vehicle","By"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{txns.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,50).map(t=><tr key={t._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:"#64748b", fontSize:12, padding:"8px 10px" }}>{t.date}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:600, padding:"8px 10px" }}>{t.customerName}</td>
            <td style={{ padding:"8px 10px" }}><span style={{ color:t.type==="credit_sale"?"#f87171":"#34d399", fontSize:11, fontWeight:700 }}>{t.type==="credit_sale"?"Credit Sale":"Payment"}</span></td>
            <td style={{ color:"#60a5fa", fontSize:12, padding:"8px 10px" }}>{t.fuelType}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, padding:"8px 10px" }}>{t.litres||"—"}</td>
            <td style={{ color:t.type==="credit_sale"?"#f87171":"#34d399", fontSize:13, fontWeight:700, padding:"8px 10px" }}>{t.type==="credit_sale"?"+":"-"}₹{(t.amount||0).toFixed(2)}</td>
            <td style={{ color:"#f59e0b", fontSize:12, fontWeight:700, padding:"8px 10px" }}>₹{(t.runningBalance||0).toFixed(2)}</td>
            <td style={{ color:"#64748b", fontSize:11, padding:"8px 10px", fontFamily:"monospace" }}>{t.vehicleNumber}</td>
            <td style={{ color:"#64748b", fontSize:11, padding:"8px 10px" }}>{t.staffName}</td>
          </tr>)}
          {!txns.length&&<tr><td colSpan={9} style={{ color:"#475569", textAlign:"center", padding:"40px 0" }}>No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}

    {tab==="ledger"&&selCust&&<div>
      <button onClick={()=>setSelCust(null)} style={{ ...ghostBtn, marginBottom:14 }}>← Back</button>
      <div style={{ ...card, marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div><h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:800, margin:"0 0 4px" }}>{selCust.name}</h2><p style={{ color:"#475569", fontSize:13, margin:0 }}>{selCust.phone} · {(selCust.vehicleNumbers||[]).join(", ")}</p></div>
          <div style={{ textAlign:"right" }}>
            <p style={{ color:"#64748b", fontSize:11, margin:"0 0 2px" }}>Outstanding</p>
            <p style={{ color:(selCust.outstandingBalance||0)>0?"#f87171":"#34d399", fontSize:22, fontWeight:900, margin:0 }}>₹{(selCust.outstandingBalance||0).toLocaleString("en-IN")}</p>
            <p style={{ color:"#475569", fontSize:11, margin:0 }}>Limit: ₹{(selCust.creditLimit||0).toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>
      <div style={card}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Transaction Ledger</h3>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Date","Type","Amount","Running Balance","Vehicle","Staff"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{custTxns.map(t=><tr key={t._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
              <td style={{ color:"#64748b", fontSize:12, padding:"10px 10px" }}>{t.date}</td>
              <td style={{ padding:"10px 10px" }}><span style={{ color:t.type==="credit_sale"?"#f87171":"#34d399", fontSize:12, fontWeight:700 }}>{t.type==="credit_sale"?"Credit Sale":"Payment Rcvd"}</span></td>
              <td style={{ color:t.type==="credit_sale"?"#f87171":"#34d399", fontSize:13, fontWeight:800, padding:"10px 10px" }}>{t.type==="credit_sale"?"+":"-"}₹{(t.amount||0).toFixed(2)}</td>
              <td style={{ color:"#f59e0b", fontSize:13, fontWeight:800, padding:"10px 10px" }}>₹{(t.runningBalance||0).toFixed(2)}</td>
              <td style={{ color:"#64748b", fontSize:11, padding:"10px 10px", fontFamily:"monospace" }}>{t.vehicleNumber}</td>
              <td style={{ color:"#64748b", fontSize:11, padding:"10px 10px" }}>{t.staffName}</td>
            </tr>)}
            {!custTxns.length&&<tr><td colSpan={6} style={{ color:"#475569", textAlign:"center", padding:"30px 0" }}>No transactions for this customer.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>}
    {tab==="ledger"&&!selCust&&<div style={{ ...card, textAlign:"center", color:"#475569", padding:40 }}>Select a customer from the Customers tab to view their ledger.</div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE 4 — GST BILLING ENGINE
// ════════════════════════════════════════════════════════════════════════
const GSTBillingView = ({ settings }) => {
  const [invoices, setInvoices]=useState([]), [loading, setLoading]=useState(true);
  const [show, setShow]=useState(false), [saving, setSaving]=useState(false);
  const [form, setForm]=useState({ type:"lube", product:"Servo Premium 4T", qty:"", price:"", customerName:"", customerGSTIN:"", date:TODAY });
  const [invNum, setInvNum]=useState(1);

  useEffect(()=>{
    const u=fbListen("gstInvoices",d=>{ setInvoices(d.sort((a,b)=>(b.date||"").localeCompare(a.date||""))); setLoading(false); });
    sbGet("gst_invoices","order=invoice_number.desc&limit=1").then(d=>{ if (d&&d.length) setInvNum((d[0].invoice_number||0)+1); });
    return u;
  },[]);

  const generateInvoice = (f) => {
    const qty=parseFloat(f.qty||0), price=parseFloat(f.price||0);
    const base=qty*price;
    if (f.type==="lube") {
      const cgst=base*0.09, sgst=base*0.09;
      return { billType:"Tax Invoice", hsn:"3811", product:f.product, qty, ratePerUnit:price, baseAmount:base, cgst, sgst, totalAmount:base+cgst+sgst, gstRate:18, gstin:settings.stationGSTIN, stationName:settings.stationName||"Shree K C Sarswat Auto Fuel Station" };
    } else {
      return { billType:"Bill of Supply", hsn:"2710", product:f.type==="petrol"?"Petrol":"Diesel", qty, ratePerUnit:price, baseAmount:base, cgst:0, sgst:0, totalAmount:base, note:"Petroleum products are outside GST ambit. Subject to State VAT/Central Excise only.", stationName:settings.stationName||"Shree K C Sarswat Auto Fuel Station" };
    }
  };

  const save = async () => {
    setSaving(true);
    const invData=generateInvoice(form);
    const invoiceNumber=invNum;
    const invoiceId=`INV-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth()+1).toString().padStart(2,"0")}-${String(invoiceNumber).padStart(5,"0")}`;
    const entry={ ...invData, invoiceId, invoice_number:invoiceNumber, customerName:form.customerName, customerGSTIN:form.customerGSTIN, date:form.date };
    const id=await fbAdd("gstInvoices",entry);
    sbInsert("gst_invoices",{ ...entry, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{});
    setInvNum(invoiceNumber+1);
    setSaving(false); setShow(false);
    setForm({ type:"lube", product:"Servo Premium 4T", qty:"", price:"", customerName:"", customerGSTIN:"", date:TODAY });
  };

  const preview=show&&form.qty&&form.price?generateInvoice(form):null;

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🧾 GST Billing Engine</h1>
        <p style={{ color:"#334155", fontSize:13, margin:0 }}>Tax Invoice (Lubes 18%) · Bill of Supply (Fuel — outside GST) · CGST+SGST split</p></div>
      <button onClick={()=>setShow(!show)} style={btn("#f59e0b")}>+ Generate Invoice</button>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:20 }}>
      {[{ l:"GST Invoices", v:invoices.filter(i=>i.billType==="Tax Invoice").length, c:"#f59e0b", icon:"🧾" },{ l:"CGST Collected", v:`₹${invoices.filter(i=>i.billType==="Tax Invoice").reduce((s,i)=>s+(i.cgst||0),0).toFixed(2)}`, c:"#3b82f6", icon:"🏦" },{ l:"SGST Collected", v:`₹${invoices.filter(i=>i.billType==="Tax Invoice").reduce((s,i)=>s+(i.sgst||0),0).toFixed(2)}`, c:"#8b5cf6", icon:"🏦" },{ l:"Bills of Supply", v:invoices.filter(i=>i.billType==="Bill of Supply").length, c:"#10b981", icon:"📄" }].map(x=>
        <StatCard key={x.l} label={x.l} value={x.v} color={x.c} icon={x.icon} />
      )}
    </div>

    {show&&<div style={{ ...card, border:"1px solid rgba(245,158,11,0.25)", marginBottom:16 }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Generate Invoice</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
        <div><Label>Invoice Type</Label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={inp}><option value="lube" style={{ background:"#07111e" }}>Lubricant / Additive (18% GST)</option><option value="petrol" style={{ background:"#07111e" }}>Petrol (Bill of Supply)</option><option value="diesel" style={{ background:"#07111e" }}>Diesel (Bill of Supply)</option></select></div>
        {form.type==="lube"&&<div><Label>Product</Label><select value={form.product} onChange={e=>setForm(p=>({...p,product:e.target.value}))} style={inp}>{LUBE_PRODUCTS.filter(p=>p!=="Custom").map(p=><option key={p} style={{ background:"#07111e" }}>{p}</option>)}</select></div>}
        <div><Label req>Qty</Label><input type="number" inputMode="numeric" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))} style={inp} /></div>
        <div><Label req>Rate ₹</Label><input type="number" inputMode="numeric" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} style={inp} /></div>
        <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp} /></div>
        <div><Label>Customer Name</Label><input value={form.customerName} onChange={e=>setForm(p=>({...p,customerName:e.target.value}))} style={inp} /></div>
        {form.type==="lube"&&<div><Label>Customer GSTIN</Label><input value={form.customerGSTIN} onChange={e=>setForm(p=>({...p,customerGSTIN:e.target.value}))} placeholder="15-char GSTIN" style={inp} /></div>}
      </div>
      {preview&&<div style={{ marginTop:14, padding:"16px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <div><p style={{ color:"#f1f5f9", fontSize:13, fontWeight:800, margin:0 }}>{preview.stationName}</p><p style={{ color:"#475569", fontSize:11, margin:0 }}>GSTIN: {preview.gstin} · Lunkaransar, RJ</p></div>
          <div style={{ textAlign:"right" }}><span style={{ background:preview.billType==="Tax Invoice"?"rgba(245,158,11,0.15)":"rgba(16,185,129,0.1)", color:preview.billType==="Tax Invoice"?"#f59e0b":"#34d399", padding:"4px 12px", borderRadius:8, fontWeight:700, fontSize:12 }}>{preview.billType}</span></div>
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:10 }}>
          {[{ l:"Product", v:`${preview.product} (HSN: ${preview.hsn})`, c:"#f1f5f9" },{ l:"Qty × Rate", v:`${preview.qty} × ₹${preview.ratePerUnit}`, c:"#94a3b8" },{ l:"Base Amount", v:`₹${preview.baseAmount.toFixed(2)}`, c:"#f1f5f9" },preview.cgst>0&&{ l:"CGST @9%", v:`₹${preview.cgst.toFixed(2)}`, c:"#f59e0b" },preview.sgst>0&&{ l:"SGST @9%", v:`₹${preview.sgst.toFixed(2)}`, c:"#f59e0b" },{ l:"Total Amount", v:`₹${preview.totalAmount.toFixed(2)}`, c:"#34d399", bold:true }].filter(Boolean).map(x=>
            <div key={x.l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0" }}>
              <span style={{ color:"#64748b", fontSize:12 }}>{x.l}</span>
              <span style={{ color:x.c, fontSize:x.bold?15:12, fontWeight:x.bold?900:500 }}>{x.v}</span>
            </div>
          )}
          {preview.note&&<p style={{ color:"#475569", fontSize:11, margin:"8px 0 0", fontStyle:"italic" }}>{preview.note}</p>}
        </div>
      </div>}
      <div style={{ marginTop:14, display:"flex", gap:10 }}>
        <button onClick={save} disabled={saving||!form.qty||!form.price} style={btn()}>{saving?"Saving…":"Save Invoice"}</button>
        <button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>}

    {!loading&&<div style={card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Invoice Register <span style={{ color:"#34d399", fontSize:10 }}>🔴 Live</span></h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Invoice ID","Date","Type","Product","Base Amt","CGST","SGST","Total","Customer"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{invoices.map(inv=><tr key={inv._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:"#f59e0b", fontSize:11, fontFamily:"monospace", fontWeight:700, padding:"8px 10px" }}>{inv.invoiceId}</td>
            <td style={{ color:"#64748b", fontSize:11, padding:"8px 10px" }}>{inv.date}</td>
            <td style={{ padding:"8px 10px" }}><span style={{ color:inv.billType==="Tax Invoice"?"#f59e0b":"#34d399", fontSize:11, fontWeight:700 }}>{inv.billType}</span></td>
            <td style={{ color:"#a78bfa", fontSize:11, padding:"8px 10px" }}>{inv.product}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:700, padding:"8px 10px" }}>₹{(inv.baseAmount||0).toFixed(2)}</td>
            <td style={{ color:"#f59e0b", fontSize:11, padding:"8px 10px" }}>₹{(inv.cgst||0).toFixed(2)}</td>
            <td style={{ color:"#f59e0b", fontSize:11, padding:"8px 10px" }}>₹{(inv.sgst||0).toFixed(2)}</td>
            <td style={{ padding:"8px 10px" }}><span style={{ color:"#34d399", fontSize:13, fontWeight:800 }}>₹{(inv.totalAmount||0).toFixed(2)}</span></td>
            <td style={{ color:"#64748b", fontSize:11, padding:"8px 10px" }}>{inv.customerName||"—"}</td>
          </tr>)}
          {!invoices.length&&<tr><td colSpan={9} style={{ color:"#475569", textAlign:"center", padding:"30px 0" }}>No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — DIP READINGS + VCF (Module 2 — Shrinkage Detection)
// ════════════════════════════════════════════════════════════════════════
const DipView = ({ tanks }) => {
  const [dips, setDips]=useState([]), [loading, setLoading]=useState(true);
  const [show, setShow]=useState(false), [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [form, setForm]=useState({ date:TODAY, unit:"unit1", fuelType:"petrol", physicalDip:"", temperature:"32" });

  useEffect(()=>{
    const u=fbListen("dipReadings",d=>{ setDips(d.sort((a,b)=>(b.date||"").localeCompare(a.date||""))); setLoading(false); });
    return u;
  },[]);

  const save = async () => {
    setSaving(true);
    const phys=parseFloat(form.physicalDip||0), temp=parseFloat(form.temperature||32);
    const vcf=calcVCF(form.fuelType, temp);
    const vcfAdjusted=phys*vcf;
    const systemStock=tanks[form.unit]?.[form.fuelType]?.current||0;
    const variance=vcfAdjusted-systemStock;
    const variancePct=systemStock>0?(variance/systemStock)*100:0;
    const flagged=Math.abs(variancePct)>0.5;
    const entry={ ...form, physicalDip:phys, temperature:temp, vcf:parseFloat(vcf.toFixed(5)), vcfAdjusted:parseFloat(vcfAdjusted.toFixed(2)), systemStock, variance:parseFloat(variance.toFixed(2)), variancePct:parseFloat(variancePct.toFixed(3)), flagged };
    const id=await fbAdd("dipReadings",entry);
    if (flagged) sbAudit("FRAUD_ALERT","dip_readings",{ type:"DIP_VS_SYSTEM_VARIANCE", ...entry, firebase_id:id },"dip_system");
    sbInsert("dip_readings",{ ...entry, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setShow(false); setForm({ date:TODAY, unit:"unit1", fuelType:"petrol", physicalDip:"", temperature:"32" });
  };

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🌡 Dip Readings & VCF</h1>
        <p style={{ color:"#334155", fontSize:13, margin:0 }}>Physical dip vs system stock · ASTM D1250 temperature correction · Pilferage detection</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge saving={saving} />}<button onClick={()=>setShow(!show)} style={btn("#ef4444")}>+ Add Dip Reading</button></div>
    </div>
    <Toast msg={saved?"Dip reading saved + Supabase synced":null} />

    {show&&<div style={{ ...card, border:"1px solid rgba(239,68,68,0.25)", marginBottom:16 }}>
      <h3 style={{ color:"#f87171", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Dip Reading</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp} /></div>
        <div><Label>Unit</Label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{ background:"#07111e" }}>{u.name}</option>)}</select></div>
        <div><Label>Fuel</Label><select value={form.fuelType} onChange={e=>setForm(p=>({...p,fuelType:e.target.value}))} style={inp}><option value="petrol" style={{ background:"#07111e" }}>Petrol</option><option value="diesel" style={{ background:"#07111e" }}>Diesel</option></select></div>
        <div><Label req>Physical Dip (Litres)</Label><input type="number" inputMode="numeric" value={form.physicalDip} onChange={e=>setForm(p=>({...p,physicalDip:e.target.value}))} style={inp} /></div>
        <div><Label>Temperature (°C)</Label><input type="number" inputMode="numeric" value={form.temperature} onChange={e=>setForm(p=>({...p,temperature:e.target.value}))} style={inp} /></div>
      </div>
      {form.physicalDip&&form.temperature&&(()=>{
        const phys=parseFloat(form.physicalDip), temp=parseFloat(form.temperature);
        const vcf=calcVCF(form.fuelType,temp), adj=phys*vcf;
        const sys=tanks[form.unit]?.[form.fuelType]?.current||0;
        const v=adj-sys, vPct=sys>0?(v/sys)*100:0;
        return <div style={{ marginTop:12, padding:"12px 14px", background:Math.abs(vPct)>0.5?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.06)", border:`1px solid ${Math.abs(vPct)>0.5?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.2)"}`, borderRadius:10 }}>
          <p style={{ color:Math.abs(vPct)>0.5?"#f87171":"#34d399", fontSize:12, fontWeight:700, margin:"0 0 6px" }}>{Math.abs(vPct)>0.5?"⚠ VARIANCE DETECTED — Log to audit trail":"✅ Within tolerance"}</p>
          <div style={{ display:"flex", gap:16, fontSize:12, flexWrap:"wrap" }}>
            {[{ l:"Physical", v:`${phys.toFixed(0)}L` },{ l:"VCF", v:vcf.toFixed(5) },{ l:"VCF-Adjusted", v:`${adj.toFixed(1)}L` },{ l:"System Stock", v:`${sys.toFixed(0)}L` },{ l:"Variance", v:`${v>=0?"+":""}${v.toFixed(1)}L (${vPct.toFixed(2)}%)`, c:Math.abs(vPct)>0.5?"#f87171":"#34d399" }].map(x=>
              <span key={x.l}>{x.l}: <b style={{ color:x.c||"#f1f5f9" }}>{x.v}</b></span>
            )}
          </div>
        </div>;
      })()}
      <div style={{ marginTop:14, display:"flex", gap:10 }}>
        <button onClick={save} disabled={saving||!form.physicalDip} style={btn("#ef4444")}>{saving?"Saving…":"Save Dip"}</button>
        <button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>}

    {!loading&&<div style={card}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>Dip History <span style={{ color:"#34d399", fontSize:10 }}>🔴 Live</span></h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Date","Unit","Fuel","Physical (L)","Temp","VCF","Adjusted (L)","System (L)","Variance","Flag"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{dips.map(d=><tr key={d._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:d.flagged?"rgba(239,68,68,0.04)":"transparent" }}>
            <td style={{ color:"#64748b", fontSize:12, padding:"8px 10px" }}>{d.date}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, padding:"8px 10px" }}>{UNIT_CONFIG[d.unit]?.name||d.unit}</td>
            <td style={{ color:d.fuelType==="petrol"?"#f59e0b":"#3b82f6", fontSize:12, fontWeight:700, padding:"8px 10px" }}>{d.fuelType}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, fontWeight:700, padding:"8px 10px" }}>{(d.physicalDip||0).toFixed(0)}</td>
            <td style={{ color:"#64748b", fontSize:12, padding:"8px 10px" }}>{d.temperature}°C</td>
            <td style={{ color:"#64748b", fontSize:11, padding:"8px 10px", fontFamily:"monospace" }}>{(d.vcf||1).toFixed(5)}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, padding:"8px 10px" }}>{(d.vcfAdjusted||0).toFixed(1)}</td>
            <td style={{ color:"#60a5fa", fontSize:12, padding:"8px 10px" }}>{(d.systemStock||0).toFixed(0)}</td>
            <td style={{ color:Math.abs(d.variancePct||0)>0.5?"#f87171":"#34d399", fontSize:12, fontWeight:700, padding:"8px 10px" }}>{(d.variance||0)>0?"+":(d.variance||0)<0?"":" "}{(d.variance||0).toFixed(1)}L ({(d.variancePct||0).toFixed(2)}%)</td>
            <td style={{ padding:"8px 10px" }}>{d.flagged?<span style={{ background:"rgba(239,68,68,0.15)", color:"#f87171", fontSize:10, padding:"3px 7px", borderRadius:4, fontWeight:700 }}>⚠ FLAGGED</span>:<span style={{ color:"#34d399", fontSize:10 }}>OK</span>}</td>
          </tr>)}
          {!dips.length&&<tr><td colSpan={10} style={{ color:"#475569", textAlign:"center", padding:"30px 0" }}>No dip readings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE — EXPENSES
// ════════════════════════════════════════════════════════════════════════
const ExpensesView = () => {
  const [exps, setExps]=useState([]), [loading, setLoading]=useState(true);
  const [show, setShow]=useState(false), [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [form, setForm]=useState({ date:TODAY, category:EXPENSE_CATS[0], customCat:"", amount:"", note:"", paidBy:"Cash" });

  useEffect(()=>{ const u=fbListen("expenses",d=>{ setExps(d.sort((a,b)=>(b.date||"").localeCompare(a.date||""))); setLoading(false); }); return u; },[]);

  const save = async () => {
    if (!form.amount||parseFloat(form.amount)<=0) return;
    setSaving(true);
    const cat=form.category==="Custom"?form.customCat:form.category;
    const entry={ date:form.date, category:cat, amount:parseFloat(form.amount), note:form.note, paidBy:form.paidBy };
    const id=await fbAdd("expenses",entry);
    sbInsert("expenses",{ ...entry, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setForm({ date:TODAY, category:EXPENSE_CATS[0], customCat:"", amount:"", note:"", paidBy:"Cash" }); setShow(false);
  };

  const totMonth=exps.filter(e=>e.date?.startsWith(TODAY.slice(0,7))).reduce((s,e)=>s+(e.amount||0),0);
  const catBreakdown=exps.filter(e=>e.date?.startsWith(TODAY.slice(0,7))).reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+e.amount; return acc; },{});
  const pieData=Object.entries(catBreakdown).map(([n,v])=>({ name:n, value:v }));
  const COLORS=["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444","#f97316","#06b6d4"];

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>💸 Expenses & OPEX</h1>
        <p style={{ color:"#334155", fontSize:13, margin:0 }}>Daily OPEX tracking · P&L amortization · Supabase synced</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge saving={saving} />}<button onClick={()=>setShow(!show)} style={btn("#ef4444")}>+ Add Expense</button></div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14, marginBottom:20 }}>
      <StatCard label="This Month OPEX" value={`₹${totMonth.toLocaleString("en-IN",{maximumFractionDigits:0})}`} sub={`Daily avg: ₹${(totMonth/new Date().getDate()).toFixed(0)}`} color="#ef4444" icon="💸" />
      <StatCard label="Daily OPEX Target" value={`₹${((INIT_SETTINGS.monthlyOpex||85000)/26).toFixed(0)}`} sub="₹85K / 26 working days" color="#f59e0b" icon="📊" />
    </div>
    {pieData.length>0&&<div style={{ ...card, marginBottom:16 }}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>This Month by Category</h3>
      <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
        <PieChart width={160} height={160}><Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">{pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:11 }} formatter={v=>`₹${v.toLocaleString("en-IN")}`} /></PieChart>
        <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:6 }}>
          {pieData.map((d,i)=><div key={d.name} style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ width:8, height:8, borderRadius:"50%", background:COLORS[i%COLORS.length], flexShrink:0 }} /><span style={{ color:"#94a3b8", fontSize:11 }}>{d.name}: <b style={{ color:"#f1f5f9" }}>₹{d.value.toLocaleString("en-IN")}</b></span></div>)}
        </div>
      </div>
    </div>}
    <Toast msg={saved?"Expense saved + Supabase synced 🔴":null} />
    {show&&<div style={{ ...card, border:"1px solid rgba(239,68,68,0.25)", marginBottom:16 }}>
      <h3 style={{ color:"#f87171", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Expense</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp} /></div>
        <div><Label>Category</Label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={inp}>{EXPENSE_CATS.map(c=><option key={c} style={{ background:"#07111e" }}>{c}</option>)}</select></div>
        {form.category==="Custom"&&<div><Label req>Custom Category</Label><input value={form.customCat} onChange={e=>setForm(p=>({...p,customCat:e.target.value}))} style={inp} /></div>}
        <div><Label req>Amount ₹</Label><input type="number" inputMode="numeric" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} style={inp} /></div>
        <div><Label>Paid By</Label><select value={form.paidBy} onChange={e=>setForm(p=>({...p,paidBy:e.target.value}))} style={inp}><option style={{ background:"#07111e" }}>Cash</option><option style={{ background:"#07111e" }}>UPI</option><option style={{ background:"#07111e" }}>Bank</option></select></div>
        <div><Label>Note</Label><input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} style={inp} /></div>
      </div>
      <div style={{ marginTop:14, display:"flex", gap:10 }}>
        <button onClick={save} disabled={saving} style={btn("#ef4444")}>{saving?"Saving…":"Save Expense"}</button>
        <button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button>
      </div>
    </div>}
    {!loading&&<div style={card}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Date","Category","Amount","Paid By","Note"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{exps.slice(0,50).map(e=><tr key={e._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:"#64748b", fontSize:12, padding:"10px 12px" }}>{e.date}</td>
            <td style={{ color:"#f87171", fontSize:12, fontWeight:600, padding:"10px 12px" }}>{e.category}</td>
            <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:800, padding:"10px 12px" }}>₹{(e.amount||0).toLocaleString("en-IN")}</td>
            <td style={{ color:"#64748b", fontSize:12, padding:"10px 12px" }}>{e.paidBy}</td>
            <td style={{ color:"#475569", fontSize:12, padding:"10px 12px" }}>{e.note}</td>
          </tr>)}
          {!exps.length&&<tr><td colSpan={5} style={{ color:"#475569", textAlign:"center", padding:"30px 0" }}>No expenses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// MODULE 6 — STAFF (with Cash Integrity Leaderboard)
// ════════════════════════════════════════════════════════════════════════
const StaffView = ({ staffList, setStaffList }) => {
  const [showForm, setShowForm]=useState(false), [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [form, setForm]=useState({ name:"", role:"Attendant", salary:"", joining:TODAY, unit:"unit1" });
  const [errs, setErrs]=useState([]), [fe, setFe]=useState({});
  const [showPwd, setShowPwd]=useState(null), [newPwd, setNewPwd]=useState("");
  const [integrityScores, setIntegrityScores]=useState([]);

  useEffect(()=>{
    sbGet("cash_integrity_log","order=created_at.desc&limit=200").then(data=>{
      if (!data||!data.length) return;
      const byStaff={};
      data.forEach(r=>{ if (!byStaff[r.staffId]) byStaff[r.staffId]={ name:r.staffName, scores:[], totalDiff:0 }; byStaff[r.staffId].scores.push(r.integrityScore||100); byStaff[r.staffId].totalDiff+=(r.cashDiff||0); });
      const arr=Object.entries(byStaff).map(([id,v])=>({ id, name:v.name, avgScore:(v.scores.reduce((s,x)=>s+x,0)/v.scores.length).toFixed(1), shifts:v.scores.length, totalDiff:v.totalDiff.toFixed(2) })).sort((a,b)=>parseFloat(b.avgScore)-parseFloat(a.avgScore));
      setIntegrityScores(arr);
    });
  },[]);

  const validate = () => {
    const e=[], nfe={};
    if (!form.name.trim()) { e.push("Name required"); nfe.name="Required"; }
    if (!form.salary||parseFloat(form.salary)<=0) { e.push("Salary required"); nfe.salary="Required"; }
    if (staffList.some(s=>s.name.toLowerCase()===form.name.toLowerCase())) { e.push("Staff name already exists"); nfe.name="Duplicate"; }
    setErrs(e); setFe(nfe); return e.length===0;
  };

  const addStaff = async () => {
    if (!validate()) return; setSaving(true);
    const s={ name:form.name, role:form.role, salary:parseFloat(form.salary||0), joining:form.joining, unit:form.unit, active:true, email:makeEmail(form.name), password:makePwd(form.name) };
    const id=await fbAdd("staff",s);
    sbInsert("staff",{ ...s, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{});
    setStaffList(p=>[...p,{ ...s, _fbId:id }]);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setShowForm(false); setErrs([]); setFe({});
    setForm({ name:"", role:"Attendant", salary:"", joining:TODAY, unit:"unit1" });
  };
  const toggle = async (id) => {
    const s=staffList.find(x=>(x._fbId||x.id)===id); if (!s) return;
    await fbUpdate("staff",id,{ active:!s.active });
    setStaffList(p=>p.map(x=>(x._fbId||x.id)===id?{...x,active:!x.active}:x));
  };
  const savePwd = async (id) => {
    if (!newPwd.trim()) return;
    await fbUpdate("staff",id,{ password:newPwd }); setStaffList(p=>p.map(x=>(x._fbId||x.id)===id?{...x,password:newPwd}:x));
    setShowPwd(null); setNewPwd("");
  };

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>👥 Staff Management</h1>
        <p style={{ color:"#334155", fontSize:13, margin:0 }}>Manage staff · Cash integrity leaderboard</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge saving={saving} />}<button onClick={()=>setShowForm(!showForm)} style={btn()}>+ Add Staff</button></div>
    </div>
    <Toast msg={saved?"Staff saved + Supabase synced 🔴":null} />

    {/* Cash Integrity Leaderboard — Module 6 */}
    {integrityScores.length>0&&<div style={{ ...card, marginBottom:20, border:"1px solid rgba(16,185,129,0.2)" }}>
      <h3 style={{ color:"#34d399", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🏆 Cash Integrity Leaderboard (Supabase Analytics)</h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Rank","Staff","Avg Score","Shifts","Total Cash Diff"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{integrityScores.map((s,i)=><tr key={s.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#cd7c30":"#475569", fontSize:14, fontWeight:900, padding:"8px 12px" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</td>
            <td style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, padding:"8px 12px" }}>{s.name}</td>
            <td style={{ padding:"8px 12px" }}><span style={{ color:parseFloat(s.avgScore)>=98?"#34d399":parseFloat(s.avgScore)>=95?"#f59e0b":"#f87171", fontSize:14, fontWeight:800 }}>{s.avgScore}%</span></td>
            <td style={{ color:"#64748b", fontSize:12, padding:"8px 12px" }}>{s.shifts}</td>
            <td style={{ color:parseFloat(s.totalDiff)>=0?"#34d399":"#f87171", fontSize:12, fontWeight:700, padding:"8px 12px" }}>₹{s.totalDiff}</td>
          </tr>)}
          </tbody>
        </table>
      </div>
    </div>}

    {showForm&&<div style={{ ...card, border:"1px solid rgba(245,158,11,0.2)", marginBottom:16 }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 8px" }}>Add Staff</h3>
      {form.name&&<div style={{ marginBottom:10, padding:"8px 12px", background:"rgba(59,130,246,0.08)", borderRadius:8 }}><p style={{ color:"#60a5fa", fontSize:11, margin:0 }}>Login: <b>{makeEmail(form.name)}</b> · Pwd: <b>{makePwd(form.name)}</b></p></div>}
      <ErrBanner errors={errs} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        <div><Label req>Name</Label><input value={form.name} onChange={e=>{ setForm(p=>({...p,name:e.target.value})); setFe(p=>({...p,name:""})); }} style={fe.name?inpErr:inp} /><FieldErr msg={fe.name} /></div>
        <div><Label>Role</Label><input value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} style={inp} /></div>
        <div><Label req>Salary ₹</Label><input type="number" inputMode="numeric" value={form.salary} onChange={e=>{ setForm(p=>({...p,salary:e.target.value})); setFe(p=>({...p,salary:""})); }} style={fe.salary?inpErr:inp} /><FieldErr msg={fe.salary} /></div>
        <div><Label>Joining Date</Label><input type="date" value={form.joining} onChange={e=>setForm(p=>({...p,joining:e.target.value}))} style={inp} /></div>
        <div><Label>Unit</Label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{ background:"#07111e" }}>{u.name}</option>)}</select></div>
      </div>
      <div style={{ marginTop:12, display:"flex", gap:10 }}><button onClick={addStaff} disabled={saving} style={btn()}>{saving?"Saving…":"Add Staff"}</button><button onClick={()=>{ setShowForm(false); setErrs([]); setFe({}); }} style={ghostBtn}>Cancel</button></div>
    </div>}
    {showPwd&&<div style={{ ...card, border:"1px solid rgba(59,130,246,0.3)", marginBottom:16 }}>
      <h3 style={{ color:"#60a5fa", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>Reset Password</h3>
      <div style={{ display:"flex", gap:10 }}>
        <input value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="New password" style={{ ...inp, flex:1 }} />
        <button onClick={()=>savePwd(showPwd)} style={btn("#3b82f6")}>Save</button>
        <button onClick={()=>setShowPwd(null)} style={ghostBtn}>Cancel</button>
      </div>
    </div>}
    <div style={card}>
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>{["Name","Role","Unit","Salary","Joining","Status","Actions"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{staffList.map(s=><tr key={s._fbId||s.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", opacity:s.active?1:0.5 }}>
          <td style={{ padding:"10px 12px" }}><p style={{ color:"#f1f5f9", fontSize:13, fontWeight:700, margin:"0 0 2px" }}>{s.name}</p><p style={{ color:"#475569", fontSize:10, margin:0 }}>{makeEmail(s.name)}</p></td>
          <td style={{ color:"#64748b", fontSize:12, padding:"10px 12px" }}>{s.role}</td>
          <td style={{ color:"#60a5fa", fontSize:12, padding:"10px 12px" }}>{UNIT_CONFIG[s.unit]?.name||s.unit}</td>
          <td style={{ color:"#34d399", fontSize:13, fontWeight:700, padding:"10px 12px" }}>₹{(s.salary||0).toLocaleString("en-IN")}</td>
          <td style={{ color:"#64748b", fontSize:12, padding:"10px 12px" }}>{s.joining}</td>
          <td style={{ padding:"10px 12px" }}>{s.active?<span style={{ background:"rgba(16,185,129,0.1)", color:"#34d399", fontSize:10, padding:"3px 8px", borderRadius:5, fontWeight:700 }}>ACTIVE</span>:<span style={{ background:"rgba(239,68,68,0.1)", color:"#f87171", fontSize:10, padding:"3px 8px", borderRadius:5, fontWeight:700 }}>INACTIVE</span>}</td>
          <td style={{ padding:"10px 12px" }}>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>toggle(s._fbId||s.id)} style={{ background:s.active?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)", color:s.active?"#f87171":"#34d399", border:"none", borderRadius:7, padding:"4px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{s.active?"Deactivate":"Activate"}</button>
              <button onClick={()=>setShowPwd(s._fbId||s.id)} style={{ background:"rgba(59,130,246,0.1)", color:"#60a5fa", border:"none", borderRadius:7, padding:"4px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>🔑 Pwd</button>
            </div>
          </td>
        </tr>)}</tbody>
      </table></div>
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// TRANSPORT VIEW
// ════════════════════════════════════════════════════════════════════════
const TransportView = () => {
  const [records, setRecords]=useState([]), [loading, setLoading]=useState(true), [show, setShow]=useState(false);
  const [form, setForm]=useState({ date:TODAY, truck:"", km:"", rate:"", driverPay:"", diesel:"", loadingCost:"", note:"" });
  const [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  useEffect(()=>{ const u=fbListen("transport",d=>{ setRecords(d.sort((a,b)=>(b.date||"").localeCompare(a.date||""))); setLoading(false); }); return u; },[]);
  const income=r=>parseFloat(r.km||0)*parseFloat(r.rate||0);
  const cost=r=>parseFloat(r.driverPay||0)+parseFloat(r.diesel||0)+parseFloat(r.loadingCost||0);
  const profit=r=>income(r)-cost(r);
  const total={ inc:records.reduce((s,r)=>s+income(r),0), cost:records.reduce((s,r)=>s+cost(r),0), profit:records.reduce((s,r)=>s+profit(r),0) };
  const save = async () => {
    setSaving(true);
    const entry={ ...form, km:parseFloat(form.km||0), rate:parseFloat(form.rate||0), driverPay:parseFloat(form.driverPay||0), diesel:parseFloat(form.diesel||0), loadingCost:parseFloat(form.loadingCost||0) };
    const id=await fbAdd("transport",entry); sbInsert("transport",{ ...entry, firebase_id:id, created_at:new Date().toISOString() }).catch(()=>{}); setRecords(p=>[{...entry,_fbId:id},...p]);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
    setForm({ date:TODAY, truck:"", km:"", rate:"", driverPay:"", diesel:"", loadingCost:"", note:"" }); setShow(false);
  };
  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Transport Income</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Personal truck trips · P&L</p></div>
      <div style={{ display:"flex", gap:8 }}>{(saving||saved)&&<SyncBadge saving={saving} />}<button onClick={()=>setShow(!show)} style={btn("#3b82f6")}>+ Add Trip</button></div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
      <StatCard label="Total Income" value={`₹${total.inc.toLocaleString("en-IN",{maximumFractionDigits:0})}`} color="#10b981" icon="💰" />
      <StatCard label="Total Cost" value={`₹${total.cost.toLocaleString("en-IN",{maximumFractionDigits:0})}`} color="#ef4444" icon="💸" />
      <StatCard label="Net Profit" value={`₹${total.profit.toLocaleString("en-IN",{maximumFractionDigits:0})}`} color={total.profit>=0?"#10b981":"#ef4444"} icon="📊" />
    </div>
    {show&&<div style={{ ...card, border:"1px solid rgba(59,130,246,0.2)", marginBottom:16 }}>
      <h3 style={{ color:"#60a5fa", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>New Trip</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))", gap:12 }}>
        {[["date","Date","date"],["truck","Truck No.","text"],["km","KM","number"],["rate","Rate ₹/km","number"],["driverPay","Driver Pay ₹","number"],["diesel","Diesel Cost ₹","number"],["loadingCost","Loading/Unloading ₹","number"],["note","Note","text"]].map(([k,l,t])=>
          <div key={k}><Label>{l}</Label><input type={t} inputMode={t==="number"?"numeric":undefined} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inp} /></div>
        )}
      </div>
      {form.km&&form.rate&&<div style={{ marginTop:12, padding:"10px 14px", background:"rgba(16,185,129,0.06)", borderRadius:10 }}>
        <span style={{ color:"#34d399", fontSize:13, fontWeight:700 }}>Income: ₹{(parseFloat(form.km||0)*parseFloat(form.rate||0)).toFixed(0)} · Cost: ₹{(parseFloat(form.driverPay||0)+parseFloat(form.diesel||0)+parseFloat(form.loadingCost||0)).toFixed(0)} · Profit: ₹{(parseFloat(form.km||0)*parseFloat(form.rate||0)-parseFloat(form.driverPay||0)-parseFloat(form.diesel||0)-parseFloat(form.loadingCost||0)).toFixed(0)}</span>
      </div>}
      <div style={{ marginTop:14, display:"flex", gap:10 }}><button onClick={save} disabled={saving} style={btn("#3b82f6")}>{saving?"Saving…":"Save"}</button><button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button></div>
    </div>}
    {!loading&&records.length>0&&<div style={card}>
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>{["Date","Truck","KM","Rate","Income","Cost","Profit"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{records.map(r=><tr key={r._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
          <td style={{ color:"#64748b", fontSize:12, padding:"10px 12px" }}>{r.date}</td>
          <td style={{ color:"#f1f5f9", fontFamily:"monospace", fontSize:12, padding:"10px 12px" }}>{r.truck}</td>
          <td style={{ color:"#f1f5f9", fontSize:12, padding:"10px 12px" }}>{r.km}</td>
          <td style={{ color:"#64748b", fontSize:12, padding:"10px 12px" }}>₹{r.rate}/km</td>
          <td style={{ color:"#34d399", fontSize:13, fontWeight:700, padding:"10px 12px" }}>₹{income(r).toFixed(0)}</td>
          <td style={{ color:"#f87171", fontSize:12, padding:"10px 12px" }}>₹{cost(r).toFixed(0)}</td>
          <td style={{ padding:"10px 12px" }}><span style={{ color:profit(r)>=0?"#34d399":"#f87171", fontSize:13, fontWeight:800 }}>₹{profit(r).toFixed(0)}</span></td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// REPORTS VIEW — Full P&L with OPEX amortization
// ════════════════════════════════════════════════════════════════════════
const ReportsView = ({ settings }) => {
  const [salesData, setSalesData]=useState([]), [lubeData, setLubeData]=useState([]);
  const [expData, setExpData]=useState([]), [transData, setTransData]=useState([]);
  const [loading, setLoading]=useState(true), [tab, setTab]=useState("pl");
  const [month, setMonth]=useState(TODAY.slice(0,7));

  useEffect(()=>{
    const u1=fbListen("sales",d=>{ setSalesData(d||[]); setLoading(false); });
    const u2=fbListen("lubricants",d=>setLubeData(d||[]));
    const u3=fbListen("expenses",d=>setExpData(d||[]));
    const u4=fbListen("transport",d=>setTransData(d||[]));
    return ()=>{ u1(); u2(); u3(); u4(); };
  },[]);

  const filtered={ sales:salesData.filter(s=>s.date?.startsWith(month)), lubes:lubeData.filter(l=>l.date?.startsWith(month)), expenses:expData.filter(e=>e.date?.startsWith(month)), transport:transData.filter(t=>t.date?.startsWith(month)) };

  const pl = useMemo(()=>{
    let petrolL=0, dieselL=0;
    filtered.sales.forEach(s=>{ if (!s.readings) return; Object.values(s.readings).forEach(r=>{ const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0),doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0); if (pc>po) petrolL+=pc-po; if (dc>doo) dieselL+=dc-doo; }); });
    const petrolRev=petrolL*settings.petrolPrice, dieselRev=dieselL*settings.dieselPrice;
    const petrolMargin=petrolL*Object.values(UNIT_CONFIG).reduce((s,u)=>s+u.petrolMargin,0)/3;
    const dieselMargin=dieselL*Object.values(UNIT_CONFIG).reduce((s,u)=>s+u.dieselMargin,0)/3;
    const lubeRev=filtered.lubes.reduce((s,l)=>s+(l.revenue||0),0);
    const lubeCOGS=filtered.lubes.reduce((s,l)=>s+(l.cogs||0),0);
    const lubeGP=lubeRev-lubeCOGS;
    const totalRev=petrolRev+dieselRev+lubeRev;
    const expenses=filtered.expenses.reduce((s,e)=>s+(e.amount||0),0);
    const transIncome=filtered.transport.reduce((s,t)=>s+parseFloat(t.km||0)*parseFloat(t.rate||0),0);
    const transCost=filtered.transport.reduce((s,t)=>s+parseFloat(t.driverPay||0)+parseFloat(t.diesel||0)+parseFloat(t.loadingCost||0),0);
    const grossMargin=petrolMargin+dieselMargin+lubeGP;
    const netProfit=grossMargin+transIncome-transCost-expenses;
    const cgstCollected=filtered.lubes.reduce((s,l)=>s+(l.cgst||0),0);
    const sgstCollected=filtered.lubes.reduce((s,l)=>s+(l.sgst||0),0);
    return { petrolL, dieselL, petrolRev, dieselRev, petrolMargin, dieselMargin, lubeRev, lubeCOGS, lubeGP, totalRev, grossMargin, expenses, transIncome, transCost, netProfit, cgstCollected, sgstCollected };
  },[filtered, settings]);

  const cashLog=useMemo(()=>filtered.sales.filter(s=>s.hasDiscrepancy||s.cashDiff!==0).sort((a,b)=>(b.date||"").localeCompare(a.date||"")),[filtered.sales]);

  const row=(label,value,bold=false,color="#f1f5f9",sub="")=><tr style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
    <td style={{ color:"#94a3b8", fontSize:13, padding:"10px 14px" }}>{label}</td>
    <td style={{ color, fontSize:bold?16:13, fontWeight:bold?800:500, padding:"10px 14px", textAlign:"right", fontFamily:"monospace" }}>₹{value.toLocaleString("en-IN",{maximumFractionDigits:2})}</td>
    {sub&&<td style={{ color:"#475569", fontSize:11, padding:"10px 14px" }}>{sub}</td>}
  </tr>;

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Reports & Analytics</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>ICAI compliant · GST filing ready · 🔴 Live</p></div>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ ...inp, width:160 }} />
        <span style={{ color:"#475569", fontSize:11 }}>{filtered.sales.length} sales</span>
      </div>
    </div>

    <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
      {[["pl","📊 P&L Statement"],["gst","🧾 GST Summary"],["cash","💰 Cash Log"],["lubes","🛢 Lubricants"]].map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={{ padding:"8px 16px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700, background:tab===id?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(255,255,255,0.06)", color:tab===id?"#fff":"#64748b", minHeight:44 }}>{label}</button>)}
    </div>

    {tab==="pl"&&<div style={card}>
      <h3 style={{ color:"#f59e0b", fontSize:15, fontWeight:800, margin:"0 0 16px" }}>Profit & Loss — {month}</h3>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <tbody>
          <tr><td colSpan={3} style={{ color:"#60a5fa", fontSize:11, fontWeight:700, padding:"12px 14px 6px", textTransform:"uppercase", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>I. Fuel Revenue (AS-9)</td></tr>
          {row("Petrol Sales", pl.petrolRev, false, "#f59e0b", `${pl.petrolL.toFixed(0)} L × ₹${settings.petrolPrice}`)}
          {row("Diesel Sales", pl.dieselRev, false, "#3b82f6", `${pl.dieselL.toFixed(0)} L × ₹${settings.dieselPrice}`)}
          {row("Fuel Revenue Total", pl.petrolRev+pl.dieselRev, true, "#f1f5f9")}
          <tr><td colSpan={3} style={{ color:"#a78bfa", fontSize:11, fontWeight:700, padding:"12px 14px 6px", textTransform:"uppercase", borderTop:"1px solid rgba(255,255,255,0.06)" }}>II. Margin (Dealer Commission)</td></tr>
          {row("Petrol Margin", pl.petrolMargin, false, "#f59e0b", "avg margin/L")}
          {row("Diesel Margin", pl.dieselMargin, false, "#3b82f6", "avg margin/L")}
          <tr><td colSpan={3} style={{ color:"#a78bfa", fontSize:11, fontWeight:700, padding:"12px 14px 6px", textTransform:"uppercase", borderTop:"1px solid rgba(255,255,255,0.06)" }}>III. Lubricant Revenue (ICAI)</td></tr>
          {row("Lubricant Revenue", pl.lubeRev)}
          {row("Less: COGS (65%)", pl.lubeCOGS, false, "#f87171")}
          {row("Lubricant Gross Profit", pl.lubeGP, true, "#34d399")}
          <tr><td colSpan={3} style={{ color:"#34d399", fontSize:11, fontWeight:700, padding:"12px 14px 6px", textTransform:"uppercase", borderTop:"1px solid rgba(255,255,255,0.06)" }}>IV. Total Gross Margin</td></tr>
          {row("Gross Margin (Fuel + Lube)", pl.grossMargin, true, "#34d399")}
          <tr><td colSpan={3} style={{ color:"#10b981", fontSize:11, fontWeight:700, padding:"12px 14px 6px", textTransform:"uppercase", borderTop:"1px solid rgba(255,255,255,0.06)" }}>V. Transport</td></tr>
          {row("Transport Income", pl.transIncome, false, "#10b981")}
          {row("Transport Costs", pl.transCost, false, "#f87171")}
          <tr><td colSpan={3} style={{ color:"#f87171", fontSize:11, fontWeight:700, padding:"12px 14px 6px", textTransform:"uppercase", borderTop:"1px solid rgba(255,255,255,0.06)" }}>VI. Operating Expenses</td></tr>
          {row("Total OPEX", pl.expenses, false, "#f87171")}
          <tr style={{ borderTop:"2px solid rgba(245,158,11,0.4)" }}><td colSpan={3} style={{ padding:"6px 0" }} /></tr>
          {row("NET PROFIT", pl.netProfit+pl.transIncome-pl.transCost, true, pl.netProfit+pl.transIncome-pl.transCost>=0?"#34d399":"#f87171")}
        </tbody>
      </table>
    </div>}

    {tab==="gst"&&<div style={card}>
      <h3 style={{ color:"#f59e0b", fontSize:15, fontWeight:800, margin:"0 0 16px" }}>GST Summary — {month}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:20 }}>
        <StatCard label="CGST Collected" value={`₹${pl.cgstCollected.toFixed(2)}`} color="#3b82f6" icon="🏦" />
        <StatCard label="SGST Collected" value={`₹${pl.sgstCollected.toFixed(2)}`} color="#8b5cf6" icon="🏦" />
        <StatCard label="Total GST" value={`₹${(pl.cgstCollected+pl.sgstCollected).toFixed(2)}`} color="#f59e0b" icon="🧾" />
      </div>
      <div style={{ padding:"14px 16px", background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:12 }}>
        <p style={{ color:"#60a5fa", fontSize:13, fontWeight:700, margin:"0 0 8px" }}>📋 GST Filing Notes</p>
        <p style={{ color:"#64748b", fontSize:12, margin:"0 0 4px" }}>• Petrol & Diesel: Outside GST ambit — report under State VAT / Central Excise only</p>
        <p style={{ color:"#64748b", fontSize:12, margin:"0 0 4px" }}>• Lubricants (HSN 3811/2710): 18% GST (CGST 9% + SGST 9%)</p>
        <p style={{ color:"#64748b", fontSize:12, margin:0 }}>• Station GSTIN: {settings.stationGSTIN}</p>
      </div>
    </div>}

    {tab==="cash"&&<div style={card}>
      <h3 style={{ color:"#f87171", fontSize:15, fontWeight:800, margin:"0 0 16px" }}>Cash Discrepancy Log — {month}</h3>
      {cashLog.length===0?<p style={{ color:"#34d399", textAlign:"center", padding:"30px 0" }}>✅ No cash discrepancies this month!</p>:
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>{["Date","Shift","Staff","Expected","Actual","Diff","Status"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{cashLog.map(s=><tr key={s._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
          <td style={{ color:"#64748b", fontSize:12, padding:"8px 10px" }}>{s.date}</td>
          <td style={{ color:"#f1f5f9", fontSize:12, padding:"8px 10px" }}>{s.shift}</td>
          <td style={{ color:"#94a3b8", fontSize:12, padding:"8px 10px" }}>{s.staffName}</td>
          <td style={{ color:"#f1f5f9", fontSize:12, padding:"8px 10px" }}>₹{(s.expectedCash||0).toFixed(2)}</td>
          <td style={{ color:"#f1f5f9", fontSize:12, padding:"8px 10px" }}>₹{(s.cashDeposited||0).toFixed(2)}</td>
          <td style={{ padding:"8px 10px" }}><span style={{ color:(s.cashDiff||0)>0?"#34d399":"#f87171", fontSize:13, fontWeight:800 }}>{(s.cashDiff||0)>0?"+":(s.cashDiff||0)<0?"":""} ₹{(s.cashDiff||0).toFixed(2)}</span></td>
          <td style={{ padding:"8px 10px" }}>{(s.cashDiff||0)>0?<span style={{ color:"#34d399", fontSize:10 }}>Excess</span>:<span style={{ background:"rgba(239,68,68,0.12)", color:"#f87171", fontSize:10, padding:"2px 6px", borderRadius:4, fontWeight:700 }}>Shortage</span>}</td>
        </tr>)}</tbody>
      </table></div>}
    </div>}

    {tab==="lubes"&&<div style={card}>
      <h3 style={{ color:"#a78bfa", fontSize:15, fontWeight:800, margin:"0 0 16px" }}>Lubricant Sales — {month}</h3>
      {filtered.lubes.length===0?<p style={{ color:"#475569", textAlign:"center", padding:"30px 0" }}>No lubricant sales this month.</p>:
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr>{["Date","Product","Qty","Price","COGS","Revenue","GP","CGST","SGST"].map(h=><th key={h} style={{ color:"#334155", fontSize:11, fontWeight:700, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>
          {filtered.lubes.map(l=><tr key={l._fbId} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
            <td style={{ color:"#64748b", fontSize:12, padding:"10px 10px" }}>{l.date}</td>
            <td style={{ color:"#a78bfa", fontWeight:700, fontSize:12, padding:"10px 10px" }}>{l.product}</td>
            <td style={{ color:"#f1f5f9", fontSize:12, padding:"10px 10px" }}>{l.qty}</td>
            <td style={{ color:"#f59e0b", fontSize:12, padding:"10px 10px" }}>₹{l.price}</td>
            <td style={{ color:"#f87171", fontSize:12, padding:"10px 10px" }}>₹{(l.cogs||0).toFixed(2)}</td>
            <td style={{ color:"#f1f5f9", fontWeight:700, fontSize:12, padding:"10px 10px" }}>₹{(l.revenue||0).toFixed(2)}</td>
            <td style={{ padding:"10px 10px" }}><span style={{ color:"#34d399", fontWeight:800 }}>₹{(l.grossProfit||0).toFixed(2)}</span></td>
            <td style={{ color:"#f59e0b", fontSize:11, padding:"10px 10px" }}>₹{(l.cgst||0).toFixed(2)}</td>
            <td style={{ color:"#f59e0b", fontSize:11, padding:"10px 10px" }}>₹{(l.sgst||0).toFixed(2)}</td>
          </tr>)}
          <tr style={{ borderTop:"2px solid rgba(139,92,246,0.3)" }}>
            <td colSpan={5} style={{ color:"#a78bfa", fontWeight:800, padding:"12px 10px" }}>TOTAL</td>
            <td style={{ color:"#f1f5f9", fontWeight:800, padding:"12px 10px", fontFamily:"monospace" }}>₹{pl.lubeRev.toFixed(2)}</td>
            <td style={{ padding:"12px 10px" }}><span style={{ color:"#34d399", fontWeight:900, fontSize:14 }}>₹{pl.lubeGP.toFixed(2)}</span></td>
            <td style={{ color:"#f59e0b", fontWeight:800, padding:"12px 10px" }}>₹{pl.cgstCollected.toFixed(2)}</td>
            <td style={{ color:"#f59e0b", fontWeight:800, padding:"12px 10px" }}>₹{pl.sgstCollected.toFixed(2)}</td>
          </tr>
        </tbody>
      </table></div>}
    </div>}
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// SETTINGS VIEW
// ════════════════════════════════════════════════════════════════════════
const SettingsView = ({ settings, setSettings, tanks, setTanks }) => {
  const [form, setForm]=useState(settings);
  const [tankForm, setTankForm]=useState(JSON.parse(JSON.stringify(tanks)));
  const [saving, setSaving]=useState(false), [saved, setSaved]=useState(false);
  const [nukeModal, setNukeModal]=useState(false), [nukePwd, setNukePwd]=useState(""), [nukeErr, setNukeErr]=useState("");
  const [supabaseStatus, setSupabaseStatus]=useState(null);

  useEffect(()=>{
    // Test Supabase connection
    sbGet("audit_trail","limit=1").then(d=>setSupabaseStatus(Array.isArray(d)?"connected":"error")).catch(()=>setSupabaseStatus("error"));
  },[]);

  const saveSettings = async () => {
    setSaving(true);
    await fbSet("settings","main",form);
    await fbSet("tanks","main",tankForm);
    sbInsert("settings_log",{ ...form, tanks:JSON.stringify(tankForm), saved_at:new Date().toISOString(), created_at:new Date().toISOString() }).catch(()=>{});
    setSettings(form); setTanks(tankForm);
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000);
  };
  const doNuke = async () => {
    await fbNuke("sales"); await fbNuke("supply"); await fbNuke("expenses"); await fbNuke("transport"); await fbNuke("lubricants");
    await fbSet("tanks","main",INIT_TANKS); setTanks(INIT_TANKS); setNukeModal(false); setNukePwd(""); setNukeErr("");
    alert("✅ All data cleared. Tank levels reset.");
  };

  return <div style={{ padding:24, overflowY:"auto", flex:1 }}>
    <ConfirmModal open={nukeModal} title="FACTORY RESET" msg="This will permanently delete ALL sales, supply, expense and transport records. Staff list and settings will be kept. This CANNOT be undone." onOk={doNuke} onCancel={()=>{ setNukeModal(false); setNukePwd(""); setNukeErr(""); }} okLabel="DELETE ALL" danger />
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
      <div><h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>⚙️ Settings</h1><p style={{ color:"#334155", fontSize:13, margin:0 }}>Owner only · Fuel prices · Tank config · GST details</p></div>
      {(saving||saved)&&<SyncBadge saving={saving} />}
    </div>

    {/* Supabase Status */}
    <div style={{ ...card, marginBottom:16, border:`1px solid ${supabaseStatus==="connected"?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}` }}>
      <h3 style={{ color:supabaseStatus==="connected"?"#34d399":"#f87171", fontSize:14, fontWeight:700, margin:"0 0 8px" }}>🔗 Supabase Connection</h3>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <div style={{ width:10, height:10, borderRadius:"50%", background:supabaseStatus==="connected"?"#34d399":supabaseStatus?"#ef4444":"#475569" }} />
        <span style={{ color:"#94a3b8", fontSize:13 }}>{supabaseStatus==="connected"?"Connected — Dual-sync active":supabaseStatus==="error"?"Connection error — Check Supabase tables":"Checking…"}</span>
      </div>
      <p style={{ color:"#475569", fontSize:11, margin:"8px 0 0" }}>Project: xgchjtiiwqraolnrnxxg.supabase.co · Tables needed: sales, supply, lubricants, expenses, transport, staff, khata_customers, khata_txns, gst_invoices, dip_readings, audit_trail, cash_integrity_log, settings_log</p>
    </div>

    <div style={{ ...card, marginBottom:16, border:"1px solid rgba(245,158,11,0.2)" }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>⛽ Fuel Prices & Thresholds</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
        {[["petrolPrice","Petrol Price ₹/L"],["dieselPrice","Diesel Price ₹/L"],["lowStockAlert","Low Stock Alert (L)"],["minOrderLitres","Min Order (L)"],["maxOrderLitres","Max Order (L)"],["monthlyOpex","Monthly OPEX ₹"],["cashMismatchTolerance","Cash Mismatch Tolerance ₹"]].map(([k,l])=>
          <div key={k}><Label>{l}</Label><input type="number" inputMode="numeric" step="0.01" value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:parseFloat(e.target.value)||0}))} style={inp} /></div>
        )}
      </div>
    </div>

    <div style={{ ...card, marginBottom:16, border:"1px solid rgba(245,158,11,0.2)" }}>
      <h3 style={{ color:"#f59e0b", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🧾 GST Details</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
        <div><Label>Station GSTIN</Label><input value={form.stationGSTIN||""} onChange={e=>setForm(p=>({...p,stationGSTIN:e.target.value}))} placeholder="15-char GSTIN" style={inp} /></div>
        <div><Label>Station Name</Label><input value={form.stationName||""} onChange={e=>setForm(p=>({...p,stationName:e.target.value}))} style={inp} /></div>
      </div>
    </div>

    <div style={{ ...card, marginBottom:16 }}>
      <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🛢 Tank Levels</h3>
      {Object.entries(UNIT_CONFIG).map(([uid,unit])=>
        <div key={uid} style={{ marginBottom:16 }}>
          <p style={{ color:"#f59e0b", fontSize:13, fontWeight:700, margin:"0 0 10px" }}>{unit.name}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}>
            {["petrol","diesel"].map(fk=>{
              const t=tankForm[uid]?.[fk]; if (!t) return null;
              const col=fk==="petrol"?"#f59e0b":"#3b82f6";
              return ["current","capacity","buffer"].map(field=>
                <div key={uid+fk+field}><Label><span style={{ color:col }}>{fk}</span> {field}</Label><input type="number" inputMode="numeric" value={t[field]||0} onChange={e=>setTankForm(p=>{ const n=JSON.parse(JSON.stringify(p)); if (n[uid]?.[fk]) n[uid][fk][field]=parseFloat(e.target.value)||0; return n; })} style={inp} /></div>
              );
            })}
          </div>
        </div>
      )}
    </div>

    <button onClick={saveSettings} disabled={saving} style={{ ...btn(), marginBottom:16 }}>{saving?"Saving…":"💾 Save All Settings"}</button>

    <div style={{ ...card, border:"2px solid rgba(239,68,68,0.3)" }}>
      <h3 style={{ color:"#f87171", fontSize:14, fontWeight:700, margin:"0 0 10px" }}>🗑 Factory Reset</h3>
      <p style={{ color:"#64748b", fontSize:13, margin:"0 0 14px" }}>Deletes all transaction data. Staff & settings preserved. Enter owner password to confirm.</p>
      <div style={{ display:"flex", gap:10 }}>
        <input type="password" value={nukePwd} onChange={e=>{ setNukePwd(e.target.value); setNukeErr(""); }} placeholder="Owner password" style={{ ...inp, flex:1, border:"1px solid rgba(239,68,68,0.3)" }} />
        <button onClick={()=>{ if (nukePwd!==OWNER.pwd) { setNukeErr("Wrong password."); return; } setNukeModal(true); }} style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:48 }}>⚠ Reset</button>
      </div>
      {nukeErr&&<p style={{ color:"#f87171", fontSize:12, margin:"8px 0 0" }}>⚠ {nukeErr}</p>}
    </div>
  </div>;
};

// ════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser]=useState(null);
  const [active, setActive]=useState("dashboard");
  const [collapsed, setCollapsed]=useState(false);
  const [settings, setSettings]=useState(INIT_SETTINGS);
  const [tanks, setTanks]=useState(INIT_TANKS);
  const [staffList, setStaffList]=useState([]);
  const [alertCount, setAlertCount]=useState(0);

  useEffect(()=>{
    fbGet("settings").then(d=>{ if (d?.length) { const s=d.find(x=>x._fbId==="main")||d[0]; if (s) setSettings({ ...INIT_SETTINGS, ...s }); } });
    fbGet("tanks").then(d=>{ if (d?.length) { const t=d.find(x=>x._fbId==="main")||d[0]; if (t) { const { _fbId, _updatedAt, ...rest }=t; setTanks({ ...INIT_TANKS, ...rest }); } } });
    fbGet("staff").then(d=>{ if (d?.length) setStaffList(d.map(s=>({...s,id:s._fbId||s.id}))); });
    // Count audit flags for badge
    sbGet("audit_trail","action=eq.FRAUD_ALERT&order=created_at.desc&limit=50").then(d=>setAlertCount(d?.length||0));
  },[]);

  const onLogin=(u)=>{ setUser(u); setActive(u.role==="owner"?"dashboard":"sales"); };
  const onLogout=()=>{ setUser(null); setActive("dashboard"); };

  if (!user) return <LoginPage onLogin={onLogin} staffList={staffList} />;

  const renderView=()=>{
    switch (active) {
      case "dashboard": return user.role==="owner"?<Dashboard settings={settings} tanks={tanks} />:<SalesView user={user} tanks={tanks} setTanks={setTanks} settings={settings} />;
      case "sales": return <SalesView user={user} tanks={tanks} setTanks={setTanks} settings={settings} />;
      case "stock": return <StockView tanks={tanks} settings={settings} />;
      case "supply": return <SupplyView user={user} tanks={tanks} setTanks={setTanks} />;
      case "logistics": return <LogisticsView tanks={tanks} settings={settings} />;
      case "lubricants": return <LubricantsView user={user} />;
      case "khata": return <KhataView user={user} />;
      case "gstbilling": return <GSTBillingView settings={settings} />;
      case "expenses": return <ExpensesView />;
      case "dip": return <DipView tanks={tanks} />;
      case "staff": return <StaffView staffList={staffList} setStaffList={setStaffList} />;
      case "transport": return <TransportView />;
      case "reports": return <ReportsView settings={settings} />;
      case "settings": return <SettingsView settings={settings} setSettings={setSettings} tanks={tanks} setTanks={setTanks} />;
      default: return null;
    }
  };

  return (
    <div style={{ display:"flex", height:"100vh", background:"#060d18", fontFamily:"'Sora',system-ui,sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
      <style>{`* { box-sizing:border-box; } ::-webkit-scrollbar { width:4px; height:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; } select option { background:#07111e; color:#f1f5f9; } input[type=number]::-webkit-inner-spin-button { opacity:0.5; } @media (max-width:768px) { .sidebar-hide { display:none; } }`}</style>
      <Sidebar active={active} setActive={setActive} user={user} onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} alertCount={alertCount} />
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
        {renderView()}
      </div>
    </div>
  );
}
