"use client";
import React from "react";
import {
  SlidersHorizontal, Globe, Smartphone, Database,
  Save, MessageSquare, Eye, EyeOff, AlertCircle,
  Loader2, Shield, Clock, RefreshCw, Info, Send,
  CheckCircle, XCircle,
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
function ah() {
  const t = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
}

// ── Helpers ───────────────────────────────────────────────────────────
function secToHours(s: number) { return Math.round(s / 3600); }
function hourToSec(h: number)  { return h * 3600; }
function secToDays(s: number)  { return Math.round(s / 86400); }
function daysToSec(d: number)  { return d * 86400; }
function faNum(n: number | string) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

// ── Bale Tab ──────────────────────────────────────────────────────────
function BaleTab() {
  const toast = useToast();
  const [bale, setBale] = React.useState({ baleSafirApiKey: "", baleBotId: "", baleMock: false });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showKey, setShowKey] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Test OTP
  const [testPhone, setTestPhone] = React.useState("");
  const [testOtp, setTestOtp] = React.useState("123456");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  React.useEffect(() => {
    setLoading(true); setError(null);
    fetch(`${API}/system-settings`, { headers: ah() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setBale({ baleSafirApiKey: d.baleSafirApiKey || "", baleBotId: d.baleBotId || "", baleMock: d.baleMock ?? false }))
      .catch(() => setError("دریافت تنظیمات ناموفق بود"))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const r = await fetch(`${API}/system-settings`, { method: "PATCH", headers: ah(), body: JSON.stringify(bale) });
      if (!r.ok) throw new Error();
      toast.success("تنظیمات بیل ذخیره شد");
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(false); }
  }

  async function runTest() {
    if (!testPhone) { toast.error("شماره تلفن را وارد کنید"); return; }
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(`${API}/system-settings/test-bale`, {
        method: "POST", headers: ah(),
        body: JSON.stringify({ phone: testPhone.replace(/\D/g, ""), otp: testOtp }),
      });
      const d = await r.json();
      if (d.ok) {
        setTestResult({ ok: true, msg: `ارسال موفق — HTTP ${d.status}` });
      } else {
        const errMsg = d.data?.error_data?.[0]?.description || JSON.stringify(d.data) || `HTTP ${d.status}`;
        setTestResult({ ok: false, msg: errMsg });
      }
    } catch { setTestResult({ ok: false, msg: "خطای شبکه" }); }
    finally { setTesting(false); }
  }

  if (loading) return <div className="flex items-center gap-2 py-12 justify-center text-theme-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" />در حال بارگذاری...</div>;
  if (error)   return <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>;

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
        تنظیمات ارسال OTP از طریق <strong>Bale Safir</strong>.
        مقادیر را از <strong>پنل بیل → تنظیمات Safir</strong> دریافت کنید.
        تغییرات بلافاصله اعمال می‌شوند — نیازی به ری‌استارت سرور نیست.
      </div>

      <form onSubmit={save} className="space-y-5">
        {/* Mock toggle */}
        <label className="flex items-center justify-between p-4 rounded-xl border border-theme cursor-pointer hover:bg-theme-hover transition-colors">
          <div>
            <p className="text-sm font-medium text-theme-primary">حالت آزمایشی (Mock)</p>
            <p className="text-xs text-theme-muted mt-0.5">OTP واقعی ارسال نمی‌شود — کد در لاگ سرور چاپ می‌شود</p>
          </div>
          <button type="button" onClick={() => setBale(s => ({ ...s, baleMock: !s.baleMock }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${bale.baleMock ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${bale.baleMock ? "right-0.5" : "left-0.5"}`} />
          </button>
        </label>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">api-access-key <span className="text-red-500">*</span></label>
          <div className="relative">
            <input type={showKey ? "text" : "password"} value={bale.baleSafirApiKey}
              onChange={e => setBale(s => ({ ...s, baleSafirApiKey: e.target.value }))}
              className="input-theme w-full pl-10" placeholder="مثال: BbGvuEzn8Nwh3cfP" dir="ltr" disabled={bale.baleMock} />
            <button type="button" onClick={() => setShowKey(v => !v)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bot ID */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">Bot ID <span className="text-red-500">*</span></label>
          <input type="text" inputMode="numeric" value={bale.baleBotId}
            onChange={e => setBale(s => ({ ...s, baleBotId: e.target.value.replace(/\D/g, "") }))}
            className="input-theme w-full" placeholder="مثال: 361469114" dir="ltr" disabled={bale.baleMock} />
          <p className="mt-1 text-xs text-theme-muted">شناسه عددی ربات از پنل Safir</p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving || (!bale.baleMock && (!bale.baleSafirApiKey || !bale.baleBotId))}
            className="btn-theme-primary flex items-center gap-2 disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />در حال ذخیره...</> : <><Save className="w-4 h-4" />ذخیره تنظیمات</>}
          </button>
        </div>
      </form>

      {/* ── Test Section ── */}
      <div className="border-t border-theme pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-theme-muted" />
          <h3 className="text-sm font-semibold text-theme-primary">تست ارسال OTP</h3>
        </div>
        <p className="text-xs text-theme-muted">برای تست اتصال به Bale Safir، شماره و کد دلخواه را وارد کنید. این تست مستقیماً به API بیل ارسال می‌شود.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-theme-secondary mb-1">شماره تلفن (98XXXXXXXXXX)</label>
            <input type="text" inputMode="numeric" value={testPhone}
              onChange={e => setTestPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
              className="input-theme w-full" placeholder="989120000000" dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-secondary mb-1">کد آزمایشی</label>
            <input type="text" inputMode="numeric" maxLength={6} value={testOtp}
              onChange={e => setTestOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="input-theme w-full" placeholder="123456" dir="ltr" />
          </div>
        </div>

        <button onClick={runTest} disabled={testing || !testPhone}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {testing ? <><Loader2 className="w-4 h-4 animate-spin" />در حال ارسال...</> : <><Send className="w-4 h-4" />ارسال تست</>}
        </button>

        {testResult && (
          <div className={`flex items-start gap-2 p-3 rounded-xl text-sm border ${testResult.ok
            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"}`}>
            {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span dir="ltr" className="font-mono text-xs break-all">{testResult.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────
function SecurityTab() {
  const toast = useToast();
  type SecSettings = { accessTokenTtlSec: number; rememberMeTtlSec: number; idleTimeoutSec: number; maxSessionLifetimeSec: number; globalTokenVersion: number };
  const [settings, setSettings] = React.useState<SecSettings | null>(null);
  const [form, setForm] = React.useState({ accessHours: "24", rememberDays: "30", idleHours: "0", maxDays: "0" });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth-settings`, { headers: ah() });
      if (!r.ok) throw new Error();
      const s: SecSettings = await r.json();
      setSettings(s);
      setForm({ accessHours: String(secToHours(s.accessTokenTtlSec)), rememberDays: String(secToDays(s.rememberMeTtlSec)), idleHours: String(secToHours(s.idleTimeoutSec)), maxDays: String(secToDays(s.maxSessionLifetimeSec)) });
    } catch { toast.error("خطا در بارگذاری تنظیمات امنیتی"); }
    finally { setLoading(false); }
  }

  React.useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const body = { accessTokenTtlSec: hourToSec(Number(form.accessHours) || 24), rememberMeTtlSec: daysToSec(Number(form.rememberDays) || 30), idleTimeoutSec: hourToSec(Number(form.idleHours) || 0), maxSessionLifetimeSec: daysToSec(Number(form.maxDays) || 0) };
      const r = await fetch(`${API}/auth-settings`, { method: "PATCH", headers: ah(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success("تنظیمات امنیتی ذخیره شد — همه کاربران باید مجدداً وارد شوند");
      load();
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(false); }
  }

  function Field({ label, name, unit, hint, helpZero }: { label: string; name: keyof typeof form; unit: string; hint: string; helpZero?: string }) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-theme-primary">{label}</label>
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} className="input-theme w-28 text-center" dir="ltr" />
          <span className="text-sm text-theme-muted">{unit}</span>
        </div>
        {helpZero && Number(form[name]) === 0 && <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"><Info className="w-3 h-3" />{helpZero}</p>}
        <p className="text-xs text-theme-muted">{hint}</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-theme-muted"><RefreshCw className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {settings && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium">نسخه توکن سراسری: {faNum(settings.globalTokenVersion)}</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">با هر ذخیره این عدد افزایش می‌یابد و توکن‌های قدیمی باطل می‌شوند.</p>
          </div>
        </div>
      )}
      <div className="border border-theme rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-theme">
          <Clock className="w-4 h-4 text-theme-muted" />
          <h2 className="font-semibold text-theme-primary text-sm">مدت اعتبار توکن</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="توکن ورود معمولی"         name="accessHours"  unit="ساعت" hint="ورود بدون «مرا به خاطر بسپار»" />
          <Field label="توکن «مرا به خاطر بسپار»" name="rememberDays" unit="روز"  hint="ورود با گزینه «مرا به خاطر بسپار»" />
          <Field label="تایم‌اوت بیکاری"           name="idleHours"   unit="ساعت" hint="لغو نشست بیکار" helpZero="غیرفعال" />
          <Field label="حداکثر عمر نشست"           name="maxDays"     unit="روز"  hint="انقضای اجباری نشست قدیمی"       helpZero="غیرفعال" />
        </div>
        <div className="pt-3 border-t border-theme">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 mb-4">
            ⚠️ ذخیره این تنظیمات نسخه توکن را افزایش می‌دهد و همه کاربران خارج می‌شوند.
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />در حال ذخیره...</> : <><Save className="w-4 h-4" />ذخیره تنظیمات</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Messaging Tab ─────────────────────────────────────────────────────
function MessagingTab() {
  const toast = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ maxFileSizeMb: "10", messageEditWindowSec: "300", messageDeleteWindowSec: "300", retentionDays: "0", allowedExtensions: "jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,zip,mp4,mp3" });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/messaging/settings`, { headers: ah() });
      if (!r.ok) throw new Error();
      const s = await r.json();
      setForm({ maxFileSizeMb: String(s.maxFileSizeMb), messageEditWindowSec: String(s.messageEditWindowSec), messageDeleteWindowSec: String(s.messageDeleteWindowSec), retentionDays: String(s.retentionDays), allowedExtensions: s.allowedExtensions.join(",") });
    } catch { toast.error("خطا در بارگذاری تنظیمات"); }
    finally { setLoading(false); }
  }

  React.useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const body = { maxFileSizeMb: parseInt(form.maxFileSizeMb) || 10, messageEditWindowSec: parseInt(form.messageEditWindowSec) || 300, messageDeleteWindowSec: parseInt(form.messageDeleteWindowSec) || 300, retentionDays: parseInt(form.retentionDays) || 0, allowedExtensions: form.allowedExtensions.split(",").map(e => e.trim().replace(/^\./, "")).filter(Boolean) };
      const r = await fetch(`${API}/messaging/settings`, { method: "PATCH", headers: ah(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success("تنظیمات پیام‌رسانی ذخیره شد");
      load();
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(false); }
  }

  function Field({ label, name, unit, hint, helpZero }: { label: string; name: keyof typeof form; unit: string; hint: string; helpZero?: string }) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-theme-primary">{label}</label>
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} className="input-theme w-28 text-center" dir="ltr" />
          <span className="text-sm text-theme-muted">{unit}</span>
        </div>
        {helpZero && Number(form[name]) === 0 && <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"><Info className="w-3 h-3" />{helpZero}</p>}
        <p className="text-xs text-theme-muted">{hint}</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-theme-muted"><RefreshCw className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="border border-theme rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-theme-primary pb-2 border-b border-theme">محدودیت فایل</h3>
        <Field label="حداکثر حجم فایل" name="maxFileSizeMb" unit="مگابایت" hint="فایل‌های بزرگ‌تر رد می‌شوند" />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-theme-primary">پسوندهای مجاز</label>
          <input type="text" value={form.allowedExtensions} onChange={e => setForm(f => ({ ...f, allowedExtensions: e.target.value }))} className="input-theme w-full font-mono text-sm" dir="ltr" placeholder="jpg,png,pdf,doc" />
          <p className="text-xs text-theme-muted">با کاما جدا کنید، بدون نقطه</p>
        </div>
      </div>
      <div className="border border-theme rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-theme-primary pb-2 border-b border-theme">ویرایش و حذف پیام</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="پنجره ویرایش"  name="messageEditWindowSec"   unit="ثانیه" hint="مدت مجاز برای ویرایش" helpZero="غیرمحدود" />
          <Field label="پنجره حذف"     name="messageDeleteWindowSec" unit="ثانیه" hint="مدت مجاز برای حذف"    helpZero="غیرمحدود" />
        </div>
      </div>
      <div className="border border-theme rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-theme-primary pb-2 border-b border-theme">نگهداری داده</h3>
        <Field label="نگهداری پیام‌ها" name="retentionDays" unit="روز" hint="پیام‌های قدیمی‌تر حذف می‌شوند" helpZero="بدون محدودیت" />
      </div>
      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm disabled:opacity-50">
        {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />در حال ذخیره...</> : <><Save className="w-4 h-4" />ذخیره تنظیمات</>}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  React.useEffect(() => { document.title = "تنظیمات سامانه | Arzesh ERP"; }, []);
  const [tab, setTab] = React.useState("bale");

  const tabs = [
    { id: "bale",      label: "پیامک OTP",     icon: MessageSquare },
    { id: "security",  label: "امنیت",          icon: Shield },
    { id: "messaging", label: "پیام‌رسانی",     icon: MessageSquare },
    { id: "general",   label: "عمومی",          icon: Globe },
    { id: "database",  label: "پایگاه داده",    icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div className="card-theme card-theme-body flex items-center gap-3">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
          <SlidersHorizontal className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">تنظیمات سامانه</h1>
          <p className="text-sm text-theme-secondary">پیکربندی عمومی، امنیتی، پیام‌رسانی و OTP</p>
        </div>
      </div>

      <div className="card-theme">
        <div className="flex border-b border-theme overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                tab === t.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-theme-secondary hover:text-theme-primary"}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="card-theme-body">
          {tab === "bale"      && <BaleTab />}
          {tab === "security"  && <SecurityTab />}
          {tab === "messaging" && <MessagingTab />}

          {tab === "general" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">نام سامانه</label>
                <input className="input-theme w-full" defaultValue="سامانه مدیریت ارزش" />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">واحد پول</label>
                <select className="select-theme w-full" defaultValue="IRR">
                  <option value="IRR">ریال ایران (IRR)</option>
                  <option value="IRT">تومان</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button className="btn-theme-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" />ذخیره</button>
              </div>
            </div>
          )}

          {tab === "database" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                پشتیبان‌گیری از دیتابیس را از سرور با دستور{" "}
                <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">./backup.sh</code> انجام دهید.
              </div>
              <button className="btn-theme-secondary flex items-center gap-2 opacity-50 cursor-not-allowed text-sm" disabled>
                بازیابی پشتیبان (غیرفعال)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
