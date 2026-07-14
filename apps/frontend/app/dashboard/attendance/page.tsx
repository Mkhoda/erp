"use client";
import React from "react";
import { pageTitle } from "../../../lib/branding";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Users, Clock, AlertTriangle, CheckCircle, XCircle, Timer,
  Loader2, Fingerprint, TrendingUp, Moon, Plane, AlertCircle,
  ClipboardList, Bell, RefreshCw, BarChart3, Calendar, Filter,
  ArrowUpRight, ArrowDownRight, Building2, Award, Eye,
  FileWarning, Search, CalendarCheck, CalendarX, Wifi, Minus,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

const STATUS_FA: Record<string,string> = {
  PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت",
  INCOMPLETE:"ناقص", LEAVE:"مرخصی", MISSION:"ماموریت",
  REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته",
  WORKING:"در حال کار",
};
const STATUS_CLR: Record<string,string> = {
  PRESENT:"#10b981", LATE:"#f59e0b", EARLY_LEAVE:"#eab308", ABSENT:"#ef4444",
  INCOMPLETE:"#f97316", LEAVE:"#3b82f6", MISSION:"#8b5cf6",
  REMOTE_WORK:"#06b6d4", HOLIDAY:"#94a3b8", COMPANY_HOLIDAY:"#64748b", WEEKEND:"#cbd5e1",
  WORKING:"#10b981",
};
const STATUS_BADGE: Record<string,string> = {
  PRESENT:"bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  LATE:"bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  EARLY_LEAVE:"bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400",
  ABSENT:"bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  INCOMPLETE:"bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  LEAVE:"bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  MISSION:"bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  REMOTE_WORK:"bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
  HOLIDAY:"bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400",
  COMPANY_HOLIDAY:"bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400",
  WEEKEND:"bg-slate-100 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500",
  WORKING:"bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const faY   = (n: number) => (n ?? 0).toLocaleString("fa-IR", { useGrouping: false });
const toFa  = (s: string) => s.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
function fmtMin(m: number): string {
  if (!m || m <= 0) return toFa("0:00");
  const h = Math.floor(m / 60), mm = m % 60;
  return toFa(`${h}:${String(mm).padStart(2, "0")}`);
}
function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return toFa(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
  } catch { return "—"; }
}
const fullName = (u?: { firstName?: string; lastName?: string } | null) =>
  `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || "—";

// INCOMPLETE + has check-in + no check-out + today → person is still at work
function liveStatus(r: { status: string; firstCheckIn?: string|null; lastCheckOut?: string|null; gregDate: string }, todayISO: string): string {
  if (r.status === "INCOMPLETE" && r.firstCheckIn && !r.lastCheckOut && r.gregDate?.slice(0, 10) === todayISO) return "WORKING";
  return r.status;
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface DashData {
  jYear: number; jMonth: number; mappedUsers: number;
  statusCounts: Record<string,number>;
  todayCounts:  Record<string,number>;
  totals: { days:number; workedMinutes:number; overtimeMinutes:number; delayMinutes:number; earlyLeaveMinutes:number; nightMinutes:number };
  trend: Array<{ jDay:number; present:number; workedMinutes:number; overtimeMinutes:number; delayMinutes:number }>;
  topOvertime: Array<{ userId:string; value:number; name:string }>;
  topDelay:    Array<{ userId:string; value:number; days:number; name:string }>;
  byDepartment: Array<{ dept:string; present:number; absent:number; late:number; leave:number; overtimeMinutes:number }>;
}
interface Rec {
  id:string; userId:string; gregDate:string;
  jYear:number; jMonth:number; jDay:number;
  firstCheckIn?:string|null; lastCheckOut?:string|null;
  workedMinutes:number; overtimeMinutes:number;
  delayMinutes:number; earlyLeaveMinutes:number; nightMinutes:number;
  status:string; hasOverride:boolean;
  user:{ id:string; firstName:string; lastName:string; phone:string; department?:{ id:string; name:string }|null };
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[status] || "bg-slate-100 text-slate-600"}`}>
      {STATUS_FA[status] || status}
    </span>
  );
}

function Empty({ title = "داده‌ای موجود نیست", sub = "" }: { title?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <div className="w-10 h-10 rounded-full bg-theme-hover flex items-center justify-center">
        <BarChart3 className="w-4 h-4 text-theme-muted" />
      </div>
      <p className="text-sm font-medium text-theme-secondary">{title}</p>
      {sub && <p className="text-xs text-theme-muted">{sub}</p>}
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, sub, gradient, delta }: {
  icon: React.ElementType; title: string; value: string; sub?: string; gradient: string; delta?: number;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 ${gradient} shadow-lg`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-white/70 mb-1 truncate">{title}</p>
          <p className="text-2xl font-bold text-white leading-none">{value}</p>
          {sub && <p className="text-[11px] text-white/55 mt-1">{sub}</p>}
          {delta !== undefined && (
            <div className={`mt-1.5 flex items-center gap-0.5 text-[11px] font-medium ${delta > 0 ? "text-emerald-200" : delta < 0 ? "text-red-200" : "text-white/40"}`}>
              {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : delta < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {delta !== 0 ? faNum(Math.abs(delta)) : "بدون تغییر"}
            </div>
          )}
        </div>
        <div className="shrink-0 w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />
    </div>
  );
}

function Section({ title, icon: Icon, children, action }: {
  title: string; icon?: React.ElementType; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-theme-card border border-theme rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-theme">
        <div className="flex items-center gap-2">
          {Icon && <div className="w-5 h-5 rounded-md bg-blue-500/15 flex items-center justify-center"><Icon className="w-3 h-3 text-blue-500" /></div>}
          <span className="font-semibold text-theme-primary text-sm">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function RankRow({ rank, name, sub, value, color }: { rank:number; name:string; sub?:string; value:string; color:string }) {
  const medal = rank === 1 ? "bg-amber-400 text-amber-900" : rank === 2 ? "bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200" : rank === 3 ? "bg-amber-700 text-amber-100" : "bg-theme-hover text-theme-muted";
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-theme last:border-0">
      <div className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${medal}`}>{faNum(rank)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-theme-primary truncate">{name}</p>
        {sub && <p className="text-[10px] text-theme-muted">{sub}</p>}
      </div>
      <span className={`text-xs font-bold shrink-0 ${color}`}>{value}</span>
    </div>
  );
}

// ─── Custom tooltip ────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-theme-card border border-theme rounded-xl shadow-lg p-2.5 text-xs min-w-[100px]" dir="rtl">
      <p className="text-theme-muted mb-1">{label ? `روز ${label}` : ""}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />{p.dataKey}</span>
          <span className="font-bold text-theme-primary">{faNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AttendanceDashboardPage() {
  React.useEffect(() => { document.title = pageTitle("داشبورد حضور و غیاب"); }, []);

  const token  = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const hdr = React.useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const [dash,    setDash]    = React.useState<DashData | null>(null);
  const [records, setRecords] = React.useState<Rec[]>([]);
  const [pending, setPending] = React.useState(0);
  const [depts,   setDepts]   = React.useState<Array<{id:string; name:string}>>([]);
  const [periods, setPeriods] = React.useState<Array<{jYear:number; jMonth:number}>>([]);
  const [jYear,   setJYear]   = React.useState<number|null>(null);
  const [jMonth,  setJMonth]  = React.useState<number|null>(null);
  const [deptId,  setDeptId]  = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [todayISO, setTodayISO]   = React.useState("");
  const [todayTab, setTodayTab]   = React.useState("ALL");
  const [searchQ,  setSearchQ]    = React.useState("");
  const [sortK,    setSortK]      = React.useState<"name"|"workedMinutes"|"delayMinutes"|"overtimeMinutes">("name");
  const [sortDir,  setSortDir]    = React.useState<"asc"|"desc">("asc");

  React.useEffect(() => { setTodayISO(new Date().toISOString().slice(0, 10)); }, []);

  // Load static resources once
  React.useEffect(() => {
    Promise.all([
      fetch(`${API}/departments`, { headers: hdr }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/attendance/records/periods`, { headers: hdr }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/attendance/requests/pending-count`, { headers: hdr }).then(r => r.ok ? r.json() : 0),
    ]).then(([d, p, pc]) => {
      setDepts(Array.isArray(d) ? d : []);
      const arr: Array<{jYear:number; jMonth:number}> = Array.isArray(p) ? p : [];
      setPeriods(arr);
      if (arr.length) { setJYear(arr[0].jYear); setJMonth(arr[0].jMonth); }
      setPending(typeof pc === "number" ? pc : (pc?.count ?? 0));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yearOpts  = React.useMemo(() => [...new Set(periods.map(p => p.jYear))].sort((a,b) => b-a), [periods]);
  const monthOpts = React.useMemo(() => [...new Set(periods.filter(p => p.jYear === jYear).map(p => p.jMonth))].sort((a,b) => a-b), [periods, jYear]);

  // Main data load
  const load = React.useCallback(async () => {
    if (jYear == null || jMonth == null) return;
    setLoading(true);
    const qs = new URLSearchParams({ jYear: String(jYear), jMonth: String(jMonth) });
    if (deptId) qs.set("departmentId", deptId);
    try {
      const [dr, rr] = await Promise.all([
        fetch(`${API}/attendance/dashboard?${qs}`, { headers: hdr }),
        fetch(`${API}/attendance/records?${qs}&take=3000`, { headers: hdr }),
      ]);
      if (dr.ok) setDash(await dr.json());
      if (rr.ok) setRecords(await rr.json());
    } finally { setLoading(false); }
  }, [jYear, jMonth, deptId, hdr]);

  React.useEffect(() => { load(); }, [load]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const today  = dash?.todayCounts  || {};
  const totals = dash?.totals       || { days:0, workedMinutes:0, overtimeMinutes:0, delayMinutes:0, earlyLeaveMinutes:0, nightMinutes:0 };
  const sc     = dash?.statusCounts || {};
  const byDept = dash?.byDepartment || [];
  const topOt  = dash?.topOvertime  || [];
  const topDel = dash?.topDelay     || [];

  const trendData = (dash?.trend || []).map(t => ({
    روز: toFa(String(t.jDay)),
    حاضر: t.present,
    "اضافه‌کار(ساعت)": Math.round(t.overtimeMinutes / 60),
    "تاخیر(ساعت)": Math.round(t.delayMinutes / 60),
  }));

  const activeToday   = Object.entries(today).filter(([k]) => !["WEEKEND","HOLIDAY","COMPANY_HOLIDAY"].includes(k)).reduce((s, [,v]) => s + (v as number), 0);
  const presentToday  = (today.PRESENT||0) + (today.LATE||0);
  const attendancePct = activeToday > 0 ? Math.round(presentToday / activeToday * 100) : 0;

  const pieDat = Object.entries(sc)
    .filter(([k,v]) => !["WEEKEND","COMPANY_HOLIDAY","HOLIDAY"].includes(k) && (v as number) > 0)
    .map(([k,v]) => ({ name: STATUS_FA[k]||k, key: k, value: v as number }));

  const deptBar = byDept.slice(0,10).map(d => ({
    name: d.dept.length > 9 ? d.dept.slice(0,9)+"…" : d.dept,
    حاضر: d.present, تاخیر: d.late, غیبت: d.absent, مرخصی: d.leave,
  }));

  // Today's records (filter by gregDate)
  const todayRecs = React.useMemo(() =>
    records.filter(r => r.gregDate?.slice(0,10) === todayISO), [records, todayISO]);

  // Exclude records that are "currently working" (checked in, no checkout, today) — they're not truly incomplete
  const incompleteRecs = React.useMemo(() =>
    records.filter(r => r.status === "INCOMPLETE" && liveStatus(r, todayISO) !== "WORKING"), [records, todayISO]);

  const filteredToday = React.useMemo(() => {
    let arr = todayTab === "ALL" ? todayRecs : todayRecs.filter(r => r.status === todayTab);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      arr = arr.filter(r => fullName(r.user).toLowerCase().includes(q) || (r.user?.department?.name||"").includes(searchQ));
    }
    return [...arr].sort((a, b) => {
      const va = sortK === "name" ? fullName(a.user) : (a as any)[sortK]||0;
      const vb = sortK === "name" ? fullName(b.user) : (b as any)[sortK]||0;
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [todayRecs, todayTab, searchQ, sortK, sortDir]);

  const monthLabel = jMonth ? `${J_MONTHS[jMonth-1]} ${faY(jYear||0)}` : "—";

  function thSort(k: typeof sortK) {
    if (sortK === k) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortK(k); setSortDir("desc"); }
  }
  const arrow = (k: string) => sortK === k ? (sortDir==="asc" ? " ↑" : " ↓") : "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full pb-10 space-y-4" dir="rtl">

      {/* ══ Header ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Fingerprint className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">داشبورد حضور و غیاب</h1>
            <p className="text-sm text-theme-muted">
              {monthLabel}
              {deptId && depts.find(d=>d.id===deptId) ? ` · ${depts.find(d=>d.id===deptId)!.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <Link href="/dashboard/attendance/approvals"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 text-xs font-medium hover:opacity-80 transition-opacity">
              <Bell className="w-3.5 h-3.5" />
              {faNum(pending)} درخواست معلق
            </Link>
          )}
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl hover:bg-theme-hover text-theme-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/dashboard/attendance/records"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-theme-card border border-theme text-sm text-theme-secondary hover:bg-theme-hover transition-colors">
            <ClipboardList className="w-3.5 h-3.5" />
            کارکرد روزانه
          </Link>
        </div>
      </div>

      {/* ══ Filters ══════════════════════════════════════════════════════════ */}
      <div className="bg-theme-card/80 backdrop-blur border border-theme rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-theme-muted shrink-0" />
        <select className="input-theme text-sm w-auto" value={jYear??""} onChange={e=>setJYear(+e.target.value)}>
          {yearOpts.map(y=><option key={y} value={y}>سال {faY(y)}</option>)}
        </select>
        <select className="input-theme text-sm w-auto" value={jMonth??""} onChange={e=>setJMonth(+e.target.value)}>
          {monthOpts.map(m=><option key={m} value={m}>{J_MONTHS[m-1]}</option>)}
        </select>
        <select className="input-theme text-sm w-auto" value={deptId} onChange={e=>setDeptId(e.target.value)}>
          <option value="">همه دپارتمان‌ها</option>
          {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {!loading && dash && (
          <span className="mr-auto text-[11px] text-theme-muted">
            {faNum(dash.mappedUsers)} کارمند دارای کارت · {faNum(totals.days)} رکورد ماه
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({length:8}).map((_,i)=>(
            <div key={i} className="rounded-2xl bg-theme-card border border-theme h-[88px] animate-pulse" />
          ))}
        </div>
      ) : !dash ? (
        <Empty title="داده‌ای برای این دوره یافت نشد" sub="فیلتر را تغییر دهید یا همگام‌سازی را بررسی کنید" />
      ) : (
        <>
          {/* ══ Today KPI ════════════════════════════════════════════════════ */}
          <div>
            <p className="text-xs text-theme-muted mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> وضعیت امروز
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard icon={CheckCircle}    title="حاضر"          value={faNum(today.PRESENT||0)}        gradient="bg-gradient-to-br from-emerald-600 to-emerald-500" />
              <KpiCard icon={XCircle}        title="غایب"          value={faNum(today.ABSENT||0)}         gradient="bg-gradient-to-br from-red-600 to-red-500" />
              <KpiCard icon={Clock}          title="با تاخیر"      value={faNum(today.LATE||0)}           gradient="bg-gradient-to-br from-amber-600 to-amber-500" />
              <KpiCard icon={AlertCircle}    title="ناقص"          value={faNum(today.INCOMPLETE||0)}     gradient="bg-gradient-to-br from-orange-600 to-orange-500" />
              <KpiCard icon={Timer}          title="تعجیل"         value={faNum(today.EARLY_LEAVE||0)}    gradient="bg-gradient-to-br from-yellow-600 to-yellow-500" />
              <KpiCard icon={CalendarCheck}  title="مرخصی"         value={faNum(today.LEAVE||0)}          gradient="bg-gradient-to-br from-blue-600 to-blue-500" />
              <KpiCard icon={Plane}          title="ماموریت / دور" value={faNum((today.MISSION||0)+(today.REMOTE_WORK||0))} gradient="bg-gradient-to-br from-violet-600 to-violet-500" />
              <KpiCard icon={TrendingUp}     title="درصد حضور"     value={`${faNum(attendancePct)}٪`}    sub="از کل فعال" gradient="bg-gradient-to-br from-indigo-600 to-indigo-500" />
            </div>
          </div>

          {/* ══ Monthly Totals ════════════════════════════════════════════════ */}
          <div>
            <p className="text-xs text-theme-muted mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> کارکرد ماه — {monthLabel}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard icon={Clock}        title="کارکرد کل"     value={fmtMin(totals.workedMinutes)}      sub="ساعت:دقیقه" gradient="bg-gradient-to-br from-slate-700 to-slate-600" />
              <KpiCard icon={TrendingUp}   title="اضافه‌کار"     value={fmtMin(totals.overtimeMinutes)}    sub="ساعت:دقیقه" gradient="bg-gradient-to-br from-purple-700 to-purple-600" />
              <KpiCard icon={AlertTriangle} title="تاخیر"        value={fmtMin(totals.delayMinutes)}       sub="ساعت:دقیقه" gradient="bg-gradient-to-br from-amber-700 to-amber-600" />
              <KpiCard icon={Timer}        title="تعجیل"         value={fmtMin(totals.earlyLeaveMinutes)}  sub="ساعت:دقیقه" gradient="bg-gradient-to-br from-yellow-700 to-yellow-600" />
              <KpiCard icon={Moon}         title="شب‌کاری"       value={fmtMin(totals.nightMinutes)}       sub="ساعت:دقیقه" gradient="bg-gradient-to-br from-indigo-800 to-indigo-700" />
              <KpiCard icon={Users}        title="رکوردهای ماه"  value={faNum(totals.days)}                sub="روز-کارمند" gradient="bg-gradient-to-br from-teal-700 to-teal-600" />
            </div>
          </div>

          {/* ══ Trend + Donut ═════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Section title="روند روزانه ماه" icon={TrendingUp} action={<span className="text-xs text-theme-muted">{monthLabel}</span>}>
                {trendData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trendData} margin={{top:4,right:4,bottom:0,left:-20}}>
                      <defs>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false}/>
                      <XAxis dataKey="روز" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<ChartTooltip />}/>
                      <Legend wrapperStyle={{fontSize:11}}/>
                      <Area type="monotone" dataKey="حاضر"             stroke="#10b981" fill="url(#gP)" strokeWidth={2} dot={false} activeDot={{r:3}}/>
                      <Area type="monotone" dataKey="اضافه‌کار(ساعت)" stroke="#8b5cf6" fill="url(#gO)" strokeWidth={2} dot={false} activeDot={{r:3}}/>
                      <Area type="monotone" dataKey="تاخیر(ساعت)"     stroke="#f59e0b" fill="url(#gD)" strokeWidth={2} dot={false} activeDot={{r:3}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Section>
            </div>

            <Section title="توزیع وضعیت ماه" icon={BarChart3}>
              {pieDat.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieDat} dataKey="value" nameKey="name"
                      cx="50%" cy="44%" outerRadius={78} innerRadius={42}
                      paddingAngle={2} stroke="none">
                      {pieDat.map((s,i)=><Cell key={i} fill={STATUS_CLR[s.key]||"#888"}/>)}
                    </Pie>
                    <Tooltip formatter={(v:any)=>faNum(+v)} contentStyle={{fontSize:11,borderRadius:8}}/>
                    <Legend wrapperStyle={{fontSize:10}} iconSize={8}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ══ Top Lists + Dept Bar ══════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title="بیشترین اضافه‌کار ماه" icon={Award}>
              {topOt.length === 0 ? <Empty title="رکوردی ثبت نشده"/> : (
                <div>
                  {topOt.map((u,i)=>(
                    <RankRow key={u.userId} rank={i+1} name={u.name}
                      value={fmtMin(u.value)} color="text-violet-600 dark:text-violet-400"/>
                  ))}
                </div>
              )}
            </Section>

            <Section title="بیشترین تاخیر ماه" icon={AlertTriangle}>
              {topDel.length === 0 ? <Empty title="رکوردی ثبت نشده"/> : (
                <div>
                  {topDel.map((u,i)=>(
                    <RankRow key={u.userId} rank={i+1} name={u.name}
                      sub={`${faNum(u.days)} روز`}
                      value={fmtMin(u.value)} color="text-amber-600 dark:text-amber-400"/>
                  ))}
                </div>
              )}
            </Section>

            <Section title="مقایسه دپارتمان‌ها" icon={Building2}>
              {deptBar.length === 0 ? <Empty/> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={deptBar} layout="vertical" margin={{right:4,left:0,top:0,bottom:0}} barCategoryGap={6}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" width={68} tick={{fontSize:9}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:10,borderRadius:8}}/>
                    <Legend wrapperStyle={{fontSize:9}} iconSize={8}/>
                    <Bar dataKey="حاضر"   stackId="a" fill="#10b981"/>
                    <Bar dataKey="تاخیر"  stackId="a" fill="#f59e0b"/>
                    <Bar dataKey="غیبت"   stackId="a" fill="#ef4444"/>
                    <Bar dataKey="مرخصی"  stackId="a" fill="#3b82f6" radius={[0,3,3,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* ══ Department Cards ═════════════════════════════════════════════ */}
          {byDept.length > 0 && (
            <div>
              <p className="text-xs text-theme-muted mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5"/> تفکیک دپارتمان‌ها — ماه {monthLabel}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {byDept.map((d,i)=>{
                  const total = d.present + d.absent + d.late + d.leave;
                  const pct   = total > 0 ? Math.round((d.present+d.late)/total*100) : 0;
                  return (
                    <div key={d.dept} className="bg-theme-card border border-theme rounded-2xl p-3 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-theme-primary truncate flex-1 ml-1">{d.dept}</span>
                        <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${i===0?"bg-amber-400 text-amber-900":i<3?"bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300":"bg-theme-hover text-theme-muted"}`}>
                          {faNum(i+1)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-theme-hover overflow-hidden mb-2">
                        <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-blue-500 transition-all" style={{width:`${pct}%`}}/>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] mb-1.5">
                        <span className="text-theme-muted">حاضر <b className="text-emerald-600 dark:text-emerald-400">{faNum(d.present)}</b></span>
                        <span className="text-theme-muted">تاخیر <b className="text-amber-600 dark:text-amber-400">{faNum(d.late)}</b></span>
                        <span className="text-theme-muted">غیبت <b className="text-red-600 dark:text-red-400">{faNum(d.absent)}</b></span>
                        <span className="text-theme-muted">مرخصی <b className="text-blue-600 dark:text-blue-400">{faNum(d.leave)}</b></span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${pct>=80?"text-emerald-600":pct>=60?"text-amber-600":"text-red-600"}`}>{faNum(pct)}٪</span>
                        <span className="text-[10px] text-theme-muted font-normal mr-0.5">حضور</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ Today's Attendance Table ══════════════════════════════════════ */}
          <div className="bg-theme-card border border-theme rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-theme">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-blue-500/15 flex items-center justify-center">
                  <Users className="w-3 h-3 text-blue-500"/>
                </div>
                <span className="font-semibold text-theme-primary text-sm">
                  کارکرد امروز
                </span>
                <span className="text-xs text-theme-muted">({faNum(todayRecs.length)} نفر)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Status tabs */}
                <div className="flex gap-1 flex-wrap">
                  {(["ALL","PRESENT","LATE","ABSENT","INCOMPLETE","LEAVE"] as const).map(s=>(
                    <button key={s} onClick={()=>setTodayTab(s)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${todayTab===s?"bg-blue-600 text-white":"bg-theme-hover text-theme-muted hover:text-theme-secondary"}`}>
                      {s==="ALL"?"همه":STATUS_FA[s]}
                      {s!=="ALL" && today[s] ? ` (${faNum(today[s] as number)})` : ""}
                    </button>
                  ))}
                </div>
                {/* Search */}
                <div className="flex items-center gap-1.5 bg-theme-hover rounded-xl px-2.5 py-1.5">
                  <Search className="w-3 h-3 text-theme-muted shrink-0"/>
                  <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
                    placeholder="جستجو..." dir="rtl"
                    className="bg-transparent text-xs outline-none text-theme-primary placeholder-theme-muted w-20"/>
                </div>
              </div>
            </div>

            {filteredToday.length === 0 ? (
              <Empty title={todayRecs.length===0?"داده‌ای برای امروز یافت نشد":"موردی با این فیلتر وجود ندارد"}/>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-theme bg-theme-hover/40 text-[11px] font-medium text-theme-muted">
                      <th className="text-right px-3 py-2.5 w-8">#</th>
                      <th className="text-right px-3 py-2.5 cursor-pointer hover:text-theme-primary" onClick={()=>thSort("name")}>کارمند{arrow("name")}</th>
                      <th className="text-right px-3 py-2.5">دپارتمان</th>
                      <th className="text-right px-3 py-2.5">ورود</th>
                      <th className="text-right px-3 py-2.5">خروج</th>
                      <th className="text-right px-3 py-2.5 cursor-pointer hover:text-theme-primary" onClick={()=>thSort("workedMinutes")}>کارکرد{arrow("workedMinutes")}</th>
                      <th className="text-right px-3 py-2.5 cursor-pointer hover:text-theme-primary" onClick={()=>thSort("delayMinutes")}>تاخیر{arrow("delayMinutes")}</th>
                      <th className="text-right px-3 py-2.5 cursor-pointer hover:text-theme-primary" onClick={()=>thSort("overtimeMinutes")}>اضافه‌کار{arrow("overtimeMinutes")}</th>
                      <th className="text-right px-3 py-2.5">وضعیت</th>
                      <th className="px-3 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredToday.map((r,idx)=>(
                      <tr key={r.id}
                        className={`border-b border-theme transition-colors hover:bg-theme-hover/30 ${liveStatus(r,todayISO)==="ABSENT"?"bg-red-50/20 dark:bg-red-950/10":liveStatus(r,todayISO)==="INCOMPLETE"?"bg-orange-50/20 dark:bg-orange-950/10":""}`}>
                        <td className="px-3 py-2 text-xs text-theme-muted">{faNum(idx+1)}</td>
                        <td className="px-3 py-2 font-medium text-theme-primary text-xs">{fullName(r.user)}</td>
                        <td className="px-3 py-2 text-xs text-theme-muted">{r.user?.department?.name||"—"}</td>
                        <td className="px-3 py-2 text-xs text-theme-secondary">{fmtTime(r.firstCheckIn)}</td>
                        <td className="px-3 py-2 text-xs text-theme-secondary">{fmtTime(r.lastCheckOut)}</td>
                        <td className="px-3 py-2 text-xs font-bold text-theme-primary">{r.workedMinutes>0?fmtMin(r.workedMinutes):"—"}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.delayMinutes>0
                            ?<span className="font-bold text-amber-600 dark:text-amber-400">{fmtMin(r.delayMinutes)}</span>
                            :<span className="text-theme-muted">—</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.overtimeMinutes>0
                            ?<span className="font-bold text-violet-600 dark:text-violet-400">{fmtMin(r.overtimeMinutes)}</span>
                            :<span className="text-theme-muted">—</span>}
                        </td>
                        <td className="px-3 py-2"><Badge status={liveStatus(r, todayISO)}/></td>
                        <td className="px-3 py-2">
                          <Link href={`/dashboard/attendance/records?userId=${r.userId}`}
                            className="text-blue-500 hover:text-blue-600 transition-colors">
                            <Eye className="w-3.5 h-3.5"/>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ══ Bottom Row: Incomplete + Insights ════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Incomplete Records */}
            <Section title={`رکوردهای ناقص ماه (${faNum(incompleteRecs.length)})`} icon={FileWarning}
              action={
                <Link href="/dashboard/attendance/records?status=INCOMPLETE"
                  className="text-[11px] text-blue-500 hover:underline">مشاهده همه</Link>
              }>
              {incompleteRecs.length === 0 ? (
                <Empty title="هیچ رکورد ناقصی وجود ندارد" sub="وضعیت ایده‌آل ✓"/>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {incompleteRecs.slice(0,25).map(r=>(
                    <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-orange-50/40 dark:bg-orange-950/10 border border-orange-200/50 dark:border-orange-900/20">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-theme-primary truncate">{fullName(r.user)}</p>
                        <p className="text-[10px] text-theme-muted">{r.user?.department?.name||"—"} · {toFa(`${r.jYear}/${r.jMonth}/${r.jDay}`)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!r.firstCheckIn && <span className="text-[10px] text-red-600 bg-red-100 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">بدون ورود</span>}
                        {r.firstCheckIn && !r.lastCheckOut && <span className="text-[10px] text-orange-600 bg-orange-100 dark:bg-orange-950/30 px-1.5 py-0.5 rounded-full">بدون خروج</span>}
                        <Link href={`/dashboard/attendance/records?userId=${r.userId}`}
                          className="text-blue-500 hover:text-blue-600 transition-colors">
                          <Eye className="w-3 h-3"/>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {incompleteRecs.length > 25 && (
                    <p className="text-center text-xs text-theme-muted pt-1">و {faNum(incompleteRecs.length-25)} رکورد دیگر</p>
                  )}
                </div>
              )}
            </Section>

            {/* Smart Insights */}
            <Section title="بینش و نکات هوشمند" icon={TrendingUp}>
              <div className="space-y-2">
                {(()=>{
                  const items: Array<{icon:React.ElementType; text:string; cls:string}> = [];

                  if (attendancePct >= 90)
                    items.push({icon:CheckCircle, text:`درصد حضور عالی: ${faNum(attendancePct)}٪ از کارمندان فعال حاضرند`, cls:"text-emerald-600 dark:text-emerald-400"});
                  else if (attendancePct < 70)
                    items.push({icon:AlertTriangle, text:`درصد حضور پایین: فقط ${faNum(attendancePct)}٪ حاضر هستند`, cls:"text-red-600 dark:text-red-400"});
                  else
                    items.push({icon:TrendingUp, text:`درصد حضور امروز: ${faNum(attendancePct)}٪`, cls:"text-blue-600 dark:text-blue-400"});

                  if ((today.LATE||0) > 0)
                    items.push({icon:Clock, text:`${faNum(today.LATE)} نفر امروز با تاخیر وارد شده‌اند`, cls:"text-amber-600 dark:text-amber-400"});

                  if ((today.INCOMPLETE||0) > 0)
                    items.push({icon:AlertCircle, text:`${faNum(today.INCOMPLETE)} رکورد ناقص امروز نیاز به رسیدگی دارد`, cls:"text-orange-600 dark:text-orange-400"});

                  if (incompleteRecs.length > 0)
                    items.push({icon:FileWarning, text:`${faNum(incompleteRecs.length)} رکورد ناقص در ماه ${monthLabel} وجود دارد`, cls:"text-orange-600 dark:text-orange-400"});

                  if (topOt.length > 0)
                    items.push({icon:Award, text:`بیشترین اضافه‌کار ماه: ${topOt[0].name} — ${fmtMin(topOt[0].value)}`, cls:"text-violet-600 dark:text-violet-400"});

                  if (topDel.length > 0)
                    items.push({icon:AlertTriangle, text:`بیشترین تاخیر ماه: ${topDel[0].name} — ${fmtMin(topDel[0].value)} (${faNum(topDel[0].days)} روز)`, cls:"text-amber-600 dark:text-amber-400"});

                  if (pending > 0)
                    items.push({icon:Bell, text:`${faNum(pending)} درخواست حضور در انتظار تایید مدیر`, cls:"text-blue-600 dark:text-blue-400"});

                  const topD = byDept[0];
                  if (topD) {
                    const tot = topD.present+topD.absent+topD.late+topD.leave;
                    const p = tot > 0 ? Math.round((topD.present+topD.late)/tot*100) : 0;
                    items.push({icon:Building2, text:`بالاترین حضور دپارتمان: ${topD.dept} با ${faNum(p)}٪`, cls:"text-blue-600 dark:text-blue-400"});
                  }

                  if (items.length === 0)
                    items.push({icon:CheckCircle, text:"همه چیز در وضعیت نرمال است", cls:"text-emerald-600"});

                  return items.map((it,i)=>{
                    const Ic = it.icon;
                    return (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-theme-hover/50">
                        <Ic className={`w-4 h-4 mt-0.5 shrink-0 ${it.cls}`}/>
                        <p className="text-xs text-theme-primary leading-relaxed">{it.text}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
