"use client";
import React from "react";
import { Shield, Clock, RefreshCw, Save, Info } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function faNum(n: number | string) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

type Settings = {
  accessTokenTtlSec: number;
  rememberMeTtlSec: number;
  idleTimeoutSec: number;
  maxSessionLifetimeSec: number;
  globalTokenVersion: number;
  updatedAt?: string;
};

function secToHours(s: number) { return Math.round(s / 3600); }
function hourToSec(h: number) { return h * 3600; }
function secToDays(s: number) { return Math.round(s / 86400); }
function daysToSec(d: number) { return d * 86400; }

export default function SecuritySettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [form, setForm] = React.useState({ accessHours: "24", rememberDays: "30", idleHours: "0", maxDays: "0" });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth-settings`, { headers: authHeaders() });
      if (!r.ok) throw new Error();
      const s: Settings = await r.json();
      setSettings(s);
      setForm({
        accessHours: String(secToHours(s.accessTokenTtlSec)),
        rememberDays: String(secToDays(s.rememberMeTtlSec)),
        idleHours: String(secToHours(s.idleTimeoutSec)),
        maxDays: String(secToDays(s.maxSessionLifetimeSec)),
      });
    } catch {
      toast.error("خطا در بارگذاری تنظیمات");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const body = {
        accessTokenTtlSec: hourToSec(Number(form.accessHours) || 24),
        rememberMeTtlSec: daysToSec(Number(form.rememberDays) || 30),
        idleTimeoutSec: hourToSec(Number(form.idleHours) || 0),
        maxSessionLifetimeSec: daysToSec(Number(form.maxDays) || 0),
      };
      const r = await fetch(`${API}/auth-settings`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      toast.success("تنظیمات ذخیره شد. نسخه توکن سراسری افزایش یافت — همه کاربران باید مجدداً وارد شوند.");
      load();
    } catch {
      toast.error("خطا در ذخیره تنظیمات");
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, name: keyof typeof form, unit: string, hint: string, min = 0, helpZero?: string) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-theme-primary">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            value={form[name]}
            onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
            className="input-theme w-28 text-center"
            dir="ltr"
          />
          <span className="text-sm text-theme-muted">{unit}</span>
        </div>
        {helpZero && Number(form[name]) === 0 && (
          <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Info className="w-3 h-3" /> {helpZero}
          </p>
        )}
        <p className="text-xs text-theme-muted">{hint}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl" dir="rtl">
      <div>
        <h1 className="font-bold text-theme-primary text-xl">تنظیمات امنیتی</h1>
        <p className="mt-0.5 text-sm text-theme-muted">پیکربندی مدت اعتبار توکن و نشست‌های کاربری</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-theme-muted">
          <RefreshCw className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current state */}
          {settings && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-0.5">
                <p className="font-medium">نسخه توکن سراسری: {faNum(settings.globalTokenVersion)}</p>
                <p className="text-blue-600 dark:text-blue-300 text-xs">
                  هر بار که تنظیمات ذخیره شود یا خروج اجباری انجام شود، این عدد افزایش می‌یابد و تمام توکن‌های قدیمی باطل می‌شوند.
                </p>
              </div>
            </div>
          )}

          <div className="bg-theme-card border border-theme rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-theme">
              <Clock className="w-4 h-4 text-theme-muted" />
              <h2 className="font-semibold text-theme-primary text-sm">مدت اعتبار توکن</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {field(
                "توکن ورود معمولی",
                "accessHours",
                "ساعت",
                "مدت اعتبار توکن برای ورود بدون «مرا به خاطر بسپار».",
                1,
              )}
              {field(
                "توکن «مرا به خاطر بسپار»",
                "rememberDays",
                "روز",
                "مدت اعتبار توکن وقتی کاربر گزینه «مرا به خاطر بسپار» را انتخاب کند.",
                1,
              )}
              {field(
                "تایم‌اوت بیکاری",
                "idleHours",
                "ساعت",
                "نشست کاربری که بیش از این مدت فعالیتی نداشته باشد لغو می‌شود.",
                0,
                "غیرفعال — بیکاری تایم‌اوت ندارد",
              )}
              {field(
                "حداکثر عمر نشست",
                "maxDays",
                "روز",
                "نشست‌هایی قدیمی‌تر از این مقدار، حتی اگر فعال باشند، منقضی می‌شوند.",
                0,
                "غیرفعال — نشست‌ها تا انقضای توکن معتبر هستند",
              )}
            </div>

            <div className="pt-3 border-t border-theme">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 mb-4">
                ⚠️ ذخیره این تنظیمات نسخه توکن سراسری را افزایش می‌دهد و همه کاربران از سیستم خارج خواهند شد.
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                ذخیره تنظیمات
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
