"use client";
import React from "react";
import { motion } from "framer-motion";
import { pageTitle } from "../../../../lib/branding";
import {
  RefreshCw, Play, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Activity, Database, Clock, ChevronDown, Stethoscope, Users, TimerReset,
} from "lucide-react";
import SearchSelect from "../../../components/ui/SearchSelect";
import Modal from "../../../components/ui/Modal";

const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => toFa(`${Math.floor(Math.abs(m || 0) / 60)}:${String(Math.abs(m || 0) % 60).padStart(2, "0")}`);
const faDateOnly = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const STATUS_FA: Record<string, string> = { PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص", LEAVE: "مرخصی", SICK_LEAVE: "استعلاجی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل", COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته", OFF_DUTY: "استراحت (شیفت)" };
const DIFF_FIELD_FA: Record<string, string> = { status: "وضعیت", workedMinutes: "کارکرد", overtimeMinutes: "اضافه‌کار", holidayOvertimeMinutes: "تعطیل‌کاری", delayMinutes: "تاخیر", earlyLeaveMinutes: "تعجیل", deficitMinutes: "کسری", nightMinutes: "شب‌کاری", leaveMinutes: "مرخصی", sickLeaveMinutes: "استعلاجی", autoConvertedLeave: "تبدیل خودکار" };

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type SourceStatus = {
  id: string; name: string; syncEnabled: boolean; lastRecordId: number;
  lastSyncAt: string | null; lastSuccessAt: string | null; lastFailureAt: string | null;
  lastError: string | null; running: boolean;
};
type SyncLog = {
  id: string; sourceId: string; status: string; trigger: string;
  fromRecordId: number; toRecordId: number; imported: number; skipped: number;
  errorDetail: string | null; startedAt: string; finishedAt: string | null;
};

const faDate = (d: string | null) => (d ? new Date(d).toLocaleString("fa-IR") : "—");
const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  SUCCESS: { label: "موفق", cls: "text-green-500 bg-green-500/10", icon: CheckCircle2 },
  RUNNING: { label: "در حال اجرا", cls: "text-blue-500 bg-blue-500/10", icon: Loader2 },
  FAILED: { label: "ناموفق", cls: "text-red-500 bg-red-500/10", icon: XCircle },
  PARTIAL: { label: "ناقص", cls: "text-amber-500 bg-amber-500/10", icon: AlertTriangle },
};

export default function SyncMonitorPage() {
  React.useEffect(() => { document.title = pageTitle("پایش همگام‌سازی"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [status, setStatus] = React.useState<SourceStatus[]>([]);
  const [logs, setLogs] = React.useState<SyncLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [runningId, setRunningId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        fetch(`${API}/attendance/sync/status`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/attendance/sync/logs`, { headers: h }).then(r => r.ok ? r.json() : []),
      ]);
      setStatus(Array.isArray(s) ? s : []);
      setLogs(Array.isArray(l) ? l : []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 10000); // auto-refresh every 10s
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, []);

  async function runNow(sourceId: string) {
    setRunningId(sourceId);
    try {
      await fetch(`${API}/attendance/sync/run`, { method: "POST", headers: h, body: JSON.stringify({ sourceId }) });
      await load();
    } finally { setRunningId(null); }
  }

  async function fullResync(sourceId: string) {
    if (!confirm("نشانگر صفر می‌شود و همه‌ی رکوردها از ابتدا دوباره خوانده می‌شوند. ادامه می‌دهید؟")) return;
    setRunningId(sourceId);
    try {
      const res = await fetch(`${API}/attendance/sync/full`, { method: "POST", headers: h, body: JSON.stringify({ sourceId }) });
      const r = await res.json();
      alert(`وارد کردن مجدد انجام شد: ${(r.imported ?? 0).toLocaleString("fa-IR")} رکورد وارد شد`);
      await load();
    } finally { setRunningId(null); }
  }

  // ── Data maintenance (moved here from the dashboard) ──
  const [diag, setDiag] = React.useState<any>(null);
  const [diagOpen, setDiagOpen] = React.useState(false);
  const [maintBusy, setMaintBusy] = React.useState(false);
  const [maintMsg, setMaintMsg] = React.useState<string | null>(null);

  const loadDiag = React.useCallback(async () => {
    const d = await fetch(`${API}/attendance/maintenance/diagnostics`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null);
    setDiag(d);
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { loadDiag(); }, [loadDiag]);

  async function relink() {
    setMaintBusy(true); setMaintMsg(null);
    try {
      const r = await fetch(`${API}/attendance/maintenance/relink`, { method: "POST", headers: h }).then(x => x.json());
      setMaintMsg(`${faNum(r.linked)} پانچ متصل، ${faNum(r.recomputed)} روز محاسبه شد`);
      await loadDiag();
    } catch { setMaintMsg("خطا در عملیات"); } finally { setMaintBusy(false); setTimeout(() => setMaintMsg(null), 8000); }
  }
  async function provisionCards() {
    if (!confirm("برای هر شماره کارتِ بدون کاربر، یک کاربر موقت (غیرفعال) ساخته می‌شود و کل حضور و غیاب محاسبه می‌گردد. ادامه می‌دهید؟")) return;
    setMaintBusy(true); setMaintMsg(null);
    try {
      const r = await fetch(`${API}/attendance/maintenance/provision-cards`, { method: "POST", headers: h }).then(x => x.json());
      setMaintMsg(`${faNum(r.createdUsers)} کاربر ساخته شد، ${faNum(r.linked)} پانچ متصل، ${faNum(r.recomputed)} روز محاسبه شد (کل خام: ${faNum(r.rawTotal)})`);
      await loadDiag();
    } catch { setMaintMsg("خطا در عملیات"); } finally { setMaintBusy(false); setTimeout(() => setMaintMsg(null), 10000); }
  }

  // "اتصال و بازمحاسبه" above only rebuilds up to today (relinkUser bounds the
  // range to [first punch, today]) — it never touches future-dated days, so a
  // leave/mission approved for an upcoming date needs this instead: rebuild one
  // whole Jalali month (any month, past or future) for all users or just one.
  const [rmYear, setRmYear] = React.useState("");
  const [rmMonth, setRmMonth] = React.useState("");
  const [rmUserId, setRmUserId] = React.useState("");
  const [users, setUsers] = React.useState<any[]>([]);
  React.useEffect(() => {
    fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {});
    // eslint-disable-next-line
  }, []);
  const userOptions = users.map((u: any) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}${u.attendanceCardNo ? ` (${u.attendanceCardNo})` : ""}`,
    search: `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`,
  }));
  const rmUserName = rmUserId ? (userOptions.find(u => u.id === rmUserId)?.name || "این کاربر") : null;

  // Preview-only: shows exactly what a recompute WOULD change, day by day,
  // without writing anything. The actual apply endpoint (recompute-month)
  // still exists on the backend but is deliberately not wired to any button
  // here — after a broad recompute once left a lot of unrelated data looking
  // different than expected, changes to real attendance/leave data should go
  // through a reviewed report first, not a single unreviewed click.
  const [preview, setPreview] = React.useState<any>(null); // { isGuard, days }
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  async function previewMonth() {
    const jYear = +rmYear, jMonth = +rmMonth;
    if (!jYear || !jMonth || jMonth < 1 || jMonth > 12) { setMaintMsg("سال و ماه شمسی معتبر وارد کنید (مثلاً 1405 و 7)"); setTimeout(() => setMaintMsg(null), 6000); return; }
    if (!rmUserId) { setMaintMsg("برای پیش‌نمایش، یک کاربر را انتخاب کنید"); setTimeout(() => setMaintMsg(null), 6000); return; }
    setPreviewLoading(true);
    try {
      const r = await fetch(`${API}/attendance/maintenance/recompute-month/preview`, { method: "POST", headers: h, body: JSON.stringify({ jYear, jMonth, userId: rmUserId }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); setMaintMsg(e.message || "خطا در پیش‌نمایش"); setTimeout(() => setMaintMsg(null), 6000); return; }
      setPreview(await r.json());
      setPreviewOpen(true);
    } catch { setMaintMsg("خطا در پیش‌نمایش"); setTimeout(() => setMaintMsg(null), 6000); }
    finally { setPreviewLoading(false); }
  }

  // Cleanup for the future-day auto-leave bug: a fixed prior recompute run
  // (before computeDay() learned to skip empty future days) left real
  // AttendanceDay rows — mostly auto-converted to LEAVE — sitting on every
  // remaining day of the month for every user. Same preview-then-apply
  // shape as above: see exactly what would be deleted before deleting it.
  const [cleanup, setCleanup] = React.useState<any[] | null>(null);
  const [cleanupOpen, setCleanupOpen] = React.useState(false);
  const [cleanupBusy, setCleanupBusy] = React.useState(false);

  async function previewCleanup() {
    setCleanupBusy(true); setMaintMsg(null);
    try {
      const r = await fetch(`${API}/attendance/maintenance/future-cleanup/preview`, { headers: h });
      setCleanup(r.ok ? await r.json() : []);
      setCleanupOpen(true);
    } catch { setMaintMsg("خطا در پیش‌نمایش پاک‌سازی"); setTimeout(() => setMaintMsg(null), 6000); }
    finally { setCleanupBusy(false); }
  }

  async function applyCleanup() {
    if (!cleanup?.length) return;
    if (!confirm(`${faNum(cleanup.length)} رکورد روز آینده (بدون پانچ یا اصلاح واقعی) حذف می‌شود. این کار قابل بازگشت نیست. ادامه می‌دهید؟`)) return;
    setCleanupBusy(true);
    try {
      const r = await fetch(`${API}/attendance/maintenance/future-cleanup/apply`, { method: "POST", headers: h }).then(x => x.json());
      setMaintMsg(`${faNum(r.deleted ?? 0)} رکورد حذف شد`);
      setCleanupOpen(false); setCleanup(null);
    } catch { setMaintMsg("خطا در حذف"); }
    finally { setCleanupBusy(false); setTimeout(() => setMaintMsg(null), 8000); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">پایش همگام‌سازی</h1>
            <p className="text-sm text-theme-muted">وضعیت اتصال دستگاه‌ها و تاریخچه همگام‌سازی</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary text-sm"><RefreshCw className="w-4 h-4" /> بروزرسانی</button>
      </div>

      {/* Data maintenance */}
      <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-theme-primary text-sm flex items-center gap-2"><Database className="w-4 h-4 text-blue-500" /> نگهداری و اطلاعات داده</h2>
          <div className="flex items-center gap-2">
            <button onClick={provisionCards} disabled={maintBusy} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
              {maintBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} ساخت کاربر از کارت‌ها
            </button>
            <button onClick={relink} disabled={maintBusy} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
              {maintBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <TimerReset className="w-4 h-4" />} اتصال و بازمحاسبه
            </button>
          </div>
        </div>
        {maintMsg && <div className="text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-2">{maintMsg}</div>}

        <div className="pt-2 border-t border-theme space-y-2">
          <span className="text-xs text-theme-muted flex items-center gap-1"><TimerReset className="w-3.5 h-3.5 text-blue-500" /> پیش‌نمایش بازمحاسبه یک ماه برای یک کاربر (شامل روزهای آینده — برای مرخصی/ماموریت از‌پیش‌ثبت‌شده) — فقط گزارش، چیزی تغییر نمی‌کند</span>
          <div className="flex flex-wrap items-center gap-2">
            <input value={rmYear} onChange={e => setRmYear(e.target.value.replace(/\D/g, ""))} placeholder="سال (1405)" dir="ltr"
              className="input-theme text-sm w-24 py-1.5" />
            <input value={rmMonth} onChange={e => setRmMonth(e.target.value.replace(/\D/g, ""))} placeholder="ماه (1-12)" dir="ltr"
              className="input-theme text-sm w-24 py-1.5" />
            <SearchSelect
              className="w-56"
              options={userOptions}
              value={rmUserId}
              onChange={setRmUserId}
              searchKey="search"
              emptyLabel="— یک کاربر انتخاب کنید —"
              placeholder="کاربر"
            />
            <button onClick={previewMonth} disabled={previewLoading || !rmUserId} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50">
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TimerReset className="w-4 h-4" />} پیش‌نمایش تغییرات
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-theme space-y-2">
          <span className="text-xs text-theme-muted flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> پاک‌سازی رکوردهای اشتباهِ روزهای آینده (باگ تبدیل خودکار روزهای آینده به مرخصی — همه‌ی کاربران)</span>
          <button onClick={previewCleanup} disabled={cleanupBusy} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
            {cleanupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} پیش‌نمایش رکوردهای اشتباه
          </button>
        </div>

        {diag && (
          <div className="border border-theme rounded-lg">
            <button onClick={() => setDiagOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2">
              <span className="text-xs text-theme-muted flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5 text-blue-500" /> خام: {faNum(diag.rawTotal)} · متصل: {faNum(diag.rawMapped)} · بدون‌کاربر: {faNum(diag.rawUnmapped)} · روزها: {faNum(diag.dayTotal)} · کاربران دارای کارت: {faNum(diag.usersWithCard)}</span>
              <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform ${diagOpen ? "rotate-180" : ""}`} />
            </button>
            {diagOpen && (
              <div className="px-3 pb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-theme-secondary mb-1">کارت‌های دستگاه</div>
                  <div className="max-h-56 overflow-y-auto border border-theme rounded-lg">
                    <table className="w-full text-xs text-center">
                      <thead className="sticky top-0 bg-theme-card"><tr className="text-theme-muted border-b border-theme"><th className="py-1.5 px-2 font-medium">کد کارت</th><th className="px-2 font-medium">پانچ</th><th className="px-2 font-medium">وضعیت</th></tr></thead>
                      <tbody>{diag.cards.map((c: any) => (
                        <tr key={c.cardNo} className="border-b border-theme/40"><td className="py-1 px-2 text-theme-primary" dir="ltr">{c.cardNo}</td><td className="px-2 text-theme-muted">{faNum(c.count)}</td><td className="px-2">{c.mapped ? <span className="text-green-600">متصل</span> : <span className="text-red-500">بدون کاربر</span>}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-theme-secondary mb-1">نمونه پانچ خام</div>
                  <div className="max-h-56 overflow-y-auto border border-theme rounded-lg">
                    <table className="w-full text-xs text-center">
                      <thead className="sticky top-0 bg-theme-card"><tr className="text-theme-muted border-b border-theme"><th className="py-1.5 px-2 font-medium">کارت</th><th className="px-2 font-medium">mDate</th><th className="px-2 font-medium">تاریخ</th><th className="px-2 font-medium">ساعت</th></tr></thead>
                      <tbody>{diag.sample.map((s: any, i: number) => (
                        <tr key={i} className="border-b border-theme/40"><td className="py-1 px-2 text-theme-primary" dir="ltr">{s.cardNo}</td><td className="px-2 text-theme-muted" dir="ltr">{s.mDate || "—"}</td><td className="px-2 text-theme-primary" dir="ltr">{s.parsedJalali}</td><td className="px-2 text-theme-primary" dir="ltr">{s.parsedTime}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {status.length === 0 && (
        <div className="bg-theme-card border border-theme rounded-xl p-8 text-center text-theme-muted">
          هیچ منبعی تنظیم نشده است. ابتدا از صفحه «تنظیمات حضور و غیاب» یک منبع اضافه کنید.
        </div>
      )}

      {/* Source status cards */}
      <div className="grid grid-cols-1 gap-4">
        {status.map(s => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-theme-card border border-theme rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-theme-primary">{s.name}</h3>
                {s.running && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> در حال اجرا</span>}
                {!s.syncEnabled && <span className="text-xs px-2 py-0.5 rounded-full bg-theme-secondary text-theme-muted">غیرفعال</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => runNow(s.id)} disabled={s.running || runningId === s.id}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                  {runningId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} اجرای دستی
                </button>
                <button onClick={() => fullResync(s.id)} disabled={s.running || runningId === s.id}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-theme-secondary border border-theme text-theme-primary hover:bg-theme-hover disabled:opacity-50"
                  title="نشانگر را صفر کرده و همه رکوردها را از ابتدا وارد می‌کند">
                  <RefreshCw className="w-3.5 h-3.5" /> وارد کردن مجدد از صفر
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <Stat label="آخرین RecordID" value={s.lastRecordId.toLocaleString("fa-IR")} />
              <Stat label="آخرین همگام‌سازی" value={faDate(s.lastSyncAt)} />
              <Stat label="آخرین موفقیت" value={faDate(s.lastSuccessAt)} ok={!!s.lastSuccessAt} />
              <Stat label="آخرین خطا" value={s.lastError ? faDate(s.lastFailureAt) : "بدون خطا"} ok={!s.lastError} />
            </div>
            {s.lastError && <div className="mt-3 text-xs text-red-500 bg-red-500/10 rounded-lg p-2 break-words">{s.lastError}</div>}
          </motion.div>
        ))}
      </div>

      {/* Sync log history */}
      <div className="bg-theme-card border border-theme rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-theme-primary">تاریخچه همگام‌سازی</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-theme-muted text-right border-b border-theme">
              <th className="py-2 font-medium">وضعیت</th><th className="font-medium">نوع</th>
              <th className="font-medium">RecordID</th><th className="font-medium">وارد شده</th>
              <th className="font-medium">تکراری</th><th className="font-medium">شروع</th><th className="font-medium">پایان</th>
            </tr></thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-theme-muted">رکوردی ثبت نشده است</td></tr>}
              {logs.map(l => {
                const st = STATUS[l.status] || STATUS.FAILED;
                return (
                  <tr key={l.id} className="border-b border-theme/50">
                    <td className="py-2"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${st.cls}`}><st.icon className={`w-3 h-3 ${l.status === "RUNNING" ? "animate-spin" : ""}`} /> {st.label}</span></td>
                    <td className="text-theme-muted">{l.trigger === "manual" ? "دستی" : "زمان‌بندی"}</td>
                    <td className="text-theme-primary">{l.fromRecordId.toLocaleString("fa-IR")} ← {l.toRecordId.toLocaleString("fa-IR")}</td>
                    <td className="text-green-500">{l.imported.toLocaleString("fa-IR")}</td>
                    <td className="text-theme-muted">{l.skipped.toLocaleString("fa-IR")}</td>
                    <td className="text-theme-muted">{faDate(l.startedAt)}</td>
                    <td className="text-theme-muted">{faDate(l.finishedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="پیش‌نمایش بازمحاسبه"
        subtitle={rmUserName ? `${rmUserName} — ${faNum(+rmMonth)}/${faNum(+rmYear)}` : undefined}
        size="xl"
        footer={<button onClick={() => setPreviewOpen(false)} className="btn-theme-secondary text-sm">بستن</button>}
      >
        {preview?.isGuard ? (
          <div className="text-sm text-theme-muted text-center py-8">
            این کاربر در چرخه‌ی شیفت نگهبانی است — پیش‌نمایش برای این نوع کاربر پشتیبانی نمی‌شود (منطق محاسبه‌ی نگهبانی چند نفر را با هم در نظر می‌گیرد).
          </div>
        ) : !preview?.days?.length ? (
          <div className="text-sm text-theme-muted text-center py-8">
            هیچ تغییری پیدا نشد — همه‌ی روزهای این ماه با محاسبه‌ی فعلی یکسان هستند.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-theme-muted">
              {faNum(preview.days.length)} روز با محاسبه‌ی فعلی فرق دارد. این فقط گزارش است — چیزی در دیتابیس تغییر نکرده.
            </p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs text-center">
                <thead className="sticky top-0 bg-theme-card">
                  <tr className="text-theme-muted border-b border-theme">
                    <th className="py-2 px-2 font-medium">تاریخ</th>
                    <th className="px-2 font-medium">وضعیت</th>
                    <th className="px-2 font-medium">کارکرد</th>
                    <th className="px-2 font-medium">کسری</th>
                    <th className="px-2 font-medium">مرخصی</th>
                    <th className="px-2 font-medium">سایر تغییرات</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.days.map((d: any) => {
                    const shown = new Set(['status', 'workedMinutes', 'deficitMinutes', 'leaveMinutes']);
                    const otherFields = d.changedFields.filter((f: string) => !shown.has(f));
                    return (
                      <tr key={d.gregDate} className="border-b border-theme/40 hover:bg-theme-hover">
                        <td className="py-1.5 px-2 text-theme-primary whitespace-nowrap" dir="ltr">{faDateOnly(d.gregDate)}</td>
                        <td className="px-2">
                          {d.isNew ? (
                            <span className="text-cyan-600">جدید: {STATUS_FA[d.computed.status] || d.computed.status}</span>
                          ) : d.current.status === d.computed.status ? (
                            <span className="text-theme-muted">{STATUS_FA[d.computed.status] || d.computed.status}</span>
                          ) : (
                            <FieldDiff oldV={STATUS_FA[d.current.status] || d.current.status} newV={STATUS_FA[d.computed.status] || d.computed.status} />
                          )}
                        </td>
                        <td className="px-2" dir="ltr">
                          {!d.isNew && d.current.workedMinutes !== d.computed.workedMinutes
                            ? <FieldDiff oldV={fmtMin(d.current.workedMinutes)} newV={fmtMin(d.computed.workedMinutes)} />
                            : <span className="text-theme-muted">{fmtMin(d.computed.workedMinutes)}</span>}
                        </td>
                        <td className="px-2" dir="ltr">
                          {!d.isNew && d.current.deficitMinutes !== d.computed.deficitMinutes
                            ? <FieldDiff oldV={fmtMin(d.current.deficitMinutes)} newV={fmtMin(d.computed.deficitMinutes)} cls="text-orange-600" />
                            : <span className="text-theme-muted">{fmtMin(d.computed.deficitMinutes)}</span>}
                        </td>
                        <td className="px-2" dir="ltr">
                          {!d.isNew && d.current.leaveMinutes !== d.computed.leaveMinutes
                            ? <FieldDiff oldV={fmtMin(d.current.leaveMinutes)} newV={fmtMin(d.computed.leaveMinutes)} cls="text-blue-600" />
                            : <span className="text-theme-muted">{fmtMin(d.computed.leaveMinutes)}</span>}
                        </td>
                        <td className="px-2 text-theme-muted">
                          {otherFields.length ? otherFields.map((f: string) => DIFF_FIELD_FA[f] || f).join("، ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        title="پاک‌سازی رکوردهای اشتباه روزهای آینده"
        size="xl"
        footer={
          <>
            <button onClick={() => setCleanupOpen(false)} className="btn-theme-secondary text-sm">بستن</button>
            {!!cleanup?.length && (
              <button onClick={applyCleanup} disabled={cleanupBusy} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50">
                {cleanupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} حذف {faNum(cleanup.length)} رکورد
              </button>
            )}
          </>
        }
      >
        {!cleanup?.length ? (
          <div className="text-sm text-theme-muted text-center py-8">
            هیچ رکورد اشتباهی پیدا نشد.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-theme-muted">
              {faNum(cleanup.length)} رکورد روز آینده بدون پانچ یا اصلاح واقعی — احتمالاً باقی‌مانده‌ی باگ تبدیل خودکار به مرخصی. این فقط پیش‌نمایش است، چیزی هنوز حذف نشده.
            </p>
            <div className="max-h-96 overflow-y-auto -mx-1">
              <table className="w-full text-xs text-center">
                <thead className="sticky top-0 bg-theme-card">
                  <tr className="text-theme-muted border-b border-theme">
                    <th className="py-2 px-2 font-medium">کاربر</th>
                    <th className="px-2 font-medium">تاریخ</th>
                    <th className="px-2 font-medium">وضعیت</th>
                    <th className="px-2 font-medium">مرخصی</th>
                    <th className="px-2 font-medium">تبدیل خودکار</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanup.map((d: any) => (
                    <tr key={d.id} className="border-b border-theme/40 hover:bg-theme-hover">
                      <td className="py-1.5 px-2 text-theme-primary whitespace-nowrap">{d.user ? `${d.user.firstName} ${d.user.lastName}` : "—"}</td>
                      <td className="px-2 text-theme-primary whitespace-nowrap" dir="ltr">{faDateOnly(d.gregDate)}</td>
                      <td className="px-2 text-theme-muted">{STATUS_FA[d.status] || d.status}</td>
                      <td className="px-2 text-theme-muted" dir="ltr">{fmtMin(d.leaveMinutes)}</td>
                      <td className="px-2">{d.autoConvertedLeave ? <span className="text-amber-600">بله</span> : <span className="text-theme-muted">خیر</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FieldDiff({ oldV, newV, cls }: { oldV: string; newV: string; cls?: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-theme-muted line-through decoration-red-400">{oldV}</span>
      <span className="text-theme-muted">←</span>
      <span className={`font-semibold ${cls || "text-theme-primary"}`}>{newV}</span>
    </span>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div>
      <div className="text-xs text-theme-muted">{label}</div>
      <div className={`font-medium ${ok === false ? "text-red-500" : ok === true ? "text-green-500" : "text-theme-primary"}`}>{value}</div>
    </div>
  );
}
