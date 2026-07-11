"use client";
import React from "react";
import { Settings, Save, RefreshCw, Info } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type ChatSettings = {
  maxFileSizeMb: number;
  messageEditWindowSec: number;
  messageDeleteWindowSec: number;
  retentionDays: number;
  allowedExtensions: string[];
};

export default function MessagingAdminPage() {
  const toast = useToast();
  const [settings, setSettings] = React.useState<ChatSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    maxFileSizeMb: "10",
    messageEditWindowSec: "300",
    messageDeleteWindowSec: "300",
    retentionDays: "0",
    allowedExtensions: "jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,zip,mp4,mp3",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/messaging/settings`, { headers: authHeader() });
      if (!r.ok) throw new Error();
      const s: ChatSettings = await r.json();
      setSettings(s);
      setForm({
        maxFileSizeMb: String(s.maxFileSizeMb),
        messageEditWindowSec: String(s.messageEditWindowSec),
        messageDeleteWindowSec: String(s.messageDeleteWindowSec),
        retentionDays: String(s.retentionDays),
        allowedExtensions: s.allowedExtensions.join(","),
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
        maxFileSizeMb: parseInt(form.maxFileSizeMb) || 10,
        messageEditWindowSec: parseInt(form.messageEditWindowSec) || 300,
        messageDeleteWindowSec: parseInt(form.messageDeleteWindowSec) || 300,
        retentionDays: parseInt(form.retentionDays) || 0,
        allowedExtensions: form.allowedExtensions.split(",").map((e) => e.trim().replace(/^\./, "")).filter(Boolean),
      };
      const r = await fetch(`${API}/messaging/settings`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      toast.success("تنظیمات ذخیره شد");
      load();
    } catch {
      toast.error("خطا در ذخیره تنظیمات");
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, name: keyof typeof form, unit: string, hint: string, helpZero?: string) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-theme-primary">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
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
        <h1 className="font-bold text-theme-primary text-xl">تنظیمات پیام‌رسانی</h1>
        <p className="mt-0.5 text-sm text-theme-muted">مدیریت فایل‌های آپلودی، حذف/ویرایش پیام و نگهداری داده</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin text-theme-muted" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-theme-card border border-theme rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-theme">
              <Settings className="w-4 h-4 text-theme-muted" />
              <h2 className="font-semibold text-theme-primary text-sm">محدودیت فایل</h2>
            </div>

            {field("حداکثر حجم فایل", "maxFileSizeMb", "مگابایت", "فایل‌های بزرگ‌تر از این مقدار رد می‌شوند.")}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-theme-primary">پسوندهای مجاز</label>
              <input
                type="text"
                value={form.allowedExtensions}
                onChange={(e) => setForm((f) => ({ ...f, allowedExtensions: e.target.value }))}
                className="input-theme w-full font-mono text-sm"
                dir="ltr"
                placeholder="jpg,png,pdf,doc"
              />
              <p className="text-xs text-theme-muted">پسوندها را با کاما جدا کنید (بدون نقطه).</p>
            </div>
          </div>

          <div className="bg-theme-card border border-theme rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-theme">
              <Settings className="w-4 h-4 text-theme-muted" />
              <h2 className="font-semibold text-theme-primary text-sm">ویرایش و حذف پیام</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {field("پنجره ویرایش", "messageEditWindowSec", "ثانیه", "کاربران تا این مدت پس از ارسال می‌توانند پیام را ویرایش کنند.", "غیرمحدود")}
              {field("پنجره حذف", "messageDeleteWindowSec", "ثانیه", "کاربران تا این مدت پس از ارسال می‌توانند پیام را حذف کنند.", "غیرمحدود")}
            </div>
          </div>

          <div className="bg-theme-card border border-theme rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-theme">
              <Settings className="w-4 h-4 text-theme-muted" />
              <h2 className="font-semibold text-theme-primary text-sm">نگهداری داده</h2>
            </div>
            {field("نگهداری پیام‌ها", "retentionDays", "روز", "پیام‌های قدیمی‌تر از این مقدار حذف می‌شوند.", "بدون محدودیت زمانی")}
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
      )}
    </div>
  );
}
