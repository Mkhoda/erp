"use client";
import React from "react";
import { pageTitle } from "../../../../lib/branding";
import {
  FileSpreadsheet, FileText, Loader2, Clock, Fingerprint, ArrowLeft, Eye, ScrollText,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";
import DayDetailModal from "../../../components/attendance/DayDetailModal";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const STATUS_FA: Record<string,string> = { PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت", INCOMPLETE:"ناقص", LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته", OFF_DUTY:"استراحت (شیفت)", WORKING:"در حال کار" };
const STATUS_CLS: Record<string,string> = {
  PRESENT:"bg-green-500/15 text-green-600", LATE:"bg-amber-500/15 text-amber-600",
  EARLY_LEAVE:"bg-yellow-500/15 text-yellow-600", ABSENT:"bg-red-500/15 text-red-600",
  INCOMPLETE:"bg-orange-500/15 text-orange-600", LEAVE:"bg-blue-500/15 text-blue-600",
  MISSION:"bg-violet-500/15 text-violet-600", REMOTE_WORK:"bg-cyan-500/15 text-cyan-600",
  HOLIDAY:"bg-slate-400/15 text-slate-500", COMPANY_HOLIDAY:"bg-slate-400/15 text-slate-500", WEEKEND:"bg-slate-300/20 text-slate-500",
  OFF_DUTY:"bg-slate-300/20 text-slate-500",
  WORKING:"bg-teal-500/15 text-teal-600",
};
const TODAY_ISO = new Date().toISOString().slice(0, 10);
function liveStatus(r: any): string {
  if (r.status === "INCOMPLETE" && r.firstCheckIn && !r.lastCheckOut && r.gregDate?.slice(0, 10) === TODAY_ISO) return "WORKING";
  return r.status;
}
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

// Current Jalali year/month (Tehran) — used to default the filters on load.
function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return { jYear: +(p.find(x => x.type === "year")?.value || 0), jMonth: +(p.find(x => x.type === "month")?.value || 0) };
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
  const [ov, setOv] = React.useState<{ inTime: string; outTime: string; status: string; reason: string; leaveHours: string; clearCheckIn: boolean; clearCheckOut: boolean }>({ inTime: "", outTime: "", status: "", reason: "", leaveHours: "", clearCheckIn: false, clearCheckOut: false });
  const [ovSaving, setOvSaving] = React.useState(false);
  const [leave, setLeave] = React.useState<any>(null);
  const [rules, setRules] = React.useState<any>(null);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [rulesLoading, setRulesLoading] = React.useState(false);
  // Pagination
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  React.useEffect(() => { setPage(1); }, [rows, pageSize]);

  // Default to the current Jalali month/year on load (0 = "all" once cleared).
  const [jYear, setJYear] = React.useState<number>(() => currentJalali().jYear);
  const [jMonth, setJMonth] = React.useState<number>(() => currentJalali().jMonth);
  const [jDay, setJDay] = React.useState<number>(0);
  const [deptId, setDeptId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [status, setStatus] = React.useState("");

  const qs = React.useCallback(() => {
    const p = new URLSearchParams();
    if (jYear) p.set("jYear", String(jYear));
    if (jMonth) p.set("jMonth", String(jMonth));
    if (jDay) p.set("jDay", String(jDay));
    if (deptId) p.set("departmentId", deptId);
    if (userId) p.set("userId", userId);
    if (status) p.set("status", status);
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
    setOv({ inTime: toHHmm(row.firstCheckIn), outTime: toHHmm(row.lastCheckOut), status: "", reason: "", leaveHours: "", clearCheckIn: false, clearCheckOut: false });
    setDetail({ row, ...d });
  }

  async function saveOverride() {
    if (!detail) return;
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
            <p className="text-sm text-theme-muted">{faNum(rows.length)} رکورد</p>
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
          {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <SumCard label="روزهای دارای داده" value={faNum(summary.distinctDays ?? summary.days)} />
          <SumCard label="کارکرد" value={fmtMin(summary.workedMinutes)} />
          <SumCard label="تاخیر" value={fmtMin(summary.delayMinutes)} cls="text-amber-600" />
          <SumCard label="تعجیل" value={fmtMin(summary.earlyLeaveMinutes)} cls="text-yellow-600" />
          <SumCard label="کسری" value={fmtMin(summary.deficitMinutes || 0)} cls="text-orange-600" />
          <SumCard label="مرخصی ساعتی" value={fmtMin(summary.hourlyLeaveMinutes || 0)} cls="text-blue-600" />
          <SumCard label="مرخصی روزانه" value={`${faNum(summary.leaveDays || 0)} روز`} cls="text-blue-600" />
          <SumCard label="اضافه‌کار عادی" value={fmtMin(summary.overtimeMinutes)} cls="text-violet-600" />
          <SumCard label="تعطیل‌کاری" value={fmtMin(summary.holidayOvertimeMinutes)} cls="text-rose-600" />
          <SumCard label="شب‌کاری" value={fmtMin(summary.nightMinutes)} cls="text-slate-600" />
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
                <th className="py-2 px-2 font-medium">#</th><th className="font-medium px-2">نام</th>
                <th className="font-medium px-2">کد کارت</th><th className="font-medium px-2">دپارتمان</th>
                <th className="font-medium px-2">تاریخ</th><th className="font-medium px-2">ورود</th><th className="font-medium px-2">خروج</th>
                <th className="font-medium px-2">کارکرد</th><th className="font-medium px-2">تاخیر</th><th className="font-medium px-2">تعجیل</th>
                <th className="font-medium px-2">کسری</th><th className="font-medium px-2">مرخصی</th><th className="font-medium px-2">اضافه‌کار</th><th className="font-medium px-2">تعطیل‌کاری</th>
                <th className="font-medium px-2">وضعیت</th><th className="font-medium px-2">جزئیات</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={16} className="py-10 text-center text-theme-muted">رکوردی یافت نشد</td></tr>
                ) : rows.slice((page-1)*pageSize, page*pageSize).map((r, i) => (
                  <tr key={r.id} className="border-b border-theme/40 hover:bg-theme-hover">
                    <td className="py-1.5 px-2 text-theme-muted">{faNum((page-1)*pageSize + i + 1)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{r.user?.attendanceCardNo || "—"}</td>
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
                      <button onClick={() => openDetail(r)} title="مشاهده جزئیات و پانچ‌ها"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-theme text-sm">
            <div className="flex items-center gap-2 text-theme-muted">
              <span>نمایش</span>
              <select value={pageSize} onChange={e => setPageSize(+e.target.value)} className="input-theme text-sm w-auto py-1">
                {[25, 50, 100, 200].map(n => <option key={n} value={n}>{faNum(n)}</option>)}
              </select>
              <span>از {faNum(rows.length)} رکورد</span>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">قبلی</button>
              <span className="text-theme-muted">صفحه {faNum(page)} از {faNum(Math.max(1, Math.ceil(rows.length / pageSize)))}</span>
              <button disabled={page >= Math.ceil(rows.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">بعدی</button>
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
      />

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

function SumCard({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
      <div className={`text-lg font-bold ${cls || "text-theme-primary"}`} dir="ltr">{value}</div>
      <div className="text-[11px] text-theme-muted">{label}</div>
    </div>
  );
}
