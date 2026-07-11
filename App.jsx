import { useState, useMemo, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Plus, X, Check, ChevronLeft, ChevronRight, Trash2, Pencil, Search,
  Wallet, TrendingUp, TrendingDown, PiggyBank, AlertTriangle, Sparkles,
  Receipt, Download, Printer, Copy, SlidersHorizontal, Utensils, Home,
  Car, ShoppingBag, Film, Activity, Briefcase, Laptop, Gift, Circle,
  ArrowUpRight, ArrowDownRight, IndianRupee,
} from "lucide-react";

/* ----------------------------------------------------------------------------
   LEDGERLINE — expense tracker with budget insights
   Single-file React app: income/expense logging, monthly reports, charts,
   per-category budgets, auto insights, and CSV / PDF export. In-memory state.
---------------------------------------------------------------------------- */

const C = {
  primary: "#0F9466", primaryDeep: "#0B7A54", expense: "#E5604D",
  ink: "#16201C", soft: "#5C6B63", line: "#E3E8E4", amber: "#E8A13A",
};

const EXPENSE_CATS = [
  { key: "Food", color: "#0F9466", icon: Utensils },
  { key: "Rent", color: "#3B82C4", icon: Home },
  { key: "Transport", color: "#E8A13A", icon: Car },
  { key: "Shopping", color: "#A855B8", icon: ShoppingBag },
  { key: "Bills", color: "#E5604D", icon: Receipt },
  { key: "Entertainment", color: "#14B8A6", icon: Film },
  { key: "Health", color: "#EC6A9C", icon: Activity },
  { key: "Other", color: "#7A8A82", icon: Circle },
];
const INCOME_CATS = [
  { key: "Salary", color: "#0F9466", icon: Briefcase },
  { key: "Freelance", color: "#3B82C4", icon: Laptop },
  { key: "Other", color: "#E8A13A", icon: Gift },
];
const catMeta = (type, key) =>
  (type === "income" ? INCOME_CATS : EXPENSE_CATS).find((c) => c.key === key) ||
  { key, color: C.soft, icon: Circle };

const DEFAULT_BUDGETS = { Food: 12000, Rent: 22000, Transport: 4000, Shopping: 6000, Bills: 5000, Entertainment: 3000, Health: 3000, Other: 2000 };

const pad = (n) => String(n).padStart(2, "0");
const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const inr = (n) => { const r = Math.round(Math.abs(n)); return (n < 0 ? "-₹" : "₹") + r.toLocaleString("en-IN"); };
const monthLong = (d) => d.toLocaleString("en-IN", { month: "long", year: "numeric" });
const monthShort = (d) => d.toLocaleString("en-IN", { month: "short" });
const rand = (a, b) => Math.round(a + Math.random() * (b - a));
const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------- seed data ---------------------------- */
function buildSeed() {
  const now = new Date();
  const txns = [];
  let id = 1;
  const push = (date, type, category, amount, note) =>
    txns.push({ id: "t" + id++, date: fmtISO(date), type, category, amount, note });

  for (let back = 5; back >= 0; back--) {
    const y = now.getFullYear(), mo = now.getMonth() - back;
    const base = new Date(y, mo, 1);
    const yy = base.getFullYear(), mm = base.getMonth();
    const dim = new Date(yy, mm + 1, 0).getDate();
    const day = (d) => new Date(yy, mm, Math.min(d, dim));
    const cap = back === 0 ? now.getDate() : dim; // current month: only up to today
    const ok = (d) => Math.min(d, dim) <= cap;

    if (ok(1)) push(day(1), "income", "Salary", rand(82000, 88000), "Monthly salary");
    if (back % 2 === 0 && ok(15)) push(day(15), "income", "Freelance", rand(12000, 20000), "Side project");
    if (ok(3)) push(day(3), "expense", "Rent", 22000, "Apartment rent");
    if (ok(9)) push(day(9), "expense", "Bills", rand(2600, 3800), "Electricity");
    if (ok(11)) push(day(11), "expense", "Bills", 999, "Internet");
    [4, 12, 19, 26].forEach((d) => { if (ok(d)) push(day(d), "expense", "Food", rand(1400, 3400), "Groceries"); });
    [7, 17, 23].forEach((d) => { if (ok(d)) push(day(d), "expense", "Food", rand(350, 1100), "Eating out"); });
    [5, 10, 14, 21, 27].forEach((d) => { if (ok(d)) push(day(d), "expense", "Transport", rand(120, 900), d % 2 ? "Cab" : "Fuel"); });
    if (ok(8)) push(day(8), "expense", "Entertainment", rand(300, 1600), "Movies");
    if (ok(20)) push(day(20), "expense", "Entertainment", 499, "Streaming");
    [13, 24].forEach((d) => { if (ok(d)) push(day(d), "expense", "Shopping", rand(800, 4200), "Online order"); });
    if (back % 3 === 0 && ok(16)) push(day(16), "expense", "Health", rand(500, 2500), "Pharmacy");
  }
  return txns;
}

/* ---------------------------- count-up hook ---------------------------- */
function useCountUp(value) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduceMotion) { setDisplay(value); prev.current = value; return; }
    const from = prev.current, to = value, dur = 600, start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}

/* ---------------------------- styles ---------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.ll, .ll * { box-sizing:border-box; }
.ll {
  --bg:#F2F5F2; --card:#FFFFFF; --ink:#16201C; --soft:#5C6B63; --line:#E3E8E4;
  --primary:#0F9466; --primary-deep:#0B7A54; --expense:#E5604D; --amber:#E8A13A;
  --fd:'Bricolage Grotesque','Segoe UI',system-ui,sans-serif;
  --fb:'Inter',system-ui,-apple-system,sans-serif;
  --fm:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  font-family:var(--fb); color:var(--ink); background:var(--bg);
  min-height:100vh; -webkit-font-smoothing:antialiased; line-height:1.45;
}
.ll button { font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }
.ll input, .ll select { font-family:inherit; }
.ll :focus-visible { outline:2px solid var(--primary); outline-offset:2px; border-radius:3px; }
.ll-mono { font-family:var(--fm); font-variant-numeric:tabular-nums; }
.ll-eyebrow { font-family:var(--fm); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--soft); }

/* top bar */
.ll-top { position:sticky; top:0; z-index:30; background:rgba(242,245,242,.85); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
.ll-top-in { max-width:1180px; margin:0 auto; padding:14px 22px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
.ll-brand { display:flex; align-items:center; gap:9px; font-family:var(--fd); font-weight:800; font-size:19px; letter-spacing:-.02em; }
.ll-brand-mark { width:28px; height:28px; border-radius:8px; background:var(--primary); display:grid; place-items:center; color:#fff; flex:0 0 auto; }
.ll-month { display:flex; align-items:center; gap:4px; margin-left:8px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:4px; }
.ll-month b { font-family:var(--fd); font-weight:700; font-size:14px; min-width:128px; text-align:center; }
.ll-month button { width:30px; height:30px; display:grid; place-items:center; border-radius:7px; color:var(--soft); }
.ll-month button:hover:not(:disabled) { background:rgba(0,0,0,.05); color:var(--ink); }
.ll-month button:disabled { opacity:.3; cursor:not-allowed; }
.ll-top-actions { margin-left:auto; display:flex; gap:10px; }

.ll-wrap { max-width:1180px; margin:0 auto; padding:24px 22px 60px; }

/* stat cards */
.ll-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:18px; }
.ll-stat { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px 18px 16px; }
.ll-stat-top { display:flex; align-items:center; gap:9px; }
.ll-stat-ic { width:30px; height:30px; border-radius:9px; display:grid; place-items:center; flex:0 0 auto; }
.ll-stat .lbl { font-size:12.5px; color:var(--soft); font-weight:500; }
.ll-stat .val { font-family:var(--fd); font-weight:800; font-size:30px; letter-spacing:-.025em; margin-top:12px; font-variant-numeric:tabular-nums; }
.ll-stat .val.big { font-size:34px; }
.ll-delta { display:inline-flex; align-items:center; gap:4px; font-family:var(--fm); font-size:11.5px; margin-top:8px; padding:3px 8px; border-radius:999px; font-weight:500; }
.ll-delta.up { color:#0B7A54; background:rgba(15,148,102,.1); }
.ll-delta.down { color:#C24A38; background:rgba(229,96,77,.1); }
.ll-delta.flat { color:var(--soft); background:rgba(0,0,0,.04); }

/* card */
.ll-grid { display:grid; gap:14px; margin-bottom:14px; }
.ll-grid.c21 { grid-template-columns:1.7fr 1fr; }
.ll-grid.c11 { grid-template-columns:1fr 1fr; }
.ll-card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:18px 20px 20px; }
.ll-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:6px; }
.ll-card-head h3 { font-family:var(--fd); font-weight:700; font-size:16.5px; margin:0; letter-spacing:-.01em; }
.ll-card-head p { font-size:12.5px; color:var(--soft); margin:3px 0 0; }
.ll-legend { display:flex; gap:14px; flex-wrap:wrap; }
.ll-legend span { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--soft); font-weight:500; }
.ll-dot { width:9px; height:9px; border-radius:3px; flex:0 0 auto; }

.ll-chart { height:268px; width:100%; margin-top:8px; }
.ll-donut-wrap { display:grid; grid-template-columns:170px 1fr; gap:8px; align-items:center; }
.ll-donut { position:relative; height:200px; }
.ll-donut-center { position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; text-align:center; }
.ll-donut-center .k { font-family:var(--fm); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--soft); }
.ll-donut-center .v { font-family:var(--fd); font-weight:800; font-size:21px; letter-spacing:-.02em; }
.ll-catlist { display:flex; flex-direction:column; gap:9px; }
.ll-catrow { display:flex; align-items:center; gap:9px; font-size:13px; }
.ll-catrow .nm { font-weight:500; }
.ll-catrow .amt { margin-left:auto; font-family:var(--fm); font-weight:500; }
.ll-catrow .pc { font-family:var(--fm); font-size:11px; color:var(--soft); min-width:34px; text-align:right; }

/* budgets */
.ll-budget { display:flex; flex-direction:column; gap:14px; }
.ll-budget-item .row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px; }
.ll-budget-item .nm { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:500; }
.ll-budget-item .nm .ic { width:24px; height:24px; border-radius:7px; display:grid; place-items:center; flex:0 0 auto; }
.ll-budget-item .amt { font-family:var(--fm); font-size:12.5px; color:var(--soft); }
.ll-budget-item .amt b { color:var(--ink); font-weight:600; }
.ll-bar { height:8px; border-radius:5px; background:rgba(0,0,0,.06); overflow:hidden; }
.ll-bar i { display:block; height:100%; border-radius:5px; transition:width .5s cubic-bezier(.2,.7,.3,1); }
.ll-over { color:var(--expense); font-weight:600; }

/* insights */
.ll-insights { display:flex; flex-direction:column; gap:12px; }
.ll-insight { display:flex; gap:11px; align-items:flex-start; }
.ll-insight .ic { width:30px; height:30px; border-radius:9px; display:grid; place-items:center; flex:0 0 auto; }
.ll-insight p { margin:0; font-size:13.5px; line-height:1.5; }
.ll-insight p b { font-weight:600; }

/* table */
.ll-filterbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:2px 0 14px; }
.ll-search { display:flex; align-items:center; gap:8px; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:8px 12px; min-width:200px; flex:1; max-width:300px; }
.ll-search input { border:none; background:none; outline:none; width:100%; font-size:13.5px; }
.ll-select { font-size:13px; padding:8px 11px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--ink); font-weight:500; }
.ll-table { width:100%; border-collapse:collapse; font-size:13.5px; }
.ll-table th { text-align:left; font-family:var(--fm); font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--soft); padding:10px 14px; border-bottom:1px solid var(--line); font-weight:500; }
.ll-table td { padding:12px 14px; border-bottom:1px solid var(--line); }
.ll-table tr:last-child td { border-bottom:none; }
.ll-table tbody tr:hover { background:rgba(0,0,0,.018); }
.ll-catchip { display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:500; }
.ll-amt { font-family:var(--fm); font-weight:600; font-variant-numeric:tabular-nums; }
.ll-amt.inc { color:var(--primary-deep); }
.ll-amt.exp { color:var(--expense); }
.ll-rowact { display:inline-flex; gap:6px; }
.ll-rowact button { width:30px; height:30px; display:grid; place-items:center; border-radius:7px; border:1px solid var(--line); color:var(--soft); }
.ll-rowact button:hover { color:var(--ink); border-color:var(--ink); }
.ll-rowact button.del:hover { color:var(--expense); border-color:var(--expense); }

/* buttons */
.ll-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; font-weight:600; font-size:13.5px; padding:10px 16px; border-radius:10px; transition:.15s; white-space:nowrap; }
.ll-btn-primary { background:var(--primary); color:#fff; }
.ll-btn-primary:hover { background:var(--primary-deep); }
.ll-btn-dark { background:var(--ink); color:#fff; }
.ll-btn-dark:hover { opacity:.9; }
.ll-btn-ghost { background:var(--card); color:var(--ink); border:1px solid var(--line); }
.ll-btn-ghost:hover { border-color:var(--ink); }
.ll-iconbtn { width:38px; height:38px; display:grid; place-items:center; border-radius:10px; color:var(--ink); }
.ll-iconbtn:hover { background:rgba(0,0,0,.05); }

/* empty */
.ll-empty { text-align:center; padding:46px 20px; color:var(--soft); }
.ll-empty svg { opacity:.4; margin-bottom:10px; }

/* modal */
.ll-overlay { position:fixed; inset:0; background:rgba(16,24,20,.42); z-index:50; backdrop-filter:blur(2px); display:grid; place-items:center; padding:20px; animation:llf .18s ease; }
@keyframes llf { from{opacity:0} to{opacity:1} }
.ll-modal { background:var(--card); border-radius:18px; width:min(520px,100%); max-height:92vh; overflow-y:auto; position:relative; box-shadow:0 40px 90px -40px rgba(0,0,0,.5); animation:llp .2s ease; }
@keyframes llp { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:translateY(0)} }
.ll-modal-x { position:absolute; top:14px; right:14px; }
.ll-modal-pad { padding:28px 30px 30px; }
.ll-modal h2 { font-family:var(--fd); font-weight:800; font-size:22px; margin:0 0 4px; letter-spacing:-.02em; }
.ll-modal .sub { color:var(--soft); font-size:13.5px; margin:0 0 20px; }

.ll-seg { display:flex; gap:4px; background:var(--bg); border:1px solid var(--line); border-radius:11px; padding:4px; margin-bottom:18px; }
.ll-seg button { flex:1; padding:9px; border-radius:8px; font-weight:600; font-size:13.5px; color:var(--soft); transition:.15s; }
.ll-seg button.exp.active { background:var(--expense); color:#fff; }
.ll-seg button.inc.active { background:var(--primary); color:#fff; }

.ll-field { margin-bottom:14px; }
.ll-field label { display:block; font-family:var(--fm); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--soft); margin-bottom:6px; }
.ll-input { width:100%; padding:11px 13px; border:1px solid var(--line); border-radius:10px; background:var(--bg); font-size:14px; color:var(--ink); outline:none; transition:.15s; }
.ll-input:focus { border-color:var(--primary); background:var(--card); }
.ll-input.err { border-color:var(--expense); }
.ll-amount-wrap { display:flex; align-items:center; border:1px solid var(--line); border-radius:10px; background:var(--bg); padding:0 13px; transition:.15s; }
.ll-amount-wrap:focus-within { border-color:var(--primary); background:var(--card); }
.ll-amount-wrap span { color:var(--soft); font-family:var(--fd); font-weight:700; font-size:18px; }
.ll-amount-wrap input { border:none; background:none; outline:none; width:100%; padding:13px 8px; font-family:var(--fd); font-weight:700; font-size:20px; color:var(--ink); }
.ll-err { color:var(--expense); font-size:12px; margin-top:5px; }
.ll-row2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }

.ll-catgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.ll-catbtn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:11px 6px; border:1px solid var(--line); border-radius:11px; background:var(--bg); transition:.15s; }
.ll-catbtn:hover { border-color:var(--soft); }
.ll-catbtn.active { border-color:var(--ink); background:var(--card); box-shadow:0 2px 8px rgba(0,0,0,.06); }
.ll-catbtn .ic { width:30px; height:30px; border-radius:9px; display:grid; place-items:center; }
.ll-catbtn .t { font-size:11px; font-weight:500; }

.ll-budget-edit { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); }
.ll-budget-edit .nm { display:flex; align-items:center; gap:9px; font-size:14px; font-weight:500; }
.ll-budget-edit .ic { width:28px; height:28px; border-radius:8px; display:grid; place-items:center; }
.ll-budget-edit .ll-amount-wrap { width:150px; padding:0 11px; }
.ll-budget-edit .ll-amount-wrap input { font-size:15px; padding:9px 6px; }
.ll-budget-edit .ll-amount-wrap span { font-size:15px; }

.ll-tabs { display:flex; gap:4px; background:var(--bg); border:1px solid var(--line); border-radius:11px; padding:4px; margin-bottom:18px; }
.ll-tabs button { flex:1; padding:9px; border-radius:8px; font-weight:600; font-size:13.5px; color:var(--soft); }
.ll-tabs button.active { background:var(--card); color:var(--ink); box-shadow:0 1px 4px rgba(0,0,0,.08); }
.ll-csv { width:100%; height:180px; font-family:var(--fm); font-size:12px; padding:12px; border:1px solid var(--line); border-radius:10px; background:var(--bg); color:var(--ink); resize:none; outline:none; }
.ll-note { font-family:var(--fm); font-size:11px; color:var(--soft); margin-top:10px; display:flex; gap:6px; align-items:flex-start; }

/* toast */
.ll-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:80; background:var(--ink); color:#fff; padding:13px 20px; border-radius:11px; font-size:13.5px; font-weight:500; display:flex; align-items:center; gap:9px; box-shadow:0 16px 40px -16px rgba(0,0,0,.5); animation:llt .25s ease; }
@keyframes llt { from{opacity:0; transform:translate(-50%,12px)} to{opacity:1; transform:translate(-50%,0)} }
.ll-toast svg { color:#6fe0a9; }

.ll-recharts-tip { background:#fff; border:1px solid var(--line); border-radius:10px; padding:9px 12px; box-shadow:0 8px 24px -12px rgba(0,0,0,.3); font-size:12.5px; }
.ll-recharts-tip .lab { font-weight:700; font-family:var(--fd); margin-bottom:4px; }
.ll-recharts-tip .ln { display:flex; align-items:center; gap:7px; font-family:var(--fm); }

/* print report */
#ll-report { display:none; }
@media print {
  .ll-app { display:none !important; }
  #ll-report { display:block !important; padding:24px 30px; font-family:'Inter',system-ui,sans-serif; color:#16201C; }
  #ll-report h1 { font-size:24px; margin:0 0 2px; }
  #ll-report .sub { color:#5C6B63; font-size:13px; margin:0 0 20px; }
  #ll-report .grid4 { display:flex; gap:18px; margin-bottom:22px; }
  #ll-report .box { border:1px solid #E3E8E4; border-radius:10px; padding:12px 14px; flex:1; }
  #ll-report .box .l { font-size:11px; color:#5C6B63; text-transform:uppercase; letter-spacing:.06em; }
  #ll-report .box .n { font-size:20px; font-weight:700; margin-top:4px; }
  #ll-report table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
  #ll-report th { text-align:left; border-bottom:1.5px solid #16201C; padding:6px 8px; font-size:10px; text-transform:uppercase; letter-spacing:.05em; }
  #ll-report td { padding:6px 8px; border-bottom:1px solid #E3E8E4; }
  #ll-report h3 { font-size:14px; margin:22px 0 6px; }
  @page { margin:14mm; }
}

@media (max-width:920px) {
  .ll-stats { grid-template-columns:repeat(2,1fr); }
  .ll-grid.c21, .ll-grid.c11 { grid-template-columns:1fr; }
  .ll-donut-wrap { grid-template-columns:1fr; }
  .ll-donut { max-width:240px; margin:0 auto; }
}
@media (max-width:560px) {
  .ll-stats { grid-template-columns:1fr; }
  .ll-catgrid { grid-template-columns:repeat(4,1fr); }
  .ll-top-actions .ll-btn span { display:none; }
}
@media (prefers-reduced-motion: reduce) {
  .ll *, .ll *::before, .ll *::after { animation-duration:.001ms !important; transition-duration:.001ms !important; }
}
`;

/* ---------------------------- small bits ---------------------------- */
function StatCard({ icon: Icon, tint, label, value, big, delta }) {
  const shown = useCountUp(value);
  return (
    <div className="ll-stat">
      <div className="ll-stat-top">
        <span className="ll-stat-ic" style={{ background: tint + "1f", color: tint }}><Icon size={17} /></span>
        <span className="lbl">{label}</span>
      </div>
      <div className={"val" + (big ? " big" : "")}>{inr(shown)}</div>
      {delta}
    </div>
  );
}

function ChartTip({ active, payload, label, kind }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="ll-recharts-tip">
      <div className="lab">{kind === "pie" ? payload[0].name : label}</div>
      {payload.map((p, i) => (
        <div className="ln" key={i}>
          <span className="ll-dot" style={{ background: p.color || p.payload.color }} />
          {kind === "pie" ? inr(p.value) : `${p.name}: ${inr(p.value)}`}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- add / edit modal ---------------------------- */
function TxnModal({ initial, onClose, onSave }) {
  const [type, setType] = useState(initial?.type || "expense");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [category, setCategory] = useState(initial?.category || "");
  const [date, setDate] = useState(initial?.date || fmtISO(new Date()));
  const [note, setNote] = useState(initial?.note || "");
  const [err, setErr] = useState({});
  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;

  const save = () => {
    const e = {};
    if (!(Number(amount) > 0)) e.amount = "Enter an amount above 0";
    if (!category) e.category = "Pick a category";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ id: initial?.id || "t" + Date.now(), type, amount: Number(amount), category, date, note: note.trim() });
  };

  return (
    <div className="ll-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ll-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ll-iconbtn ll-modal-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="ll-modal-pad">
          <h2>{initial ? "Edit transaction" : "Add transaction"}</h2>
          <p className="sub">Log what came in or went out.</p>

          <div className="ll-seg">
            <button className={"exp" + (type === "expense" ? " active" : "")} onClick={() => { setType("expense"); setCategory(""); }}>Expense</button>
            <button className={"inc" + (type === "income" ? " active" : "")} onClick={() => { setType("income"); setCategory(""); }}>Income</button>
          </div>

          <div className="ll-field">
            <label>Amount</label>
            <div className="ll-amount-wrap">
              <span>₹</span>
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" autoFocus />
            </div>
            {err.amount && <div className="ll-err">{err.amount}</div>}
          </div>

          <div className="ll-field">
            <label>Category</label>
            <div className="ll-catgrid">
              {cats.map((c) => {
                const Icon = c.icon;
                const on = category === c.key;
                return (
                  <button key={c.key} className={"ll-catbtn" + (on ? " active" : "")} onClick={() => setCategory(c.key)}>
                    <span className="ic" style={{ background: c.color + (on ? "26" : "16"), color: c.color }}><Icon size={16} /></span>
                    <span className="t">{c.key}</span>
                  </button>
                );
              })}
            </div>
            {err.category && <div className="ll-err">{err.category}</div>}
          </div>

          <div className="ll-row2">
            <div className="ll-field">
              <label>Date</label>
              <input type="date" className="ll-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="ll-field">
              <label>Note (optional)</label>
              <input className="ll-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Groceries" />
            </div>
          </div>

          <button className="ll-btn ll-btn-primary" style={{ width: "100%", marginTop: 6 }} onClick={save}>
            <Check size={16} /> {initial ? "Save changes" : "Add transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- budgets modal ---------------------------- */
function BudgetModal({ budgets, onClose, onSave }) {
  const [b, setB] = useState({ ...budgets });
  return (
    <div className="ll-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ll-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ll-iconbtn ll-modal-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="ll-modal-pad">
          <h2>Monthly budgets</h2>
          <p className="sub">Set a spending limit for each category.</p>
          {EXPENSE_CATS.map((c) => {
            const Icon = c.icon;
            return (
              <div className="ll-budget-edit" key={c.key}>
                <span className="nm">
                  <span className="ic" style={{ background: c.color + "1a", color: c.color }}><Icon size={15} /></span>
                  {c.key}
                </span>
                <div className="ll-amount-wrap">
                  <span>₹</span>
                  <input inputMode="numeric" value={b[c.key] ?? 0} onChange={(e) => setB({ ...b, [c.key]: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </div>
              </div>
            );
          })}
          <button className="ll-btn ll-btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={() => onSave(b)}>
            <Check size={16} /> Save budgets
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- export modal ---------------------------- */
function ExportModal({ csv, onClose, onPrint }) {
  const [tab, setTab] = useState("csv");
  const ref = useRef();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(csv);
      else { ref.current.select(); document.execCommand("copy"); }
    } catch (e) {
      if (ref.current) { ref.current.select(); try { document.execCommand("copy"); } catch (_) {} }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ledgerline-export.csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { copy(); }
  };

  return (
    <div className="ll-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ll-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ll-iconbtn ll-modal-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="ll-modal-pad">
          <h2>Export data</h2>
          <p className="sub">Download this month as a spreadsheet, or print a PDF report.</p>
          <div className="ll-tabs">
            <button className={tab === "csv" ? "active" : ""} onClick={() => setTab("csv")}>CSV / Spreadsheet</button>
            <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>PDF report</button>
          </div>

          {tab === "csv" ? (
            <>
              <textarea ref={ref} className="ll-csv" readOnly value={csv} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="ll-btn ll-btn-primary" style={{ flex: 1 }} onClick={download}><Download size={16} /> Download .csv</button>
                <button className="ll-btn ll-btn-ghost" style={{ flex: 1 }} onClick={copy}><Copy size={16} /> {copied ? "Copied!" : "Copy"}</button>
              </div>
              <p className="ll-note"><Receipt size={13} /> Opens in Excel, Google Sheets or Numbers. If the download is blocked, use Copy and paste into a sheet.</p>
            </>
          ) : (
            <>
              <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: "22px 18px", textAlign: "center" }}>
                <Printer size={30} style={{ color: "var(--primary)", marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--soft)" }}>Generates a clean one-page report for the selected month.</p>
              </div>
              <button className="ll-btn ll-btn-dark" style={{ width: "100%", marginTop: 14 }} onClick={onPrint}><Printer size={16} /> Print / Save as PDF</button>
              <p className="ll-note"><Printer size={13} /> Opens your print dialog — choose "Save as PDF" as the destination.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- app ---------------------------- */
export default function App() {
  const [txns, setTxns] = useState(buildSeed);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const now = useMemo(() => new Date(), []);
  const [sel, setSel] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [modal, setModal] = useState(null); // 'add' | 'budget' | 'export' | txn(edit)
  const [editing, setEditing] = useState(null);
  const [fType, setFType] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const toastT = useRef();

  const flash = (m) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2200); };
  useEffect(() => () => clearTimeout(toastT.current), []);

  const isCurrentMonth = sel.getFullYear() === now.getFullYear() && sel.getMonth() === now.getMonth();
  const inMonth = (t, d) => { const td = parseISO(t.date); return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth(); };

  const monthTxns = useMemo(() => txns.filter((t) => inMonth(t, sel)).sort((a, b) => b.date.localeCompare(a.date)), [txns, sel]);
  const prevMonth = useMemo(() => new Date(sel.getFullYear(), sel.getMonth() - 1, 1), [sel]);
  const prevTxns = useMemo(() => txns.filter((t) => inMonth(t, prevMonth)), [txns, prevMonth]);

  const sum = (arr, type) => arr.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const income = sum(monthTxns, "income");
  const expense = sum(monthTxns, "expense");
  const net = income - expense;
  const savingsRate = income > 0 ? net / income : 0;
  const prevExpense = sum(prevTxns, "expense");
  const prevNet = sum(prevTxns, "income") - prevExpense;

  // 6-month series ending at selected month
  const series = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(sel.getFullYear(), sel.getMonth() - i, 1);
      const m = txns.filter((t) => inMonth(t, d));
      out.push({ label: monthShort(d), income: sum(m, "income"), expense: sum(m, "expense") });
    }
    return out;
  }, [txns, sel]);

  // category breakdown for this month's expenses
  const breakdown = useMemo(() => {
    const map = {};
    monthTxns.filter((t) => t.type === "expense").forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: catMeta("expense", name).color }))
      .sort((a, b) => b.value - a.value);
  }, [monthTxns]);

  // budget usage
  const budgetUsage = useMemo(() =>
    EXPENSE_CATS.map((c) => {
      const used = monthTxns.filter((t) => t.type === "expense" && t.category === c.key).reduce((s, t) => s + t.amount, 0);
      const limit = budgets[c.key] || 0;
      return { ...c, used, limit, pct: limit ? Math.min(used / limit, 1) : 0, over: limit && used > limit };
    }).filter((b) => b.limit > 0 || b.used > 0).sort((a, b) => b.used - a.used)
  , [monthTxns, budgets, budgets]);

  // insights
  const insights = useMemo(() => {
    const list = [];
    if (breakdown.length) {
      const top = breakdown[0];
      const share = expense ? Math.round((top.value / expense) * 100) : 0;
      list.push({ icon: TrendingUp, tint: top.color, text: <><b>{top.name}</b> was your biggest expense at <b>{inr(top.value)}</b> — {share}% of spending.</> });
    }
    if (prevExpense > 0) {
      const diff = expense - prevExpense;
      const pct = Math.round((Math.abs(diff) / prevExpense) * 100);
      const up = diff >= 0;
      list.push({ icon: up ? TrendingUp : TrendingDown, tint: up ? C.expense : C.primary, text: <>Spending is <b>{up ? "up" : "down"} {pct}%</b> versus last month ({inr(Math.abs(diff))} {up ? "more" : "less"}).</> });
    }
    if (net >= 0) list.push({ icon: PiggyBank, tint: C.primary, text: <>You saved <b>{inr(net)}</b> this month — a <b>{Math.round(savingsRate * 100)}%</b> savings rate.</> });
    else list.push({ icon: AlertTriangle, tint: C.expense, text: <>You spent <b>{inr(-net)}</b> more than you earned this month.</> });
    const over = budgetUsage.find((b) => b.over);
    if (over) list.push({ icon: AlertTriangle, tint: C.amber, text: <><b>{over.key}</b> is over budget by <b>{inr(over.used - over.limit)}</b>.</> });
    if (isCurrentMonth && expense > 0 && now.getDate() > 2) {
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projected = (expense / now.getDate()) * dim;
      list.push({ icon: Sparkles, tint: C.primary, text: <>At this pace you're on track to spend about <b>{inr(projected)}</b> by month-end.</> });
    }
    return list.slice(0, 5);
  }, [breakdown, expense, prevExpense, net, savingsRate, budgetUsage, isCurrentMonth, now]);

  // filtered table
  const filtered = useMemo(() => monthTxns.filter((t) => {
    if (fType !== "all" && t.type !== fType) return false;
    if (fCat !== "all" && t.category !== fCat) return false;
    if (q.trim()) { const s = (t.category + " " + (t.note || "")).toLowerCase(); if (!s.includes(q.toLowerCase())) return false; }
    return true;
  }), [monthTxns, fType, fCat, q]);

  // csv for export
  const csv = useMemo(() => {
    const rows = [["Date", "Type", "Category", "Note", "Amount (INR)"]];
    monthTxns.slice().reverse().forEach((t) => rows.push([t.date, t.type, t.category, (t.note || "").replace(/,/g, ";"), t.amount]));
    return rows.map((r) => r.join(",")).join("\n");
  }, [monthTxns]);

  const saveTxn = (t) => {
    setTxns((prev) => editing ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]);
    const td = parseISO(t.date);
    if (td.getFullYear() !== sel.getFullYear() || td.getMonth() !== sel.getMonth())
      setSel(new Date(td.getFullYear(), td.getMonth(), 1));
    setModal(null); setEditing(null);
    flash(editing ? "Transaction updated" : "Transaction added");
  };
  const delTxn = (id) => { setTxns((prev) => prev.filter((t) => t.id !== id)); flash("Transaction deleted"); };

  const shiftMonth = (n) => setSel(new Date(sel.getFullYear(), sel.getMonth() + n, 1));
  const nextDisabled = isCurrentMonth;

  const deltaTag = (cur, prev, goodWhenUp) => {
    if (!prev) return <span className="ll-delta flat">No prior data</span>;
    const diff = cur - prev; const pct = Math.round((Math.abs(diff) / Math.abs(prev)) * 100);
    if (diff === 0) return <span className="ll-delta flat">Same as last month</span>;
    const up = diff > 0; const good = up === goodWhenUp;
    const Ic = up ? ArrowUpRight : ArrowDownRight;
    return <span className={"ll-delta " + (good ? "up" : "down")}><Ic size={12} /> {pct}% vs last mo.</span>;
  };

  return (
    <div className="ll">
      <style>{CSS}</style>

      <div className="ll-app">
        {/* TOP */}
        <header className="ll-top">
          <div className="ll-top-in">
            <div className="ll-brand"><span className="ll-brand-mark"><Wallet size={17} /></span> Ledgerline</div>
            <div className="ll-month">
              <button onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <b>{monthLong(sel)}</b>
              <button onClick={() => shiftMonth(1)} disabled={nextDisabled} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
            <div className="ll-top-actions">
              <button className="ll-btn ll-btn-ghost" onClick={() => setModal("export")}><Download size={16} /><span>Export</span></button>
              <button className="ll-btn ll-btn-primary" onClick={() => { setEditing(null); setModal("add"); }}><Plus size={16} /><span>Add transaction</span></button>
            </div>
          </div>
        </header>

        <main className="ll-wrap">
          {/* STATS */}
          <div className="ll-stats">
            <StatCard icon={Wallet} tint={net >= 0 ? C.primary : C.expense} label="Net this month" value={net} big
              delta={deltaTag(net, prevNet, true)} />
            <StatCard icon={TrendingUp} tint={C.primary} label="Income" value={income} />
            <StatCard icon={TrendingDown} tint={C.expense} label="Spending" value={expense}
              delta={deltaTag(expense, prevExpense, false)} />
            <StatCard icon={PiggyBank} tint={C.amber} label="Savings rate"
              value={Math.max(0, Math.round(savingsRate * 100))} />
          </div>

          {/* CHARTS ROW */}
          <div className="ll-grid c21">
            <div className="ll-card">
              <div className="ll-card-head">
                <div><h3>Income vs spending</h3><p>Last 6 months</p></div>
                <div className="ll-legend">
                  <span><i className="ll-dot" style={{ background: C.primary }} /> Income</span>
                  <span><i className="ll-dot" style={{ background: C.expense }} /> Spending</span>
                </div>
              </div>
              <div className="ll-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} barGap={4} barCategoryGap="26%" margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={C.line} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: C.soft, fontFamily: "var(--fm)" }} dy={6} />
                    <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: C.soft, fontFamily: "var(--fm)" }}
                      tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : v)} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.035)" }} content={<ChartTip />} />
                    <Bar dataKey="income" name="Income" fill={C.primary} radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={!reduceMotion} />
                    <Bar dataKey="expense" name="Spending" fill={C.expense} radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={!reduceMotion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="ll-card">
              <div className="ll-card-head"><div><h3>Where it goes</h3><p>{monthShort(sel)} expenses by category</p></div></div>
              {breakdown.length === 0 ? (
                <div className="ll-empty" style={{ padding: "40px 10px" }}><Receipt size={32} /><p>No expenses logged this month yet.</p></div>
              ) : (
                <div className="ll-donut-wrap">
                  <div className="ll-donut">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="none" isAnimationActive={!reduceMotion}>
                          {breakdown.map((e) => <Cell key={e.name} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTip kind="pie" />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ll-donut-center"><div><div className="k">Spent</div><div className="v">{inr(expense)}</div></div></div>
                  </div>
                  <div className="ll-catlist">
                    {breakdown.slice(0, 6).map((e) => (
                      <div className="ll-catrow" key={e.name}>
                        <span className="ll-dot" style={{ background: e.color }} />
                        <span className="nm">{e.name}</span>
                        <span className="amt">{inr(e.value)}</span>
                        <span className="pc">{expense ? Math.round((e.value / expense) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BUDGETS + INSIGHTS */}
          <div className="ll-grid c11">
            <div className="ll-card">
              <div className="ll-card-head">
                <div><h3>Budgets</h3><p>Spending against your monthly limits</p></div>
                <button className="ll-btn ll-btn-ghost" style={{ padding: "7px 12px" }} onClick={() => setModal("budget")}><Pencil size={14} /> Edit</button>
              </div>
              <div className="ll-budget" style={{ marginTop: 8 }}>
                {budgetUsage.slice(0, 6).map((b) => {
                  const Icon = b.icon;
                  return (
                    <div className="ll-budget-item" key={b.key}>
                      <div className="row">
                        <span className="nm"><span className="ic" style={{ background: b.color + "1a", color: b.color }}><Icon size={14} /></span>{b.key}</span>
                        <span className="amt"><b className={b.over ? "ll-over" : ""}>{inr(b.used)}</b> / {inr(b.limit)}</span>
                      </div>
                      <div className="ll-bar"><i style={{ width: (b.pct * 100) + "%", background: b.over ? C.expense : b.color }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="ll-card">
              <div className="ll-card-head"><div><h3>Insights</h3><p>Auto-generated from your activity</p></div><Sparkles size={18} style={{ color: C.amber }} /></div>
              <div className="ll-insights" style={{ marginTop: 8 }}>
                {insights.length === 0 ? (
                  <div className="ll-empty" style={{ padding: "30px 10px" }}><Sparkles size={30} /><p>Add a few transactions to see insights.</p></div>
                ) : insights.map((ins, i) => {
                  const Icon = ins.icon;
                  return (
                    <div className="ll-insight" key={i}>
                      <span className="ic" style={{ background: ins.tint + "1f", color: ins.tint }}><Icon size={16} /></span>
                      <p>{ins.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TRANSACTIONS */}
          <div className="ll-card">
            <div className="ll-card-head" style={{ marginBottom: 14 }}>
              <div><h3>Transactions</h3><p>{monthTxns.length} in {monthLong(sel)}</p></div>
            </div>
            <div className="ll-filterbar">
              <div className="ll-search">
                <Search size={15} style={{ color: "var(--soft)", flex: "0 0 auto" }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes or categories…" />
              </div>
              <select className="ll-select" value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="all">All types</option><option value="expense">Expenses</option><option value="income">Income</option>
              </select>
              <select className="ll-select" value={fCat} onChange={(e) => setFCat(e.target.value)}>
                <option value="all">All categories</option>
                {[...new Set(monthTxns.map((t) => t.category))].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="ll-btn ll-btn-primary" style={{ marginLeft: "auto", padding: "9px 14px" }} onClick={() => { setEditing(null); setModal("add"); }}><Plus size={15} /> Add</button>
            </div>

            {filtered.length === 0 ? (
              <div className="ll-empty">
                <SlidersHorizontal size={34} />
                <p>{monthTxns.length === 0 ? "Nothing logged for this month yet." : "No transactions match those filters."}</p>
                {monthTxns.length === 0 && <button className="ll-btn ll-btn-ghost" style={{ marginTop: 14 }} onClick={() => { setEditing(null); setModal("add"); }}>Add your first one</button>}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ll-table">
                  <thead><tr><th>Date</th><th>Category</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map((t) => {
                      const meta = catMeta(t.type, t.category); const Icon = meta.icon;
                      return (
                        <tr key={t.id}>
                          <td className="ll-mono" style={{ color: "var(--soft)", whiteSpace: "nowrap" }}>{parseISO(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                          <td>
                            <span className="ll-catchip">
                              <span style={{ width: 24, height: 24, borderRadius: 7, background: meta.color + "1a", color: meta.color, display: "grid", placeItems: "center", flex: "0 0 auto" }}><Icon size={13} /></span>
                              {t.category}
                            </span>
                          </td>
                          <td style={{ color: "var(--soft)" }}>{t.note || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            <span className={"ll-amt " + (t.type === "income" ? "inc" : "exp")}>{t.type === "income" ? "+" : "-"}{inr(t.amount)}</span>
                          </td>
                          <td style={{ textAlign: "right", width: 1 }}>
                            <span className="ll-rowact">
                              <button onClick={() => { setEditing(t); setModal("edit"); }} aria-label="Edit"><Pencil size={14} /></button>
                              <button className="del" onClick={() => delTxn(t.id)} aria-label="Delete"><Trash2 size={14} /></button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p style={{ textAlign: "center", color: "var(--soft)", fontSize: 12.5, marginTop: 26 }}>
            Ledgerline — demo expense tracker. Data lives in memory and resets on reload.
          </p>
        </main>
      </div>

      {/* PRINT REPORT */}
      <div id="ll-report">
        <h1>Ledgerline — {monthLong(sel)}</h1>
        <p className="sub">Monthly expense report</p>
        <div className="grid4">
          <div className="box"><div className="l">Income</div><div className="n">{inr(income)}</div></div>
          <div className="box"><div className="l">Spending</div><div className="n">{inr(expense)}</div></div>
          <div className="box"><div className="l">Net</div><div className="n">{inr(net)}</div></div>
          <div className="box"><div className="l">Savings rate</div><div className="n">{Math.max(0, Math.round(savingsRate * 100))}%</div></div>
        </div>
        <h3>Spending by category</h3>
        <table>
          <thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead>
          <tbody>{breakdown.map((b) => <tr key={b.name}><td>{b.name}</td><td>{inr(b.value)}</td><td>{expense ? Math.round((b.value / expense) * 100) : 0}%</td></tr>)}</tbody>
        </table>
        <h3>Transactions</h3>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
          <tbody>{monthTxns.slice().reverse().map((t) => <tr key={t.id}><td>{t.date}</td><td>{t.type}</td><td>{t.category}</td><td>{t.note || "—"}</td><td>{(t.type === "income" ? "+" : "-") + inr(t.amount)}</td></tr>)}</tbody>
        </table>
      </div>

      {/* MODALS */}
      {(modal === "add" || modal === "edit") && (
        <TxnModal initial={editing} onClose={() => { setModal(null); setEditing(null); }} onSave={saveTxn} />
      )}
      {modal === "budget" && (
        <BudgetModal budgets={budgets} onClose={() => setModal(null)} onSave={(b) => { setBudgets(b); setModal(null); flash("Budgets saved"); }} />
      )}
      {modal === "export" && (
        <ExportModal csv={csv} onClose={() => setModal(null)} onPrint={() => { setModal(null); setTimeout(() => { try { window.print(); } catch (e) {} }, 120); }} />
      )}

      {toast && <div className="ll-toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}
