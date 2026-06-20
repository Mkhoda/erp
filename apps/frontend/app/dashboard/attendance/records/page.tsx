"use client";
import React from "react";
import {
  FileSpreadsheet, FileText, Loader2, Search, X, Clock, Fingerprint, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const STATUS_FA: Record<string,string> = { PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت", INCOMPLETE:"ناقص", LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته" };
const STATUS_CLS: Record<string,string> = {
  PRESENT:"bg-green-500/15 text-green-600", LATE:"bg-amber-500/15 text-amber-600",
  EARLY_LEAVE:"bg-yellow-500/15 text-yellow-600", ABSENT:"bg-red-500/15 text-red-600",
  INCOMPLETE:"bg-orange-500/15 text-orange-600", LEAVE:"bg-blue-500/15 text-blue-600",
  MISSION:"bg-violet-500/15 text-violet-600", REMOTE_WORK:"bg-cyan-500/15 text-cyan-600",
  HOLIDAY:"bg-slate-400/15 text-slate-500", COMPANY_HOLIDAY:"bg-slate-400/15 text-slate-500", WEEKEND:"bg-slate-300/20 text-slate-500",
};
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const fmtMin = (m: number) => { const h = Math.floor(Math.abs(m||0)/60); const mm = Math.abs(m||0)%60; return `${m<0?"-":""}${faNum(h)}:${String(mm).padStart(2,"0")}`; };
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });

export default function AttendanceRecordsPage() {
  React.useEffect(() => { document.title = "کارکرد روزانه | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<any>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);

  const now = new Date();
  const [jYear, setJYear] = React.useState<number>(1404);
  const [jMonth, setJMonth] = React.useState<number>(1);
  const [deptId, setDeptId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [personQuery, setPersonQuery] = React.useState("");
  const [seeded, setSeeded] = React.useState(false);

  const qs = React.useCallback(() => {
    const p = new URLSearchParams();
    if (jYear) p.set("jYear", String(jYear));
    if (jMonth) p.set("jMonth", String(jMonth));
    if (deptId) p.set("departmentId", deptId);
    if (userId) p.set("userId", userId);
    if (status) p.set("status", status);
    return p.toString();
  }, [jYear, jMonth, deptId, userId, status]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        fetch(`${API}/attendance/records?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : []),
        fetch(`${API}/attendance/records/summary?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : null),
      ]);
      setRows(Array.isArray(r) ? r : []);
      setSummary(s);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [qs]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    // seed current month from dashboard, and load filter lists
    fetch(`${API}/attendance/dashboard`, { headers: h }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setJYear(d.jYear); setJMonth(d.jMonth); } setSeeded(true);
    }).catch(() => setSeeded(true));
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
    fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {});
    // eslint-disable-next-line
  }, []);

  async function openDetail(row: any) {
    const date = row.gregDate.slice(0, 10);
    const d = await fetch(`${API}/attendance/records/day?userId=${row.userId}&date=${date}`, { headers: h }).then(r => r.ok ? r.json() : null);
    setDetail({ row, ...d });
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

  const yearOpts = [jYear - 2, jYear - 1, jYear, jYear + 1];
  const personFiltered = users.filter((u: any) => {
    if (!personQuery) return true;
    const s = `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`.toLowerCase();
    return s.includes(personQuery.toLowerCase());
  }).slice(0, 50);

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
          <button onClick={() => exportFile("excel")} disabled={!!exporting} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
            {exporting === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} اکسل
          </button>
          <button onClick={() => exportFile("pdf")} disabled={!!exporting} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
            {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-card border border-theme rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <select className="input-theme text-sm" value={jYear} onChange={e => setJYear(+e.target.value)}>
          {yearOpts.map(y => <option key={y} value={y}>سال {faNum(y)}</option>)}
        </select>
        <select className="input-theme text-sm" value={jMonth} onChange={e => setJMonth(+e.target.value)}>
          {J_MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select className="input-theme text-sm" value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">همه دپارتمان‌ها</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="input-theme text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="relative col-span-2 md:col-span-1">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
          <input className="input-theme text-sm pr-7" placeholder="جستجوی شخص (نام/موبایل/کارت)" value={personQuery} onChange={e => setPersonQuery(e.target.value)} />
        </div>
        <select className="input-theme text-sm col-span-2 md:col-span-1" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">همه افراد</option>
          {personFiltered.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}{u.attendanceCardNo ? ` (${u.attendanceCardNo})` : ""}</option>)}
        </select>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <SumCard label="روزها" value={faNum(summary.days)} />
          <SumCard label="کارکرد" value={fmtMin(summary.workedMinutes)} />
          <SumCard label="اضافه‌کار" value={fmtMin(summary.overtimeMinutes)} cls="text-violet-600" />
          <SumCard label="تاخیر" value={fmtMin(summary.delayMinutes)} cls="text-amber-600" />
          <SumCard label="تعجیل" value={fmtMin(summary.earlyLeaveMinutes)} cls="text-yellow-600" />
          <SumCard label="شب‌کاری" value={fmtMin(summary.nightMinutes)} cls="text-slate-600" />
        </div>
      )}

      {/* Table */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-theme-muted text-right border-b border-theme bg-theme-secondary/30">
                <th className="py-2 px-2 font-medium">#</th><th className="font-medium px-2">نام</th>
                <th className="font-medium px-2">کد کارت</th><th className="font-medium px-2">دپارتمان</th>
                <th className="font-medium px-2">تاریخ</th><th className="font-medium px-2">ورود</th><th className="font-medium px-2">خروج</th>
                <th className="font-medium px-2">کارکرد</th><th className="font-medium px-2">اضافه‌کار</th><th className="font-medium px-2">تاخیر</th>
                <th className="font-medium px-2">وضعیت</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-center text-theme-muted">رکوردی یافت نشد</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.id} onClick={() => openDetail(r)} className="border-b border-theme/40 hover:bg-theme-hover cursor-pointer">
                    <td className="py-1.5 px-2 text-theme-muted">{faNum(i+1)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{r.user?.attendanceCardNo || "—"}</td>
                    <td className="px-2 text-theme-muted whitespace-nowrap">{r.user?.department?.name || "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{faDate(r.gregDate)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.firstCheckIn)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.lastCheckOut)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{fmtMin(r.workedMinutes)}</td>
                    <td className="px-2 text-violet-600" dir="ltr">{r.overtimeMinutes ? fmtMin(r.overtimeMinutes) : "—"}</td>
                    <td className="px-2 text-amber-600" dir="ltr">{r.delayMinutes ? fmtMin(r.delayMinutes) : "—"}</td>
                    <td className="px-2"><span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] || "bg-theme-secondary"}`}>{STATUS_FA[r.status] || r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Day detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-theme-card border border-theme rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-theme-primary">{detail.row.user ? `${detail.row.user.firstName} ${detail.row.user.lastName}` : ""} — {faDate(detail.row.gregDate)}</h3>
              <button onClick={() => setDetail(null)} className="text-theme-muted hover:text-theme-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Info label="وضعیت" value={STATUS_FA[detail.row.status] || detail.row.status} />
              <Info label="کارکرد" value={fmtMin(detail.row.workedMinutes)} />
              <Info label="اضافه‌کار" value={fmtMin(detail.row.overtimeMinutes)} />
              <Info label="تاخیر" value={fmtMin(detail.row.delayMinutes)} />
              <Info label="تعجیل" value={fmtMin(detail.row.earlyLeaveMinutes)} />
              <Info label="شب‌کاری" value={fmtMin(detail.row.nightMinutes)} />
            </div>
            <div className="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> پانچ‌های خام ({faNum(detail.punches?.length || 0)})</div>
            <div className="space-y-1">
              {(detail.punches || []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm bg-theme-secondary/30 rounded-lg px-3 py-1.5">
                  <span dir="ltr" className="text-theme-primary">{faTime(p.punchAt)}</span>
                  <span className="text-theme-muted text-xs">دستگاه {p.deviceCode || "—"} · کد {p.rType ?? "—"}</span>
                </div>
              ))}
              {(!detail.punches || detail.punches.length === 0) && <div className="text-theme-muted text-sm">پانچی ثبت نشده</div>}
            </div>
            {detail.override && <div className="mt-3 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">اصلاح دستی توسط {detail.override.createdBy?.firstName} {detail.override.createdBy?.lastName}: {detail.override.reason}</div>}
          </div>
        </div>
      )}
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
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-theme-secondary/30 rounded-lg px-3 py-1.5">
      <div className="text-[11px] text-theme-muted">{label}</div>
      <div className="text-theme-primary font-medium" dir="ltr">{value}</div>
    </div>
  );
}
