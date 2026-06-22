"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  RefreshCw, Play, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Activity, Database, Clock,
} from "lucide-react";

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
  React.useEffect(() => { document.title = "پایش همگام‌سازی | Arzesh"; }, []);
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

      {status.length === 0 && (
        <div className="bg-theme-card border border-theme rounded-xl p-8 text-center text-theme-muted">
          هیچ منبعی تنظیم نشده است. ابتدا از صفحه «تنظیمات حضور و غیاب» یک منبع اضافه کنید.
        </div>
      )}

      {/* Source status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
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
