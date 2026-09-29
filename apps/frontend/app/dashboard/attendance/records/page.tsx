"use client";
import React from "react";
import { pageTitle } from "../../../../lib/branding";
import {
  FileSpreadsheet, FileText, Loader2, Clock, Fingerprint, ArrowLeft, Eye, ScrollText, Filter,
  CalendarDays, AlarmClock, LogOut, TrendingDown, Hourglass, CalendarCheck, TrendingUp, CalendarOff, Moon, ChevronDown,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";
import DayDetailModal from "../../../components/attendance/DayDetailModal";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const STATUS_FA: Record<string,string> = { PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت", INCOMPLETE:"ناقص", LEAVE:"مرخصی", SICK_LEAVE:"استعلاجی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته", OFF_DUTY:"استراحت (شیفت)", WORKING:"در حال کار", UNMAPPED:"کارت بدون کاربر" };
const STATUS_CLS: Record<string,string> = {
  PRESENT:"bg-green-500/15 text-green-600", LATE:"bg-amber-500/15 text-amber-600",
  EARLY_LEAVE:"bg-yellow-500/15 text-yellow-600", ABSENT:"bg-red-500/15 text-red-600",
  INCOMPLETE:"bg-orange-500/15 text-orange-600", LEAVE:"bg-blue-500/15 text-blue-600",
  SICK_LEAVE:"bg-rose-500/15 text-rose-600",
  MISSION:"bg-violet-500/15 text-violet-600", REMOTE_WORK:"bg-cyan-500/15 text-cyan-600",
  HOLIDAY:"bg-slate-400/15 text-slate-500", COMPANY_HOLIDAY:"bg-slate-400/15 text-slate-500", WEEKEND:"bg-slate-300/20 text-slate-500",
  OFF_DUTY:"bg-slate-300/20 text-slate-500",
  WORKING:"bg-teal-500/15 text-teal-600",
  UNMAPPED:"bg-red-500/15 text-red-600",
};
const TODAY_ISO = new Date().toISOString().slice(0, 10);
function liveStatus(r: any): string {
  if (r.status === "INCOMPLETE" && r.firstCheckIn && !r.lastCheckOut && r.gregDate?.slice(0, 10) === TODAY_ISO) return "WORKING";
  return r.status;
}

// Drill-down spec for each summary card: which rows contributed to that sum,
// and what to show as the "value" column in the breakdown modal. Mirrors the
// exact same filters the backend's summary() aggregate uses (e.g. hourly
// leave = leaveMinutes on non-full-leave days) so the modal total matches
// the card.
type MetricKey = "distinctDays" | "workedMinutes" | "delayMinutes" | "earlyLeaveMinutes" | "deficitMinutes"
  | "hourlyLeaveMinutes" | "leaveDays" | "overtimeMinutes" | "holidayOvertimeMinutes" | "nightMinutes";
const METRICS: Record<MetricKey, { label: string; valueLabel: string; matches: (r: any) => boolean; value: (r: any) => number; unit: "min" | "day" }> = {
  distinctDays: { label: "روزهای دارای داده", valueLabel: "کارکرد", matches: () => true, value: (r) => r.workedMinutes || 0, unit: "min" },
  workedMinutes: { label: "کارکرد", valueLabel: "کارکرد", matches: (r) => (r.workedMinutes || 0) > 0, value: (r) => r.workedMinutes || 0, unit: "min" },
  delayMinutes: { label: "تاخیر", valueLabel: "تاخیر", matches: (r) => (r.delayMinutes || 0) > 0, value: (r) => r.delayMinutes || 0, unit: "min" },
  earlyLeaveMinutes: { label: "تعجیل", valueLabel: "تعجیل", matches: (r) => (r.earlyLeaveMinutes || 0) > 0, value: (r) => r.earlyLeaveMinutes || 0, unit: "min" },
  deficitMinutes: { label: "کسری", valueLabel: "کسری", matches: (r) => (r.deficitMinutes || 0) > 0, value: (r) => r.deficitMinutes || 0, unit: "min" },
  hourlyLeaveMinutes: { label: "مرخصی ساعتی", valueLabel: "مرخصی", matches: (r) => (r.leaveMinutes || 0) > 0 && r.status !== "LEAVE", value: (r) => r.leaveMinutes || 0, unit: "min" },
  leaveDays: { label: "مرخصی روزانه", valueLabel: "مرخصی", matches: (r) => r.status === "LEAVE", value: (r) => r.leaveMinutes || 0, unit: "day" },
  overtimeMinutes: { label: "اضافه‌کار عادی", valueLabel: "اضافه‌کار", matches: (r) => (r.overtimeMinutes || 0) > 0, value: (r) => r.overtimeMinutes || 0, unit: "min" },
  holidayOvertimeMinutes: { label: "تعطیل‌کاری", valueLabel: "تعطیل‌کاری", matches: (r) => (r.holidayOvertimeMinutes || 0) > 0, value: (r) => r.holidayOvertimeMinutes || 0, unit: "min" },
  nightMinutes: { label: "شب‌کاری", valueLabel: "شب‌کاری", matches: (r) => (r.nightMinutes || 0) > 0, value: (r) => r.nightMinutes || 0, unit: "min" },
};
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const fmtDH = (days: number) => { const d = Math.floor(days); const h = Math.round((days - d) * 8); return h > 0 ? `${faNum(d)} روز و ${faNum(h)} ساعت` : `${faNum(d)} روز`; };
const faY = (n: number) => (n ?? 0).toLocaleString("fa-IR", { useGrouping: false }); // years: no thousands separator
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]); // map ASCII digits → Persian
const fmtMin = (m: number) => { const h = Math.floor(Math.abs(m||0)/60); const mm = Math.abs(m||0)%60; return toFa(`${m<0?"-":""}${h}:${String(mm).padStart(2,"0")}`); };
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });
const faDOW  = (g: string) => new Date(g).toLocaleDateString("fa-IR", { weekday:"long", timeZone:"UTC" });
const hhmm = (min: number) => toFa(`${String(Math.floor((min||0)/60)).padStart(2,"0")}:${String((min||0)%60).padStart(2,"0")}`);
const DOW_FA: Record<number,string> = { 6:"شنبه", 0:"یکشنبه", 1:"دوشنبه", 2:"سه‌شنبه", 3:"چهارشنبه", 4:"پنج‌شنبه", 5:"جمعه" };
const FA_ORDER = [6,0,1,2,3,4,5];

// Current Jalali date (Tehran) — used to default the filters on load: the
// page opens scoped to today's still-working people, not the whole month.
function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return {
    jYear: +(p.find(x => x.type === "year")?.value || 0),
    jMonth: +(p.find(x => x.type === "month")?.value || 0),
    jDay: +(p.find(x => x.type === "day")?.value || 0),
  };
}

export default function AttendanceRecordsPage() {
  React.useEffect(() => { document.title = pageTitle("کارکرد روزانه"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [periods, setPeriods] = React.useState<Array<{ jYear: number; jMonth: number }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<any>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);
  // Admin edit (override) form in the detail modal.
  const [ov, setOv] = React.useState<{ inTime: string; outTime: string; status: string; reason: string; leaveHours: string; clearCheckIn: boolean; clearCheckOut: boolean; isSickLeave: boolean; attachment: string }>({ inTime: "", outTime: "", status: "", reason: "", leaveHours: "", clearCheckIn: false, clearCheckOut: false, isSickLeave: false, attachment: "" });
  const [ovSaving, setOvSaving] = React.useState(false);
  const [ovUploading, setOvUploading] = React.useState(false);

  // Same doctor's-note upload endpoint as employee self-service — any authenticated user may use it.
  async function onPickOvAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setOvUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`${API}/attendance/me/requests/attachment`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { const e2 = await res.json().catch(() => ({})); alert(e2.message || "خطا در آپلود عکس"); return; }
      const d = await res.json();
      setOv(s => ({ ...s, attachment: d.url }));
    } catch { alert("خطا در آپلود عکس"); }
    finally { setOvUploading(false); }
  }
  const [leave, setLeave] = React.useState<any>(null);
  const [rules, setRules] = React.useState<any>(null);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [rulesLoading, setRulesLoading] = React.useState(false);
  const [breakdown, setBreakdown] = React.useState<MetricKey | null>(null);
  // Pagination
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  // Default to today, status "در حال کار" — the page opens on "who's working
  // right now", not a month-wide dump. 0 = "all" once the user clears a field.
  const [jYear, setJYear] = React.useState<number>(() => currentJalali().jYear);
  const [jMonth, setJMonth] = React.useState<number>(() => currentJalali().jMonth);
  const [jDay, setJDay] = React.useState<number>(() => currentJalali().jDay);
  const [deptId, setDeptId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [status, setStatus] = React.useState("WORKING");
  React.useEffect(() => { setPage(1); }, [rows, pageSize, status]);

  // Advanced search (collapsed accordion) — currently just the unmapped-card toggle.
  const [advOpen, setAdvOpen] = React.useState(false);
  const [showUnmapped, setShowUnmapped] = React.useState(false);
  const [unmapped, setUnmapped] = React.useState<any[]>([]);
  const [unmappedLoading, setUnmappedLoading] = React.useState(false);

  const qs = React.useCallback(() => {
    const p = new URLSearchParams();
    if (jYear) p.set("jYear", String(jYear));
    if (jMonth) p.set("jMonth", String(jMonth));
    if (jDay) p.set("jDay", String(jDay));
    if (deptId) p.set("departmentId", deptId);
    if (userId) p.set("userId", userId);
    // "WORKING" isn't a real backend status — it's a client-derived subset of
    // INCOMPLETE (checked in, no checkout yet, today). Ask the backend for the
    // full INCOMPLETE set and split it into WORKING vs. genuinely INCOMPLETE below.
    if (status) p.set("status", status === "WORKING" ? "INCOMPLETE" : status);
    return p.toString();
  }, [jYear, jMonth, jDay, deptId, userId, status]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        fetch(`${API}/attendance/records?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : []),
        fetch(`${API}/attendance/records/summary?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : null),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setSummary(s);
      // Leave balance only makes sense for a specific person + year.
      const lbYear = jYear || (Array.isArray(r) && r[0] ? r[0].jYear : 0);
      if (userId && lbYear) {
        setLeave(await fetch(`${API}/attendance/records/leave-balance?userId=${userId}&jYear=${lbYear}`, { headers: h }).then(x => x.ok ? x.json() : null));
      } else setLeave(null);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [qs]);

  React.useEffect(() => { load(); }, [load]);

  const loadUnmapped = React.useCallback(async () => {
    setUnmappedLoading(true);
    try {
      const p = new URLSearchParams();
      if (jYear) p.set("jYear", String(jYear));
      if (jMonth) p.set("jMonth", String(jMonth));
      if (jDay) p.set("jDay", String(jDay));
      const r = await fetch(`${API}/attendance/records/unmapped?${p}`, { headers: h }).then(x => x.ok ? x.json() : []);
      setUnmapped(Array.isArray(r) ? r : []);
    } finally { setUnmappedLoading(false); }
    // eslint-disable-next-line
  }, [jYear, jMonth, jDay]);
  React.useEffect(() => { if (showUnmapped) loadUnmapped(); else setUnmapped([]); }, [showUnmapped, loadUnmapped]);

  React.useEffect(() => {
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
    fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {});
    fetch(`${API}/attendance/records/periods`, { headers: h }).then(r => r.ok ? r.json() : []).then(p => setPeriods(Array.isArray(p) ? p : [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const toHHmm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hour12: false }) : "";

  const loadRules = React.useCallback(async () => {
    setRulesLoading(true);
    try {
      const qp = userId ? `?userId=${userId}` : "";
      const r = await fetch(`${API}/attendance/records/rules-summary${qp}`, { headers: h });
      setRules(r.ok ? await r.json() : null);
    } finally { setRulesLoading(false); }
    // eslint-disable-next-line
  }, [userId]);
  function openRules() { setRulesOpen(true); loadRules(); }
  React.useEffect(() => { if (rulesOpen) loadRules(); }, [userId]); // eslint-disable-line

  async function openDetail(row: any) {
    const date = row.gregDate.slice(0, 10);
    const d = await fetch(`${API}/attendance/records/day?userId=${row.userId}&date=${date}`, { headers: h }).then(r => r.ok ? r.json() : null);
    setOv({ inTime: toHHmm(row.firstCheckIn), outTime: toHHmm(row.lastCheckOut), status: "", reason: "", leaveHours: "", clearCheckIn: false, clearCheckOut: false, isSickLeave: false, attachment: "" });
    setDetail({ row, ...d });
  }

  async function saveOverride() {
    if (!detail) return;
    if (ov.isSickLeave && !ov.attachment) { alert("برای مرخصی استعلاجی، بارگذاری تصویر برگه مرخصی (گواهی پزشک) الزامی است"); return; }
    setOvSaving(true);
    try {
      const body = {
        userId: detail.row.userId,
        date: detail.row.gregDate.slice(0, 10),
        inTime: ov.clearCheckIn ? undefined : (ov.inTime || undefined),
        outTime: ov.clearCheckOut ? undefined : (ov.outTime || undefined),
        clearCheckIn: ov.clearCheckIn || undefined,
        clearCheckOut: ov.clearCheckOut || undefined,
        forceStatus: ov.status || undefined,
        leaveMinutes: ov.leaveHours ? Math.round(Number(ov.leaveHours) * 60) : undefined,
        isSickLeave: ov.isSickLeave || undefined,
        attachment: ov.isSickLeave ? ov.attachment : undefined,
        reason: ov.reason || "اصلاح توسط مدیر",
      };
      const res = await fetch(`${API}/attendance/overrides`, { method: "POST", headers: h, body: JSON.stringify(body) });
      if (res.ok) { setDetail(null); await load(); }
    } finally { setOvSaving(false); }
  }

  async function exportFile(kind: "excel" | "pdf") {
    setExporting(kind);
    try {
      const res = await fetch(`${API}/attendance/reports/${kind}?${qs()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = kind === "excel" ? "attendance.xlsx" : "attendance.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(null); }
  }

  // Data-driven options: only years/months that actually have records.
  // Always include the currently-selected year/month so the default filter shows
  // even before its data has loaded into `periods`.
  const yearOpts = [...new Set([...(jYear ? [jYear] : []), ...periods.map(p => p.jYear)])].sort((a, b) => b - a);
  const monthOpts = [...new Set([...(jMonth ? [jMonth] : []), ...periods.filter(p => !jYear || p.jYear === jYear).map(p => p.jMonth)])].sort((a, b) => a - b);
  // Split the backend's raw INCOMPLETE set into "still working today" vs.
  // genuinely incomplete, so the status filter doesn't lump the two together.
  // Unmapped-card pseudo-rows (no AttendanceDay, no status) are appended
  // regardless of the status filter — they have no status to filter by.
  const displayRows = React.useMemo(() => {
    const base = status === "INCOMPLETE" ? rows.filter(r => liveStatus(r) !== "WORKING")
      : status === "WORKING" ? rows.filter(r => liveStatus(r) === "WORKING")
      : rows;
    if (!showUnmapped || !unmapped.length) return base;
    const pseudo = unmapped.map(u => ({
      id: `unmapped-${u.cardNo}-${u.gregDate}`,
      userId: null, user: null,
      gregDate: u.gregDate, firstCheckIn: u.firstPunch, lastCheckOut: u.lastPunch,
      workedMinutes: 0, delayMinutes: 0, earlyLeaveMinutes: 0, deficitMinutes: 0,
      leaveMinutes: 0, overtimeMinutes: 0, holidayOvertimeMinutes: 0, nightMinutes: 0,
      status: "UNMAPPED",
      __unmappedCard: u.cardNo, __punchCount: u.punchCount,
    }));
    return [...base, ...pseudo];
  }, [rows, status, showUnmapped, unmapped]);

  // ── Column sort (client-side, applied after the status split above) ──
  const [sortK, setSortK] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  function thSort(k: string) {
    if (sortK === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortK(k); setSortDir("asc"); }
  }
  const arrow = (k: string) => sortK === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const sortValue = React.useCallback((r: any, k: string): string | number => {
    switch (k) {
      case "name": return r.user ? `${r.user.firstName || ""} ${r.user.lastName || ""}` : (r.__unmappedCard ? "کارت بدون کاربر" : "");
      case "card": return r.user?.attendanceCardNo || r.__unmappedCard || "";
      case "dept": return r.user?.department?.name || "";
      case "date": return r.gregDate || "";
      case "in": return r.firstCheckIn || "";
      case "out": return r.lastCheckOut || "";
      case "worked": return r.workedMinutes || 0;
      case "delay": return r.delayMinutes || 0;
      case "early": return r.earlyLeaveMinutes || 0;
      case "deficit": return r.deficitMinutes || 0;
      case "leave": return r.leaveMinutes || 0;
      case "ot": return r.overtimeMinutes || 0;
      case "holidayOt": return r.holidayOvertimeMinutes || 0;
      case "status": return STATUS_FA[liveStatus(r)] || r.status || "";
      default: return 0;
    }
  }, []);
  const sortedRows = React.useMemo(() => {
    if (!sortK) return displayRows;
    const sorted = [...displayRows].sort((a, b) => {
      const va = sortValue(a, sortK), vb = sortValue(b, sortK);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fa");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [displayRows, sortK, sortDir, sortValue]);

  const personOptions = users.map((u: any) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}${u.attendanceCardNo ? ` (${u.attendanceCardNo})` : ""}`,
    search: `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`,
  }));

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Fingerprint className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">کارکرد روزانه</h1>
            <p className="text-sm text-theme-muted">{faNum(displayRows.length)} رکورد</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/attendance" className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><ArrowLeft className="w-4 h-4" /> داشبورد</Link>
          <button onClick={openRules} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary">
            <ScrollText className="w-4 h-4" /> قوانین کارکرد
          </button>
          <button onClick={() => exportFile("excel")} disabled={!!exporting} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
            {exporting === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} اکسل
          </button>
          <button onClick={() => exportFile("pdf")} disabled={!!exporting} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
            {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-card border border-theme rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
        <select className="input-theme text-sm" value={jYear} onChange={e => { setJYear(+e.target.value); setJMonth(0); setJDay(0); }}>
          <option value={0}>همه سال‌ها</option>
          {yearOpts.map(y => <option key={y} value={y}>سال {faY(y)}</option>)}
        </select>
        <select className="input-theme text-sm" value={jMonth} onChange={e => { setJMonth(+e.target.value); setJDay(0); }}>
          <option value={0}>همه ماه‌ها</option>
          {monthOpts.map(m => <option key={m} value={m}>{J_MONTHS[m-1]}</option>)}
        </select>
        <select className="input-theme text-sm" value={jDay} onChange={e => setJDay(+e.target.value)}>
          <option value={0}>همه روزها</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>روز {toFa(String(d))}</option>)}
        </select>
        <select className="input-theme text-sm" value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">همه دپارتمان‌ها</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input-theme text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUS_FA).filter(([k]) => k !== "UNMAPPED").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <SearchSelect
          className="col-span-2"
          options={personOptions}
          value={userId}
          onChange={setUserId}
          searchKey="search"
          emptyLabel="همه افراد"
          placeholder="جستجوی شخص (نام/موبایل/کارت)"
        />
      </div>

      {/* Advanced search (accordion) */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        <button type="button" onClick={() => setAdvOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-theme-primary">
          <span className="flex items-center gap-1.5"><Filter className="w-4 h-4 text-blue-500" /> جستجوی پیشرفته</span>
          <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform ${advOpen ? "rotate-180" : ""}`} />
        </button>
        {advOpen && (
          <div className="px-3 pb-3 border-t border-theme pt-3">
            <label className="flex items-center gap-2 text-sm text-theme-primary cursor-pointer w-fit">
              <input type="checkbox" checked={showUnmapped} onChange={e => setShowUnmapped(e.target.checked)} />
              نمایش کارت‌های بدون کاربر
              {unmappedLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-muted" />}
            </label>
            <p className="mt-1 text-xs text-theme-muted">پانچ‌های خام دستگاه برای کارت‌هایی که هنوز به هیچ کاربری متصل نشده‌اند، در همین بازه‌ی تاریخ — به انتهای جدول اضافه می‌شود.</p>
          </div>
        )}
      </div>

      {/* Summary — click a card (or its icon) to see which days/hours make up that total */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <SumCard label="روزهای دارای داده" value={faNum(summary.distinctDays ?? summary.days)} icon={CalendarDays} iconCls="bg-sky-500/10 text-sky-600" onClick={() => setBreakdown("distinctDays")} />
          <SumCard label="کارکرد" value={fmtMin(summary.workedMinutes)} icon={Fingerprint} iconCls="bg-emerald-500/10 text-emerald-600" onClick={() => setBreakdown("workedMinutes")} />
          <SumCard label="تاخیر" value={fmtMin(summary.delayMinutes)} cls="text-amber-600" icon={AlarmClock} iconCls="bg-amber-500/10 text-amber-600" onClick={() => setBreakdown("delayMinutes")} />
          <SumCard label="تعجیل" value={fmtMin(summary.earlyLeaveMinutes)} cls="text-yellow-600" icon={LogOut} iconCls="bg-yellow-500/10 text-yellow-600" onClick={() => setBreakdown("earlyLeaveMinutes")} />
          <SumCard label="کسری" value={fmtMin(summary.deficitMinutes || 0)} cls="text-orange-600" icon={TrendingDown} iconCls="bg-orange-500/10 text-orange-600" onClick={() => setBreakdown("deficitMinutes")} />
          <SumCard label="مرخصی ساعتی" value={fmtMin(summary.hourlyLeaveMinutes || 0)} cls="text-blue-600" icon={Hourglass} iconCls="bg-blue-500/10 text-blue-600" onClick={() => setBreakdown("hourlyLeaveMinutes")} />
          <SumCard label="مرخصی روزانه" value={`${faNum(summary.leaveDays || 0)} روز`} cls="text-blue-600" icon={CalendarCheck} iconCls="bg-blue-500/10 text-blue-600" onClick={() => setBreakdown("leaveDays")} />
          <SumCard label="اضافه‌کار عادی" value={fmtMin(summary.overtimeMinutes)} cls="text-violet-600" icon={TrendingUp} iconCls="bg-violet-500/10 text-violet-600" onClick={() => setBreakdown("overtimeMinutes")} />
          <SumCard label="تعطیل‌کاری" value={fmtMin(summary.holidayOvertimeMinutes)} cls="text-rose-600" icon={CalendarOff} iconCls="bg-rose-500/10 text-rose-600" onClick={() => setBreakdown("holidayOvertimeMinutes")} />
          <SumCard label="شب‌کاری" value={fmtMin(summary.nightMinutes)} cls="text-slate-600" icon={Moon} iconCls="bg-slate-500/10 text-slate-600" onClick={() => setBreakdown("nightMinutes")} />
        </div>
      )}

      {leave && (
        <div className="border border-blue-500/30 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20">
            <span className="text-theme-primary font-semibold text-sm">مرخصی سال {faY(leave.jYear)}</span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600 font-bold">{fmtDH(leave.remainingDays)} مانده</span>
              <span className="text-theme-muted text-xs">از {faNum(leave.entitlement)} روز</span>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch bg-blue-500/5 text-xs">
            {([
              { lbl: "مرخصی روزانه", val: `${faNum(leave.fullDays)} روز`, cls: "text-blue-600" },
              { lbl: "مرخصی ساعتی", val: fmtMin(leave.hourlyLeaveMinutes), cls: "text-blue-600" },
              { lbl: "غیبت", val: `${faNum(leave.absentDays)} روز`, cls: "text-red-600" },
              { lbl: "کسر تاخیر/تعجیل", val: fmtMin(leave.tardyMinutes), cls: "text-amber-600" },
              { lbl: "مصرف کل", val: `${faNum(leave.usedDays)} روز`, cls: "text-orange-600" },
              { lbl: "ماموریت", val: `${faNum(leave.mission)} روز`, cls: "text-violet-600" },
              { lbl: "دورکاری", val: `${faNum(leave.remote)} روز`, cls: "text-cyan-600" },
            ] as { lbl: string; val: string; cls: string }[]).map((item, i) => (
              <React.Fragment key={item.lbl}>
                {i > 0 && <div className="w-px bg-blue-500/20 self-stretch" />}
                <div className="flex flex-col items-center justify-center px-3 py-2 text-center">
                  <span className="text-theme-muted whitespace-nowrap">{item.lbl}</span>
                  <span className={`font-semibold whitespace-nowrap mt-0.5 ${item.cls}`}>{item.val}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead><tr className="text-theme-muted text-center border-b border-theme bg-theme-secondary/30">
                <th className="py-2 px-2 font-medium">#</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("name")}>نام{arrow("name")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("card")}>کد کارت{arrow("card")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("dept")}>دپارتمان{arrow("dept")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("date")}>تاریخ{arrow("date")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("in")}>ورود{arrow("in")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("out")}>خروج{arrow("out")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("worked")}>کارکرد{arrow("worked")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("delay")}>تاخیر{arrow("delay")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("early")}>تعجیل{arrow("early")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("deficit")}>کسری{arrow("deficit")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("leave")}>مرخصی{arrow("leave")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("ot")}>اضافه‌کار{arrow("ot")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("holidayOt")}>تعطیل‌کاری{arrow("holidayOt")}</th>
                <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("status")}>وضعیت{arrow("status")}</th>
                <th className="font-medium px-2">عملیات</th>
              </tr></thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr><td colSpan={16} className="py-10 text-center text-theme-muted">رکوردی یافت نشد</td></tr>
                ) : sortedRows.slice((page-1)*pageSize, page*pageSize).map((r, i) => (
                  <tr key={r.id} className="border-b border-theme/40 hover:bg-theme-hover">
                    <td className="py-1.5 px-2 text-theme-muted">{faNum((page-1)*pageSize + i + 1)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">
                      {r.user ? `${r.user.firstName} ${r.user.lastName}` : r.__unmappedCard ? <span className="text-red-600 font-medium">کارت بدون کاربر{r.__punchCount > 1 ? ` (${faNum(r.__punchCount)} پانچ)` : ""}</span> : "—"}
                    </td>
                    <td className="px-2 text-theme-muted" dir="ltr">{r.user?.attendanceCardNo || r.__unmappedCard || "—"}</td>
                    <td className="px-2 text-theme-muted whitespace-nowrap">{r.user?.department?.name || "—"}</td>
                    <td className="px-2">
                      <div className="text-theme-muted text-xs" dir="ltr">{faDate(r.gregDate)}</div>
                      <div className="text-[10px] text-theme-muted/70">{faDOW(r.gregDate)}</div>
                    </td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.firstCheckIn)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.lastCheckOut)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{fmtMin(r.workedMinutes)}</td>
                    <td className="px-2 text-amber-600" dir="ltr">{r.delayMinutes ? fmtMin(r.delayMinutes) : "—"}</td>
                    <td className="px-2 text-yellow-600" dir="ltr">{r.earlyLeaveMinutes ? fmtMin(r.earlyLeaveMinutes) : "—"}</td>
                    <td className="px-2 text-orange-600 font-medium" dir="ltr">{r.deficitMinutes ? fmtMin(r.deficitMinutes) : "—"}</td>
                    <td className="px-2 text-blue-600" dir="ltr">{r.leaveMinutes ? fmtMin(r.leaveMinutes) : "—"}</td>
                    <td className="px-2 text-violet-600" dir="ltr">{r.overtimeMinutes ? fmtMin(r.overtimeMinutes) : "—"}</td>
                    <td className="px-2 text-rose-600" dir="ltr">{r.holidayOvertimeMinutes ? fmtMin(r.holidayOvertimeMinutes) : "—"}</td>
                    <td className="px-2"><span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[liveStatus(r)] || "bg-theme-secondary"}`}>{STATUS_FA[liveStatus(r)] || r.status}</span></td>
                    <td className="px-2">
                      {r.userId ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openDetail(r)} title="مشاهده جزئیات و پانچ‌ها"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => setUserId(r.userId)} title={`فیلتر بر اساس ${r.user ? `${r.user.firstName} ${r.user.lastName}` : "این کاربر"}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-theme-muted hover:bg-blue-500/10 hover:text-blue-500 transition-colors">
                            <Filter className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-theme-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {!loading && displayRows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-theme text-sm">
            <div className="flex items-center gap-2 text-theme-muted">
              <span>نمایش</span>
              <select value={pageSize} onChange={e => setPageSize(+e.target.value)} className="input-theme text-sm w-auto py-1">
                {[25, 50, 100, 200].map(n => <option key={n} value={n}>{faNum(n)}</option>)}
              </select>
              <span>از {faNum(displayRows.length)} رکورد</span>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">قبلی</button>
              <span className="text-theme-muted">صفحه {faNum(page)} از {faNum(Math.max(1, Math.ceil(displayRows.length / pageSize)))}</span>
              <button disabled={page >= Math.ceil(displayRows.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">بعدی</button>
            </div>
          </div>
        )}
      </div>

      <DayDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        detail={detail}
        allowOverride
        ov={ov}
        setOv={setOv}
        onSaveOverride={saveOverride}
        ovSaving={ovSaving}
        ovUploading={ovUploading}
        onPickOvAttachment={onPickOvAttachment}
      />

      <BreakdownModal metricKey={breakdown} rows={rows} onClose={() => setBreakdown(null)} />

      {/* Work-rules info panel — generated live from the effective schedule, never hardcoded */}
      <Modal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title="قوانین کارکرد"
        subtitle={rules ? `گروه: ${rules.scheduleName}${userId ? "" : " (پیش‌فرض سازمان)"}` : undefined}
        size="lg"
        footer={<button onClick={() => setRulesOpen(false)} className="btn-theme-secondary text-sm">بستن</button>}
      >
        {rulesLoading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : !rules ? (
          <div className="text-theme-muted text-sm text-center py-8">دریافت قوانین ناموفق بود</div>
        ) : (
          <RulesPanel rules={rules} />
        )}
      </Modal>
    </div>
  );
}

function RulesPanel({ rules: r }: { rules: any }) {
  const workDaysFa = FA_ORDER.filter(d => (r.workDays || []).includes(d)).map(d => DOW_FA[d]).join("، ") || "—";
  const otParts: string[] = [];
  if (r.otAllowed) {
    otParts.push(`آستانه شروع اضافه‌کار: ${faNum(r.otMinThreshold)} دقیقه`);
    otParts.push(`گرد کردن به نزدیک‌ترین: ${faNum(r.otRounding)} دقیقه`);
    otParts.push(`سقف روزانه: ${r.otMaxDaily > 0 ? fmtMin(r.otMaxDaily) : "نامحدود"}`);
    otParts.push(`سقف ماهانه: ${r.otMaxMonthly > 0 ? fmtMin(r.otMaxMonthly) : "نامحدود"}`);
  } else {
    otParts.push("اضافه‌کار برای این گروه فعال نیست");
  }

  const sections: Array<{ title: string; icon: any; items: string[] }> = [
    {
      title: "ساعت کار و بازه‌ها", icon: Clock,
      items: [
        `ساعت کار موردنیاز روزانه: ${fmtMin(r.dailyMinutes)}`,
        `کسر ناهار/استراحت: ${fmtMin(r.lunchMinutes)}`,
        `قانون تاخیر: ورود بعد از ${hhmm(r.checkInEnd)} تاخیر محسوب می‌شود`,
        `قانون تعجیل: خروج قبل از ${hhmm(r.checkOutStart)} تعجیل محسوب می‌شود`,
        `روزهای کاری: ${workDaysFa}`,
      ],
    },
    {
      title: "اضافه‌کار", icon: Fingerprint,
      items: otParts,
    },
    {
      title: "کسری کارکرد و تبدیل به مرخصی", icon: ScrollText,
      items: [
        "نحوه محاسبه کسری: حداکثر بین صفر و (ساعت موردنیاز − کارکرد − مرخصی تایید‌شده) — شامل تاخیر، تعجیل، کارکرد ناقص و غیبت",
        r.deficitToLeaveEnabled
          ? `کسری روزانه به‌صورت خودکار و دقیقاً به همان میزان از مرخصی سالانه کسر می‌شود`
          : "کسری روزانه به‌صورت خودکار تبدیل به مرخصی نمی‌شود",
        r.absentToLeaveEnabled
          ? `روزهای غیبت در صورت کافی بودن مانده مرخصی سالانه (${faNum(r.annualLeaveDays)} روز)، به‌صورت خودکار به مرخصی روزانه تبدیل می‌شوند`
          : "روزهای غیبت به‌صورت خودکار به مرخصی تبدیل نمی‌شوند و به‌عنوان غیبت باقی می‌مانند",
      ].filter(Boolean),
    },
    {
      title: "سایر", icon: Fingerprint,
      items: [
        `نوع استخدام: ${r.employeeType === "HOURLY" ? "ساعتی (فقط حضور، بدون تاخیر/اضافه‌کار)" : "تمام‌وقت"}`,
        `مرخصی استحقاقی سالانه: ${faNum(r.annualLeaveDays)} روز`,
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {sections.map(sec => (
        <div key={sec.title}>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-theme-primary mb-2">
            <sec.icon className="w-4 h-4 text-blue-500" /> {sec.title}
          </div>
          <ul className="space-y-1.5">
            {sec.items.map((it, i) => (
              <li key={i} className="text-sm text-theme-secondary bg-theme-secondary/30 rounded-lg px-3 py-2 leading-relaxed">{it}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SumCard({ label, value, cls, icon: Icon, iconCls, onClick }: { label: string; value: string; cls?: string; icon: any; iconCls: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`مشاهده جزئیات ${label}`}
      className="flex items-center gap-2 bg-theme-card border border-theme rounded-2xl px-3 py-2.5 w-full hover:border-blue-400/50 hover:shadow-theme-lg transition-all"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-xs text-theme-muted truncate flex-1 text-right">{label}</span>
      <span className={`text-lg font-extrabold shrink-0 ${cls || "text-theme-primary"}`} dir="ltr">{value}</span>
    </button>
  );
}

// Drill-down modal for a summary card — every row that contributed to that
// total, sortable on any column (mirrors the main table's sort pattern).
function BreakdownModal({ metricKey, rows, onClose }: { metricKey: MetricKey | null; rows: any[]; onClose: () => void }) {
  const [sk, setSk] = React.useState<string | null>(null);
  const [sd, setSd] = React.useState<"asc" | "desc">("asc");
  function thSort(k: string) {
    if (sk === k) setSd(d => d === "asc" ? "desc" : "asc");
    else { setSk(k); setSd("asc"); }
  }
  const arrow = (k: string) => sk === k ? (sd === "asc" ? " ↑" : " ↓") : "";
  React.useEffect(() => { setSk(null); setSd("asc"); }, [metricKey]);

  const spec = metricKey ? METRICS[metricKey] : null;
  const matched = React.useMemo(() => spec ? rows.filter(spec.matches) : [], [spec, rows]);
  const sorted = React.useMemo(() => {
    if (!spec) return [];
    const val = (r: any, k: string): string | number => {
      switch (k) {
        case "name": return r.user ? `${r.user.firstName || ""} ${r.user.lastName || ""}` : "";
        case "dept": return r.user?.department?.name || "";
        case "date": return r.gregDate || "";
        case "in": return r.firstCheckIn || "";
        case "out": return r.lastCheckOut || "";
        case "value": return spec.value(r);
        case "status": return STATUS_FA[liveStatus(r)] || r.status || "";
        default: return 0;
      }
    };
    if (!sk) return matched;
    return [...matched].sort((a, b) => {
      const va = val(a, sk), vb = val(b, sk);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fa");
      return sd === "asc" ? cmp : -cmp;
    });
  }, [matched, sk, sd, spec]);

  const totalMinutes = matched.reduce((s, r) => s + (spec ? spec.value(r) : 0), 0);

  return (
    <Modal open={!!metricKey} onClose={onClose} title={spec ? spec.label : ""}
      subtitle={spec ? `${faNum(matched.length)} رکورد${spec.unit === "min" ? ` — مجموع ${fmtMin(totalMinutes)}` : ""}` : undefined}
      size="lg" footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}>
      {spec && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm text-center">
            <thead><tr className="text-theme-muted text-center border-b border-theme">
              <th className="py-2 px-2 font-medium">#</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("name")}>نام{arrow("name")}</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("dept")}>دپارتمان{arrow("dept")}</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("date")}>تاریخ{arrow("date")}</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("in")}>ورود{arrow("in")}</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("out")}>خروج{arrow("out")}</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("value")}>{spec.valueLabel}{arrow("value")}</th>
              <th className="font-medium px-2 cursor-pointer hover:text-theme-primary" onClick={() => thSort("status")}>وضعیت{arrow("status")}</th>
            </tr></thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-theme-muted">رکوردی یافت نشد</td></tr>
              ) : sorted.map((r, i) => (
                <tr key={r.id} className="border-b border-theme/40 hover:bg-theme-hover">
                  <td className="py-1.5 px-2 text-theme-muted">{faNum(i + 1)}</td>
                  <td className="px-2 text-theme-primary whitespace-nowrap">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "—"}</td>
                  <td className="px-2 text-theme-muted whitespace-nowrap">{r.user?.department?.name || "—"}</td>
                  <td className="px-2 text-theme-muted" dir="ltr">{faDate(r.gregDate)}</td>
                  <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.firstCheckIn)}</td>
                  <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.lastCheckOut)}</td>
                  <td className="px-2 font-medium text-theme-primary" dir="ltr">{spec.unit === "day" ? "روز کامل" : fmtMin(spec.value(r))}</td>
                  <td className="px-2"><span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[liveStatus(r)] || "bg-theme-secondary"}`}>{STATUS_FA[liveStatus(r)] || r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
