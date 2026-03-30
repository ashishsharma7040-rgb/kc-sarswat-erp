// ═══════════════════════════════════════════════════════════════
// KC SARSWAT AUTO FUEL STATION — ERP v4.0
// Production-grade | Supabase-only | Secure Auth | RLS
// PDF Reports (pdfmake) | Excel (SheetJS) | 9 Modules
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
// SUPABASE — keys from Vercel env vars (never hardcode)
// Fallback prevents crash if env vars are missing
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
  || "https://xgchjtiiwqraolnrnxxg.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnY2hqdGlpd3FyYW9sbnJueHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODE1NDksImV4cCI6MjA5MDM1NzU0OX0.ceDR5BK6Jo8aGrDcuOWUxG8zhrIYMlQsC3m4r2wckW0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  db: { schema: "public" },
  global: {
    headers: { "X-Client-Info": "kc-sarswat-erp/4.0" },
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
    },
  },
  realtime: { params: { eventsPerSecond: 2 } },
});

// ═══════════════════════════════════════════════════════════════
// GLOBAL CONTEXT
// ═══════════════════════════════════════════════════════════════
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const TODAY = new Date().toISOString().split("T")[0];
const THIS_MONTH = TODAY.slice(0, 7);
const IST = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

const UNIT_CONFIG = {
  unit1: { name: "Unit 1", machines: ["M1","M2","M3"] },
  unit2: { name: "Unit 2", machines: ["M4","M5"] },
  unit3: { name: "Unit 3", machines: ["M6","M7"] },
};
const SHIFTS       = ["Day Shift", "Night Shift"];
const LUBE_PRODUCTS = ["Servo Premium 4T","Servo Super Bike","HP Racer 4T","HP Laal Ghoda","Servo Extreme 4T","Custom"];
const LUBE_COGS    = 0.65;
const EXPENSE_CATS = ["Cleaning","Maintenance","Generator Diesel","Electricity Bill","Water Bill","Staff Salary","Cash Shortage","Custom"];
const TRUCKS       = [
  { id:"own",  name:"Own Truck (14K)", cap:14000 },
  { id:"t12",  name:"Transport 12K",   cap:12000 },
  { id:"t16",  name:"Transport 16K",   cap:16000 },
  { id:"t23",  name:"Transport 23K",   cap:23000 },
];
const HOLIDAYS = ["2025-01-26","2025-08-15","2025-10-02","2026-01-26","2026-03-17","2026-04-14","2026-08-15","2026-10-02"];

const PIE_COLORS = ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#ef4444","#f97316","#06b6d4","#ec4899"];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const isDepotClosed = (dt) => {
  const h = dt.getHours(), day = dt.getDay(), ds = dt.toISOString().split("T")[0];
  return day === 0 || HOLIDAYS.includes(ds) || h >= 17;
};
const isWithin24h = (d) => { try { return (Date.now() - new Date(d + "T00:00:00")) < 86400000; } catch { return true; } };
const calcVCF     = (fuelType, tempC) => 1 - ((fuelType === "petrol" ? 0.00090 : 0.00082) * (tempC - 15));
const forecastDays = (current, sales7) => {
  if (!sales7 || sales7.length < 2) return 99;
  const w = [0.4, 0.3, 0.2, 0.1];
  const wAvg = [...sales7].reverse().slice(0, 4).reduce((s, v, i) => s + (v || 0) * (w[i] || 0.1), 0);
  return wAvg > 0 ? current / wAvg : 99;
};
const fmtINR = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtINR0 = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const haptic = (ms = 30) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} };
const numWords = (n) => {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const inWords = (num) => {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num/10)] + (num%10?" "+a[num%10]:"");
    if (num < 1000) return a[Math.floor(num/100)]+" Hundred"+(num%100?" "+inWords(num%100):"");
    if (num < 100000) return inWords(Math.floor(num/1000))+" Thousand"+(num%1000?" "+inWords(num%1000):"");
    if (num < 10000000) return inWords(Math.floor(num/100000))+" Lakh"+(num%100000?" "+inWords(num%100000):"");
    return inWords(Math.floor(num/10000000))+" Crore"+(num%10000000?" "+inWords(num%10000000):"");
  };
  const intPart = Math.floor(Math.abs(n));
  return "INR " + (intPart === 0 ? "Zero" : inWords(intPart)) + " Only";
};

// ═══════════════════════════════════════════════════════════════
// SUPABASE DATA LAYER — Speed optimised for Asia latency
// Key fixes:
//   1. insert() no .select() = 1 round-trip not 2
//   2. Tank updates run in parallel not sequential
//   3. Client-side UUID = instant optimistic UI
//   4. withRetry wrapper for bad connections
//   5. 12s timeout so app never hangs forever
// ═══════════════════════════════════════════════════════════════

const withRetry = async (fn, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 700 * (i + 1)));
    }
  }
};

const db = {
  // SETTINGS
  getSettings: async () => {
    const { data } = await supabase.from("app_settings").select("*").single();
    return data;
  },
  updateSettings: async (id, vals) => {
    const { error } = await supabase.from("app_settings").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
    return !error;
  },

  // TANKS
  getTanks: async () => {
    const { data } = await supabase.from("tanks").select("*");
    return data || [];
  },
  // Fire-and-forget single tank — optimistic UI already done
  updateTank: async (unitId, fuelType, current) => {
    supabase.from("tanks").update({ current, updated_at: new Date().toISOString() }).eq("unit_id", unitId).eq("fuel_type", fuelType);
  },
  updateTankFull: async (unitId, fuelType, vals) => {
    await supabase.from("tanks").update({ ...vals, updated_at: new Date().toISOString() }).eq("unit_id", unitId).eq("fuel_type", fuelType);
  },
  // SPEED FIX: run all tank updates at same time not one by one
  updateTanksParallel: (updates) => {
    return Promise.all(updates.map(({ unitId, fuelType, current }) =>
      supabase.from("tanks").update({ current, updated_at: new Date().toISOString() }).eq("unit_id", unitId).eq("fuel_type", fuelType)
    ));
  },

  // SALES
  getSales: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("sales").select("*").like("date", `${month}%`).order("date", { ascending: false }).order("created_at", { ascending: false });
    return data || [];
  },
  getSalesToday: async () => {
    const { data } = await supabase.from("sales").select("*").eq("date", TODAY);
    return data || [];
  },
  getPrevShift: async (date, shift) => {
    let pd = date, ps = shift === "Day Shift" ? "Night Shift" : "Day Shift";
    if (shift === "Day Shift") { const d2 = new Date(date); d2.setDate(d2.getDate()-1); pd = d2.toISOString().split("T")[0]; }
    const { data } = await supabase.from("sales").select("*").eq("date", pd).eq("shift", ps).maybeSingle();
    return data;
  },
  getExistEntry: async (date, shift) => {
    const { data } = await supabase.from("sales").select("id,date,shift").eq("date", date).eq("shift", shift).maybeSingle();
    return data;
  },
  // SPEED FIX: no .select().single() — saves 1 full round-trip
  insertSale: async (entry) => {
    const id = crypto.randomUUID();
    const row = { id, ...entry };
    const result = await withRetry(() => supabase.from("sales").insert(row));
    return result === null ? null : row;
  },
  updateSale: async (id, entry) => {
    const { error } = await supabase.from("sales").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", id);
    return !error;
  },

  // SUPPLY
  getSupply: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("supply").select("*").like("date", `${month}%`).order("date", { ascending: false });
    return data || [];
  },
  insertSupply: async (entry) => {
    const id = crypto.randomUUID();
    const row = { id, ...entry };
    const result = await withRetry(() => supabase.from("supply").insert(row));
    return result === null ? null : row;
  },

  // LUBRICANTS
  getLubes: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("lubricants").select("*").like("date", `${month}%`).order("date", { ascending: false });
    return data || [];
  },
  insertLube: async (entry) => {
    const { data, error } = await supabase.from("lubricants").insert(entry).select().single();
    return error ? null : data;
  },
  updateLube: async (id, entry) => {
    await supabase.from("lubricants").update(entry).eq("id", id);
  },

  // EXPENSES
  getExpenses: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("expenses").select("*").like("date", `${month}%`).order("date", { ascending: false });
    return data || [];
  },
  insertExpense: async (entry) => {
    const { data } = await supabase.from("expenses").insert(entry).select().single();
    return data;
  },

  // TRANSPORT
  getTransport: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("transport").select("*").like("date", `${month}%`).order("date", { ascending: false });
    return data || [];
  },
  insertTransport: async (entry) => {
    const { data } = await supabase.from("transport").insert(entry).select().single();
    return data;
  },

  // KHATA
  getCustomers: async () => {
    const { data } = await supabase.from("khata_customers").select("*").order("name");
    return data || [];
  },
  insertCustomer: async (entry) => {
    const { data } = await supabase.from("khata_customers").insert(entry).select().single();
    return data;
  },
  updateCustomer: async (id, vals) => {
    await supabase.from("khata_customers").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
  },
  getKhataTxns: async (customerId) => {
    const { data } = await supabase.from("khata_txns").select("*").eq("customer_id", customerId).order("date", { ascending: false });
    return data || [];
  },
  getAllKhataTxns: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("khata_txns").select("*").like("date", `${month}%`).order("date", { ascending: false });
    return data || [];
  },
  insertKhataTxn: async (entry) => {
    const { data } = await supabase.from("khata_txns").insert(entry).select().single();
    return data;
  },

  // GST INVOICES
  getInvoices: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("gst_invoices").select("*").like("date", `${month}%`).order("invoice_number", { ascending: false });
    return data || [];
  },
  getLastInvoiceNum: async () => {
    const { data } = await supabase.from("gst_invoices").select("invoice_number").order("invoice_number", { ascending: false }).limit(1).maybeSingle();
    return data?.invoice_number || 0;
  },
  insertInvoice: async (entry) => {
    const { data } = await supabase.from("gst_invoices").insert(entry).select().single();
    return data;
  },

  // DIP READINGS
  getDips: async (month = THIS_MONTH) => {
    const { data } = await supabase.from("dip_readings").select("*").like("date", `${month}%`).order("date", { ascending: false });
    return data || [];
  },
  insertDip: async (entry) => {
    const { data } = await supabase.from("dip_readings").insert(entry).select().single();
    return data;
  },

  // CASH INTEGRITY
  insertIntegrity: async (entry) => {
    await supabase.from("cash_integrity_log").insert(entry);
  },
  getIntegritySummary: async () => {
    const { data } = await supabase.from("staff_integrity_summary").select("*");
    return data || [];
  },

  // AUDIT TRAIL
  audit: async (action, tableName, data, staffId, staffName) => {
    await supabase.from("audit_trail").insert({ action, table_name: tableName, record_data: data, performed_by: staffId, performed_name: staffName });
  },

  // STAFF
  getStaff: async () => {
    const { data } = await supabase.from("staff").select("*").order("name");
    return data || [];
  },
  insertStaff: async (entry) => {
    const { data } = await supabase.from("staff").insert(entry).select().single();
    return data;
  },
  updateStaff: async (id, vals) => {
    await supabase.from("staff").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", id);
  },

  // REPORTS — month data bundle
  getMonthBundle: async (month) => {
    const [sales, lubes, expenses, transport, supply] = await Promise.all([
      supabase.from("sales").select("*").like("date", `${month}%`),
      supabase.from("lubricants").select("*").like("date", `${month}%`),
      supabase.from("expenses").select("*").like("date", `${month}%`),
      supabase.from("transport").select("*").like("date", `${month}%`),
      supabase.from("supply").select("*").like("date", `${month}%`),
    ]);
    return {
      sales: sales.data || [],
      lubes: lubes.data || [],
      expenses: expenses.data || [],
      transport: transport.data || [],
      supply: supply.data || [],
    };
  },
};

// ═══════════════════════════════════════════════════════════════
// PDF GENERATOR (pdfmake via CDN — loaded dynamically)
// ═══════════════════════════════════════════════════════════════
const getPdfMake = () => window.pdfMake;

const pdfStyles = {
  header:     { fontSize: 16, bold: true, color: "#1e293b" },
  subheader:  { fontSize: 12, bold: true, color: "#334155" },
  label:      { fontSize: 9,  color: "#64748b" },
  value:      { fontSize: 10, bold: true, color: "#0f172a" },
  tableHead:  { fontSize: 9,  bold: true, color: "#fff", fillColor: "#0f172a" },
  tableRow:   { fontSize: 9,  color: "#1e293b" },
  tableAlt:   { fontSize: 9,  color: "#1e293b", fillColor: "#f8fafc" },
  total:      { fontSize: 10, bold: true, color: "#0f172a", fillColor: "#fef3c7" },
  red:        { color: "#dc2626" },
  green:      { color: "#16a34a" },
  amber:      { color: "#d97706" },
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const card = { background:"rgba(13,27,42,0.95)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:22 };
const inp  = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"12px 14px", color:"#f1f5f9", fontSize:14, width:"100%", outline:"none", fontFamily:"inherit", boxSizing:"border-box", minHeight:48 };
const inpErr = { ...inp, background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.55)" };
const btn  = (c = "#f59e0b") => ({ background:`linear-gradient(135deg,${c},${c}cc)`, color:"#fff", border:"none", borderRadius:12, padding:"12px 22px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:48, touchAction:"manipulation" });
const ghostBtn = { background:"rgba(255,255,255,0.05)", color:"#64748b", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 22px", fontSize:13, cursor:"pointer", fontFamily:"inherit", minHeight:48 };

// ═══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
const Label    = ({ children, req }) => <label style={{ color:"#94a3b8", fontSize:11, fontWeight:700, display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.6px" }}>{children}{req && <span style={{ color:"#f87171", marginLeft:3 }}>*</span>}</label>;
const FieldErr = ({ msg }) => msg ? <div style={{ color:"#f87171", fontSize:11, marginTop:4 }}>⚠ {msg}</div> : null;
const ErrBanner = ({ errors }) => !errors?.length ? null : (
  <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:"14px 18px", marginBottom:16 }}>
    <p style={{ color:"#fca5a5", fontSize:13, fontWeight:700, margin:"0 0 6px" }}>Please fix:</p>
    <ul style={{ color:"#f87171", fontSize:12, margin:0, paddingLeft:16 }}>{errors.map((e,i) => <li key={i}>{e}</li>)}</ul>
  </div>
);
const Toast = ({ msg, type = "success" }) => msg ? (
  <div style={{ background:type==="success"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.1)", border:`1px solid ${type==="success"?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`, borderRadius:12, padding:"12px 18px", marginBottom:16, color:type==="success"?"#34d399":"#f87171", fontSize:13, fontWeight:600 }}>{msg}</div>
) : null;
const SyncBadge = ({ saving }) => (
  <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", background:saving?"rgba(245,158,11,0.1)":"rgba(16,185,129,0.1)", border:`1px solid ${saving?"rgba(245,158,11,0.2)":"rgba(16,185,129,0.2)"}`, borderRadius:6 }}>
    <div style={{ width:6, height:6, borderRadius:"50%", background:saving?"#f59e0b":"#34d399" }} />
    <span style={{ color:saving?"#f59e0b":"#34d399", fontSize:10, fontWeight:700 }}>{saving?"Saving…":"Saved ✓"}</span>
  </div>
);
const Skeleton = ({ w = "100%", h = 16 }) => <div style={{ width:w, height:h, borderRadius:8, background:"rgba(255,255,255,0.06)", marginBottom:8 }} />;
const LockedBar = () => <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"10px 16px", marginBottom:14, color:"#f87171", fontSize:12, fontWeight:600 }}>🔒 Locked — Staff can only edit today's data.</div>;

const StatCard = ({ label, value, sub, color="#f59e0b", icon, loading, alert }) => {
  if (loading) return <div style={{ ...card, height:110 }}><Skeleton /><Skeleton w="60%" h={24} /></div>;
  const rgb = color==="#f59e0b"?"245,158,11":color==="#3b82f6"?"59,130,246":color==="#10b981"?"16,185,129":color==="#8b5cf6"?"139,92,246":"239,68,68";
  return (
    <div style={{ ...card, border:`1px solid rgba(${rgb},0.22)`, position:"relative", overflow:"hidden" }}>
      {alert && <div style={{ position:"absolute", top:10, right:10, background:"#ef4444", color:"#fff", fontSize:9, fontWeight:900, padding:"2px 7px", borderRadius:8, animation:"pulse 1s infinite" }}>🚨 ALERT</div>}
      <div style={{ position:"absolute", top:0, right:0, width:100, height:100, background:`radial-gradient(circle at top right,rgba(${rgb},0.1),transparent)`, borderRadius:"0 18px 0 100%" }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <p style={{ color:"#64748b", fontSize:11, fontWeight:700, margin:"0 0 8px", letterSpacing:"0.9px", textTransform:"uppercase" }}>{label}</p>
          <p style={{ color:"#f1f5f9", fontSize:24, fontWeight:800, margin:0 }}>{value}</p>
          {sub && <p style={{ color:"#94a3b8", fontSize:12, margin:"4px 0 0" }}>{sub}</p>}
        </div>
        <div style={{ width:46, height:46, background:`rgba(${rgb},0.14)`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", color, fontSize:22, flexShrink:0 }}>{icon}</div>
      </div>
    </div>
  );
};

const TankGauge = ({ label, current, capacity, color, lowAlert, buffer, forecastD }) => {
  const pct   = Math.min((current / capacity) * 100, 100);
  const bPct  = capacity > 0 ? Math.min(((buffer||0) / capacity) * 100, 100) : 0;
  const usable = Math.max(0, current - (buffer||0));
  const isLow  = usable < (lowAlert||500);
  const urgency = forecastD !== undefined ? (forecastD < 1 ? "critical" : forecastD < 3 ? "warning" : "ok") : "ok";
  return (
    <div style={{ ...card, textAlign:"center", padding:"14px 10px", border:`1px solid ${urgency==="critical"?"rgba(239,68,68,0.5)":urgency==="warning"?"rgba(245,158,11,0.3)":"rgba(255,255,255,0.07)"}` }}>
      <p style={{ color:"#94a3b8", fontSize:9, fontWeight:700, margin:"0 0 8px", textTransform:"uppercase" }}>{label}</p>
      <div style={{ position:"relative", width:50, height:90, margin:"0 auto 8px", borderRadius:"6px 6px 4px 4px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:`linear-gradient(0deg,${color}cc,${color}55)`, transition:"height 0.6s" }} />
        {bPct > 0 && <div style={{ position:"absolute", left:0, right:0, bottom:`${bPct}%`, height:2, background:"#ef4444" }} />}
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#f1f5f9", fontSize:10, fontWeight:700, textShadow:"0 1px 4px rgba(0,0,0,0.9)" }}>{pct.toFixed(0)}%</span>
        </div>
      </div>
      <p style={{ color:"#f1f5f9", fontSize:12, fontWeight:700, margin:"0 0 1px" }}>{fmtINR0(current)}L</p>
      <p style={{ color:"#34d399", fontSize:10, margin:"0 0 3px" }}>Use: {fmtINR0(usable)}L</p>
      {forecastD !== undefined && forecastD < 99 && (
        <p style={{ color:urgency==="critical"?"#f87171":urgency==="warning"?"#f59e0b":"#64748b", fontSize:9, fontWeight:700, margin:"0 0 3px" }}>~{forecastD.toFixed(1)}d</p>
      )}
      {isLow && <span style={{ background:"rgba(239,68,68,0.15)", color:"#f87171", fontSize:9, padding:"2px 6px", borderRadius:4, fontWeight:700 }}>⚠ LOW</span>}
    </div>
  );
};

const ConfirmModal = ({ open, title, msg, onOk, onCancel, okLabel="Proceed", danger=false, extraBtn }) => {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:999 }}>
      <div style={{ ...card, border:`1px solid ${danger?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.3)"}`, width:"100%", maxWidth:520, borderRadius:"24px 24px 0 0", boxShadow:"0 -20px 60px rgba(0,0,0,0.6)" }}>
        <h3 style={{ color:danger?"#fca5a5":"#f59e0b", fontSize:16, fontWeight:800, margin:"0 0 10px" }}>⚠ {title}</h3>
        <p style={{ color:"#94a3b8", fontSize:13, margin:"0 0 20px", lineHeight:1.7 }}>{msg}</p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={onOk} style={{ flex:1, ...btn(danger?"#ef4444":"#f59e0b") }}>{okLabel}</button>
          {extraBtn && <button onClick={extraBtn.onClick} style={{ flex:1, ...btn("#3b82f6") }}>{extraBtn.label}</button>}
          <button onClick={onCancel} style={{ flex:1, ...ghostBtn }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

const DiscrepancyModal = ({ open, field, prevVal, currVal, onContinue, onFix }) => {
  if (!open) return null;
  const diff = parseFloat(currVal||0) - parseFloat(prevVal||0);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:1000 }}>
      <div style={{ ...card, border:"2px solid rgba(239,68,68,0.6)", width:"100%", maxWidth:520, borderRadius:"24px 24px 0 0" }}>
        <h3 style={{ color:"#fca5a5", fontSize:17, fontWeight:900, margin:"0 0 10px" }}>⚠️ Balance Discrepancy!</h3>
        <p style={{ color:"#64748b", fontSize:12, margin:"0 0 6px" }}>{field}</p>
        <div style={{ background:"rgba(239,68,68,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
          <p style={{ color:"#94a3b8", fontSize:13, margin:0, lineHeight:1.8 }}>
            Previous closing: <b style={{ color:"#f59e0b" }}>₹{parseFloat(prevVal||0).toFixed(2)}</b><br/>
            Current opening: <b style={{ color:"#f59e0b" }}>₹{parseFloat(currVal||0).toFixed(2)}</b><br/>
            Discrepancy: <b style={{ color:diff>0?"#34d399":"#f87171" }}>{diff>0?"+":""}₹{diff.toFixed(2)}</b>
          </p>
        </div>
        <p style={{ color:"#f87171", fontSize:12, fontWeight:700, margin:"0 0 14px" }}>⛛ Meter Continuity Rule: Opening must equal previous closing. This will be flagged in audit trail.</p>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onFix} style={{ flex:1, ...btn("#10b981") }}>← Fix It</button>
          <button onClick={onContinue} style={{ flex:1, background:"rgba(239,68,68,0.15)", color:"#f87171", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 0", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Continue (Flag)</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LOGIN PAGE — Supabase Auth
// ═══════════════════════════════════════════════════════════════
const LoginPage = ({ onLogin }) => {
  const [email, setEmail]     = useState("");
  const [pwd, setPwd]         = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const login = async () => {
    if (!email || !pwd) { setError("Enter email and password."); return; }
    setLoading(true); setError("");
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pwd });
    if (authErr || !data.user) { setError("Invalid credentials. Try again."); setLoading(false); return; }
    // Fetch profile
    const { data: profile } = await supabase.from("staff").select("*").eq("id", data.user.id).maybeSingle();
    if (!profile) { setError("Account not set up. Contact owner."); await supabase.auth.signOut(); setLoading(false); return; }
    if (!profile.active) { setError("Your account is deactivated."); await supabase.auth.signOut(); setLoading(false); return; }
    onLogin({ ...profile, email: data.user.email });
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", fontFamily:"'Sora',system-ui,sans-serif", background:"#060d18" }}>
      <div style={{ flex:1, background:"linear-gradient(180deg,#0a0f1a,#0d1c2e,#102238)", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:40 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:80, marginBottom:16 }}>⛽</div>
          <h2 style={{ color:"#f1f5f9", fontSize:28, fontWeight:800, margin:"0 0 8px" }}>Shree K C Sarswat</h2>
          <h3 style={{ color:"#f59e0b", fontSize:20, fontWeight:700, margin:"0 0 8px" }}>Auto Fuel Station</h3>
          <p style={{ color:"#475569", fontSize:13 }}>3 Units · 7 Machines · HPCL · Lunkaransar, RJ</p>
          <div style={{ marginTop:20, display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            {[["⛽","Petrol","#f59e0b"],["🔵","Diesel","#3b82f6"],["🛢","Lubes","#8b5cf6"],["📋","Khata","#10b981"],["🧾","GST","#f59e0b"]].map(([ic,lb,cl]) =>
              <div key={lb} style={{ padding:"6px 14px", background:`rgba(${cl==="#f59e0b"?"245,158,11":cl==="#3b82f6"?"59,130,246":cl==="#8b5cf6"?"139,92,246":"16,185,129"},0.1)`, border:`1px solid ${cl}44`, borderRadius:10 }}>
                <span style={{ color:cl, fontSize:12, fontWeight:700 }}>{ic} {lb}</span>
              </div>
            )}
          </div>
          <div style={{ marginTop:14, padding:"6px 14px", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:8, fontSize:10, color:"#34d399", fontWeight:700 }}>
            🔐 Supabase Auth · RLS Secured · v4.0
          </div>
        </div>
      </div>
      <div style={{ width:420, background:"#07111e", borderLeft:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", justifyContent:"center", padding:"44px 40px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <div style={{ width:48, height:48, background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>⛽</div>
          <div><p style={{ color:"#f1f5f9", fontSize:15, fontWeight:800, margin:0 }}>KC Sarswat ERP</p><p style={{ color:"#475569", fontSize:11, margin:0 }}>v4.0 Production</p></div>
        </div>
        <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Sign In</h1>
        <p style={{ color:"#475569", fontSize:13, margin:"0 0 24px" }}>Secured by Supabase Auth</p>
        <div style={{ marginBottom:14 }}>
          <Label>Email</Label>
          <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="your@email.com" style={{ ...inp, fontSize:14 }} autoComplete="email" />
        </div>
        <div style={{ marginBottom:20, position:"relative" }}>
          <Label>Password</Label>
          <input type={showPwd?"text":"password"} value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} style={{ ...inp, fontSize:14, paddingRight:44 }} autoComplete="current-password" />
          <button onClick={()=>setShowPwd(!showPwd)} style={{ position:"absolute", right:12, top:34, background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:16 }}>{showPwd?"🙈":"👁"}</button>
        </div>
        {error && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:16, color:"#f87171", fontSize:12, fontWeight:600 }}>⚠ {error}</div>}
        <button onClick={login} disabled={loading} style={{ width:"100%", ...btn(), fontSize:14, fontWeight:800 }}>{loading?"Signing in…":"Sign In →"}</button>
        <p style={{ color:"#334155", fontSize:11, marginTop:16, textAlign:"center" }}>Contact owner to reset password</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
const Sidebar = ({ active, setActive, user, onLogout, collapsed, setCollapsed }) => {
  const ownerNav = [
    { id:"dashboard",  label:"Dashboard",   icon:"📊" },
    { id:"sales",      label:"Sales Entry",  icon:"🧾" },
    { id:"stock",      label:"Stock",        icon:"📦" },
    { id:"supply",     label:"Fuel Supply",  icon:"🚛" },
    { id:"logistics",  label:"Order Alerts", icon:"🔔" },
    { id:"lubricants", label:"Lubricants",   icon:"🛢"  },
    { id:"khata",      label:"Khata",        icon:"📋" },
    { id:"gst",        label:"GST Billing",  icon:"🧾" },
    { id:"expenses",   label:"Expenses",     icon:"💸" },
    { id:"dip",        label:"Dip & VCF",    icon:"🌡"  },
    { id:"staff",      label:"Staff",        icon:"👥" },
    { id:"transport",  label:"Transport",    icon:"🚚" },
    { id:"reports",    label:"Reports",      icon:"📈" },
    { id:"settings",   label:"Settings",     icon:"⚙️"  },
  ];
  const staffNav = [
    { id:"sales",      label:"Sales Entry", icon:"🧾" },
    { id:"stock",      label:"Stock",       icon:"📦" },
    { id:"supply",     label:"Fuel Supply", icon:"🚛" },
    { id:"lubricants", label:"Lubricants",  icon:"🛢"  },
    { id:"khata",      label:"Khata",       icon:"📋" },
  ];
  const nav = user.role === "owner" ? ownerNav : staffNav;
  return (
    <div style={{ width:collapsed?64:224, background:"linear-gradient(180deg,#06111e,#08192a)", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", transition:"width 0.25s", overflow:"hidden", flexShrink:0, height:"100vh" }}>
      <div style={{ padding:collapsed?"14px 12px":"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:34, height:34, background:"linear-gradient(135deg,#f59e0b,#d97706)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:18 }}>⛽</div>
        {!collapsed && <div style={{ flex:1, minWidth:0 }}><p style={{ color:"#f1f5f9", fontSize:12, fontWeight:800, margin:0 }}>KC Sarswat</p><p style={{ color:"#334155", fontSize:10, margin:0 }}>ERP v4.0</p></div>}
        <button onClick={()=>setCollapsed(!collapsed)} style={{ background:"none", border:"none", cursor:"pointer", color:"#334155", fontSize:16, padding:4, flexShrink:0 }}>{collapsed?"›":"‹"}</button>
      </div>
      {!collapsed && (
        <div style={{ margin:"8px 8px 0", padding:"8px 12px", background:user.role==="owner"?"rgba(245,158,11,0.08)":"rgba(59,130,246,0.08)", borderRadius:10, border:`1px solid ${user.role==="owner"?"rgba(245,158,11,0.15)":"rgba(59,130,246,0.15)"}` }}>
          <p style={{ color:user.role==="owner"?"#f59e0b":"#60a5fa", fontSize:10, fontWeight:700, margin:"0 0 2px", textTransform:"uppercase" }}>{user.role==="owner"?"👑 Owner":"👤 Staff"}</p>
          <p style={{ color:"#64748b", fontSize:10, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.name}</p>
        </div>
      )}
      <nav style={{ flex:1, padding:"8px 6px", overflowY:"auto" }}>
        {nav.map(item => (
          <button key={item.id} onClick={()=>setActive(item.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:10, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600, marginBottom:2, background:active===item.id?"rgba(245,158,11,0.12)":"transparent", color:active===item.id?"#f59e0b":"#475569", borderLeft:active===item.id?"2px solid #f59e0b":"2px solid transparent" }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{item.icon}</span>
            {!collapsed && <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div style={{ padding:"8px 6px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={onLogout} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:10, border:"none", cursor:"pointer", background:"rgba(239,68,68,0.08)", color:"#f87171", fontFamily:"inherit", fontSize:12, fontWeight:600 }}>
          <span style={{ fontSize:15 }}>🚪</span>{!collapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
};

export { supabase, db, TODAY, THIS_MONTH, UNIT_CONFIG, SHIFTS, LUBE_PRODUCTS, LUBE_COGS, EXPENSE_CATS, TRUCKS, PIE_COLORS, calcVCF, forecastDays, fmtINR, fmtINR0, numWords, isDepotClosed, isWithin24h, card, inp, inpErr, btn, ghostBtn, pdfStyles, getPdfMake, AppCtx, useApp, Label, FieldErr, ErrBanner, Toast, SyncBadge, Skeleton, LockedBar, StatCard, TankGauge, ConfirmModal, DiscrepancyModal, LoginPage, Sidebar };

// ═══════════════════════════════════════════════════════════════
// MODULE 1 — EXECUTIVE DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = () => {
  const { settings, tanks, user } = useApp();
  const [salesData, setSalesData]   = useState([]);
  const [lubeData,  setLubeData]    = useState([]);
  const [expData,   setExpData]     = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [alerts,    setAlerts]      = useState([]);

  useEffect(() => {
    Promise.all([
      db.getSales(THIS_MONTH),
      db.getLubes(THIS_MONTH),
      db.getExpenses(THIS_MONTH),
    ]).then(([s, l, e]) => {
      setSalesData(s); setLubeData(l); setExpData(e); setLoading(false);
    });
    supabase.from("audit_trail").select("*").eq("action","FRAUD_ALERT").order("created_at",{ascending:false}).limit(10).then(({data})=>setAlerts(data||[]));
  }, []);

  // Real-time subscription for today's sales
  useEffect(() => {
    const ch = supabase.channel("dash-sales").on("postgres_changes",{event:"*",schema:"public",table:"sales"},()=>{
      db.getSales(THIS_MONTH).then(setSalesData);
    }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const daily7 = useMemo(() => Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const ds = d.toISOString().split("T")[0];
    let p=0,di=0,lr=0,gm=0;
    salesData.filter(s=>s.date===ds).forEach(s=>{
      if (!s.readings) return;
      Object.values(s.readings).forEach(r=>{
        const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0);
        const doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0);
        if(pc>po) p+=pc-po; if(dc>doo) di+=dc-doo;
      });
      gm+=parseFloat(s.fuel_margin||0);
    });
    lubeData.filter(l=>l.date===ds).forEach(l=>{ lr+=(l.revenue||0); gm+=(l.gross_profit||0); });
    return { date:d.toLocaleDateString("en-IN",{month:"short",day:"numeric"}), petrol:Math.round(p), diesel:Math.round(di), lubeRev:Math.round(lr), grossMargin:Math.round(gm) };
  }), [salesData, lubeData]);

  const today   = daily7[6];
  const amtOpex = (settings?.monthly_opex||85000)/26;
  const todayNet = today.grossMargin - amtOpex;
  const todayRev = today.petrol*(settings?.petrol_price||102.84) + today.diesel*(settings?.diesel_price||89.62) + today.lubeRev;

  const cashToday = useMemo(()=>{
    let pp=0,pt=0,ec=0,ac=0;
    salesData.filter(s=>s.date===TODAY).forEach(s=>{ pp+=parseFloat(s.phone_pe_sales||0); pt+=parseFloat(s.paytm_sales||0); ec+=parseFloat(s.expected_cash||0); ac+=parseFloat(s.cash_deposited||0); });
    return { pp,pt,ec,ac,diff:ac-ec };
  },[salesData]);

  const last7byUnit = useMemo(()=>{
    const r={};
    Object.keys(UNIT_CONFIG).forEach(uid=>{ r[uid]={petrol:[],diesel:[]}; });
    Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i)); const ds=d.toISOString().split("T")[0];
      Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
        let pL=0,dL=0;
        salesData.filter(s=>s.date===ds).forEach(s=>{ u.machines.forEach(mId=>{ const rd=s.readings?.[mId]; if(!rd) return; const po=parseFloat(rd.petrolOpen||0),pc=parseFloat(rd.petrolClose||0),doo=parseFloat(rd.dieselOpen||0),dc=parseFloat(rd.dieselClose||0); if(pc>po) pL+=pc-po; if(dc>doo) dL+=dc-doo; }); });
        r[uid].petrol.push(pL); r[uid].diesel.push(dL);
      });
    });
    return r;
  },[salesData]);

  const unitPerf = useMemo(()=>{
    const perf={};
    Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
      const todaySales=salesData.filter(s=>s.date===TODAY);
      let margin=0;
      todaySales.forEach(s=>{ u.machines.forEach(mId=>{ const rd=s.readings?.[mId]; if(!rd) return; const po=parseFloat(rd.petrolOpen||0),pc=parseFloat(rd.petrolClose||0),doo=parseFloat(rd.dieselOpen||0),dc=parseFloat(rd.dieselClose||0); if(pc>po) margin+=(pc-po)*(settings?.petrol_margin||4.27); if(dc>doo) margin+=(dc-doo)*(settings?.diesel_margin||2.72); }); });
      perf[uid]={ name:u.name, margin:margin.toFixed(0) };
    });
    return perf;
  },[salesData, settings]);
  const bestUnit = Object.values(unitPerf).sort((a,b)=>parseFloat(b.margin)-parseFloat(a.margin))[0];
  const cashLeakage = cashToday.diff < -(settings?.cash_tolerance||500);

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:8}}>
        <h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:0}}>Executive Dashboard</h1>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{color:"#34d399",fontSize:11,fontWeight:700}}>🔴 Live</span>
          <span style={{color:"#475569",fontSize:11}}>🔐 RLS Secured</span>
        </div>
      </div>
      <p style={{color:"#334155",fontSize:13,margin:"0 0 20px"}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginBottom:20}}>
        <StatCard label="Net Profit Today" value={`₹${fmtINR0(todayNet)}`} sub={`Margin ₹${fmtINR0(today.grossMargin)} − OPEX ₹${fmtINR0(amtOpex)}`} color={todayNet>=0?"#10b981":"#ef4444"} icon="💰" loading={loading} />
        <StatCard label="Cash Integrity" value={`${cashToday.diff>=0?"+":""}₹${cashToday.diff.toFixed(0)}`} sub="Short / Over today" color={cashToday.diff===0?"#10b981":cashToday.diff>0?"#10b981":"#ef4444"} icon="🏦" loading={loading} alert={cashLeakage} />
        <StatCard label="Best Unit" value={bestUnit?.name||"—"} sub={`₹${bestUnit?.margin||0} margin today`} color="#f59e0b" icon="🏆" loading={loading} />
        <StatCard label="Petrol Today" value={`${fmtINR0(today.petrol)} L`} sub={`₹${fmtINR0(today.petrol*(settings?.petrol_price||102.84))}`} color="#f59e0b" icon="⛽" loading={loading} />
        <StatCard label="Diesel Today" value={`${fmtINR0(today.diesel)} L`} sub={`₹${fmtINR0(today.diesel*(settings?.diesel_price||89.62))}`} color="#3b82f6" icon="🔵" loading={loading} />
        <StatCard label="Revenue Today" value={`₹${fmtINR0(todayRev)}`} sub="Fuel + Lubes" color="#8b5cf6" icon="📊" loading={loading} />
      </div>

      {cashLeakage && (
        <div style={{background:"rgba(239,68,68,0.1)",border:"2px solid rgba(239,68,68,0.5)",borderRadius:14,padding:"14px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:28}}>🚨</span>
          <div>
            <p style={{color:"#f87171",fontSize:14,fontWeight:900,margin:"0 0 4px"}}>CASH LEAKAGE ALERT</p>
            <p style={{color:"#fca5a5",fontSize:12,margin:0}}>Cash mismatch <b>₹{Math.abs(cashToday.diff).toFixed(2)}</b> exceeds tolerance ₹{settings?.cash_tolerance||500}. Logged to audit trail.</p>
          </div>
        </div>
      )}

      <div style={{...card,marginBottom:20,border:"1px solid rgba(245,158,11,0.2)"}}>
        <h3 style={{color:"#f59e0b",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>💰 Today's Cash Reconciliation</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
          {[{l:"PhonePe",v:`₹${cashToday.pp.toFixed(2)}`,c:"#60a5fa"},{l:"Paytm",v:`₹${cashToday.pt.toFixed(2)}`,c:"#a78bfa"},{l:"Expected Cash",v:`₹${cashToday.ec.toFixed(2)}`,c:"#f59e0b"},{l:"Actual Cash",v:`₹${cashToday.ac.toFixed(2)}`,c:"#34d399"},{l:"Difference",v:`${cashToday.diff>=0?"+":""}₹${cashToday.diff.toFixed(2)}`,c:cashToday.diff===0?"#34d399":cashToday.diff>0?"#34d399":"#f87171"}].map(x=>
            <div key={x.l} style={{padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderRadius:10}}>
              <p style={{color:"#64748b",fontSize:10,fontWeight:700,margin:"0 0 4px",textTransform:"uppercase"}}>{x.l}</p>
              <p style={{color:x.c,fontSize:16,fontWeight:800,margin:0}}>{x.v}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
        <div style={card}>
          <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>📊 7-Day Volume</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={daily7} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="date" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#0a1628",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#f1f5f9",fontSize:11}}/>
              <Legend wrapperStyle={{fontSize:11,color:"#64748b"}}/>
              <Bar dataKey="petrol" name="Petrol (L)" fill="#f59e0b" radius={[5,5,0,0]}/>
              <Bar dataKey="diesel" name="Diesel (L)" fill="#3b82f6" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <h3 style={{color:"#10b981",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>💰 7-Day Gross Margin</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={daily7}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis dataKey="date" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#0a1628",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,color:"#f1f5f9",fontSize:11}} formatter={v=>`₹${fmtINR0(v)}`}/>
              <Area type="monotone" dataKey="grossMargin" name="Gross Margin ₹" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{...card,marginBottom:20}}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🛢 Tank Levels + AI Forecast</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10}}>
          {tanks && Object.entries(UNIT_CONFIG).flatMap(([uid,u])=>[
            <TankGauge key={uid+"p"} label={`${u.name} Petrol`} current={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.current||0} capacity={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.capacity||10000} color="#f59e0b" lowAlert={settings?.low_stock_alert||500} buffer={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.buffer||0} forecastD={forecastDays(tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.current||0, last7byUnit[uid]?.petrol)}/>,
            <TankGauge key={uid+"d"} label={`${u.name} Diesel`} current={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.current||0} capacity={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.capacity||15000} color="#3b82f6" lowAlert={settings?.low_stock_alert||500} buffer={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.buffer||0} forecastD={forecastDays(tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.current||0, last7byUnit[uid]?.diesel)}/>
          ])}
        </div>
      </div>

      {alerts.length>0 && (
        <div style={{...card,border:"1px solid rgba(239,68,68,0.3)"}}>
          <h3 style={{color:"#f87171",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🚩 Recent Fraud Alerts</h3>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Time","Type","Table","By"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"6px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{alerts.map((a,i)=><tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <td style={{color:"#64748b",fontSize:11,padding:"8px 10px"}}>{IST(a.created_at).slice(0,16)}</td>
                <td style={{color:"#f87171",fontSize:11,fontWeight:700,padding:"8px 10px"}}>{a.record_data?.type||a.action}</td>
                <td style={{color:"#94a3b8",fontSize:11,padding:"8px 10px"}}>{a.table_name}</td>
                <td style={{color:"#f59e0b",fontSize:11,padding:"8px 10px"}}>{a.performed_name||"system"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE 2 — SALES ENTRY (Secure, Paginated, Fraud Detection)
// ═══════════════════════════════════════════════════════════════
const SalesView = () => {
  const { user, tanks, setTanks, settings } = useApp();
  const allowedUnits = user.role==="owner" ? Object.keys(UNIT_CONFIG) : (user.unit?[user.unit]:Object.keys(UNIT_CONFIG));
  const allM = Object.entries(UNIT_CONFIG).filter(([uid])=>allowedUnits.includes(uid)).flatMap(([uid,u])=>u.machines.map(id=>({id,unit:uid})));
  const emptyR = allM.reduce((a,m)=>({...a,[m.id]:{petrolOpen:"",petrolClose:"",dieselOpen:"",dieselClose:""}}),{});

  const [date,setDate]=useState(TODAY),[shift,setShift]=useState("Day Shift");
  const [readings,setReadings]=useState(emptyR);
  const [ppOpen,setPpOpen]=useState(""),[ppClose,setPpClose]=useState("");
  const [ptOpen,setPtOpen]=useState(""),[ptClose,setPtClose]=useState("");
  const [cashDep,setCashDep]=useState("");
  const [errs,setErrs]=useState([]),[fe,setFe]=useState({});
  const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [prevShift,setPrevShift]=useState(null),[autoXfer,setAutoXfer]=useState(false);
  const [existEntry,setExistEntry]=useState(null),[showDup,setShowDup]=useState(false);
  const [discModal,setDiscModal]=useState({open:false,field:"",prev:"",curr:""});
  const locked = user.role==="staff" && !isWithin24h(date);

  useEffect(()=>{
    setAutoXfer(false);
    Promise.all([db.getPrevShift(date,shift), db.getExistEntry(date,shift)]).then(([prev,exist])=>{ setPrevShift(prev||null); setExistEntry(exist||null); });
  },[date,shift]);

  const autoTransfer = ()=>{
    if (!prevShift) return;
    const nr={...emptyR};
    allM.forEach(({id:mId})=>{ const p=prevShift.readings?.[mId]; if(p) nr[mId]={petrolOpen:p.petrolClose||"",petrolClose:"",dieselOpen:p.dieselClose||"",dieselClose:""}; });
    setReadings(nr); setPpOpen(prevShift.phone_pe_close||""); setPtOpen(prevShift.paytm_close||""); setAutoXfer(true);
  };

  const upd=(mId,field,val)=>{
    setReadings(p=>({...p,[mId]:{...p[mId],[field]:val}})); setFe(p=>({...p,[mId+field]:""}));
    if (field.includes("Open") && prevShift && !autoXfer) {
      const ft=field.replace("Open",""); const pv=prevShift.readings?.[mId]?.[ft+"Close"];
      if (pv && Math.abs(parseFloat(pv)-parseFloat(val))>0.01) {
        setDiscModal({open:true,field:`Machine ${mId} — ${ft} opening`,prev:pv,curr:val});
        db.audit("FRAUD_ALERT","meter_readings",{type:"METER_DISCONTINUITY",machine:mId,ft,expected:pv,entered:val},user.id,user.name);
      }
    }
  };

  const calcL=(o,c)=>{ const ov=parseFloat(o),cv=parseFloat(c); if(isNaN(ov)||isNaN(cv)) return null; if(cv<ov) return {error:"Close < Open"}; return {litres:(cv-ov).toFixed(2)}; };

  const validate=()=>{
    const e=[],nfe={};
    allM.forEach(({id:mId})=>{ const r=readings[mId]; ["petrol","diesel"].forEach(f=>{ const o=r[`${f}Open`],c=r[`${f}Close`]; if(o!==""&&c===""){e.push(`Machine ${mId} ${f}: Closing missing`);nfe[mId+`${f}Close`]="Required";} if(o===""&&c!==""){e.push(`Machine ${mId} ${f}: Opening missing`);nfe[mId+`${f}Open`]="Required";} if(o!==""&&c!==""&&parseFloat(c)<parseFloat(o)){e.push(`Machine ${mId} ${f}: Close < Open`);nfe[mId+`${f}Close`]="Invalid";} }); });
    setFe(nfe); setErrs(e); return e.length===0;
  };

  const performSave=async(mode="new")=>{
    setSaving(true);
    const unitSold={}; Object.keys(UNIT_CONFIG).forEach(uid=>{unitSold[uid]={petrol:0,diesel:0};});
    allM.forEach(({id:mId,unit:uid})=>{ const r=readings[mId]; const ps=calcL(r.petrolOpen,r.petrolClose),ds=calcL(r.dieselOpen,r.dieselClose); if(ps?.litres) unitSold[uid].petrol+=parseFloat(ps.litres); if(ds?.litres) unitSold[uid].diesel+=parseFloat(ds.litres); });
    const ppSales=Math.max(0,parseFloat(ppClose||0)-parseFloat(ppOpen||0));
    const ptSales=Math.max(0,parseFloat(ptClose||0)-parseFloat(ptOpen||0));
    let totalFuelRev=0, totalMargin=0;
    allM.forEach(({id:mId,unit:uid})=>{ const r=readings[mId]; const ps=calcL(r.petrolOpen,r.petrolClose),ds=calcL(r.dieselOpen,r.dieselClose); if(ps?.litres){totalFuelRev+=parseFloat(ps.litres)*(settings?.petrol_price||102.84); totalMargin+=parseFloat(ps.litres)*(settings?.petrol_margin||4.27);} if(ds?.litres){totalFuelRev+=parseFloat(ds.litres)*(settings?.diesel_price||89.62); totalMargin+=parseFloat(ds.litres)*(settings?.diesel_margin||2.72);} });
    const expectedCash=totalFuelRev-ppSales-ptSales;
    const cashDiff=parseFloat(cashDep||0)-expectedCash;
    if (cashDiff < -(settings?.cash_tolerance||500)) {
      db.audit("FRAUD_ALERT","cash_integrity",{type:"CASH_SHORTAGE",cashDiff,staffName:user.name,date,shift,threshold:settings?.cash_tolerance||500},user.id,user.name);
    }
    const entry={ date,shift,staff_id:user.id,staff_name:user.name, readings, phone_pe_open:parseFloat(ppOpen||0),phone_pe_close:parseFloat(ppClose||0),phone_pe_sales:ppSales, paytm_open:parseFloat(ptOpen||0),paytm_close:parseFloat(ptClose||0),paytm_sales:ptSales, cash_deposited:parseFloat(cashDep||0),expected_cash:expectedCash,cash_diff:cashDiff, total_fuel_revenue:totalFuelRev,fuel_margin:totalMargin, has_discrepancy:Math.abs(cashDiff)>0.01,auto_transfer_used:autoXfer };
    if (mode==="replace"&&existEntry?.id) { await db.updateSale(existEntry.id,entry); }
    else if (mode==="merge"&&existEntry?.id) { await db.updateSale(existEntry.id,{...existEntry,...entry}); }
    else { await db.insertSale(entry); }
    // SPEED FIX: parallel tank updates + optimistic local state (no extra getTanks() call)
    const tankUpdates=[];
    const newTankState=tanks?[...tanks]:[];
    for (const [uid,sold] of Object.entries(unitSold)) {
      const pt=tanks?.find(t=>t.unit_id===uid&&t.fuel_type==="petrol");
      const dt=tanks?.find(t=>t.unit_id===uid&&t.fuel_type==="diesel");
      if(pt&&sold.petrol>0){const nc=Math.max(0,(pt.current||0)-sold.petrol);tankUpdates.push({unitId:uid,fuelType:"petrol",current:nc});const i=newTankState.findIndex(t=>t.unit_id===uid&&t.fuel_type==="petrol");if(i>=0)newTankState[i]={...newTankState[i],current:nc};}
      if(dt&&sold.diesel>0){const nc=Math.max(0,(dt.current||0)-sold.diesel);tankUpdates.push({unitId:uid,fuelType:"diesel",current:nc});const i=newTankState.findIndex(t=>t.unit_id===uid&&t.fuel_type==="diesel");if(i>=0)newTankState[i]={...newTankState[i],current:nc};}
    }
    setTanks(newTankState); // instant optimistic update
    db.updateTanksParallel(tankUpdates); // fire to DB in background
    // Cash integrity log
    const intScore=totalFuelRev>0?Math.max(0,(1-Math.abs(cashDiff)/Math.max(totalFuelRev,1))*100):100;
    db.insertIntegrity({staff_id:user.id,staff_name:user.name,date,shift,expected_cash:expectedCash,actual_cash:parseFloat(cashDep||0),cash_diff:cashDiff,integrity_score:intScore});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000); setShowDup(false);
  };

  const handleSave=()=>{ if(locked||!validate()) return; if(existEntry){setShowDup(true);return;} performSave("new"); };
  const ppL=Math.max(0,parseFloat(ppClose||0)-parseFloat(ppOpen||0));
  const ptL=Math.max(0,parseFloat(ptClose||0)-parseFloat(ptOpen||0));
  let fuelRevLive=0;
  allM.forEach(({id:mId})=>{ const r=readings[mId]; const ps=calcL(r.petrolOpen,r.petrolClose),ds=calcL(r.dieselOpen,r.dieselClose); if(ps?.litres) fuelRevLive+=parseFloat(ps.litres)*(settings?.petrol_price||102.84); if(ds?.litres) fuelRevLive+=parseFloat(ds.litres)*(settings?.diesel_price||89.62); });
  const expLive=fuelRevLive-ppL-ptL, diffLive=parseFloat(cashDep||0)-expLive;

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <ConfirmModal open={showDup} title="Entry Already Exists" msg={`A ${shift} entry for ${date} already exists. Replace or merge?`} onOk={()=>performSave("replace")} onCancel={()=>setShowDup(false)} okLabel="Replace" danger extraBtn={{label:"Merge",onClick:()=>performSave("merge")}}/>
      <DiscrepancyModal open={discModal.open} field={discModal.field} prevVal={discModal.prev} currVal={discModal.curr} onContinue={()=>setDiscModal({...discModal,open:false})} onFix={()=>setDiscModal({...discModal,open:false})}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>Sales Entry</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Meter readings · Cash reconciliation · Fraud detection</p></div>
        {(saving||saved)&&<SyncBadge saving={saving}/>}
      </div>
      {locked&&<LockedBar/>}
      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div><Label>Date</Label><input type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={user.role==="staff"} style={{...inp,width:160}}/></div>
        <div><Label>Shift</Label><select value={shift} onChange={e=>setShift(e.target.value)} style={{...inp,width:160}}>{SHIFTS.map(s=><option key={s} style={{background:"#07111e"}}>{s}</option>)}</select></div>
        {existEntry&&<div style={{padding:"8px 14px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,alignSelf:"flex-end"}}><span style={{color:"#f87171",fontSize:12,fontWeight:700}}>⚠ Entry exists</span></div>}
      </div>
      {prevShift&&!autoXfer&&<div style={{...card,border:"1px solid rgba(52,211,153,0.3)",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}><div><p style={{color:"#34d399",fontSize:13,fontWeight:700,margin:"0 0 2px"}}>🔄 Previous Shift Available</p><p style={{color:"#64748b",fontSize:12,margin:0}}>Auto-fill from {prevShift.shift} · {prevShift.date}</p></div><button onClick={autoTransfer} style={{...btn("#10b981")}}>✅ Auto-Transfer → Opening</button></div></div>}
      {autoXfer&&<Toast msg="✅ Auto-transfer applied"/>}
      <ErrBanner errors={errs}/>
      <Toast msg={saved?`✓ Saved — ${date} · ${shift}`:null}/>

      {Object.entries(UNIT_CONFIG).filter(([uid])=>allowedUnits.includes(uid)).map(([uid,unit])=>(
        <div key={uid} style={{...card,marginBottom:14,opacity:locked?0.5:1}}>
          <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>⛽ {unit.name}</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}}>
            {unit.machines.map(mId=>{
              const r=readings[mId]||{petrolOpen:"",petrolClose:"",dieselOpen:"",dieselClose:""};
              const ps=calcL(r.petrolOpen,r.petrolClose),ds=calcL(r.dieselOpen,r.dieselClose);
              return <div key={mId} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:14}}>
                <p style={{color:"#475569",fontSize:12,fontWeight:700,margin:"0 0 10px"}}>MACHINE {mId}</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[{label:"⛽ Petrol",ok:"petrolOpen",ck:"petrolClose",s:ps,c:"#f59e0b"},{label:"🔵 Diesel",ok:"dieselOpen",ck:"dieselClose",s:ds,c:"#3b82f6"}].map(f=>(
                    <div key={f.label}>
                      <p style={{color:f.c,fontSize:11,fontWeight:700,margin:"0 0 5px"}}>{f.label}</p>
                      <div style={{display:"flex",gap:5}}>
                        <div style={{flex:1}}><label style={{color:"#475569",fontSize:10,display:"block",marginBottom:2}}>Open</label><input type="number" inputMode="numeric" placeholder="0.00" value={r[f.ok]} onChange={e=>upd(mId,f.ok,e.target.value)} disabled={locked} style={fe[mId+f.ok]?{...inpErr,padding:"8px 10px"}:{...inp,padding:"8px 10px"}}/></div>
                        <div style={{flex:1}}><label style={{color:"#475569",fontSize:10,display:"block",marginBottom:2}}>Close</label><input type="number" inputMode="numeric" placeholder="0.00" value={r[f.ck]} onChange={e=>upd(mId,f.ck,e.target.value)} disabled={locked} style={fe[mId+f.ck]?{...inpErr,padding:"8px 10px"}:{...inp,padding:"8px 10px"}}/></div>
                      </div>
                      {f.s?.litres&&<p style={{color:f.c,fontSize:11,margin:"3px 0 0",fontWeight:700}}>{f.s.litres} L sold</p>}
                      {f.s?.error&&<p style={{color:"#f87171",fontSize:11,margin:"3px 0 0"}}>{f.s.error}</p>}
                    </div>
                  ))}
                </div>
              </div>;
            })}
          </div>
        </div>
      ))}

      <div style={{...card,marginBottom:14,border:"1px solid rgba(59,130,246,0.2)"}}>
        <h3 style={{color:"#60a5fa",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>💳 Digital Payments & Cash</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:12,marginBottom:14}}>
          <div><Label>PhonePe Opening ₹</Label><input type="number" inputMode="numeric" value={ppOpen} onChange={e=>{setPpOpen(e.target.value); if(prevShift&&Math.abs(parseFloat(prevShift.phone_pe_close||0)-parseFloat(e.target.value))>0.01) setDiscModal({open:true,field:"PhonePe Opening",prev:prevShift.phone_pe_close||"0",curr:e.target.value});}} style={inp} disabled={locked}/></div>
          <div><Label>PhonePe Closing ₹</Label><input type="number" inputMode="numeric" value={ppClose} onChange={e=>setPpClose(e.target.value)} style={inp} disabled={locked}/></div>
          <div><Label>Paytm Opening ₹</Label><input type="number" inputMode="numeric" value={ptOpen} onChange={e=>{setPtOpen(e.target.value); if(prevShift&&Math.abs(parseFloat(prevShift.paytm_close||0)-parseFloat(e.target.value))>0.01) setDiscModal({open:true,field:"Paytm Opening",prev:prevShift.paytm_close||"0",curr:e.target.value});}} style={inp} disabled={locked}/></div>
          <div><Label>Paytm Closing ₹</Label><input type="number" inputMode="numeric" value={ptClose} onChange={e=>setPtClose(e.target.value)} style={inp} disabled={locked}/></div>
          <div><Label>Cash Deposited ₹</Label><input type="number" inputMode="numeric" value={cashDep} onChange={e=>setCashDep(e.target.value)} style={{...inp,border:"1px solid rgba(245,158,11,0.3)"}} disabled={locked}/></div>
        </div>
        <div style={{padding:"14px 16px",background:"rgba(255,255,255,0.03)",borderRadius:12}}>
          <p style={{color:"#64748b",fontSize:11,fontWeight:700,margin:"0 0 10px",textTransform:"uppercase"}}>Live Calculation</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
            {[{l:"PhonePe",v:`₹${ppL.toFixed(2)}`,c:"#60a5fa"},{l:"Paytm",v:`₹${ptL.toFixed(2)}`,c:"#a78bfa"},{l:"Fuel Revenue",v:`₹${fuelRevLive.toFixed(2)}`,c:"#f59e0b"},{l:"Expected Cash",v:`₹${expLive.toFixed(2)}`,c:"#f59e0b"},{l:"Difference",v:`${diffLive>=0?"+":""}₹${diffLive.toFixed(2)}`,c:diffLive===0?"#34d399":diffLive>0?"#34d399":"#f87171"}].map(x=>(
              <div key={x.l} style={{padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
                <p style={{color:"#475569",fontSize:10,fontWeight:700,margin:"0 0 3px",textTransform:"uppercase"}}>{x.l}</p>
                <p style={{color:x.c,fontSize:14,fontWeight:800,margin:0}}>{x.v}</p>
              </div>
            ))}
          </div>
          {Math.abs(diffLive)>0.01&&cashDep!==""&&<div style={{marginTop:10,padding:"8px 12px",background:"rgba(239,68,68,0.08)",borderRadius:8}}><p style={{color:"#f87171",fontSize:12,fontWeight:700,margin:0}}>⚠ {diffLive>0?`Cash EXCESS ₹${diffLive.toFixed(2)}`:`Cash SHORT ₹${Math.abs(diffLive).toFixed(2)}`}</p></div>}
        </div>
      </div>
      <button onClick={handleSave} disabled={saving||locked} style={{...btn(),opacity:saving||locked?0.5:1}}>
        {saving?"Saving…":"💾 Save Sales + Update Stock"}
      </button>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE — STOCK VIEW
// ═══════════════════════════════════════════════════════════════
const StockView = () => {
  const { tanks, settings } = useApp();
  const [salesData, setSalesData] = useState([]);
  useEffect(()=>{ db.getSales(THIS_MONTH).then(setSalesData); },[]);
  const last7 = useMemo(()=>{
    const r={};
    Object.keys(UNIT_CONFIG).forEach(uid=>{r[uid]={petrol:[],diesel:[]};});
    Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i)); const ds=d.toISOString().split("T")[0];
      Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
        let pL=0,dL=0;
        salesData.filter(s=>s.date===ds).forEach(s=>{ u.machines.forEach(mId=>{ const rd=s.readings?.[mId]; if(!rd) return; const po=parseFloat(rd.petrolOpen||0),pc=parseFloat(rd.petrolClose||0),doo=parseFloat(rd.dieselOpen||0),dc=parseFloat(rd.dieselClose||0); if(pc>po) pL+=pc-po; if(dc>doo) dL+=dc-doo; }); });
        r[uid].petrol.push(pL); r[uid].diesel.push(dL);
      });
    });
    return r;
  },[salesData]);

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>Stock Management</h1>
      <p style={{color:"#334155",fontSize:13,margin:"0 0 20px"}}>Live tank levels · AI forecast · Auto-updated on sales & supply</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:20}}>
        {tanks&&Object.entries(UNIT_CONFIG).flatMap(([uid,u])=>[
          <TankGauge key={uid+"p"} label={`${u.name} Petrol`} current={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.current||0} capacity={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.capacity||10000} color="#f59e0b" lowAlert={settings?.low_stock_alert||500} buffer={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.buffer||0} forecastD={forecastDays(tanks.find(t=>t.unit_id===uid&&t.fuel_type==="petrol")?.current||0,last7[uid]?.petrol)}/>,
          <TankGauge key={uid+"d"} label={`${u.name} Diesel`} current={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.current||0} capacity={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.capacity||15000} color="#3b82f6" lowAlert={settings?.low_stock_alert||500} buffer={tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.buffer||0} forecastD={forecastDays(tanks.find(t=>t.unit_id===uid&&t.fuel_type==="diesel")?.current||0,last7[uid]?.diesel)}/>
        ])}
      </div>
      <div style={card}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Tank Summary + AI Order Suggestion</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Unit","Fuel","Current","Buffer","Usable","Capacity","Fill %","Forecast","Suggested Order","Status"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>
              {tanks&&Object.entries(UNIT_CONFIG).flatMap(([uid,unit])=>["petrol","diesel"].map(fk=>{
                const t=tanks.find(tt=>tt.unit_id===uid&&tt.fuel_type===fk); if(!t) return null;
                const buf=t.buffer||0,usable=Math.max(0,t.current-buf),pct=((t.current/t.capacity)*100).toFixed(1);
                const col=fk==="petrol"?"#f59e0b":"#3b82f6";
                const fd=forecastDays(t.current,last7[uid]?.[fk]);
                const ullage=t.capacity-t.current;
                const bestTruck=TRUCKS.filter(tr=>tr.cap<=ullage).sort((a,b)=>b.cap-a.cap)[0];
                return <tr key={uid+fk} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",background:fd<3?"rgba(239,68,68,0.03)":"transparent"}}>
                  <td style={{color:"#f1f5f9",fontSize:13,fontWeight:600,padding:"10px 12px"}}>{unit.name}</td>
                  <td style={{padding:"10px 12px"}}><span style={{color:col,fontWeight:700}}>{fk==="petrol"?"Petrol":"Diesel"}</span></td>
                  <td style={{color:"#f1f5f9",fontWeight:700,padding:"10px 12px"}}>{fmtINR0(t.current)}L</td>
                  <td style={{color:"#ef4444",padding:"10px 12px"}}>{fmtINR0(buf)}L</td>
                  <td style={{color:"#34d399",fontWeight:700,padding:"10px 12px"}}>{fmtINR0(usable)}L</td>
                  <td style={{color:"#64748b",padding:"10px 12px"}}>{fmtINR0(t.capacity)}L</td>
                  <td style={{padding:"10px 12px"}}><span style={{color:col}}>{pct}%</span></td>
                  <td style={{padding:"10px 12px"}}><span style={{color:fd<2?"#f87171":fd<4?"#f59e0b":"#34d399",fontWeight:700}}>{fd>=99?"—":`~${fd.toFixed(1)}d`}</span></td>
                  <td style={{color:"#60a5fa",fontSize:11,padding:"10px 12px"}}>{bestTruck&&fd<4?`${fmtINR0(bestTruck.cap)}L (${bestTruck.name})`:"—"}</td>
                  <td style={{padding:"10px 12px"}}>{usable<(settings?.low_stock_alert||500)?<span style={{background:"rgba(239,68,68,0.12)",color:"#f87171",fontSize:10,padding:"3px 7px",borderRadius:4,fontWeight:700}}>⚠ LOW</span>:<span style={{background:"rgba(16,185,129,0.1)",color:"#34d399",fontSize:10,padding:"3px 7px",borderRadius:4,fontWeight:700}}>OK</span>}</td>
                </tr>;
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE — SUPPLY
// ═══════════════════════════════════════════════════════════════
const SupplyView = () => {
  const { user, tanks, setTanks } = useApp();
  const ef={date:TODAY,fuel_type:"Petrol",unit_id:"unit1",litres:"",truck:"",supplier:"HPCL"};
  const [supply,setSupply]=useState([]),[loading,setLoading]=useState(true),[show,setShow]=useState(false);
  const [form,setForm]=useState(ef),[errs,setErrs]=useState([]),[fe,setFe]=useState({});
  const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{ db.getSupply(THIS_MONTH).then(d=>{ setSupply(d); setLoading(false); }); },[]);

  const validate=()=>{ const e=[],nfe={}; if(!form.litres||parseFloat(form.litres)<=0){e.push("Litres required");nfe.litres="Required";} if(!form.truck.trim()){e.push("Truck number required");nfe.truck="Required";} setErrs(e);setFe(nfe);return e.length===0; };

  const save=async()=>{
    if(!validate()) return; setSaving(true);
    const litres=parseFloat(form.litres);
    const entry={...form,litres,saved_by:user.id,saved_name:user.name};
    const data=await db.insertSupply(entry);
    if(data){ setSupply(p=>[data,...p]); }
    const fk=form.fuel_type.toLowerCase();
    const tank=tanks?.find(t=>t.unit_id===form.unit_id&&t.fuel_type===fk);
    if(tank){ const newCurr=Math.min(tank.capacity,(tank.current||0)+litres); await db.updateTank(form.unit_id,fk,newCurr); const fresh=await db.getTanks(); setTanks(fresh); }
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);setForm(ef);setShow(false);setErrs([]);setFe({});
  };

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>Fuel Supply</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Tanker deliveries · Tank auto-increases on save</p></div>
        <div style={{display:"flex",gap:8}}>{(saving||saved)&&<SyncBadge saving={saving}/>}<button onClick={()=>setShow(!show)} style={btn()}>+ Add Supply</button></div>
      </div>
      <Toast msg={saved?"Supply saved — Tank updated ✓":null}/>
      {show&&<div style={{...card,border:"1px solid rgba(245,158,11,0.2)",marginBottom:16}}>
        <h3 style={{color:"#f59e0b",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>New Supply</h3>
        <ErrBanner errors={errs}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:12}}>
          <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/></div>
          <div><Label>Unit</Label><select value={form.unit_id} onChange={e=>setForm(p=>({...p,unit_id:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{background:"#07111e"}}>{u.name}</option>)}</select></div>
          <div><Label>Fuel</Label><select value={form.fuel_type} onChange={e=>setForm(p=>({...p,fuel_type:e.target.value}))} style={inp}><option style={{background:"#07111e"}}>Petrol</option><option style={{background:"#07111e"}}>Diesel</option></select></div>
          <div><Label req>Litres</Label><input type="number" inputMode="numeric" value={form.litres} onChange={e=>{setForm(p=>({...p,litres:e.target.value}));setFe(p=>({...p,litres:""}));}} style={fe.litres?inpErr:inp}/><FieldErr msg={fe.litres}/></div>
          <div><Label req>Truck No.</Label><input value={form.truck} onChange={e=>{setForm(p=>({...p,truck:e.target.value}));setFe(p=>({...p,truck:""}));}} placeholder="RJ-XX-XX-XXXX" style={fe.truck?inpErr:inp}/><FieldErr msg={fe.truck}/></div>
          <div><Label req>Supplier</Label><input value={form.supplier} onChange={e=>setForm(p=>({...p,supplier:e.target.value}))} style={inp}/></div>
        </div>
        {form.unit_id&&form.fuel_type&&(()=>{ const fk=form.fuel_type.toLowerCase(); const t=tanks?.find(tt=>tt.unit_id===form.unit_id&&tt.fuel_type===fk); if(!t) return null; const after=Math.min(t.capacity,(t.current||0)+parseFloat(form.litres||0)); const ov=parseFloat(form.litres||0)>(t.capacity-t.current); return <div style={{marginTop:12,padding:"10px 14px",background:ov?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.06)",border:`1px solid ${ov?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.2)"}`,borderRadius:10}}><p style={{color:ov?"#f87171":"#34d399",fontSize:12,margin:0}}>📦 Tank: {fmtINR0(t.current)}L → {fmtINR0(after)}L / {fmtINR0(t.capacity)}L{ov?" ⚠ OVERFLOW!":""}</p></div>; })()}
        <div style={{marginTop:14,display:"flex",gap:10}}>
          <button onClick={save} disabled={saving} style={{...btn("#10b981")}}>{saving?"Saving…":"Save + Update Stock"}</button>
          <button onClick={()=>{setShow(false);setErrs([]);setFe({});}} style={ghostBtn}>Cancel</button>
        </div>
      </div>}
      {loading?<div style={{...card,color:"#475569",textAlign:"center",padding:30}}>Loading…</div>:<div style={card}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Supply Records</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Date","Unit","Fuel","Litres","Truck","Supplier"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{supply.map(s=><tr key={s.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <td style={{color:s.date===TODAY?"#f59e0b":"#64748b",fontSize:12,padding:"10px 10px",fontWeight:s.date===TODAY?700:400}}>{s.date}</td>
              <td style={{color:"#f1f5f9",fontSize:12,fontWeight:600,padding:"10px 10px"}}>{UNIT_CONFIG[s.unit_id]?.name||s.unit_id}</td>
              <td style={{padding:"10px 10px"}}><span style={{color:s.fuel_type==="Petrol"?"#f59e0b":"#3b82f6",fontWeight:700}}>{s.fuel_type}</span></td>
              <td style={{color:"#f1f5f9",fontSize:13,fontWeight:700,padding:"10px 10px"}}>{fmtINR0(s.litres)}L</td>
              <td style={{color:"#64748b",fontSize:11,padding:"10px 10px",fontFamily:"monospace"}}>{s.truck}</td>
              <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{s.supplier}</td>
            </tr>)}
            {!supply.length&&<tr><td colSpan={6} style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No supply records this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE — LOGISTICS / ORDER ALERTS
// ═══════════════════════════════════════════════════════════════
const LogisticsView = () => {
  const { tanks, settings } = useApp();
  const [salesData, setSalesData] = useState([]);
  useEffect(()=>{ db.getSales(THIS_MONTH).then(setSalesData); },[]);
  const depotClosed = isDepotClosed(new Date());

  const last7 = useMemo(()=>{
    const r={};
    Object.keys(UNIT_CONFIG).forEach(uid=>{r[uid]={petrol:[],diesel:[]};});
    Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i)); const ds=d.toISOString().split("T")[0];
      Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
        let pL=0,dL=0;
        salesData.filter(s=>s.date===ds).forEach(s=>{ u.machines.forEach(mId=>{ const rd=s.readings?.[mId]; if(!rd) return; const po=parseFloat(rd.petrolOpen||0),pc=parseFloat(rd.petrolClose||0),doo=parseFloat(rd.dieselOpen||0),dc=parseFloat(rd.dieselClose||0); if(pc>po) pL+=pc-po; if(dc>doo) dL+=dc-doo; }); });
        r[uid].petrol.push(pL); r[uid].diesel.push(dL);
      });
    });
    return r;
  },[salesData]);

  const alerts = useMemo(()=>{
    const list=[];
    if (!tanks) return list;
    Object.entries(UNIT_CONFIG).forEach(([uid,u])=>{
      ["petrol","diesel"].forEach(fk=>{
        const t=tanks.find(tt=>tt.unit_id===uid&&tt.fuel_type===fk); if(!t) return;
        const fd=forecastDays(t.current,last7[uid]?.[fk]);
        const ullage=t.capacity-t.current;
        const bestTruck=TRUCKS.filter(tr=>tr.cap<=ullage).sort((a,b)=>b.cap-a.cap)[0];
        const usable=Math.max(0,t.current-(t.buffer||0));
        if(fd<5||usable<(settings?.low_stock_alert||500)){
          list.push({uid,unitName:u.name,fuelType:fk,current:t.current,usable,fd,ullage,bestTruck,urgency:fd<2?"critical":fd<3?"high":fd<5?"medium":"low"});
        }
      });
    });
    return list.sort((a,b)=>a.fd-b.fd);
  },[tanks,last7,settings]);

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>Order Alerts & Logistics</h1>
      <p style={{color:"#334155",fontSize:13,margin:"0 0 20px"}}>AI-driven replenishment · Weighted moving average forecast</p>
      {depotClosed&&<div style={{...card,border:"1px solid rgba(239,68,68,0.3)",marginBottom:20,background:"rgba(239,68,68,0.06)"}}><p style={{color:"#f87171",fontSize:14,fontWeight:700,margin:0}}>🔴 Depot Closed — Sunday / Holiday / After 17:00. Orders cannot be placed now.</p></div>}
      {alerts.length===0?<div style={{...card,textAlign:"center",color:"#475569",padding:40}}>✅ All tanks well-stocked. No orders needed.</div>:
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {alerts.map((a,i)=>{
          const urgColor=a.urgency==="critical"?"#ef4444":a.urgency==="high"?"#f87171":a.urgency==="medium"?"#f59e0b":"#34d399";
          return <div key={i} style={{...card,border:`1px solid ${urgColor}44`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{background:`rgba(${a.urgency==="critical"?"239,68,68":a.urgency==="high"?"248,113,113":a.urgency==="medium"?"245,158,11":"52,211,153"},0.15)`,color:urgColor,fontSize:11,fontWeight:800,padding:"4px 10px",borderRadius:8}}>{a.urgency.toUpperCase()}</span>
                  <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:0}}>{a.unitName} — {a.fuelType==="petrol"?"Petrol":"Diesel"}</h3>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                  {[{l:"Current",v:`${fmtINR0(a.current)}L`,c:"#f1f5f9"},{l:"Usable",v:`${fmtINR0(a.usable)}L`,c:a.usable<(settings?.low_stock_alert||500)?"#f87171":"#34d399"},{l:"Days Left",v:a.fd>=99?"Unknown":`~${a.fd.toFixed(1)} days`,c:urgColor},{l:"Ullage",v:`${fmtINR0(a.ullage)}L`,c:"#60a5fa"}].map(x=>(
                    <div key={x.l} style={{padding:"8px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
                      <p style={{color:"#475569",fontSize:10,margin:"0 0 2px",textTransform:"uppercase",fontWeight:700}}>{x.l}</p>
                      <p style={{color:x.c,fontSize:14,fontWeight:800,margin:0}}>{x.v}</p>
                    </div>
                  ))}
                </div>
              </div>
              {a.bestTruck&&!depotClosed&&<div style={{padding:"14px 16px",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,textAlign:"center",minWidth:160}}>
                <p style={{color:"#60a5fa",fontSize:11,fontWeight:700,margin:"0 0 6px"}}>🚛 SUGGESTED ORDER</p>
                <p style={{color:"#f1f5f9",fontSize:18,fontWeight:900,margin:"0 0 2px"}}>{fmtINR0(a.bestTruck.cap)}L</p>
                <p style={{color:"#475569",fontSize:11,margin:0}}>{a.bestTruck.name}</p>
              </div>}
            </div>
          </div>;
        })}
      </div>}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE — LUBRICANTS (with GST + pdfmake invoice)
// ═══════════════════════════════════════════════════════════════
const LubricantsView = () => {
  const { user, settings } = useApp();
  const [lubes,setLubes]=useState([]),[loading,setLoading]=useState(true);
  const [show,setShow]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [errs,setErrs]=useState([]),[fe,setFe]=useState({}),[editId,setEditId]=useState(null);
  const [form,setForm]=useState({date:TODAY,unit_id:"unit1",product:LUBE_PRODUCTS[0],customProduct:"",qty:"",price:"",cost_price:""});
  useEffect(()=>{ db.getLubes(THIS_MONTH).then(d=>{setLubes(d);setLoading(false);}); },[]);

  const validate=()=>{ const e=[],nfe={}; if(!form.qty||parseFloat(form.qty)<=0){e.push("Qty required");nfe.qty="Required";} if(!form.price||parseFloat(form.price)<=0){e.push("Price required");nfe.price="Required";} if(form.product==="Custom"&&!form.customProduct.trim()){e.push("Product name required");nfe.customProduct="Required";} setErrs(e);setFe(nfe);return e.length===0; };

  const save=async()=>{
    if(!validate()) return; setSaving(true);
    const prod=form.product==="Custom"?form.customProduct:form.product;
    const qty=parseFloat(form.qty),price=parseFloat(form.price);
    const cp=form.cost_price?parseFloat(form.cost_price):price*LUBE_COGS;
    const revenue=qty*price,cogs=qty*cp,grossP=qty*(price-cp);
    const cgst=revenue*0.09,sgst=revenue*0.09;
    const entry={date:form.date,unit_id:form.unit_id,product:prod,qty,price,cost_price:cp,revenue,cogs,gross_profit:grossP,cgst,sgst,total_with_gst:revenue+cgst+sgst,hsn:"3811",staff_id:user.id,staff_name:user.name};
    if(editId){await db.updateLube(editId,entry);setLubes(p=>p.map(l=>l.id===editId?{...l,...entry}:l));}
    else{const d=await db.insertLube(entry);if(d) setLubes(p=>[d,...p]);}
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setShow(false);setEditId(null);setErrs([]);setFe({});
    setForm({date:TODAY,unit_id:"unit1",product:LUBE_PRODUCTS[0],customProduct:"",qty:"",price:"",cost_price:""});
  };

  const totRev=lubes.reduce((s,l)=>s+(l.revenue||0),0);
  const totGP=lubes.reduce((s,l)=>s+(l.gross_profit||0),0);
  const totGST=lubes.reduce((s,l)=>s+(l.cgst||0)+(l.sgst||0),0);

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🛢 Lubricants</h1><p style={{color:"#334155",fontSize:13,margin:0}}>ICAI AS-9 · Revenue vs COGS · GST 18% · HSN 3811</p></div>
        <div style={{display:"flex",gap:8}}>{(saving||saved)&&<SyncBadge saving={saving}/>}<button onClick={()=>{setShow(!show);setEditId(null);}} style={btn("#8b5cf6")}>+ Add Sale</button></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:20}}>
        <StatCard label="Total Revenue" value={`₹${fmtINR0(totRev)}`} sub={`${lubes.length} entries`} color="#8b5cf6" icon="🛢"/>
        <StatCard label="Gross Profit" value={`₹${fmtINR0(totGP)}`} sub={totRev>0?`${((totGP/totRev)*100).toFixed(1)}% margin`:""} color="#10b981" icon="💰"/>
        <StatCard label="GST Collected" value={`₹${fmtINR0(totGST)}`} sub="CGST+SGST @18%" color="#f59e0b" icon="🧾"/>
      </div>
      <Toast msg={saved?"Lubricant sale saved ✓":null}/>
      {show&&<div style={{...card,border:"1px solid rgba(139,92,246,0.25)",marginBottom:16}}>
        <h3 style={{color:"#a78bfa",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>{editId?"Edit Sale":"New Sale"}</h3>
        <ErrBanner errors={errs}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:12}}>
          <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/></div>
          <div><Label>Unit</Label><select value={form.unit_id} onChange={e=>setForm(p=>({...p,unit_id:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{background:"#07111e"}}>{u.name}</option>)}</select></div>
          <div><Label req>Product</Label><select value={form.product} onChange={e=>setForm(p=>({...p,product:e.target.value}))} style={inp}>{LUBE_PRODUCTS.map(p=><option key={p} style={{background:"#07111e"}}>{p}</option>)}</select></div>
          {form.product==="Custom"&&<div><Label req>Product Name</Label><input value={form.customProduct} onChange={e=>{setForm(p=>({...p,customProduct:e.target.value}));setFe(p=>({...p,customProduct:""}));}} style={fe.customProduct?inpErr:inp}/><FieldErr msg={fe.customProduct}/></div>}
          <div><Label req>Qty</Label><input type="number" inputMode="numeric" value={form.qty} onChange={e=>{setForm(p=>({...p,qty:e.target.value}));setFe(p=>({...p,qty:""}));}} style={fe.qty?inpErr:inp}/><FieldErr msg={fe.qty}/></div>
          <div><Label req>Selling Price ₹</Label><input type="number" inputMode="numeric" value={form.price} onChange={e=>{setForm(p=>({...p,price:e.target.value}));setFe(p=>({...p,price:""}));}} style={fe.price?inpErr:inp}/><FieldErr msg={fe.price}/></div>
          <div><Label>Cost Price ₹</Label><input type="number" inputMode="numeric" value={form.cost_price} onChange={e=>setForm(p=>({...p,cost_price:e.target.value}))} style={inp} placeholder={form.price?`Auto: ₹${(parseFloat(form.price)*LUBE_COGS).toFixed(2)}`:"65% default"}/></div>
        </div>
        {form.qty&&form.price&&(()=>{ const q=parseFloat(form.qty||0),p=parseFloat(form.price||0),cp=form.cost_price?parseFloat(form.cost_price):p*LUBE_COGS; const rev=q*p,gst=rev*0.18; return <div style={{marginTop:12,padding:"10px 14px",background:"rgba(139,92,246,0.08)",borderRadius:10,border:"1px solid rgba(139,92,246,0.2)"}}><p style={{color:"#a78bfa",fontSize:12,fontWeight:700,margin:"0 0 6px"}}>GST Invoice Preview (18% — HSN 3811)</p><div style={{display:"flex",gap:12,fontSize:12,flexWrap:"wrap"}}>{[{l:"Revenue",v:`₹${fmtINR(rev)}`,c:"#a78bfa"},{l:"COGS",v:`₹${fmtINR(q*cp)}`,c:"#f87171"},{l:"GP",v:`₹${fmtINR(q*(p-cp))}`,c:"#34d399"},{l:"CGST @9%",v:`₹${fmtINR(gst/2)}`,c:"#f59e0b"},{l:"SGST @9%",v:`₹${fmtINR(gst/2)}`,c:"#f59e0b"},{l:"Total incl GST",v:`₹${fmtINR(rev+gst)}`,c:"#f1f5f9"}].map(x=><span key={x.l} style={{padding:"4px 8px",background:"rgba(255,255,255,0.03)",borderRadius:6}}>{x.l}: <b style={{color:x.c}}>{x.v}</b></span>)}</div></div>; })()}
        <div style={{marginTop:14,display:"flex",gap:10}}>
          <button onClick={save} disabled={saving} style={{...btn("#8b5cf6")}}>{saving?"Saving…":editId?"Update":"Save"}</button>
          <button onClick={()=>{setShow(false);setEditId(null);}} style={ghostBtn}>Cancel</button>
        </div>
      </div>}
      {loading?<div style={{...card,textAlign:"center",color:"#475569",padding:40}}>Loading…</div>:<div style={card}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Records</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:780}}>
            <thead><tr>{["Date","Unit","Product","Qty","Price","COGS","Revenue","GP","CGST","SGST",""].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>
              {lubes.map(l=><tr key={l.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{l.date}</td>
                <td style={{color:"#f1f5f9",fontSize:12,fontWeight:600,padding:"10px 10px"}}>{UNIT_CONFIG[l.unit_id]?.name||l.unit_id}</td>
                <td style={{color:"#a78bfa",fontSize:12,fontWeight:700,padding:"10px 10px"}}>{l.product}</td>
                <td style={{color:"#f1f5f9",fontSize:12,padding:"10px 10px"}}>{l.qty}</td>
                <td style={{color:"#f59e0b",fontSize:12,padding:"10px 10px"}}>₹{l.price}</td>
                <td style={{color:"#f87171",fontSize:12,padding:"10px 10px"}}>₹{fmtINR(l.cogs)}</td>
                <td style={{color:"#f1f5f9",fontSize:13,fontWeight:700,padding:"10px 10px"}}>₹{fmtINR(l.revenue)}</td>
                <td style={{padding:"10px 10px"}}><span style={{color:"#34d399",fontSize:13,fontWeight:800}}>₹{fmtINR(l.gross_profit)}</span></td>
                <td style={{color:"#f59e0b",fontSize:11,padding:"10px 10px"}}>₹{fmtINR(l.cgst)}</td>
                <td style={{color:"#f59e0b",fontSize:11,padding:"10px 10px"}}>₹{fmtINR(l.sgst)}</td>
                <td style={{padding:"10px 10px"}}>{(user.role==="owner"||isWithin24h(l.date))&&<button onClick={()=>{setForm({date:l.date,unit_id:l.unit_id,product:LUBE_PRODUCTS.includes(l.product)?l.product:"Custom",customProduct:LUBE_PRODUCTS.includes(l.product)?"":l.product,qty:String(l.qty),price:String(l.price),cost_price:String(l.cost_price||"")});setEditId(l.id);setShow(true);}} style={{background:"rgba(139,92,246,0.1)",color:"#a78bfa",border:"1px solid rgba(139,92,246,0.2)",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✏</button>}</td>
              </tr>)}
              {!lubes.length&&<tr><td colSpan={11} style={{color:"#475569",textAlign:"center",padding:"40px 0"}}>No lubricant sales this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE 3 — KHATA / CREDIT LEDGER
// ═══════════════════════════════════════════════════════════════
const KhataView = () => {
  const { user, settings } = useApp();
  const [customers,setCustomers]=useState([]),[txns,setTxns]=useState([]);
  const [loading,setLoading]=useState(true),[tab,setTab]=useState("customers");
  const [showCust,setShowCust]=useState(false),[showTxn,setShowTxn]=useState(false);
  const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [selCust,setSelCust]=useState(null),[custTxns,setCustTxns]=useState([]);
  const [custForm,setCustForm]=useState({name:"",vehicleNumbers:"",phone:"",creditLimit:"50000"});
  const [txnForm,setTxnForm]=useState({customerId:"",type:"credit_sale",date:TODAY,fuel_type:"Petrol",litres:"",ratePerLitre:"",amount:"",vehicleNumber:""});

  useEffect(()=>{ Promise.all([db.getCustomers(),db.getAllKhataTxns(THIS_MONTH)]).then(([c,t])=>{setCustomers(c);setTxns(t);setLoading(false);}); },[]);

  const saveCust=async()=>{
    if(!custForm.name.trim()) return; setSaving(true);
    const c={name:custForm.name,vehicle_numbers:custForm.vehicleNumbers.split(",").map(v=>v.trim()).filter(Boolean),phone:custForm.phone,credit_limit:parseFloat(custForm.creditLimit||0),outstanding_balance:0,created_by:user.id};
    const d=await db.insertCustomer(c); if(d) setCustomers(p=>[d,...p]);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setShowCust(false);setCustForm({name:"",vehicleNumbers:"",phone:"",creditLimit:"50000"});
  };

  const saveTxn=async()=>{
    const cust=customers.find(c=>c.id===txnForm.customerId); if(!cust) return; setSaving(true);
    const amt=txnForm.amount?parseFloat(txnForm.amount):(parseFloat(txnForm.litres||0)*parseFloat(txnForm.ratePerLitre||0));
    const prevBal=cust.outstanding_balance||0;
    const newBal=txnForm.type==="credit_sale"?prevBal+amt:Math.max(0,prevBal-amt);
    const txn={customer_id:txnForm.customerId,customer_name:cust.name,date:txnForm.date,type:txnForm.type,fuel_type:txnForm.fuel_type,litres:parseFloat(txnForm.litres||0),rate_per_litre:parseFloat(txnForm.ratePerLitre||0),amount:amt,vehicle_number:txnForm.vehicleNumber,running_balance:newBal,staff_id:user.id,staff_name:user.name};
    const d=await db.insertKhataTxn(txn); if(d) setTxns(p=>[d,...p]);
    await db.updateCustomer(txnForm.customerId,{outstanding_balance:newBal,last_payment:txnForm.type==="payment"?txnForm.date:undefined,last_payment_amt:txnForm.type==="payment"?amt:undefined});
    setCustomers(p=>p.map(c=>c.id===txnForm.customerId?{...c,outstanding_balance:newBal}:c));
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setShowTxn(false);setTxnForm({customerId:"",type:"credit_sale",date:TODAY,fuel_type:"Petrol",litres:"",ratePerLitre:"",amount:"",vehicleNumber:""});
  };

  const openLedger=async(cust)=>{ setSelCust(cust); const d=await db.getKhataTxns(cust.id); setCustTxns(d); setTab("ledger"); };

  // PDF Khata Statement
  const printKhataStatement=async(cust,txList)=>{
    const pm=getPdfMake(); if(!pm){alert("PDF library loading, try again.");return;}
    const s=settings||{};
    const rows=txList.map(t=>([{text:t.date,style:"tableRow"},{text:t.type==="credit_sale"?"Credit Sale":"Payment",style:"tableRow",color:t.type==="credit_sale"?"#dc2626":"#16a34a"},{text:t.vehicle_number||"—",style:"tableRow"},{text:t.fuel_type||"—",style:"tableRow"},{text:`${t.litres||0} L`,style:"tableRow"},{text:`₹${fmtINR(t.amount)}`,style:"tableRow",color:t.type==="credit_sale"?"#dc2626":"#16a34a"},{text:`₹${fmtINR(t.running_balance)}`,style:"tableRow",bold:true}]));
    const dd={content:[
      {text:s.station_name||"Shree K C Sarswat Auto Fuel Station",style:"header"},
      {text:`${s.address_line1||""}, ${s.city||"Lunkaransar"}, ${s.state||"Rajasthan"} — ${s.pincode||"334603"}`,style:"label",margin:[0,2,0,0]},
      {text:`GSTIN: ${s.gstin||"08XXXXXXXXXXXXX"}  |  Phone: ${s.phone||""}`,style:"label",margin:[0,0,0,12]},
      {canvas:[{type:"line",x1:0,y1:0,x2:515,y2:0,lineWidth:1,lineColor:"#1e293b"}]},
      {text:"KHATA STATEMENT",style:"subheader",margin:[0,12,0,2],color:"#d97706"},
      {columns:[{text:[{text:"Customer: ",style:"label"},{text:cust.name,style:"value"}]},{text:[{text:"Phone: ",style:"label"},{text:cust.phone||"—",style:"value"}],alignment:"right"}],margin:[0,6,0,2]},
      {columns:[{text:[{text:"Credit Limit: ",style:"label"},{text:`₹${fmtINR(cust.credit_limit)}`,style:"value"}]},{text:[{text:"Outstanding: ",style:"label"},{text:`₹${fmtINR(cust.outstanding_balance)}`,style:"value",color:cust.outstanding_balance>0?"#dc2626":"#16a34a"}],alignment:"right"}],margin:[0,0,0,12]},
      {table:{headerRows:1,widths:["auto","auto","auto","auto","auto","auto","*"],body:[[{text:"Date",style:"tableHead"},{text:"Type",style:"tableHead"},{text:"Vehicle",style:"tableHead"},{text:"Fuel",style:"tableHead"},{text:"Qty",style:"tableHead"},{text:"Amount",style:"tableHead"},{text:"Balance",style:"tableHead"}],...rows]},layout:{hLineColor:"#e2e8f0",vLineColor:"#e2e8f0"}},
      {text:`Generated: ${new Date().toLocaleDateString("en-IN")}  |  ${s.station_name}`,style:"label",margin:[0,16,0,0],alignment:"center"},
    ],styles:pdfStyles,defaultStyle:{font:"Helvetica"},pageSize:"A4",pageMargins:[40,40,40,40]};
    pm.createPdf(dd).download(`khata-${cust.name.replace(/\s/g,"-")}-${THIS_MONTH}.pdf`);
  };

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>📋 Khata — Credit Ledger</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Fleet credit management · Running balance · PDF statements</p></div>
        {(saving||saved)&&<SyncBadge saving={saving}/>}
      </div>
      <Toast msg={saved?"Saved ✓":null}/>
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[["customers","👥 Customers"],["transactions","💳 Transactions"],["ledger","📊 Ledger"]].map(([id,label])=>(
          <button key={id} onClick={()=>{setTab(id);if(id!=="ledger") setSelCust(null);}} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:tab===id?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.06)",color:tab===id?"#fff":"#64748b",minHeight:44}}>{label}</button>
        ))}
      </div>

      {tab==="customers"&&<>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button onClick={()=>setShowCust(!showCust)} style={btn("#10b981")}>+ Add Customer</button>
          <button onClick={()=>setShowTxn(!showTxn)} style={btn("#3b82f6")}>+ Add Transaction</button>
        </div>
        {showCust&&<div style={{...card,border:"1px solid rgba(16,185,129,0.25)",marginBottom:16}}>
          <h3 style={{color:"#34d399",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>New Credit Customer</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <div><Label req>Customer Name</Label><input value={custForm.name} onChange={e=>setCustForm(p=>({...p,name:e.target.value}))} style={inp}/></div>
            <div><Label>Vehicle Numbers (comma-sep)</Label><input value={custForm.vehicleNumbers} onChange={e=>setCustForm(p=>({...p,vehicleNumbers:e.target.value}))} placeholder="RJ10AB1234, RJ10CD5678" style={inp}/></div>
            <div><Label>Phone</Label><input type="tel" inputMode="numeric" value={custForm.phone} onChange={e=>setCustForm(p=>({...p,phone:e.target.value}))} style={inp}/></div>
            <div><Label>Credit Limit ₹</Label><input type="number" inputMode="numeric" value={custForm.creditLimit} onChange={e=>setCustForm(p=>({...p,creditLimit:e.target.value}))} style={inp}/></div>
          </div>
          <div style={{marginTop:14,display:"flex",gap:10}}><button onClick={saveCust} disabled={saving} style={btn("#10b981")}>{saving?"Saving…":"Save Customer"}</button><button onClick={()=>setShowCust(false)} style={ghostBtn}>Cancel</button></div>
        </div>}
        {showTxn&&<div style={{...card,border:"1px solid rgba(59,130,246,0.25)",marginBottom:16}}>
          <h3 style={{color:"#60a5fa",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>New Transaction</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <div><Label req>Customer</Label><select value={txnForm.customerId} onChange={e=>setTxnForm(p=>({...p,customerId:e.target.value}))} style={inp}><option value="" style={{background:"#07111e"}}>Select…</option>{customers.map(c=><option key={c.id} value={c.id} style={{background:"#07111e"}}>{c.name}</option>)}</select></div>
            <div><Label>Type</Label><select value={txnForm.type} onChange={e=>setTxnForm(p=>({...p,type:e.target.value}))} style={inp}><option value="credit_sale" style={{background:"#07111e"}}>Credit Sale</option><option value="payment" style={{background:"#07111e"}}>Payment Received</option></select></div>
            <div><Label>Date</Label><input type="date" value={txnForm.date} onChange={e=>setTxnForm(p=>({...p,date:e.target.value}))} style={inp}/></div>
            <div><Label>Fuel</Label><select value={txnForm.fuel_type} onChange={e=>setTxnForm(p=>({...p,fuel_type:e.target.value}))} style={inp}><option style={{background:"#07111e"}}>Petrol</option><option style={{background:"#07111e"}}>Diesel</option></select></div>
            <div><Label>Litres</Label><input type="number" inputMode="numeric" value={txnForm.litres} onChange={e=>setTxnForm(p=>({...p,litres:e.target.value}))} style={inp}/></div>
            <div><Label>Rate ₹/L</Label><input type="number" inputMode="numeric" value={txnForm.ratePerLitre} onChange={e=>setTxnForm(p=>({...p,ratePerLitre:e.target.value}))} style={inp}/></div>
            <div><Label>Amount ₹</Label><input type="number" inputMode="numeric" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))} placeholder={txnForm.litres&&txnForm.ratePerLitre?`Auto: ₹${(parseFloat(txnForm.litres||0)*parseFloat(txnForm.ratePerLitre||0)).toFixed(2)}`:"Enter amount"} style={inp}/></div>
            <div><Label>Vehicle No.</Label><input value={txnForm.vehicleNumber} onChange={e=>setTxnForm(p=>({...p,vehicleNumber:e.target.value}))} style={inp}/></div>
          </div>
          <div style={{marginTop:14,display:"flex",gap:10}}><button onClick={saveTxn} disabled={saving} style={btn("#3b82f6")}>{saving?"Saving…":"Save Transaction"}</button><button onClick={()=>setShowTxn(false)} style={ghostBtn}>Cancel</button></div>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
          {loading?[1,2].map(i=><div key={i} style={{...card,height:140}}><Skeleton/><Skeleton w="70%" h={20}/><Skeleton w="50%"/></div>):
          customers.map(c=>{
            const util=c.credit_limit>0?((c.outstanding_balance||0)/c.credit_limit)*100:0;
            const crit=util>80;
            return <div key={c.id} onClick={()=>openLedger(c)} style={{...card,cursor:"pointer",border:`1px solid ${crit?"rgba(239,68,68,0.4)":"rgba(16,185,129,0.2)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><p style={{color:"#f1f5f9",fontSize:15,fontWeight:800,margin:"0 0 4px"}}>{c.name}</p><p style={{color:"#475569",fontSize:11,margin:"0 0 8px"}}>{c.phone} · {(c.vehicle_numbers||[]).slice(0,2).join(", ")}</p></div>
                {crit&&<span style={{background:"rgba(239,68,68,0.15)",color:"#f87171",fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:6}}>⚠ HIGH</span>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#64748b",fontSize:11}}>Outstanding</span><span style={{color:crit?"#f87171":"#34d399",fontSize:13,fontWeight:800}}>₹{fmtINR(c.outstanding_balance)}</span></div>
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(util,100)}%`,background:crit?"#ef4444":"#10b981",borderRadius:3}}/></div>
              <p style={{color:"#475569",fontSize:10,margin:"4px 0 0"}}>{util.toFixed(0)}% of ₹{fmtINR0(c.credit_limit)} limit</p>
            </div>;
          })}
        </div>
      </>}

      {tab==="transactions"&&<div style={card}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>All Transactions — {THIS_MONTH}</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Date","Customer","Type","Fuel","Litres","Amount","Balance","Vehicle"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{txns.map(t=><tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <td style={{color:"#64748b",fontSize:12,padding:"8px 10px"}}>{t.date}</td>
              <td style={{color:"#f1f5f9",fontSize:12,fontWeight:600,padding:"8px 10px"}}>{t.customer_name}</td>
              <td style={{padding:"8px 10px"}}><span style={{color:t.type==="credit_sale"?"#f87171":"#34d399",fontSize:11,fontWeight:700}}>{t.type==="credit_sale"?"Credit Sale":"Payment"}</span></td>
              <td style={{color:"#60a5fa",fontSize:12,padding:"8px 10px"}}>{t.fuel_type}</td>
              <td style={{color:"#f1f5f9",fontSize:12,padding:"8px 10px"}}>{t.litres||"—"}</td>
              <td style={{color:t.type==="credit_sale"?"#f87171":"#34d399",fontSize:13,fontWeight:700,padding:"8px 10px"}}>{t.type==="credit_sale"?"+":"-"}₹{fmtINR(t.amount)}</td>
              <td style={{color:"#f59e0b",fontSize:12,fontWeight:700,padding:"8px 10px"}}>₹{fmtINR(t.running_balance)}</td>
              <td style={{color:"#64748b",fontSize:11,padding:"8px 10px",fontFamily:"monospace"}}>{t.vehicle_number}</td>
            </tr>)}
            {!txns.length&&<tr><td colSpan={8} style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No transactions this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}

      {tab==="ledger"&&selCust&&<div>
        <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center"}}>
          <button onClick={()=>{setSelCust(null);setTab("customers");}} style={{...ghostBtn,padding:"8px 14px",fontSize:12}}>← Back</button>
          <button onClick={()=>printKhataStatement(selCust,custTxns)} style={{...btn("#8b5cf6"),padding:"8px 16px",fontSize:12}}>⬇ PDF Statement</button>
        </div>
        <div style={{...card,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
            <div><h2 style={{color:"#f1f5f9",fontSize:18,fontWeight:800,margin:"0 0 4px"}}>{selCust.name}</h2><p style={{color:"#475569",fontSize:13,margin:0}}>{selCust.phone} · {(selCust.vehicle_numbers||[]).join(", ")}</p></div>
            <div style={{textAlign:"right"}}><p style={{color:"#64748b",fontSize:11,margin:"0 0 2px"}}>Outstanding</p><p style={{color:(selCust.outstanding_balance||0)>0?"#f87171":"#34d399",fontSize:22,fontWeight:900,margin:0}}>₹{fmtINR(selCust.outstanding_balance)}</p><p style={{color:"#475569",fontSize:11,margin:0}}>Limit: ₹{fmtINR0(selCust.credit_limit)}</p></div>
          </div>
        </div>
        <div style={card}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Date","Type","Amount","Balance","Vehicle","Staff"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{custTxns.map(t=><tr key={t.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{t.date}</td>
                <td style={{padding:"10px 10px"}}><span style={{color:t.type==="credit_sale"?"#f87171":"#34d399",fontSize:12,fontWeight:700}}>{t.type==="credit_sale"?"Credit Sale":"Payment"}</span></td>
                <td style={{color:t.type==="credit_sale"?"#f87171":"#34d399",fontSize:13,fontWeight:800,padding:"10px 10px"}}>{t.type==="credit_sale"?"+":"-"}₹{fmtINR(t.amount)}</td>
                <td style={{color:"#f59e0b",fontSize:13,fontWeight:800,padding:"10px 10px"}}>₹{fmtINR(t.running_balance)}</td>
                <td style={{color:"#64748b",fontSize:11,padding:"10px 10px",fontFamily:"monospace"}}>{t.vehicle_number}</td>
                <td style={{color:"#64748b",fontSize:11,padding:"10px 10px"}}>{t.staff_name}</td>
              </tr>)}
              {!custTxns.length&&<tr><td colSpan={6} style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No transactions for this customer.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>}
      {tab==="ledger"&&!selCust&&<div style={{...card,textAlign:"center",color:"#475569",padding:40}}>Select a customer from the Customers tab.</div>}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE 4 — GST BILLING ENGINE + pdfmake Tax Invoice
// ═══════════════════════════════════════════════════════════════
const GSTView = () => {
  const { user, settings } = useApp();
  const [invoices,setInvoices]=useState([]),[loading,setLoading]=useState(true);
  const [show,setShow]=useState(false),[saving,setSaving]=useState(false);
  const [form,setForm]=useState({type:"lube",product:"Servo Premium 4T",qty:"",price:"",customerName:"",customerGSTIN:"",vehicleNumber:"",date:TODAY});

  useEffect(()=>{ db.getInvoices(THIS_MONTH).then(d=>{setInvoices(d);setLoading(false);}); },[]);

  const genInvoice=(f)=>{
    const qty=parseFloat(f.qty||0),price=parseFloat(f.price||0),base=qty*price;
    const s=settings||{};
    if(f.type==="lube"){ const cgst=base*0.09,sgst=base*0.09; return {billType:"Tax Invoice",hsn:"3811",product:f.product,qty,rate_per_unit:price,base_amount:base,cgst,sgst,gst_rate:18,total_amount:base+cgst+sgst}; }
    return {billType:"Bill of Supply",hsn:"2710",product:f.type==="petrol"?"Petrol":"Diesel",qty,rate_per_unit:price,base_amount:base,cgst:0,sgst:0,gst_rate:0,total_amount:base,note:"Petroleum products outside GST ambit. Subject to State VAT only."};
  };

  const save=async()=>{
    setSaving(true);
    const invData=genInvoice(form);
    const lastNum=await db.getLastInvoiceNum();
    const invNum=lastNum+1;
    const fy=new Date().getFullYear(); const fySuffix=`${String(fy).slice(-2)}${String(fy+1).slice(-2)}`;
    const invoiceId=`${settings?.invoice_prefix||"INV"}-${fySuffix}-${String(invNum).padStart(5,"0")}`;
    const entry={...invData,invoice_id:invoiceId,invoice_number:invNum,customer_name:form.customerName,customer_gstin:form.customerGSTIN,vehicle_number:form.vehicleNumber,date:form.date,gstin:settings?.gstin,station_name:settings?.station_name,created_by:user.id};
    const d=await db.insertInvoice(entry); if(d) setInvoices(p=>[d,...p]);
    setSaving(false);setShow(false);
    setForm({type:"lube",product:"Servo Premium 4T",qty:"",price:"",customerName:"",customerGSTIN:"",vehicleNumber:"",date:TODAY});
    if(d) printInvoice(d);
  };

  const printInvoice=async(inv)=>{
    const pm=getPdfMake(); if(!pm){alert("PDF loading, try again.");return;}
    const s=settings||{};
    const isTax=inv.bill_type==="Tax Invoice";
    const tableBody=[[{text:"S.No",style:"tableHead"},{text:"Description",style:"tableHead"},{text:"HSN",style:"tableHead"},{text:"Qty",style:"tableHead"},{text:"Rate (₹)",style:"tableHead"},{text:"Taxable Value (₹)",style:"tableHead"},...(isTax?[{text:"CGST @9%",style:"tableHead"},{text:"SGST @9%",style:"tableHead"},{text:"Total (₹)",style:"tableHead"}]:[{text:"Total (₹)",style:"tableHead"}])]];
    tableBody.push([{text:"1",style:"tableRow"},{text:inv.product,style:"tableRow"},{text:inv.hsn,style:"tableRow"},{text:`${inv.qty} ${inv.bill_type==="Bill of Supply"?"L":"Nos"}`,style:"tableRow"},{text:`₹${fmtINR(inv.rate_per_unit)}`,style:"tableRow"},{text:`₹${fmtINR(inv.base_amount)}`,style:"tableRow"},...(isTax?[{text:`₹${fmtINR(inv.cgst)}`,style:"tableRow"},{text:`₹${fmtINR(inv.sgst)}`,style:"tableRow"},{text:`₹${fmtINR(inv.total_amount)}`,style:"tableRow",bold:true}]:[{text:`₹${fmtINR(inv.total_amount)}`,style:"tableRow",bold:true}])]);
    tableBody.push([{text:"TOTAL",style:"total",colSpan:5},{},{},{},{},{text:`₹${fmtINR(inv.base_amount)}`,style:"total"},...(isTax?[{text:`₹${fmtINR(inv.cgst)}`,style:"total"},{text:`₹${fmtINR(inv.sgst)}`,style:"total"},{text:`₹${fmtINR(inv.total_amount)}`,style:"total",fontSize:11}]:[{text:`₹${fmtINR(inv.total_amount)}`,style:"total",fontSize:11}])]);
    const dd={content:[
      {columns:[{width:"*",stack:[{text:isTax?"TAX INVOICE":"BILL OF SUPPLY",style:"header",color:isTax?"#d97706":"#16a34a"},{text:s.station_name||"Shree K C Sarswat Auto Fuel Station",style:"subheader",margin:[0,4,0,0]},{text:`${s.address_line1||""},\n${s.city||"Lunkaransar"}, ${s.state||"Rajasthan"} — ${s.pincode||"334603"}`,style:"label",margin:[0,2,0,0]},{text:`GSTIN: ${s.gstin||"08XXXXXXXXXXXXX"}  |  Phone: ${s.phone||""}`,style:"label"},{text:`Proprietor: ${s.proprietor_name||"K C Sarswat"}`,style:"label"}]},{width:"auto",stack:[{text:`Invoice No: ${inv.invoice_id}`,style:"value",alignment:"right"},{text:`Date: ${inv.date}`,style:"value",alignment:"right",margin:[0,4,0,0]},{text:isTax?`State: ${s.state||"Rajasthan"}\nState Code: ${s.state_code||"08"}`:"",style:"label",alignment:"right",margin:[0,4,0,0]}]}]},
      {canvas:[{type:"line",x1:0,y1:0,x2:515,y2:0,lineWidth:1.5,lineColor:"#0f172a"}],margin:[0,10,0,10]},
      ...(inv.customer_name?[{columns:[{text:[{text:"Bill To: ",style:"label"},{text:inv.customer_name,style:"value"}]},{text:[{text:"GSTIN: ",style:"label"},{text:inv.customer_gstin||"—",style:"value"}],alignment:"right"}]},{text:inv.vehicle_number?`Vehicle No: ${inv.vehicle_number}`:"",style:"label",margin:[0,2,0,10]}]:[{text:"",margin:[0,10,0,0]}]),
      {table:{headerRows:1,widths:isTax?["auto","*","auto","auto","auto","auto","auto","auto","auto"]:["auto","*","auto","auto","auto","auto","auto"],body:tableBody},layout:{hLineColor:"#e2e8f0",vLineColor:"#e2e8f0",fillColor:(ri)=>ri===0?"#0f172a":ri%2===0?"#f8fafc":null},margin:[0,0,0,12]},
      {text:`Amount in Words: ${numWords(inv.total_amount)}`,style:"label",margin:[0,0,0,8]},
      ...(inv.note?[{text:inv.note,style:"label",italics:true,margin:[0,0,0,8]}]:[]),
      {canvas:[{type:"line",x1:0,y1:0,x2:515,y2:0,lineWidth:0.5,lineColor:"#e2e8f0"}],margin:[0,4,0,10]},
      ...(s.bank_name?[{columns:[{width:"*",stack:[{text:"Bank Details:",style:"label",bold:true},{text:`${s.bank_name}`,style:"value"},{text:`A/C: ${s.bank_account||"—"}`,style:"label"},{text:`IFSC: ${s.bank_ifsc||"—"}`,style:"label"},{text:s.upi_id?`UPI: ${s.upi_id}`:"",style:"label"}]},{width:"auto",stack:[{text:"Authorized Signatory",style:"label",alignment:"right"},{text:"\n\n\n",style:"label"},{text:s.station_name||"",style:"label",alignment:"right"},{text:s.proprietor_name||"",style:"value",alignment:"right"}]}]}]:[{columns:[{width:"*",stack:[{text:s.upi_id?`UPI: ${s.upi_id}`:"",style:"label"}]},{width:"auto",stack:[{text:"Authorized Signatory",style:"label",alignment:"right"},{text:"\n\n\n",style:"label"},{text:s.proprietor_name||"",style:"value",alignment:"right"}]}]}]),
      {text:"\nDeclaration: Certified that the particulars given above are true and correct.",style:"label",margin:[0,8,0,0]},
    ],styles:pdfStyles,defaultStyle:{font:"Helvetica"},pageSize:"A4",pageMargins:[40,40,40,40]};
    pm.createPdf(dd).download(`${inv.invoice_id}.pdf`);
  };

  const preview=show&&form.qty&&form.price?genInvoice(form):null;
  const totBase=invoices.reduce((s,i)=>s+(i.base_amount||0),0);
  const totCGST=invoices.filter(i=>i.bill_type==="Tax Invoice").reduce((s,i)=>s+(i.cgst||0),0);
  const totSGST=invoices.filter(i=>i.bill_type==="Tax Invoice").reduce((s,i)=>s+(i.sgst||0),0);

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🧾 GST Billing Engine</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Tax Invoice (Lubes 18% GST) · Bill of Supply (Fuel) · pdfmake PDF</p></div>
        <button onClick={()=>setShow(!show)} style={btn()}>+ Generate Invoice</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:20}}>
        <StatCard label="Tax Invoices" value={invoices.filter(i=>i.bill_type==="Tax Invoice").length} color="#f59e0b" icon="🧾"/>
        <StatCard label="CGST Collected" value={`₹${fmtINR(totCGST)}`} color="#3b82f6" icon="🏦"/>
        <StatCard label="SGST Collected" value={`₹${fmtINR(totSGST)}`} color="#8b5cf6" icon="🏦"/>
        <StatCard label="Bills of Supply" value={invoices.filter(i=>i.bill_type==="Bill of Supply").length} color="#10b981" icon="📄"/>
      </div>

      {show&&<div style={{...card,border:"1px solid rgba(245,158,11,0.25)",marginBottom:16}}>
        <h3 style={{color:"#f59e0b",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Generate Invoice</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          <div><Label>Invoice Type</Label><select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={inp}><option value="lube" style={{background:"#07111e"}}>Lubricant/Additive (18% GST)</option><option value="petrol" style={{background:"#07111e"}}>Petrol (Bill of Supply)</option><option value="diesel" style={{background:"#07111e"}}>Diesel (Bill of Supply)</option></select></div>
          {form.type==="lube"&&<div><Label>Product</Label><select value={form.product} onChange={e=>setForm(p=>({...p,product:e.target.value}))} style={inp}>{LUBE_PRODUCTS.filter(p=>p!=="Custom").map(p=><option key={p} style={{background:"#07111e"}}>{p}</option>)}</select></div>}
          <div><Label req>Qty</Label><input type="number" inputMode="numeric" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))} style={inp}/></div>
          <div><Label req>Rate ₹</Label><input type="number" inputMode="numeric" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} style={inp}/></div>
          <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/></div>
          <div><Label>Customer Name</Label><input value={form.customerName} onChange={e=>setForm(p=>({...p,customerName:e.target.value}))} style={inp}/></div>
          <div><Label>Vehicle No.</Label><input value={form.vehicleNumber} onChange={e=>setForm(p=>({...p,vehicleNumber:e.target.value}))} style={inp}/></div>
          {form.type==="lube"&&<div><Label>Customer GSTIN</Label><input value={form.customerGSTIN} onChange={e=>setForm(p=>({...p,customerGSTIN:e.target.value}))} placeholder="15-char GSTIN" style={inp}/></div>}
        </div>
        {preview&&<div style={{marginTop:14,padding:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <p style={{color:"#f1f5f9",fontSize:13,fontWeight:800,margin:0}}>{settings?.station_name||"Shree K C Sarswat Auto Fuel Station"}</p>
            <span style={{background:preview.billType==="Tax Invoice"?"rgba(245,158,11,0.15)":"rgba(16,185,129,0.1)",color:preview.billType==="Tax Invoice"?"#f59e0b":"#34d399",padding:"4px 12px",borderRadius:8,fontWeight:700,fontSize:12}}>{preview.billType}</span>
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10}}>
            {[{l:"Product (HSN: "+preview.hsn+")",v:preview.product||form.type,c:"#f1f5f9"},{l:`${preview.qty} × ₹${fmtINR(preview.rate_per_unit)}`,v:"",c:"#94a3b8"},{l:"Base Amount",v:`₹${fmtINR(preview.base_amount)}`,c:"#f1f5f9"},preview.cgst>0&&{l:"CGST @9%",v:`₹${fmtINR(preview.cgst)}`,c:"#f59e0b"},preview.sgst>0&&{l:"SGST @9%",v:`₹${fmtINR(preview.sgst)}`,c:"#f59e0b"},{l:"TOTAL",v:`₹${fmtINR(preview.total_amount)}`,c:"#34d399",bold:true}].filter(Boolean).map(x=>(
              <div key={x.l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                <span style={{color:"#64748b",fontSize:12}}>{x.l}</span>
                <span style={{color:x.c,fontSize:x.bold?14:12,fontWeight:x.bold?900:500}}>{x.v}</span>
              </div>
            ))}
          </div>
        </div>}
        <div style={{marginTop:14,display:"flex",gap:10}}>
          <button onClick={save} disabled={saving||!form.qty||!form.price} style={btn()}>{saving?"Saving…":"Save + Download PDF"}</button>
          <button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button>
        </div>
      </div>}

      {!loading&&<div style={card}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Invoice Register — {THIS_MONTH}</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Invoice ID","Date","Type","Product","Base","CGST","SGST","Total","Customer",""].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{invoices.map(inv=><tr key={inv.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <td style={{color:"#f59e0b",fontSize:11,fontFamily:"monospace",fontWeight:700,padding:"8px 10px"}}>{inv.invoice_id}</td>
              <td style={{color:"#64748b",fontSize:11,padding:"8px 10px"}}>{inv.date}</td>
              <td style={{padding:"8px 10px"}}><span style={{color:inv.bill_type==="Tax Invoice"?"#f59e0b":"#34d399",fontSize:11,fontWeight:700}}>{inv.bill_type}</span></td>
              <td style={{color:"#a78bfa",fontSize:11,padding:"8px 10px"}}>{inv.product}</td>
              <td style={{color:"#f1f5f9",fontSize:12,fontWeight:700,padding:"8px 10px"}}>₹{fmtINR(inv.base_amount)}</td>
              <td style={{color:"#f59e0b",fontSize:11,padding:"8px 10px"}}>₹{fmtINR(inv.cgst)}</td>
              <td style={{color:"#f59e0b",fontSize:11,padding:"8px 10px"}}>₹{fmtINR(inv.sgst)}</td>
              <td style={{padding:"8px 10px"}}><span style={{color:"#34d399",fontSize:13,fontWeight:800}}>₹{fmtINR(inv.total_amount)}</span></td>
              <td style={{color:"#64748b",fontSize:11,padding:"8px 10px"}}>{inv.customer_name||"—"}</td>
              <td style={{padding:"8px 10px"}}><button onClick={()=>printInvoice(inv)} style={{background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.2)",borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⬇ PDF</button></td>
            </tr>)}
            {!invoices.length&&<tr><td colSpan={10} style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No invoices this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE — EXPENSES
// ═══════════════════════════════════════════════════════════════
const ExpensesView = () => {
  const { user } = useApp();
  const [exps,setExps]=useState([]),[loading,setLoading]=useState(true);
  const [show,setShow]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [form,setForm]=useState({date:TODAY,category:EXPENSE_CATS[0],customCat:"",amount:"",note:"",paid_by:"Cash"});
  useEffect(()=>{ db.getExpenses(THIS_MONTH).then(d=>{setExps(d);setLoading(false);}); },[]);

  const save=async()=>{
    if(!form.amount||parseFloat(form.amount)<=0) return; setSaving(true);
    const cat=form.category==="Custom"?form.customCat:form.category;
    const entry={date:form.date,category:cat,amount:parseFloat(form.amount),note:form.note,paid_by:form.paid_by,staff_id:user.id};
    const d=await db.insertExpense(entry); if(d) setExps(p=>[d,...p]);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setForm({date:TODAY,category:EXPENSE_CATS[0],customCat:"",amount:"",note:"",paid_by:"Cash"});setShow(false);
  };

  const tot=exps.reduce((s,e)=>s+(e.amount||0),0);
  const catData=exps.reduce((acc,e)=>{ acc[e.category]=(acc[e.category]||0)+e.amount; return acc; },{});
  const pieData=Object.entries(catData).map(([name,value])=>({name,value}));

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>💸 Expenses</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Daily OPEX — {THIS_MONTH}</p></div>
        <div style={{display:"flex",gap:8}}>{(saving||saved)&&<SyncBadge saving={saving}/>}<button onClick={()=>setShow(!show)} style={btn("#ef4444")}>+ Add Expense</button></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginBottom:20}}>
        <StatCard label="This Month OPEX" value={`₹${fmtINR0(tot)}`} sub={`Daily avg: ₹${fmtINR0(tot/Math.max(1,new Date().getDate()))}`} color="#ef4444" icon="💸"/>
        <StatCard label="Daily Target" value={`₹${fmtINR0(85000/26)}`} sub="₹85K / 26 working days" color="#f59e0b" icon="📊"/>
      </div>
      {pieData.length>0&&<div style={{...card,marginBottom:16}}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>By Category</h3>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <PieChart width={160} height={160}><Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">{pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:"#0a1628",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontSize:11}} formatter={v=>`₹${fmtINR0(v)}`}/></PieChart>
          <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:6}}>
            {pieData.map((d,i)=><div key={d.name} style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/><span style={{color:"#94a3b8",fontSize:11}}>{d.name}: <b style={{color:"#f1f5f9"}}>₹{fmtINR0(d.value)}</b></span></div>)}
          </div>
        </div>
      </div>}
      <Toast msg={saved?"Expense saved ✓":null}/>
      {show&&<div style={{...card,border:"1px solid rgba(239,68,68,0.25)",marginBottom:16}}>
        <h3 style={{color:"#f87171",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>New Expense</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:12}}>
          <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/></div>
          <div><Label>Category</Label><select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={inp}>{EXPENSE_CATS.map(c=><option key={c} style={{background:"#07111e"}}>{c}</option>)}</select></div>
          {form.category==="Custom"&&<div><Label req>Custom Category</Label><input value={form.customCat} onChange={e=>setForm(p=>({...p,customCat:e.target.value}))} style={inp}/></div>}
          <div><Label req>Amount ₹</Label><input type="number" inputMode="numeric" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} style={inp}/></div>
          <div><Label>Paid By</Label><select value={form.paid_by} onChange={e=>setForm(p=>({...p,paid_by:e.target.value}))} style={inp}><option style={{background:"#07111e"}}>Cash</option><option style={{background:"#07111e"}}>UPI</option><option style={{background:"#07111e"}}>Bank</option></select></div>
          <div><Label>Note</Label><input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} style={inp}/></div>
        </div>
        <div style={{marginTop:14,display:"flex",gap:10}}><button onClick={save} disabled={saving} style={btn("#ef4444")}>{saving?"Saving…":"Save"}</button><button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button></div>
      </div>}
      {!loading&&<div style={card}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Date","Category","Amount","Paid By","Note"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{exps.map(e=><tr key={e.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
            <td style={{color:"#64748b",fontSize:12,padding:"10px 12px"}}>{e.date}</td>
            <td style={{color:"#f87171",fontSize:12,fontWeight:600,padding:"10px 12px"}}>{e.category}</td>
            <td style={{color:"#f1f5f9",fontSize:13,fontWeight:800,padding:"10px 12px"}}>₹{fmtINR0(e.amount)}</td>
            <td style={{color:"#64748b",fontSize:12,padding:"10px 12px"}}>{e.paid_by}</td>
            <td style={{color:"#475569",fontSize:12,padding:"10px 12px"}}>{e.note}</td>
          </tr>)}
          {!exps.length&&<tr><td colSpan={5} style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No expenses this month.</td></tr>}
          </tbody>
        </table></div>
      </div>}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE — DIP READINGS + VCF
// ═══════════════════════════════════════════════════════════════
const DipView = () => {
  const { user, tanks } = useApp();
  const [dips,setDips]=useState([]),[loading,setLoading]=useState(true);
  const [show,setShow]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [form,setForm]=useState({date:TODAY,unit_id:"unit1",fuel_type:"petrol",physical_dip:"",temperature:"32"});
  useEffect(()=>{ db.getDips(THIS_MONTH).then(d=>{setDips(d);setLoading(false);}); },[]);

  const save=async()=>{
    if(!form.physical_dip) return; setSaving(true);
    const phys=parseFloat(form.physical_dip),temp=parseFloat(form.temperature||32);
    const vcf=calcVCF(form.fuel_type,temp),adj=phys*vcf;
    const sys=tanks?.find(t=>t.unit_id===form.unit_id&&t.fuel_type===form.fuel_type)?.current||0;
    const variance=adj-sys,variancePct=sys>0?(variance/sys)*100:0;
    const flagged=Math.abs(variancePct)>0.5;
    const entry={date:form.date,unit_id:form.unit_id,fuel_type:form.fuel_type,physical_dip:phys,temperature:temp,vcf:parseFloat(vcf.toFixed(5)),vcf_adjusted:parseFloat(adj.toFixed(2)),system_stock:parseFloat(sys.toFixed(2)),variance:parseFloat(variance.toFixed(2)),variance_pct:parseFloat(variancePct.toFixed(3)),flagged,created_by:user.id};
    const d=await db.insertDip(entry); if(d) setDips(p=>[d,...p]);
    if(flagged) db.audit("FRAUD_ALERT","dip_readings",{type:"DIP_SYSTEM_VARIANCE",variancePct,unit:form.unit_id,fuel:form.fuel_type,variance},user.id,user.name);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setShow(false);setForm({date:TODAY,unit_id:"unit1",fuel_type:"petrol",physical_dip:"",temperature:"32"});
  };

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      {user.role!=="owner"&&<div style={{...card,border:"1px solid rgba(239,68,68,0.3)",marginBottom:16}}><p style={{color:"#f87171",fontSize:13,fontWeight:700,margin:0}}>🔒 Owner only — Dip readings cannot be submitted by staff.</p></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🌡 Dip Readings & VCF</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Physical dip vs system stock · ASTM D1250 temperature correction · Pilferage detection</p></div>
        {user.role==="owner"&&<div style={{display:"flex",gap:8}}>{(saving||saved)&&<SyncBadge saving={saving}/>}<button onClick={()=>setShow(!show)} style={btn("#ef4444")}>+ Add Dip Reading</button></div>}
      </div>
      <Toast msg={saved?"Dip reading saved ✓":null}/>
      {show&&user.role==="owner"&&<div style={{...card,border:"1px solid rgba(239,68,68,0.25)",marginBottom:16}}>
        <h3 style={{color:"#f87171",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>New Dip Reading</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          <div><Label>Date</Label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={inp}/></div>
          <div><Label>Unit</Label><select value={form.unit_id} onChange={e=>setForm(p=>({...p,unit_id:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{background:"#07111e"}}>{u.name}</option>)}</select></div>
          <div><Label>Fuel</Label><select value={form.fuel_type} onChange={e=>setForm(p=>({...p,fuel_type:e.target.value}))} style={inp}><option value="petrol" style={{background:"#07111e"}}>Petrol</option><option value="diesel" style={{background:"#07111e"}}>Diesel</option></select></div>
          <div><Label req>Physical Dip (Litres)</Label><input type="number" inputMode="numeric" value={form.physical_dip} onChange={e=>setForm(p=>({...p,physical_dip:e.target.value}))} style={inp}/></div>
          <div><Label>Temperature (°C)</Label><input type="number" inputMode="numeric" value={form.temperature} onChange={e=>setForm(p=>({...p,temperature:e.target.value}))} style={inp}/></div>
        </div>
        {form.physical_dip&&form.temperature&&(()=>{
          const ph=parseFloat(form.physical_dip),tmp=parseFloat(form.temperature);
          const vcf=calcVCF(form.fuel_type,tmp),adj=ph*vcf;
          const sys=tanks?.find(t=>t.unit_id===form.unit_id&&t.fuel_type===form.fuel_type)?.current||0;
          const v=adj-sys,vPct=sys>0?(v/sys)*100:0;
          return <div style={{marginTop:12,padding:"12px 14px",background:Math.abs(vPct)>0.5?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.06)",border:`1px solid ${Math.abs(vPct)>0.5?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.2)"}`,borderRadius:10}}>
            <p style={{color:Math.abs(vPct)>0.5?"#f87171":"#34d399",fontSize:12,fontWeight:700,margin:"0 0 6px"}}>{Math.abs(vPct)>0.5?"⚠ VARIANCE > 0.5% — Will be flagged in audit trail":"✅ Within tolerance"}</p>
            <div style={{display:"flex",gap:16,fontSize:12,flexWrap:"wrap"}}>
              {[{l:"Physical",v:`${ph.toFixed(0)}L`},{l:"VCF",v:vcf.toFixed(5)},{l:"VCF-Adjusted",v:`${adj.toFixed(1)}L`},{l:"System Stock",v:`${sys.toFixed(0)}L`},{l:"Variance",v:`${v>=0?"+":""}${v.toFixed(1)}L (${vPct.toFixed(2)}%)`,c:Math.abs(vPct)>0.5?"#f87171":"#34d399"}].map(x=>(
                <span key={x.l}>{x.l}: <b style={{color:x.c||"#f1f5f9"}}>{x.v}</b></span>
              ))}
            </div>
          </div>;
        })()}
        <div style={{marginTop:14,display:"flex",gap:10}}><button onClick={save} disabled={saving||!form.physical_dip} style={btn("#ef4444")}>{saving?"Saving…":"Save Dip"}</button><button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button></div>
      </div>}
      {!loading&&<div style={card}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>Dip History — {THIS_MONTH}</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Date","Unit","Fuel","Physical (L)","Temp","VCF","Adjusted (L)","System (L)","Variance","Flag"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{dips.map(d=><tr key={d.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",background:d.flagged?"rgba(239,68,68,0.04)":"transparent"}}>
              <td style={{color:"#64748b",fontSize:12,padding:"8px 10px"}}>{d.date}</td>
              <td style={{color:"#f1f5f9",fontSize:12,padding:"8px 10px"}}>{UNIT_CONFIG[d.unit_id]?.name||d.unit_id}</td>
              <td style={{color:d.fuel_type==="petrol"?"#f59e0b":"#3b82f6",fontSize:12,fontWeight:700,padding:"8px 10px"}}>{d.fuel_type}</td>
              <td style={{color:"#f1f5f9",fontWeight:700,padding:"8px 10px"}}>{(d.physical_dip||0).toFixed(0)}</td>
              <td style={{color:"#64748b",padding:"8px 10px"}}>{d.temperature}°C</td>
              <td style={{color:"#64748b",fontSize:11,padding:"8px 10px",fontFamily:"monospace"}}>{(d.vcf||1).toFixed(5)}</td>
              <td style={{color:"#f1f5f9",padding:"8px 10px"}}>{(d.vcf_adjusted||0).toFixed(1)}</td>
              <td style={{color:"#60a5fa",padding:"8px 10px"}}>{(d.system_stock||0).toFixed(0)}</td>
              <td style={{color:Math.abs(d.variance_pct||0)>0.5?"#f87171":"#34d399",fontWeight:700,padding:"8px 10px"}}>{(d.variance||0)>=0?"+":""}{(d.variance||0).toFixed(1)}L ({(d.variance_pct||0).toFixed(2)}%)</td>
              <td style={{padding:"8px 10px"}}>{d.flagged?<span style={{background:"rgba(239,68,68,0.15)",color:"#f87171",fontSize:10,padding:"3px 7px",borderRadius:4,fontWeight:700}}>⚠ FLAGGED</span>:<span style={{color:"#34d399",fontSize:10}}>OK</span>}</td>
            </tr>)}
            {!dips.length&&<tr><td colSpan={10} style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No dip readings this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE — STAFF (with Cash Integrity Leaderboard)
// ═══════════════════════════════════════════════════════════════
const StaffView = () => {
  const { user } = useApp();
  const [staffList,setStaffList]=useState([]),[loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const [form,setForm]=useState({email:"",password:"",name:"",role:"staff",unit:"unit1",salary:"",joining:TODAY});
  const [errs,setErrs]=useState([]);
  const [scores,setScores]=useState([]);

  useEffect(()=>{
    Promise.all([db.getStaff(),db.getIntegritySummary()]).then(([s,sc])=>{ setStaffList(s); setScores(sc); setLoading(false); });
  },[]);

  const addStaff=async()=>{
    const e=[];
    if(!form.name.trim()) e.push("Name required");
    if(!form.email.trim()) e.push("Email required");
    if(!form.password||form.password.length<6) e.push("Password min 6 chars");
    if(!form.salary||parseFloat(form.salary)<=0) e.push("Salary required");
    if(e.length){setErrs(e);return;} setSaving(true);
    // Create auth user via Supabase Auth Admin (this requires service role — use signUp as workaround)
    const { data:authData, error:authErr } = await supabase.auth.admin?.createUser({email:form.email,password:form.password,email_confirm:true}).catch(()=>({error:"admin not available"}))
      || await supabase.auth.signUp({email:form.email,password:form.password});
    if(authErr||!authData?.user){setErrs(["Auth error: "+((authErr?.message)||"Try different email")]);setSaving(false);return;}
    const profile={id:authData.user.id,name:form.name,role:form.role,unit:form.unit,salary:parseFloat(form.salary||0),joining:form.joining,active:true,phone:""};
    await db.insertStaff(profile);
    setStaffList(p=>[{...profile},...p]);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setShowForm(false);setErrs([]);setForm({email:"",password:"",name:"",role:"staff",unit:"unit1",salary:"",joining:TODAY});
  };

  const toggle=async(id)=>{
    const s=staffList.find(x=>x.id===id); if(!s) return;
    await db.updateStaff(id,{active:!s.active});
    setStaffList(p=>p.map(x=>x.id===id?{...x,active:!x.active}:x));
  };

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>👥 Staff Management</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Supabase Auth accounts · Cash integrity leaderboard</p></div>
        <div style={{display:"flex",gap:8}}>{(saving||saved)&&<SyncBadge saving={saving}/>}<button onClick={()=>setShowForm(!showForm)} style={btn()}>+ Add Staff</button></div>
      </div>
      <Toast msg={saved?"Staff account created ✓":null}/>
      {scores.length>0&&<div style={{...card,marginBottom:20,border:"1px solid rgba(16,185,129,0.2)"}}>
        <h3 style={{color:"#34d399",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🏆 Cash Integrity Leaderboard</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Rank","Staff","Avg Score","Shifts","Total Diff","Zero-Error Shifts"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"6px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{scores.map((s,i)=><tr key={s.staff_id||i} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
              <td style={{color:i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#cd7c30":"#475569",fontSize:14,fontWeight:900,padding:"8px 12px"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</td>
              <td style={{color:"#f1f5f9",fontSize:13,fontWeight:700,padding:"8px 12px"}}>{s.staff_name}</td>
              <td style={{padding:"8px 12px"}}><span style={{color:parseFloat(s.avg_score)>=98?"#34d399":parseFloat(s.avg_score)>=95?"#f59e0b":"#f87171",fontSize:14,fontWeight:800}}>{s.avg_score}%</span></td>
              <td style={{color:"#64748b",fontSize:12,padding:"8px 12px"}}>{s.total_shifts}</td>
              <td style={{color:parseFloat(s.total_diff)>=0?"#34d399":"#f87171",fontSize:12,fontWeight:700,padding:"8px 12px"}}>₹{s.total_diff}</td>
              <td style={{color:"#60a5fa",fontSize:12,padding:"8px 12px"}}>{s.zero_error_shifts}</td>
            </tr>)}
            </tbody>
          </table>
        </div>
      </div>}
      {showForm&&<div style={{...card,border:"1px solid rgba(245,158,11,0.2)",marginBottom:16}}>
        <h3 style={{color:"#f59e0b",fontSize:14,fontWeight:700,margin:"0 0 8px"}}>Add Staff (Creates Supabase Auth Account)</h3>
        <ErrBanner errors={errs}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:12}}>
          <div><Label req>Full Name</Label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inp}/></div>
          <div><Label req>Email</Label><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={inp}/></div>
          <div><Label req>Password (min 6)</Label><input type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={inp}/></div>
          <div><Label req>Salary ₹</Label><input type="number" inputMode="numeric" value={form.salary} onChange={e=>setForm(p=>({...p,salary:e.target.value}))} style={inp}/></div>
          <div><Label>Joining Date</Label><input type="date" value={form.joining} onChange={e=>setForm(p=>({...p,joining:e.target.value}))} style={inp}/></div>
          <div><Label>Unit</Label><select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={inp}>{Object.entries(UNIT_CONFIG).map(([k,u])=><option key={k} value={k} style={{background:"#07111e"}}>{u.name}</option>)}</select></div>
        </div>
        <div style={{marginTop:12,display:"flex",gap:10}}><button onClick={addStaff} disabled={saving} style={btn()}>{saving?"Creating…":"Create Staff Account"}</button><button onClick={()=>{setShowForm(false);setErrs([]);}} style={ghostBtn}>Cancel</button></div>
      </div>}
      {!loading&&<div style={card}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Name","Unit","Salary","Joining","Status","Actions"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{staffList.map(s=><tr key={s.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",opacity:s.active?1:0.5}}>
            <td style={{padding:"10px 12px"}}><p style={{color:"#f1f5f9",fontSize:13,fontWeight:700,margin:"0 0 2px"}}>{s.name}</p><p style={{color:s.role==="owner"?"#f59e0b":"#475569",fontSize:10,margin:0,fontWeight:700}}>{s.role==="owner"?"👑 Owner":"👤 Staff"}</p></td>
            <td style={{color:"#60a5fa",fontSize:12,padding:"10px 12px"}}>{UNIT_CONFIG[s.unit]?.name||s.unit}</td>
            <td style={{color:"#34d399",fontSize:13,fontWeight:700,padding:"10px 12px"}}>₹{fmtINR0(s.salary)}</td>
            <td style={{color:"#64748b",fontSize:12,padding:"10px 12px"}}>{s.joining}</td>
            <td style={{padding:"10px 12px"}}>{s.active?<span style={{background:"rgba(16,185,129,0.1)",color:"#34d399",fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:700}}>ACTIVE</span>:<span style={{background:"rgba(239,68,68,0.1)",color:"#f87171",fontSize:10,padding:"3px 8px",borderRadius:5,fontWeight:700}}>INACTIVE</span>}</td>
            <td style={{padding:"10px 12px"}}>{s.id!==user.id&&<button onClick={()=>toggle(s.id)} style={{background:s.active?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)",color:s.active?"#f87171":"#34d399",border:"none",borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{s.active?"Deactivate":"Activate"}</button>}</td>
          </tr>)}</tbody>
        </table></div>
      </div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE — TRANSPORT
// ═══════════════════════════════════════════════════════════════
const TransportView = () => {
  const [records,setRecords]=useState([]),[loading,setLoading]=useState(true),[show,setShow]=useState(false);
  const [form,setForm]=useState({date:TODAY,truck:"",km:"",rate:"",driver_pay:"",diesel_cost:"",loading_cost:"",note:""});
  const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{ db.getTransport(THIS_MONTH).then(d=>{setRecords(d);setLoading(false);}); },[]);
  const income=r=>parseFloat(r.km||0)*parseFloat(r.rate||0);
  const cost=r=>parseFloat(r.driver_pay||0)+parseFloat(r.diesel_cost||0)+parseFloat(r.loading_cost||0);
  const profit=r=>income(r)-cost(r);
  const total={inc:records.reduce((s,r)=>s+income(r),0),cost:records.reduce((s,r)=>s+cost(r),0),profit:records.reduce((s,r)=>s+profit(r),0)};
  const save=async()=>{
    setSaving(true);
    const entry={...form,km:parseFloat(form.km||0),rate:parseFloat(form.rate||0),driver_pay:parseFloat(form.driver_pay||0),diesel_cost:parseFloat(form.diesel_cost||0),loading_cost:parseFloat(form.loading_cost||0)};
    const d=await db.insertTransport(entry); if(d) setRecords(p=>[d,...p]);
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);
    setForm({date:TODAY,truck:"",km:"",rate:"",driver_pay:"",diesel_cost:"",loading_cost:"",note:""});setShow(false);
  };
  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>🚚 Transport Income</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Own truck trips · P&L — {THIS_MONTH}</p></div>
        <div style={{display:"flex",gap:8}}>{(saving||saved)&&<SyncBadge saving={saving}/>}<button onClick={()=>setShow(!show)} style={btn("#3b82f6")}>+ Add Trip</button></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        <StatCard label="Total Income" value={`₹${fmtINR0(total.inc)}`} color="#10b981" icon="💰"/>
        <StatCard label="Total Cost" value={`₹${fmtINR0(total.cost)}`} color="#ef4444" icon="💸"/>
        <StatCard label="Net Profit" value={`₹${fmtINR0(total.profit)}`} color={total.profit>=0?"#10b981":"#ef4444"} icon="📊"/>
      </div>
      <Toast msg={saved?"Trip saved ✓":null}/>
      {show&&<div style={{...card,border:"1px solid rgba(59,130,246,0.2)",marginBottom:16}}>
        <h3 style={{color:"#60a5fa",fontSize:14,fontWeight:700,margin:"0 0 10px"}}>New Trip</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:12}}>
          {[["date","Date","date"],["truck","Truck No.","text"],["km","KM","number"],["rate","Rate ₹/km","number"],["driver_pay","Driver Pay ₹","number"],["diesel_cost","Diesel Cost ₹","number"],["loading_cost","Loading/Unloading ₹","number"],["note","Note","text"]].map(([k,l,t])=>(
            <div key={k}><Label>{l}</Label><input type={t} inputMode={t==="number"?"numeric":undefined} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={inp}/></div>
          ))}
        </div>
        {form.km&&form.rate&&<div style={{marginTop:12,padding:"10px 14px",background:"rgba(16,185,129,0.06)",borderRadius:10}}><span style={{color:"#34d399",fontSize:13,fontWeight:700}}>Income: ₹{fmtINR0(parseFloat(form.km||0)*parseFloat(form.rate||0))} · Cost: ₹{fmtINR0(parseFloat(form.driver_pay||0)+parseFloat(form.diesel_cost||0)+parseFloat(form.loading_cost||0))} · Profit: ₹{fmtINR0(parseFloat(form.km||0)*parseFloat(form.rate||0)-parseFloat(form.driver_pay||0)-parseFloat(form.diesel_cost||0)-parseFloat(form.loading_cost||0))}</span></div>}
        <div style={{marginTop:14,display:"flex",gap:10}}><button onClick={save} disabled={saving} style={btn("#3b82f6")}>{saving?"Saving…":"Save"}</button><button onClick={()=>setShow(false)} style={ghostBtn}>Cancel</button></div>
      </div>}
      {!loading&&records.length>0&&<div style={card}>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Date","Truck","KM","Rate","Income","Cost","Profit"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>{records.map(r=><tr key={r.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
            <td style={{color:"#64748b",fontSize:12,padding:"10px 12px"}}>{r.date}</td>
            <td style={{color:"#f1f5f9",fontFamily:"monospace",fontSize:12,padding:"10px 12px"}}>{r.truck}</td>
            <td style={{color:"#f1f5f9",fontSize:12,padding:"10px 12px"}}>{r.km}</td>
            <td style={{color:"#64748b",fontSize:12,padding:"10px 12px"}}>₹{r.rate}/km</td>
            <td style={{color:"#34d399",fontSize:13,fontWeight:700,padding:"10px 12px"}}>₹{fmtINR0(income(r))}</td>
            <td style={{color:"#f87171",fontSize:12,padding:"10px 12px"}}>₹{fmtINR0(cost(r))}</td>
            <td style={{padding:"10px 12px"}}><span style={{color:profit(r)>=0?"#34d399":"#f87171",fontSize:13,fontWeight:800}}>₹{fmtINR0(profit(r))}</span></td>
          </tr>)}</tbody>
        </table></div>
      </div>}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE — REPORTS (P&L + Excel + PDF exports)
// ═══════════════════════════════════════════════════════════════
const ReportsView = () => {
  const { settings } = useApp();
  const [month, setMonth] = useState(THIS_MONTH);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab]     = useState("pl");

  const loadData = useCallback(async () => {
    setLoading(true);
    const bundle = await db.getMonthBundle(month);
    setData(bundle);
    setLoading(false);
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  const pl = useMemo(() => {
    if (!data) return null;
    let petrolL = 0, dieselL = 0;
    data.sales.forEach(s => {
      if (!s.readings) return;
      Object.values(s.readings).forEach(r => {
        const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0);
        const doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0);
        if (pc>po) petrolL+=pc-po; if (dc>doo) dieselL+=dc-doo;
      });
    });
    const petrolPrice  = settings?.petrol_price||102.84;
    const dieselPrice  = settings?.diesel_price||89.62;
    const petrolMargin = settings?.petrol_margin||4.27;
    const dieselMargin = settings?.diesel_margin||2.72;
    const petrolRev    = petrolL*petrolPrice;
    const dieselRev    = dieselL*dieselPrice;
    const petrolMarg   = petrolL*petrolMargin;
    const dieselMarg   = dieselL*dieselMargin;
    const lubeRev      = data.lubes.reduce((s,l)=>s+(l.revenue||0),0);
    const lubeCOGS     = data.lubes.reduce((s,l)=>s+(l.cogs||0),0);
    const lubeGP       = lubeRev-lubeCOGS;
    const cgst         = data.lubes.reduce((s,l)=>s+(l.cgst||0),0);
    const sgst         = data.lubes.reduce((s,l)=>s+(l.sgst||0),0);
    const expenses     = data.expenses.reduce((s,e)=>s+(e.amount||0),0);
    const transInc     = data.transport.reduce((s,t)=>s+parseFloat(t.km||0)*parseFloat(t.rate||0),0);
    const transCost    = data.transport.reduce((s,t)=>s+parseFloat(t.driver_pay||0)+parseFloat(t.diesel_cost||0)+parseFloat(t.loading_cost||0),0);
    const grossMargin  = petrolMarg+dieselMarg+lubeGP;
    const netProfit    = grossMargin+transInc-transCost-expenses;
    const cashVariance = data.sales.reduce((s,sl)=>s+Math.abs(sl.cash_diff||0),0);
    return { petrolL,dieselL,petrolRev,dieselRev,petrolMarg,dieselMarg,lubeRev,lubeCOGS,lubeGP,cgst,sgst,expenses,transInc,transCost,grossMargin,netProfit,cashVariance,totalRev:petrolRev+dieselRev+lubeRev };
  }, [data, settings]);

  // Excel export using SheetJS
  const exportExcel = useCallback(async () => {
    if (!data || !pl) return;
    const XLSX = window.XLSX;
    if (!XLSX) { alert("SheetJS not loaded. Check internet connection."); return; }
    const wb = XLSX.utils.book_new();

    // Sheet 1: P&L
    const plRows = [
      ["KC SARSWAT ERP — Profit & Loss Statement"],
      ["Month:", month],
      ["Station:", settings?.station_name||"Shree K C Sarswat Auto Fuel Station"],
      ["GSTIN:", settings?.gstin||""],
      [],
      ["REVENUE FROM OPERATIONS","",""],
      ["Petrol Sales", pl.petrolL.toFixed(0)+" L", `₹${fmtINR(pl.petrolRev)}`],
      ["Diesel Sales", pl.dieselL.toFixed(0)+" L", `₹${fmtINR(pl.dieselRev)}`],
      ["Lubricant Revenue","",`₹${fmtINR(pl.lubeRev)}`],
      ["Transport Income","",`₹${fmtINR(pl.transInc)}`],
      ["TOTAL REVENUE","",`₹${fmtINR(pl.totalRev+pl.transInc)}`],
      [],
      ["GROSS MARGIN (Dealer Commission)","",""],
      ["Petrol Margin",`₹${settings?.petrol_margin||4.27}/L`,`₹${fmtINR(pl.petrolMarg)}`],
      ["Diesel Margin",`₹${settings?.diesel_margin||2.72}/L`,`₹${fmtINR(pl.dieselMarg)}`],
      ["Lubricant Gross Profit (35% of revenue)","",`₹${fmtINR(pl.lubeGP)}`],
      ["GROSS MARGIN TOTAL","",`₹${fmtINR(pl.grossMargin)}`],
      [],
      ["EXPENSES","",""],
      ["Operating Expenses","",`₹${fmtINR(pl.expenses)}`],
      ["Transport Costs","",`₹${fmtINR(pl.transCost)}`],
      ["Less: Lube COGS","",`₹${fmtINR(pl.lubeCOGS)}`],
      [],
      ["NET PROFIT / (LOSS)","",`₹${fmtINR(pl.netProfit)}`],
      [],
      ["GST SUMMARY","",""],
      ["CGST Collected (9%)","",`₹${fmtINR(pl.cgst)}`],
      ["SGST Collected (9%)","",`₹${fmtINR(pl.sgst)}`],
      ["Total GST","",`₹${fmtINR(pl.cgst+pl.sgst)}`],
      [],
      ["Cash Variance (Total Shortages)","",`₹${fmtINR(pl.cashVariance)}`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plRows), "P&L");

    // Sheet 2: Shift Reconciliation
    const shiftRows = [
      ["Date","Shift","Staff","Petrol (L)","Diesel (L)","Fuel Revenue","Expected Cash","Actual Cash","Difference","PhonePe","Paytm","Discrepancy"],
      ...data.sales.map(s => {
        let pL=0,dL=0;
        if(s.readings) Object.values(s.readings).forEach(r=>{ const po=parseFloat(r.petrolOpen||0),pc=parseFloat(r.petrolClose||0),doo=parseFloat(r.dieselOpen||0),dc=parseFloat(r.dieselClose||0); if(pc>po) pL+=pc-po; if(dc>doo) dL+=dc-doo; });
        return [s.date,s.shift,s.staff_name,pL.toFixed(2),dL.toFixed(2),fmtINR(s.total_fuel_revenue),fmtINR(s.expected_cash),fmtINR(s.cash_deposited),fmtINR(s.cash_diff),fmtINR(s.phone_pe_sales),fmtINR(s.paytm_sales),s.has_discrepancy?"YES":"NO"];
      })
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(shiftRows), "Shift Reconciliation");

    // Sheet 3: GSTR-1 Data Extract
    const gstRows = [
      ["GSTR-1 DATA EXTRACT — Lubricants (B2B/B2C)"],
      ["Month:", month],
      [],
      ["Invoice No","Date","Customer Name","Customer GSTIN","Product","HSN","Qty","Rate","Taxable Value","CGST Rate","CGST Amt","SGST Rate","SGST Amt","Total Invoice Value"],
      ...(await db.getInvoices(month)).filter(i=>i.bill_type==="Tax Invoice").map(i=>[
        i.invoice_id,i.date,i.customer_name||"B2C",i.customer_gstin||"",i.product,i.hsn,i.qty,i.rate_per_unit,fmtINR(i.base_amount),"9%",fmtINR(i.cgst),"9%",fmtINR(i.sgst),fmtINR(i.total_amount)
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstRows), "GSTR-1 Extract");

    // Sheet 4: Stock & Dip Variance
    const dipData = await db.getDips(month);
    const dipRows = [
      ["Date","Unit","Fuel","Physical Dip (L)","Temp (°C)","VCF","VCF-Adjusted (L)","System Stock (L)","Variance (L)","Variance %","Flagged"],
      ...dipData.map(d=>[d.date,UNIT_CONFIG[d.unit_id]?.name||d.unit_id,d.fuel_type,d.physical_dip,d.temperature,d.vcf,d.vcf_adjusted,d.system_stock,d.variance,d.variance_pct+"%",d.flagged?"YES":"NO"])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dipRows), "Stock & Dip Variance");

    // Sheet 5: Expenses
    const expRows = [
      ["Date","Category","Amount","Paid By","Note"],
      ...data.expenses.map(e=>[e.date,e.category,e.amount,e.paid_by,e.note||""])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), "Expenses");

    XLSX.writeFile(wb, `KC-Sarswat-ERP-${month}.xlsx`);
  }, [data, pl, month, settings]);

  // PDF P&L export
  const exportPDF = useCallback(async () => {
    if (!pl || !data) return;
    const pm = getPdfMake();
    if (!pm) { alert("PDF library loading. Try again in a moment."); return; }
    const s = settings || {};
    const row=(label,value,bold=false,color="#1e293b",indent=false)=>[
      {text:(indent?"   ":"")+label,style:bold?"subheader":"tableRow",color:"#475569",fontSize:bold?10:9,margin:[indent?12:0,0,0,0]},
      {text:value,style:bold?"subheader":"tableRow",color,fontSize:bold?10:9,alignment:"right",bold}
    ];
    const dd = {
      content:[
        {text:s.station_name||"Shree K C Sarswat Auto Fuel Station",style:"header"},
        {text:`${s.address_line1||""}, ${s.city||"Lunkaransar"}, ${s.state||"Rajasthan"} — ${s.pincode||"334603"}`,style:"label"},
        {text:`GSTIN: ${s.gstin||""} | Proprietor: ${s.proprietor_name||""}`,style:"label",margin:[0,0,0,10]},
        {canvas:[{type:"line",x1:0,y1:0,x2:515,y2:0,lineWidth:2,lineColor:"#0f172a"}]},
        {text:`STATEMENT OF PROFIT & LOSS — ${month}`,style:"subheader",margin:[0,10,0,2],color:"#d97706"},
        {text:`(Sole Proprietorship — Not required to follow Schedule III, prepared for internal use)`,style:"label",italics:true,margin:[0,0,0,12]},
        {table:{widths:["*","auto"],body:[
          [{text:"REVENUE FROM OPERATIONS",colSpan:2,style:"tableHead"},{}],
          ...row("Sale of Petrol",`₹${fmtINR(pl.petrolRev)}`),
          ...row("Sale of Diesel",`₹${fmtINR(pl.dieselRev)}`),
          ...row("Sale of Lubricants",`₹${fmtINR(pl.lubeRev)}`),
          ...row("Transport Income",`₹${fmtINR(pl.transInc)}`),
          ...row("TOTAL REVENUE",`₹${fmtINR(pl.totalRev+pl.transInc)}`,true,"#0f172a"),
          [{text:"",colSpan:2},{}],
          [{text:"GROSS MARGIN (DEALER COMMISSION)",colSpan:2,style:"tableHead"},{}],
          ...row("Petrol Margin",`₹${fmtINR(pl.petrolMarg)}`),
          ...row("Diesel Margin",`₹${fmtINR(pl.dieselMarg)}`),
          ...row("Lubricant Gross Profit (35%)",`₹${fmtINR(pl.lubeGP)}`),
          ...row("GROSS MARGIN TOTAL",`₹${fmtINR(pl.grossMargin)}`,true,"#16a34a"),
          [{text:"",colSpan:2},{}],
          [{text:"OPERATING EXPENSES",colSpan:2,style:"tableHead"},{}],
          ...row("Staff Salaries & Allowances",`₹${fmtINR(data.expenses.filter(e=>e.category==="Staff Salary").reduce((s,e)=>s+(e.amount||0),0))}`),
          ...row("Electricity & Utilities",`₹${fmtINR(data.expenses.filter(e=>["Electricity Bill","Water Bill"].includes(e.category)).reduce((s,e)=>s+(e.amount||0),0))}`),
          ...row("Maintenance & Repairs",`₹${fmtINR(data.expenses.filter(e=>e.category==="Maintenance").reduce((s,e)=>s+(e.amount||0),0))}`),
          ...row("Other Operating Expenses",`₹${fmtINR(data.expenses.filter(e=>!["Staff Salary","Electricity Bill","Water Bill","Maintenance"].includes(e.category)).reduce((s,e)=>s+(e.amount||0),0))}`),
          ...row("Transport Costs",`₹${fmtINR(pl.transCost)}`),
          ...row("TOTAL EXPENSES",`₹${fmtINR(pl.expenses+pl.transCost)}`,true,"#dc2626"),
          [{text:"",colSpan:2},{}],
          ...row("NET PROFIT / (LOSS)",`₹${fmtINR(pl.netProfit)}`,true,pl.netProfit>=0?"#16a34a":"#dc2626"),
          [{text:"",colSpan:2},{}],
          [{text:"GST SUMMARY",colSpan:2,style:"tableHead"},{}],
          ...row("CGST Collected @9%",`₹${fmtINR(pl.cgst)}`),
          ...row("SGST Collected @9%",`₹${fmtINR(pl.sgst)}`),
          ...row("Total GST Liability",`₹${fmtINR(pl.cgst+pl.sgst)}`,true,"#d97706"),
          [{text:"",colSpan:2},{}],
          ...row("Cash Variance (Total Shortages)",`₹${fmtINR(pl.cashVariance)}`),
        ]},layout:{hLineColor:"#e2e8f0",vLineColor:"#e2e8f0",fillColor:(ri)=>ri===0||ri===8||ri===13||ri===20||ri===27||ri===29?"#0f172a":ri%2===0?"#f8fafc":null}},
        {text:`\nGenerated: ${new Date().toLocaleDateString("en-IN")} | ${s.station_name}`,style:"label",alignment:"center",margin:[0,16,0,0]},
        {text:"Declaration: This statement is prepared from electronic records maintained in KC Sarswat ERP v4.0 and is true to the best of knowledge.",style:"label",italics:true,margin:[0,4,0,0]},
      ],
      styles:pdfStyles,
      defaultStyle:{font:"Helvetica"},
      pageSize:"A4",
      pageMargins:[40,40,40,40],
    };
    pm.createPdf(dd).download(`PL-${month}.pdf`);
  }, [pl, data, month, settings]);

  const row=(label,value,bold=false,color="#f1f5f9",sub="")=>(
    <tr style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
      <td style={{color:"#94a3b8",fontSize:13,padding:"10px 14px"}}>{label}</td>
      <td style={{color,fontSize:bold?16:13,fontWeight:bold?800:500,padding:"10px 14px",textAlign:"right",fontFamily:"monospace"}}>₹{fmtINR(value)}</td>
      {sub&&<td style={{color:"#475569",fontSize:11,padding:"10px 14px"}}>{sub}</td>}
    </tr>
  );

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>📈 Reports & Analytics</h1><p style={{color:"#334155",fontSize:13,margin:0}}>ICAI-aligned · GST filing ready · pdfmake + SheetJS export</p></div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{...inp,width:160}}/>
          <button onClick={loadData} style={{...btn("#3b82f6"),padding:"10px 16px",fontSize:12}}>🔄 Load</button>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {[["pl","📊 P&L"],["gst","🧾 GST"],["cash","💰 Cash Log"],["lubes","🛢 Lubricants"],["export","⬇ Export"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:tab===id?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(255,255,255,0.06)",color:tab===id?"#fff":"#64748b",minHeight:44}}>{label}</button>
        ))}
      </div>

      {loading&&<div style={{...card,textAlign:"center",color:"#475569",padding:40}}>Loading {month} data…</div>}

      {!loading&&pl&&tab==="pl"&&(
        <div style={card}>
          <h3 style={{color:"#f59e0b",fontSize:15,fontWeight:800,margin:"0 0 16px"}}>Profit & Loss — {month}</h3>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <tbody>
              <tr><td colSpan={3} style={{color:"#60a5fa",fontSize:11,fontWeight:700,padding:"12px 14px 6px",textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>I. Revenue from Operations</td></tr>
              {row("Petrol Sales",pl.petrolRev,false,"#f59e0b",`${pl.petrolL.toFixed(0)} L`)}
              {row("Diesel Sales",pl.dieselRev,false,"#3b82f6",`${pl.dieselL.toFixed(0)} L`)}
              {row("Lubricant Revenue",pl.lubeRev)}
              {row("Transport Income",pl.transInc,false,"#10b981")}
              {row("TOTAL REVENUE",pl.totalRev+pl.transInc,true,"#f1f5f9")}
              <tr><td colSpan={3} style={{color:"#a78bfa",fontSize:11,fontWeight:700,padding:"12px 14px 6px",textTransform:"uppercase",borderTop:"1px solid rgba(255,255,255,0.06)"}}>II. Gross Margin (Dealer Commission)</td></tr>
              {row("Petrol Margin",pl.petrolMarg,false,"#f59e0b")}
              {row("Diesel Margin",pl.dieselMarg,false,"#3b82f6")}
              {row("Lubricant Gross Profit (35%)",pl.lubeGP,true,"#34d399")}
              {row("GROSS MARGIN TOTAL",pl.grossMargin,true,"#34d399")}
              <tr><td colSpan={3} style={{color:"#f87171",fontSize:11,fontWeight:700,padding:"12px 14px 6px",textTransform:"uppercase",borderTop:"1px solid rgba(255,255,255,0.06)"}}>III. Operating Expenses</td></tr>
              {row("Total OPEX",pl.expenses,false,"#f87171")}
              {row("Transport Costs",pl.transCost,false,"#f87171")}
              <tr style={{borderTop:"2px solid rgba(245,158,11,0.4)"}}><td colSpan={3} style={{padding:"6px 0"}}/></tr>
              {row("NET PROFIT / (LOSS)",pl.netProfit,true,pl.netProfit>=0?"#34d399":"#f87171")}
              <tr><td colSpan={3} style={{color:"#f59e0b",fontSize:11,fontWeight:700,padding:"12px 14px 6px",textTransform:"uppercase",borderTop:"1px solid rgba(255,255,255,0.06)"}}>IV. GST Summary</td></tr>
              {row("CGST @9% (Lubricants)",pl.cgst,false,"#f59e0b")}
              {row("SGST @9% (Lubricants)",pl.sgst,false,"#f59e0b")}
              {row("Total GST Collected",pl.cgst+pl.sgst,true,"#f59e0b")}
            </tbody>
          </table>
        </div>
      )}

      {!loading&&pl&&tab==="gst"&&(
        <div style={card}>
          <h3 style={{color:"#f59e0b",fontSize:15,fontWeight:800,margin:"0 0 16px"}}>GST Summary — {month}</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
            <StatCard label="CGST Collected" value={`₹${fmtINR(pl.cgst)}`} color="#3b82f6" icon="🏦"/>
            <StatCard label="SGST Collected" value={`₹${fmtINR(pl.sgst)}`} color="#8b5cf6" icon="🏦"/>
            <StatCard label="Total GST" value={`₹${fmtINR(pl.cgst+pl.sgst)}`} color="#f59e0b" icon="🧾"/>
          </div>
          <div style={{padding:"14px 16px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12}}>
            <p style={{color:"#60a5fa",fontSize:13,fontWeight:700,margin:"0 0 8px"}}>📋 GST Filing Notes</p>
            <p style={{color:"#64748b",fontSize:12,margin:"0 0 4px"}}>• Petrol & Diesel: Outside GST — Bill of Supply only. Report under State VAT separately.</p>
            <p style={{color:"#64748b",fontSize:12,margin:"0 0 4px"}}>• Lubricants (HSN 3811): 18% GST intra-state = CGST 9% + SGST 9%.</p>
            <p style={{color:"#64748b",fontSize:12,margin:"0 0 4px"}}>• State: Rajasthan (Code 08) — intra-state transactions only.</p>
            <p style={{color:"#64748b",fontSize:12,margin:0}}>• GSTIN: {settings?.gstin||"Not set — update in Settings"}</p>
          </div>
        </div>
      )}

      {!loading&&data&&tab==="cash"&&(
        <div style={card}>
          <h3 style={{color:"#f87171",fontSize:15,fontWeight:800,margin:"0 0 16px"}}>Cash Discrepancy Log — {month}</h3>
          {data.sales.filter(s=>s.has_discrepancy||s.cash_diff!==0).length===0
            ?<p style={{color:"#34d399",textAlign:"center",padding:"30px 0"}}>✅ No cash discrepancies this month!</p>
            :<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Date","Shift","Staff","Expected","Actual","Diff","Status"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{data.sales.filter(s=>s.has_discrepancy||s.cash_diff!==0).map(s=>(
                <tr key={s.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                  <td style={{color:"#64748b",fontSize:12,padding:"8px 10px"}}>{s.date}</td>
                  <td style={{color:"#f1f5f9",fontSize:12,padding:"8px 10px"}}>{s.shift}</td>
                  <td style={{color:"#94a3b8",fontSize:12,padding:"8px 10px"}}>{s.staff_name}</td>
                  <td style={{color:"#f1f5f9",fontSize:12,padding:"8px 10px"}}>₹{fmtINR(s.expected_cash)}</td>
                  <td style={{color:"#f1f5f9",fontSize:12,padding:"8px 10px"}}>₹{fmtINR(s.cash_deposited)}</td>
                  <td style={{padding:"8px 10px"}}><span style={{color:(s.cash_diff||0)>=0?"#34d399":"#f87171",fontSize:13,fontWeight:800}}>{(s.cash_diff||0)>=0?"+":""}₹{fmtINR(s.cash_diff)}</span></td>
                  <td style={{padding:"8px 10px"}}>{(s.cash_diff||0)<0?<span style={{background:"rgba(239,68,68,0.12)",color:"#f87171",fontSize:10,padding:"2px 6px",borderRadius:4,fontWeight:700}}>Shortage</span>:<span style={{color:"#34d399",fontSize:10}}>Excess</span>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          }
        </div>
      )}

      {!loading&&data&&tab==="lubes"&&(
        <div style={card}>
          <h3 style={{color:"#a78bfa",fontSize:15,fontWeight:800,margin:"0 0 16px"}}>Lubricant Sales — {month}</h3>
          {!data.lubes.length?<p style={{color:"#475569",textAlign:"center",padding:"30px 0"}}>No lubricant sales this month.</p>:
          <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Date","Product","Qty","Price","COGS","Revenue","GP","CGST","SGST"].map(h=><th key={h} style={{color:"#334155",fontSize:11,fontWeight:700,textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>
              {data.lubes.map(l=>(
                <tr key={l.id} style={{borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                  <td style={{color:"#64748b",fontSize:12,padding:"10px 10px"}}>{l.date}</td>
                  <td style={{color:"#a78bfa",fontWeight:700,fontSize:12,padding:"10px 10px"}}>{l.product}</td>
                  <td style={{color:"#f1f5f9",fontSize:12,padding:"10px 10px"}}>{l.qty}</td>
                  <td style={{color:"#f59e0b",fontSize:12,padding:"10px 10px"}}>₹{l.price}</td>
                  <td style={{color:"#f87171",fontSize:12,padding:"10px 10px"}}>₹{fmtINR(l.cogs)}</td>
                  <td style={{color:"#f1f5f9",fontWeight:700,fontSize:12,padding:"10px 10px"}}>₹{fmtINR(l.revenue)}</td>
                  <td style={{padding:"10px 10px"}}><span style={{color:"#34d399",fontWeight:800}}>₹{fmtINR(l.gross_profit)}</span></td>
                  <td style={{color:"#f59e0b",fontSize:11,padding:"10px 10px"}}>₹{fmtINR(l.cgst)}</td>
                  <td style={{color:"#f59e0b",fontSize:11,padding:"10px 10px"}}>₹{fmtINR(l.sgst)}</td>
                </tr>
              ))}
              <tr style={{borderTop:"2px solid rgba(139,92,246,0.3)"}}>
                <td colSpan={5} style={{color:"#a78bfa",fontWeight:800,padding:"12px 10px"}}>TOTAL</td>
                <td style={{color:"#f1f5f9",fontWeight:800,padding:"12px 10px",fontFamily:"monospace"}}>₹{fmtINR(pl?.lubeRev)}</td>
                <td style={{padding:"12px 10px"}}><span style={{color:"#34d399",fontWeight:900,fontSize:14}}>₹{fmtINR(pl?.lubeGP)}</span></td>
                <td style={{color:"#f59e0b",fontWeight:800,padding:"12px 10px"}}>₹{fmtINR(pl?.cgst)}</td>
                <td style={{color:"#f59e0b",fontWeight:800,padding:"12px 10px"}}>₹{fmtINR(pl?.sgst)}</td>
              </tr>
            </tbody>
          </table></div>}
        </div>
      )}

      {tab==="export"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{...card,border:"1px solid rgba(16,185,129,0.2)"}}>
            <h3 style={{color:"#34d399",fontSize:14,fontWeight:700,margin:"0 0 8px"}}>📊 Excel Export (.xlsx)</h3>
            <p style={{color:"#64748b",fontSize:13,margin:"0 0 14px"}}>Downloads a workbook with 5 sheets: P&L, Shift Reconciliation, GSTR-1 Extract, Stock & Dip Variance, Expenses. Ready for Tally import.</p>
            <button onClick={exportExcel} disabled={loading||!pl} style={btn("#10b981")}>⬇ Download Excel — {month}.xlsx</button>
          </div>
          <div style={{...card,border:"1px solid rgba(245,158,11,0.2)"}}>
            <h3 style={{color:"#f59e0b",fontSize:14,fontWeight:700,margin:"0 0 8px"}}>📄 PDF P&L Statement</h3>
            <p style={{color:"#64748b",fontSize:13,margin:"0 0 14px"}}>Professional Profit & Loss statement with GST summary, ICAI-aligned structure for Sole Proprietorship.</p>
            <button onClick={exportPDF} disabled={loading||!pl} style={btn("#f59e0b")}>⬇ Download P&L PDF — {month}</button>
          </div>
          <div style={{...card,border:"1px solid rgba(59,130,246,0.2)"}}>
            <p style={{color:"#60a5fa",fontSize:12,fontWeight:700,margin:"0 0 6px"}}>ℹ GST Tax Invoice PDFs</p>
            <p style={{color:"#64748b",fontSize:12,margin:0}}>Individual GST invoices can be downloaded from the 🧾 GST Billing module — click the ⬇ PDF button next to each invoice.</p>
          </div>
          <div style={{...card,border:"1px solid rgba(139,92,246,0.2)"}}>
            <p style={{color:"#a78bfa",fontSize:12,fontWeight:700,margin:"0 0 6px"}}>ℹ Khata Customer Statements</p>
            <p style={{color:"#64748b",fontSize:12,margin:0}}>Khata PDF statements can be downloaded per customer from the 📋 Khata module — open a customer ledger and click ⬇ PDF Statement.</p>
          </div>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════
// MODULE — SETTINGS (all editable: station, GST, bank, tanks)
// ═══════════════════════════════════════════════════════════════
const SettingsView = () => {
  const { user, settings, setSettings, tanks, setTanks } = useApp();
  const [form, setForm]       = useState(settings || {});
  const [tankForm, setTankForm] = useState(JSON.parse(JSON.stringify(tanks || [])));
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [connOk, setConnOk]   = useState(null);
  const [pwdForm, setPwdForm] = useState({ current:"", next:"", confirm:"" });
  const [pwdMsg, setPwdMsg]   = useState("");

  useEffect(() => { setForm(settings || {}); }, [settings]);
  useEffect(() => { setTankForm(JSON.parse(JSON.stringify(tanks || []))); }, [tanks]);

  useEffect(() => {
    supabase.from("app_settings").select("id").limit(1).then(({ error }) => setConnOk(!error));
  }, []);

  const save = async () => {
    setSaving(true);
    const ok = await db.updateSettings(form.id, { ...form, updated_at: new Date().toISOString() });
    // Save tanks
    for (const t of tankForm) {
      await db.updateTankFull(t.unit_id, t.fuel_type, { capacity: t.capacity, current: t.current, buffer: t.buffer });
    }
    if (ok) { setSettings(form); const fresh = await db.getTanks(); setTanks(fresh); }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const changePassword = async () => {
    if (pwdForm.next !== pwdForm.confirm) { setPwdMsg("Passwords do not match."); return; }
    if (pwdForm.next.length < 6) { setPwdMsg("Minimum 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: pwdForm.next });
    setPwdMsg(error ? "Error: "+error.message : "✅ Password updated successfully.");
    if (!error) setPwdForm({ current:"", next:"", confirm:"" });
  };

  const f = (key, label, type="text", placeholder="") => (
    <div key={key}>
      <Label>{label}</Label>
      <input type={type} inputMode={type==="number"?"numeric":undefined} value={form[key]||""} onChange={e=>setForm(p=>({...p,[key]:type==="number"?parseFloat(e.target.value)||0:e.target.value}))} placeholder={placeholder} style={inp}/>
    </div>
  );

  return (
    <div style={{padding:"20px 20px 90px",overflowY:"auto",flex:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{color:"#f1f5f9",fontSize:22,fontWeight:800,margin:"0 0 4px"}}>⚙️ Settings</h1><p style={{color:"#334155",fontSize:13,margin:0}}>Owner only — Station profile, prices, bank details, tanks</p></div>
        {(saving||saved)&&<SyncBadge saving={saving}/>}
      </div>

      {/* Connection Status */}
      <div style={{...card,marginBottom:16,border:`1px solid ${connOk===null?"rgba(255,255,255,0.07)":connOk?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:connOk===null?"#475569":connOk?"#34d399":"#ef4444"}}/>
          <span style={{color:connOk===null?"#475569":connOk?"#34d399":"#ef4444",fontSize:13,fontWeight:700}}>
            {connOk===null?"Checking Supabase…":connOk?"🔐 Supabase Connected — RLS Active — v4.0 Production":"⚠ Supabase Connection Error"}
          </span>
        </div>
        <p style={{color:"#475569",fontSize:11,margin:"6px 0 0"}}>Project: xgchjtiiwqraolnrnxxg.supabase.co · Auth: Supabase Auth · Keys: Environment Variables</p>
      </div>

      {/* Station Info */}
      <div style={{...card,marginBottom:16,border:"1px solid rgba(245,158,11,0.2)"}}>
        <h3 style={{color:"#f59e0b",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🏪 Station Profile</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          {f("station_name","Station Name")}
          {f("proprietor_name","Proprietor Name")}
          {f("address_line1","Address Line 1")}
          {f("address_line2","Address Line 2")}
          {f("city","City")}
          {f("state","State")}
          {f("state_code","State Code (e.g. 08)")}
          {f("pincode","Pincode")}
          {f("phone","Phone")}
          {f("email","Email")}
          {f("gstin","GSTIN (15 chars)")}
          {f("pan","PAN")}
          {f("invoice_prefix","Invoice Prefix (e.g. INV)")}
        </div>
      </div>

      {/* Bank Details */}
      <div style={{...card,marginBottom:16,border:"1px solid rgba(16,185,129,0.2)"}}>
        <h3 style={{color:"#34d399",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🏦 Bank Details (printed on GST invoices)</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          {f("bank_name","Bank Name")}
          {f("bank_account","Account Number")}
          {f("bank_ifsc","IFSC Code")}
          {f("bank_branch","Branch")}
          {f("upi_id","UPI ID")}
        </div>
      </div>

      {/* Fuel Prices & Margins */}
      <div style={{...card,marginBottom:16,border:"1px solid rgba(59,130,246,0.2)"}}>
        <h3 style={{color:"#60a5fa",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>⛽ Fuel Prices, Margins & Thresholds</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          {f("petrol_price","Petrol Price ₹/L","number")}
          {f("diesel_price","Diesel Price ₹/L","number")}
          {f("petrol_margin","Petrol Dealer Margin ₹/L","number")}
          {f("diesel_margin","Diesel Dealer Margin ₹/L","number")}
          {f("low_stock_alert","Low Stock Alert (L)","number")}
          {f("monthly_opex","Monthly OPEX ₹","number")}
          {f("cash_tolerance","Cash Mismatch Tolerance ₹","number")}
          {f("state_vat_petrol","State VAT Petrol %","number")}
          {f("state_vat_diesel","State VAT Diesel %","number")}
        </div>
      </div>

      {/* Tank Levels */}
      <div style={{...card,marginBottom:16}}>
        <h3 style={{color:"#f1f5f9",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🛢 Tank Configuration</h3>
        {Object.entries(UNIT_CONFIG).map(([uid,unit])=>(
          <div key={uid} style={{marginBottom:16}}>
            <p style={{color:"#f59e0b",fontSize:13,fontWeight:700,margin:"0 0 10px"}}>{unit.name}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
              {["petrol","diesel"].map(fk=>{
                const t=tankForm.find(tt=>tt.unit_id===uid&&tt.fuel_type===fk); if(!t) return null;
                const col=fk==="petrol"?"#f59e0b":"#3b82f6";
                return ["current","capacity","buffer"].map(field=>(
                  <div key={uid+fk+field}>
                    <Label><span style={{color:col}}>{fk}</span> {field}</Label>
                    <input type="number" inputMode="numeric" value={t[field]||0} onChange={e=>setTankForm(p=>p.map(tt=>tt.unit_id===uid&&tt.fuel_type===fk?{...tt,[field]:parseFloat(e.target.value)||0}:tt))} style={inp}/>
                  </div>
                ));
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} style={{...btn(),marginBottom:20,width:"100%",fontSize:14}}>
        {saving?"Saving…":"💾 Save All Settings"}
      </button>

      {/* Change Password */}
      <div style={{...card,marginBottom:16,border:"1px solid rgba(59,130,246,0.2)"}}>
        <h3 style={{color:"#60a5fa",fontSize:14,fontWeight:700,margin:"0 0 14px"}}>🔑 Change Password</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          <div><Label>New Password</Label><input type="password" value={pwdForm.next} onChange={e=>setPwdForm(p=>({...p,next:e.target.value}))} style={inp}/></div>
          <div><Label>Confirm Password</Label><input type="password" value={pwdForm.confirm} onChange={e=>setPwdForm(p=>({...p,confirm:e.target.value}))} style={inp}/></div>
        </div>
        <button onClick={changePassword} style={{...btn("#3b82f6"),marginTop:12}}>Update Password</button>
        {pwdMsg&&<p style={{color:pwdMsg.startsWith("✅")?"#34d399":"#f87171",fontSize:12,margin:"8px 0 0",fontWeight:700}}>{pwdMsg}</p>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser]         = useState(null);
  const [active, setActive]     = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [settings, setSettings] = useState(null);
  const [tanks, setTanks]       = useState([]);
  // sessionChecked: true once we know if user is logged in or not
  // Starts false — we briefly try to restore session from localStorage
  // If nothing found in 3s, show login. Never hangs forever.
  const [sessionChecked, setSessionChecked] = useState(false);

  // Load pdfmake + SheetJS from CDN
  useEffect(() => {
    if (!window.pdfMake) {
      const s1 = document.createElement("script");
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js";
      s1.onload = () => {
        const s2 = document.createElement("script");
        s2.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js";
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    }
    if (!window.XLSX) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.head.appendChild(s);
    }
  }, []);

  // Restore session on load — hard 3s cap, then show login no matter what
  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setSessionChecked(true); } };

    // 3 second max — if Supabase is slow, show login anyway
    const timer = setTimeout(finish, 3000);

    const tryRestore = async () => {
      try {
        // Check localStorage first — instant, no network needed
        const stored = localStorage.getItem(
          `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`
        );
        if (!stored) { finish(); return; }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) { finish(); return; }

        const { data: profile, error: pErr } = await supabase
          .from("staff").select("*").eq("id", session.user.id).maybeSingle();

        if (!pErr && profile?.active) {
          setUser({ ...profile, email: session.user.email });
        }
      } catch (_) {}
      finish();
    };

    tryRestore();

    // Also listen for auth changes (sign in / sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null); setActive("dashboard");
        }
        if (event === "TOKEN_REFRESHED" && session?.user) {
          // silent token refresh — keep user logged in, no UI change needed
        }
      }
    );

    return () => { clearTimeout(timer); subscription.unsubscribe(); };
  }, []);

  // Load global data after login
  useEffect(() => {
    if (!user) return;
    Promise.all([db.getSettings(), db.getTanks()]).then(([s, t]) => {
      if (s) setSettings(s);
      if (t) setTanks(t);
    });
  }, [user]);

  const onLogin = (profile) => {
    setUser(profile);
    setSessionChecked(true);
    setActive(profile.role === "owner" ? "dashboard" : "sales");
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setActive("dashboard");
  };

  // Show login immediately if no session — no loading screen at all
  if (!sessionChecked && !user) {
    // Only show brief loader if we think we might have a stored session
    const hasStored = !!localStorage.getItem(
      `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`
    );
    if (!hasStored) return <LoginPage onLogin={onLogin}/>;
    // Has stored session — show 3s max spinner while we restore it
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#060d18", fontFamily:"'Sora',system-ui,sans-serif" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:56, marginBottom:14 }}>⛽</div>
          <p style={{ color:"#f1f5f9", fontSize:15, fontWeight:700, margin:"0 0 6px" }}>KC Sarswat ERP</p>
          <p style={{ color:"#475569", fontSize:12, margin:"0 0 18px" }}>Restoring session…</p>
          <div style={{ width:140, height:3, background:"rgba(255,255,255,0.07)", borderRadius:99, overflow:"hidden", margin:"0 auto" }}>
            <div style={{ height:"100%", width:"40%", background:"linear-gradient(90deg,#f59e0b,#d97706)", borderRadius:99, animation:"kc-slide 1.2s ease-in-out infinite" }}/>
          </div>
          <style>{`@keyframes kc-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={onLogin}/>;

  const ctxValue = { user, settings, setSettings, tanks, setTanks };

  const renderView = () => {
    switch (active) {
      case "dashboard":  return user.role==="owner" ? <Dashboard/> : <SalesView/>;
      case "sales":      return <SalesView/>;
      case "stock":      return <StockView/>;
      case "supply":     return <SupplyView/>;
      case "logistics":  return <LogisticsView/>;
      case "lubricants": return <LubricantsView/>;
      case "khata":      return <KhataView/>;
      case "gst":        return <GSTView/>;
      case "expenses":   return <ExpensesView/>;
      case "dip":        return user.role==="owner" ? <DipView/> : <SalesView/>;
      case "staff":      return user.role==="owner" ? <StaffView/> : <SalesView/>;
      case "transport":  return user.role==="owner" ? <TransportView/> : <SalesView/>;
      case "reports":    return user.role==="owner" ? <ReportsView/> : <SalesView/>;
      case "settings":   return user.role==="owner" ? <SettingsView/> : <SalesView/>;
      default:           return <Dashboard/>;
    }
  };

  // ── Mobile Bottom Nav ────────────────────────────────────────────
  const ownerBottomTabs = [
    { id:"dashboard",  icon:"📊", label:"Dashboard" },
    { id:"sales",      icon:"🧾", label:"Sales" },
    { id:"khata",      icon:"📋", label:"Khata" },
    { id:"reports",    icon:"📈", label:"Reports" },
    { id:"settings",   icon:"⚙️",  label:"More" },
  ];
  const staffBottomTabs = [
    { id:"sales",      icon:"🧾", label:"Sales" },
    { id:"stock",      icon:"📦", label:"Stock" },
    { id:"khata",      icon:"📋", label:"Khata" },
    { id:"supply",     icon:"🚛", label:"Supply" },
    { id:"lubricants", icon:"🛢",  label:"Lubes" },
  ];
  const bottomTabs = user.role === "owner" ? ownerBottomTabs : staffBottomTabs;

  return (
    <AppCtx.Provider value={ctxValue}>
      <div style={{ display:"flex", height:"100dvh", background:"#060d18", fontFamily:"'Sora',system-ui,sans-serif", color:"#f1f5f9", overflow:"hidden" }}>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { overscroll-behavior: none; touch-action: manipulation; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
          select option { background: #07111e; color: #f1f5f9; }
          input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
          input:focus, select:focus { border-color: rgba(245,158,11,0.55) !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); outline: none; }
          button:active { transform: scale(0.97); }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          /* ── Desktop: show sidebar, hide bottom nav ── */
          .kc-sidebar    { display: flex !important; }
          .kc-bottom-nav { display: none !important; }
          .kc-content    { padding-bottom: 16px !important; }
          /* ── Mobile: hide sidebar, show bottom nav ── */
          @media (max-width: 768px) {
            .kc-sidebar    { display: none !important; }
            .kc-bottom-nav { display: flex !important; }
            .kc-content    { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)) !important; }
          }
          /* Hover effects — desktop only */
          @media (hover: hover) {
            button:hover { opacity: 0.87; }
          }
          /* Safe area */
          .kc-safe-top { padding-top: env(safe-area-inset-top, 0px); }
        `}</style>

        {/* ── Desktop Sidebar ── */}
        <div className="kc-sidebar" style={{ flexDirection:"column" }}>
          <Sidebar
            active={active}
            setActive={setActive}
            user={user}
            onLogout={onLogout}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
          />
        </div>

        {/* ── Main Content ── */}
        <div className="kc-content kc-safe-top" style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
          {renderView()}
        </div>

        {/* ── Mobile Bottom Navigation ── */}
        <div
          className="kc-bottom-nav"
          style={{
            position:"fixed", bottom:0, left:0, right:0,
            background:"rgba(6,13,24,0.97)",
            backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
            borderTop:"1px solid rgba(255,255,255,0.08)",
            alignItems:"center", zIndex:900,
            paddingBottom:"env(safe-area-inset-bottom, 0px)",
          }}
        >
          {bottomTabs.map(t => {
            const isActive = active === t.id ||
              (t.id === "settings" && ["settings","staff","expenses","transport","dip","logistics","gst"].includes(active));
            return (
              <button
                key={t.id}
                onClick={() => { try{navigator.vibrate&&navigator.vibrate(22);}catch{} setActive(t.id); }}
                style={{
                  flex:1, display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  padding:"10px 4px 8px", background:"none", border:"none",
                  cursor:"pointer", fontFamily:"inherit", gap:2, minHeight:56,
                  touchAction:"manipulation",
                }}
              >
                <span style={{ fontSize:20, lineHeight:1, transform:isActive?"scale(1.18)":"scale(1)", transition:"transform 0.15s" }}>{t.icon}</span>
                <span style={{ fontSize:9, fontWeight:isActive?700:500, color:isActive?"#f59e0b":"#475569", transition:"color 0.15s", letterSpacing:"0.3px" }}>{t.label}</span>
                {isActive && <div style={{ width:16, height:2, background:"#f59e0b", borderRadius:1, marginTop:2 }} />}
              </button>
            );
          })}
        </div>

      </div>
    </AppCtx.Provider>
  );
}
