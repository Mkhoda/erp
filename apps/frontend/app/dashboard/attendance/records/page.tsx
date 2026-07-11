"use client";
import React from "react";
import {
  FileSpreadsheet, FileText, Loader2, Clock, Fingerprint, ArrowLeft, Eye, Pencil,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";
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
const faY = (n: number) => (n ?? 0).toLocaleString("fa-IR", { useGrouping: false }); // years: no thousands separator
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]); // map ASCII digits → Persian
const fmtMin = (m: number) => { const h = Math.floor(Math.abs(m||0)/60); const mm = Math.abs(m||0)%60; return toFa(`${m<0?"-":""}${h}:${String(mm).padStart(2,"0")}`); };
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });

// Current Jalali year/month (Tehran) — used to default the filters on load.
function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return { jYear: +(p.find(x => x.type === "year")?.value || 0), jMonth: +(p.find(x => x.type === "month")?.value || 0) };
}

export default function AttendanceRecordsPage() {
  React.useEffect(() => { document.title = "کارکرد روزانه | Arzesh"; }, []);
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
  const [ov, setOv] = React.useState<{ inTime: string; outTime: string; status: string; reason: string; leaveHours: string }>({ inTime: "", outTime: "", status: "", reason: "", leaveHours: "" });
  const [ovSaving, setOvSaving] = React.useState(false);
  const [leave, setLeave] = React.useState<any>(null);
  // Pagination
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  React.useEffect(() => { setPage(1); }, [rows, pageSize]);

  // Default to the current Jalali month/year on load (0 = "all" once cleared).
  const [jYear, setJYear] = React.useState<number>(() => currentJalali().jYear);
  const [jMonth, setJMonth] = React.useState<number>(() => currentJalali().jMonth);
  const [deptId, setDeptId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [status, setStatus] = React.useState("");

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

  async function openDetail(row: any) {
    const date = row.gregDate.slice(0, 10);
    const d = await fetch(`${API}/attendance/records/day?userId=${row.userId}&date=${date}`, { headers: h }).then(r => r.ok ? r.json() : null);
    setOv({ inTime: toHHmm(row.firstCheckIn), outTime: toHHmm(row.lastCheckOut), status: "", reason: "", leaveHours: "" });
    setDetail({ row, ...d });
  }

  async function saveOverride() {
    if (!detail) return;
    setOvSaving(true);
    try {
      const body = {
        userId: detail.row.userId,
        date: detail.row.gregDate.slice(0, 10),
        inTime: ov.inTime || undefined,
        outTime: ov.outTime || undefined,
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
        <select className="input-theme text-sm" value={jYear} onChange={e => { setJYear(+e.target.value); setJMonth(0); }}>
          <option value={0}>همه سال‌ها</option>
          {yearOpts.map(y => <option key={y} value={y}>سال {faY(y)}</option>)}
        </select>
        <select className="input-theme text-sm" value={jMonth} onChange={e => setJMonth(+e.target.value)}>
          <option value={0}>همه ماه‌ها</option>
          {monthOpts.map(m => <option key={m} value={m}>{J_MONTHS[m-1]}</option>)}
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
        <div className="grid grid-cols-3 md:grid-cols-8 gap-2">
          <SumCard label="روزهای دارای داده" value={faNum(summary.distinctDays ?? summary.days)} />
          <SumCard label="کارکرد" value={fmtMin(summary.workedMinutes)} />
          <SumCard label="تاخیر" value={fmtMin(summary.delayMinutes)} cls="text-amber-600" />
          <SumCard label="تعجیل" value={fmtMin(summary.earlyLeaveMinutes)} cls="text-yellow-600" />
          <SumCard label="کسری" value={fmtMin((summary.delayMinutes || 0) + (summary.earlyLeaveMinutes || 0))} cls="text-orange-600" />
          <SumCard label="اضافه‌کار عادی" value={fmtMin(summary.overtimeMinutes)} cls="text-violet-600" />
          <SumCard label="تعطیل‌کاری" value={fmtMin(summary.holidayOvertimeMinutes)} cls="text-rose-600" />
          <SumCard label="شب‌کاری" value={fmtMin(summary.nightMinutes)} cls="text-slate-600" />
        </div>
      )}

      {leave && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-blue-500/5 border border-blue-500/30 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-theme-primary font-medium">مرخصی سال {faNum(leave.jYear)}:</span>
          <span className="text-blue-600 font-semibold">مانده {faNum(leave.remainingDays)} روز</span>
          <span className="text-theme-muted">از {faNum(leave.entitlement)}</span>
          <span className="text-theme-muted">· روزانه {faNum(leave.fullDays)} روز</span>
          <span className="text-theme-muted">· ساعتی {fmtMin(leave.hourlyLeaveMinutes)}</span>
          <span className="text-amber-600">· کسر تاخیر/تعجیل {fmtMin(leave.tardyMinutes)}</span>
          <span className="text-theme-muted">· ماموریت {faNum(leave.mission)}</span>
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
                <th className="font-medium px-2">کسری</th><th className="font-medium px-2">اضافه‌کار</th>
                <th className="font-medium px-2">وضعیت</th><th className="font-medium px-2">جزئیات</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={14} className="py-10 text-center text-theme-muted">رکوردی یافت نشد</td></tr>
                ) : rows.slice((page-1)*pageSize, page*pageSize).map((r, i) => (
                  <tr key={r.id} className="border-b border-theme/40 hover:bg-theme-hover">
                    <td className="py-1.5 px-2 text-theme-muted">{faNum((page-1)*pageSize + i + 1)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{r.user?.attendanceCardNo || "—"}</td>
                    <td className="px-2 text-theme-muted whitespace-nowrap">{r.user?.department?.name || "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{faDate(r.gregDate)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.firstCheckIn)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.lastCheckOut)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{fmtMin(r.workedMinutes)}</td>
                    <td className="px-2 text-amber-600" dir="ltr">{r.delayMinutes ? fmtMin(r.delayMinutes) : "—"}</td>
                    <td className="px-2 text-yellow-600" dir="ltr">{r.earlyLeaveMinutes ? fmtMin(r.earlyLeaveMinutes) : "—"}</td>
                    <td className="px-2 text-orange-600 font-medium" dir="ltr">{(r.delayMinutes + r.earlyLeaveMinutes) ? fmtMin(r.delayMinutes + r.earlyLeaveMinutes) : "—"}</td>
                    <td className="px-2 text-violet-600" dir="ltr">{r.overtimeMinutes ? fmtMin(r.overtimeMinutes) : "—"}</td>
                    <td className="px-2"><span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] || "bg-theme-secondary"}`}>{STATUS_FA[r.status] || r.status}</span></td>
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

      {/* Day detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.row.user ? `${detail.row.user.firstName} ${detail.row.user.lastName}` : ""} — ${faDate(detail.row.gregDate)}` : "جزئیات روز"}
        size="md"
        footer={<button onClick={() => setDetail(null)} className="btn-theme-secondary text-sm">بستن</button>}
      >
        {detail && (
          <div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Info label="وضعیت" value={STATUS_FA[detail.row.status] || detail.row.status} />
              <Info label="کارکرد" value={fmtMin(detail.row.workedMinutes)} />
              <Info label="اضافه‌کار" value={fmtMin(detail.row.overtimeMinutes)} />
              <Info label="تاخیر" value={fmtMin(detail.row.delayMinutes)} />
              <Info label="تعجیل" value={fmtMin(detail.row.earlyLeaveMinutes)} />
              <Info label="شب‌کاری" value={fmtMin(detail.row.nightMinutes)} />
              {detail.row.leaveMinutes > 0 && <Info label="مرخصی" value={fmtMin(detail.row.leaveMinutes)} />}
            </div>
            <div className="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-1">
              <Clock className="w-4 h-4" /> پانچ‌های خام ({faNum(detail.punches?.length || 0)})
            </div>
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

            {/* Admin edit (override) */}
            <div className="mt-4 border-t border-theme pt-3">
              <div className="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-1"><Pencil className="w-4 h-4" /> اصلاح ساعت ورود/خروج</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">ورود</label>
                  <TimeSelect value={ov.inTime} onChange={v => setOv(s => ({ ...s, inTime: v }))} />
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">خروج</label>
                  <TimeSelect value={ov.outTime} onChange={v => setOv(s => ({ ...s, outTime: v }))} />
                </div>
                <div><label className="block mb-1 text-theme-secondary text-xs">وضعیت (اختیاری)</label>
                  <select value={ov.status} onChange={e => setOv(s => ({ ...s, status: e.target.value }))} className="input-theme text-sm">
                    <option value="">— خودکار —</option>
                    {["PRESENT","LEAVE","MISSION","REMOTE_WORK","ABSENT"].map(s => <option key={s} value={s}>{STATUS_FA[s]}</option>)}
                  </select>
                </div>
                <div><label className="block mb-1 text-theme-secondary text-xs">مرخصی ساعتی (ساعت)</label><input type="number" step="0.5" min="0" dir="ltr" value={ov.leaveHours} onChange={e => setOv(s => ({ ...s, leaveHours: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً 2" /></div>
                <div className="sm:col-span-2"><label className="block mb-1 text-theme-secondary text-xs">دلیل</label><input value={ov.reason} onChange={e => setOv(s => ({ ...s, reason: e.target.value }))} className="input-theme text-sm" placeholder="دلیل اصلاح" /></div>
              </div>
              <button onClick={saveOverride} disabled={ovSaving} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
                {ovSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} ذخیره اصلاح
              </button>
              <p className="mt-1 text-[11px] text-theme-muted">این اصلاح ثبت می‌شود و در پایش مجدد از بین نمی‌رود.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split(":") : [];
  const h = parts[0] !== undefined && parts[0] !== "" ? +parts[0] : -1;
  const m = parts[1] !== undefined && parts[1] !== "" ? +parts[1] : -1;
  function set(newH: number, newM: number) {
    if (newH < 0) { onChange(""); return; }
    onChange(`${String(newH).padStart(2,"0")}:${String(newM >= 0 ? newM : 0).padStart(2,"0")}`);
  }
  return (
    <div className="flex gap-1 items-center" dir="ltr">
      <select className="input-theme text-sm flex-1" value={h >= 0 ? h : ""} onChange={e => set(e.target.value !== "" ? +e.target.value : -1, m)}>
        <option value="">ساعت</option>
        {Array.from({length:24},(_,i)=>i).map(i=><option key={i} value={i}>{String(i).padStart(2,"0")}</option>)}
      </select>
      <span className="text-theme-muted font-bold">:</span>
      <select className="input-theme text-sm flex-1" value={m >= 0 ? m : ""} onChange={e => set(h, e.target.value !== "" ? +e.target.value : -1)}>
        <option value="">دقیقه</option>
        {Array.from({length:60},(_,i)=>i).map(i=><option key={i} value={i}>{String(i).padStart(2,"0")}</option>)}
      </select>
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
