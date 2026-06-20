"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  Server, Database, Clock, Save, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, Plug, ShieldCheck, AlertTriangle, Cpu, Plus,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Device = { id: string; deviceCode: string; name: string; direction: string; lastSeenAt: string | null; isActive: boolean };
type Source = {
  id: string; name: string; driver: string; host: string; port: number; database: string;
  username: string; password: string; tableName: string; timeZone: string;
  syncEnabled: boolean; syncIntervalSec: number; batchSize: number;
  initialSyncDate: string | null; initialRecordId: number; autoRetry: boolean; retryCount: number;
  lastRecordId: number; lastSyncAt: string | null; lastSuccessAt: string | null;
  lastFailureAt: string | null; lastError: string | null; devices?: Device[];
};
type TestResult = { ok: boolean; message: string; serverTime?: string | null; tableReachable?: boolean; sampleCount?: number };

const EMPTY = {
  name: "EOSDB", driver: "mssql", host: "172.17.100.201", port: 1433, database: "EOSDB",
  username: "", password: "", tableName: "dbo.TimeRecords", timeZone: "Asia/Tehran",
  syncEnabled: false, syncIntervalSec: 300, batchSize: 1000, initialSyncDate: "",
  initialRecordId: 0, autoRetry: true, retryCount: 3,
};

const faDate = (d: string | null) => (d ? new Date(d).toLocaleString("fa-IR") : "—");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-theme-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full bg-theme-primary border border-theme rounded-lg px-3 py-2 text-theme-primary text-sm focus:outline-none focus:border-blue-500";

export default function AttendanceSettingsPage() {
  React.useEffect(() => { document.title = "تنظیمات حضور و غیاب | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [sources, setSources] = React.useState<Source[]>([]);
  const [current, setCurrent] = React.useState<Source | null>(null);
  const [form, setForm] = React.useState<any>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [test, setTest] = React.useState<TestResult | null>(null);
  const [showPw, setShowPw] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/attendance/sources`, { headers: h });
      const data: Source[] = res.ok ? await res.json() : [];
      setSources(data);
      if (data.length) selectSource(data[0]);
    } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function selectSource(s: Source) {
    setCurrent(s);
    setForm({
      ...EMPTY, ...s,
      password: "", // never prefill; blank keeps existing
      initialSyncDate: s.initialSyncDate ? s.initialSyncDate.slice(0, 10) : "",
    });
    setTest(null);
  }
  function newSource() { setCurrent(null); setForm(EMPTY); setTest(null); }
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function runTest() {
    setTesting(true); setTest(null);
    try {
      const res = await fetch(`${API}/attendance/sources/validate`, {
        method: "POST", headers: h, body: JSON.stringify(form),
      });
      setTest(await res.json());
    } catch (e: any) {
      setTest({ ok: false, message: "خطا در ارتباط با سرور" });
    } finally { setTesting(false); }
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const body = { ...form };
      if (!body.password) delete body.password; // keep existing on update
      const url = current ? `${API}/attendance/sources/${current.id}` : `${API}/attendance/sources`;
      const res = await fetch(url, { method: current ? "PUT" : "POST", headers: h, body: JSON.stringify(body) });
      if (res.ok) { setMsg("تنظیمات ذخیره شد"); await load(); }
      else { const e = await res.json().catch(() => ({})); setMsg(e.message || "خطا در ذخیره‌سازی"); }
    } finally { setSaving(false); setTimeout(() => setMsg(null), 4000); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Server className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">تنظیمات حضور و غیاب</h1>
            <p className="text-sm text-theme-muted">اتصال به پایگاه‌داده دستگاه حضور و غیاب</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sources.length > 0 && (
            <select className={inputCls + " w-auto"} value={current?.id || "new"}
              onChange={(e) => { const s = sources.find(x => x.id === e.target.value); s ? selectSource(s) : newSource(); }}>
              {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="new">+ منبع جدید</option>
            </select>
          )}
          {sources.length === 0 && <button onClick={newSource} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><Plus className="w-4 h-4" /> منبع جدید</button>}
        </div>
      </div>

      {/* Connection status banner */}
      {current && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatusCard ok={!!current.lastSuccessAt} label="آخرین همگام‌سازی موفق" value={faDate(current.lastSuccessAt)} icon={CheckCircle2} />
          <StatusCard ok={!current.lastError} label="آخرین خطا" value={current.lastError ? faDate(current.lastFailureAt) : "بدون خطا"} icon={current.lastError ? AlertTriangle : ShieldCheck} sub={current.lastError || undefined} />
          <StatusCard ok label="آخرین RecordID" value={current.lastRecordId.toLocaleString("fa-IR")} icon={Database} />
        </div>
      )}

      {/* Connection */}
      <Section title="اتصال" icon={Plug}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="نام منبع"><input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} /></Field>
          <Field label="نوع درایور">
            <select className={inputCls} value={form.driver} onChange={e => set("driver", e.target.value)}>
              <option value="mssql">SQL Server</option>
            </select>
          </Field>
          <Field label="هاست"><input className={inputCls} value={form.host} onChange={e => set("host", e.target.value)} /></Field>
          <Field label="پورت"><input type="number" className={inputCls} value={form.port} onChange={e => set("port", +e.target.value)} /></Field>
          <Field label="پایگاه‌داده"><input className={inputCls} value={form.database} onChange={e => set("database", e.target.value)} /></Field>
          <Field label="نام جدول"><input className={inputCls} value={form.tableName} onChange={e => set("tableName", e.target.value)} /></Field>
          <Field label="نام کاربری"><input className={inputCls} value={form.username} onChange={e => set("username", e.target.value)} /></Field>
          <Field label={current ? "رمز عبور (برای تغییر وارد کنید)" : "رمز عبور"}>
            <div className="relative">
              <input type={showPw ? "text" : "password"} className={inputCls + " pl-10"} value={form.password} onChange={e => set("password", e.target.value)} placeholder={current ? "بدون تغییر" : ""} />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-muted">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={runTest} disabled={testing} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary text-sm disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} تست اتصال
          </button>
          {test && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center gap-2 text-sm ${test.ok ? "text-green-500" : "text-red-500"}`}>
              {test.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{test.message}{test.ok && test.sampleCount != null ? ` — ${test.sampleCount.toLocaleString("fa-IR")} رکورد` : ""}</span>
            </motion.div>
          )}
        </div>
      </Section>

      {/* Sync */}
      <Section title="همگام‌سازی" icon={Clock}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-theme-primary">
            <input type="checkbox" checked={form.syncEnabled} onChange={e => set("syncEnabled", e.target.checked)} /> همگام‌سازی فعال
          </label>
          <label className="flex items-center gap-2 text-sm text-theme-primary">
            <input type="checkbox" checked={form.autoRetry} onChange={e => set("autoRetry", e.target.checked)} /> تلاش مجدد خودکار
          </label>
          <Field label="فاصله همگام‌سازی (ثانیه)"><input type="number" className={inputCls} value={form.syncIntervalSec} onChange={e => set("syncIntervalSec", +e.target.value)} /></Field>
          <Field label="اندازه دسته"><input type="number" className={inputCls} value={form.batchSize} onChange={e => set("batchSize", +e.target.value)} /></Field>
          <Field label="تعداد تلاش مجدد"><input type="number" className={inputCls} value={form.retryCount} onChange={e => set("retryCount", +e.target.value)} /></Field>
          <Field label="RecordID اولیه (نقطه شروع)"><input type="number" className={inputCls} value={form.initialRecordId} onChange={e => set("initialRecordId", +e.target.value)} /></Field>
          <Field label="تاریخ شروع اولیه"><input type="date" className={inputCls} value={form.initialSyncDate} onChange={e => set("initialSyncDate", e.target.value)} /></Field>
          <Field label="منطقه زمانی">
            <select className={inputCls} value={form.timeZone} onChange={e => set("timeZone", e.target.value)}>
              <option value="Asia/Tehran">Asia/Tehran (UTC+3:30)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Devices */}
      {current?.devices && current.devices.length > 0 && (
        <Section title="دستگاه‌ها" icon={Cpu}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-theme-muted text-right border-b border-theme">
                <th className="py-2 font-medium">کد دستگاه</th><th className="font-medium">نام</th><th className="font-medium">جهت</th><th className="font-medium">آخرین فعالیت</th>
              </tr></thead>
              <tbody>
                {current.devices.map(d => (
                  <tr key={d.id} className="border-b border-theme/50">
                    <td className="py-2 text-theme-primary">{d.deviceCode}</td>
                    <td className="text-theme-primary">{d.name}</td>
                    <td className="text-theme-muted">{d.direction}</td>
                    <td className="text-theme-muted">{faDate(d.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        {msg && <span className="text-sm text-theme-muted">{msg}</span>}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره تنظیمات
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-theme-primary">{title}</h2></div>
      {children}
    </div>
  );
}
function StatusCard({ ok, label, value, sub, icon: Icon }: { ok: boolean; label: string; value: string; sub?: string; icon: any }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ok ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-theme-primary truncate">{value}</div>
        <div className="text-xs text-theme-muted">{label}</div>
        {sub && <div className="text-xs text-red-500 mt-0.5 truncate" title={sub}>{sub}</div>}
      </div>
    </div>
  );
}
