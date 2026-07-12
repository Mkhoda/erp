"use client";
import React from 'react';
import { Settings as SettingsIcon, Globe, Smartphone, Database, Save, CheckCircle, MessageSquare, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
function authHeader() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function SettingsPage() {
  const toast = useToast();
  React.useEffect(() => { document.title = "تنظیمات | Arzesh ERP"; }, []);

  const [activeTab, setActiveTab] = React.useState('bale');
  const [general, setGeneral] = React.useState({ siteName: 'سامانه مدیریت ارزش', currency: 'IRR', language: 'fa' });

  // ── Bale OTP settings ──────────────────────────────────────────
  const [bale, setBale] = React.useState({ baleSafirApiKey: '', baleBotId: '', baleMock: false });
  const [baleLoading, setBaleLoading] = React.useState(true);
  const [baleSaving, setBaleSaving] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [baleError, setBaleError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeTab !== 'bale') return;
    setBaleLoading(true);
    setBaleError(null);
    fetch(`${API}/system-settings`, { headers: authHeader() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setBale({
        baleSafirApiKey: d.baleSafirApiKey || '',
        baleBotId: d.baleBotId || '',
        baleMock: d.baleMock ?? false,
      }))
      .catch(() => setBaleError('دریافت تنظیمات ناموفق بود'))
      .finally(() => setBaleLoading(false));
  }, [activeTab]);

  async function saveBale(e: React.FormEvent) {
    e.preventDefault();
    setBaleSaving(true);
    try {
      const res = await fetch(`${API}/system-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(bale),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('تنظیمات بیل با موفقیت ذخیره شد');
    } catch {
      toast.error('خطا در ذخیره تنظیمات');
    } finally {
      setBaleSaving(false);
    }
  }

  const tabs = [
    { id: 'bale',     label: 'پیامک OTP (بیل)',  icon: MessageSquare },
    { id: 'general',  label: 'عمومی',             icon: Globe },
    { id: 'pwa',      label: 'اپلیکیشن',          icon: Smartphone },
    { id: 'database', label: 'پایگاه داده',        icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card-theme card-theme-body flex items-center gap-3">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">تنظیمات سیستم</h1>
          <p className="text-sm text-theme-secondary">پیکربندی عمومی سامانه</p>
        </div>
      </div>

      <div className="card-theme">
        <div className="flex border-b border-theme overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-theme-secondary hover:text-theme-primary'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card-theme-body">

          {/* ── Bale OTP Tab ── */}
          {activeTab === 'bale' && (
            baleLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-theme-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال بارگذاری...
              </div>
            ) : baleError ? (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {baleError}
              </div>
            ) : (
              <form onSubmit={saveBale} className="space-y-6">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
                  تنظیمات ارسال OTP از طریق سرویس{' '}
                  <strong>Bale Safir</strong>. مقادیر را از{' '}
                  <strong>پنل بیل → تنظیمات Safir</strong> دریافت کنید.
                  تغییرات بلافاصله اعمال می‌شوند و نیازی به ری‌استارت سرور نیست.
                </div>

                {/* Mock mode toggle */}
                <label className="flex items-center justify-between p-4 rounded-xl border border-theme cursor-pointer hover:bg-theme-hover transition-colors">
                  <div>
                    <p className="text-sm font-medium text-theme-primary">حالت آزمایشی (Mock)</p>
                    <p className="text-xs text-theme-muted mt-0.5">OTP واقعی ارسال نمی‌شود — کد در لاگ سرور چاپ می‌شود</p>
                  </div>
                  <div
                    onClick={() => setBale(s => ({ ...s, baleMock: !s.baleMock }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${bale.baleMock ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${bale.baleMock ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </label>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1.5">
                    api-access-key
                    <span className="text-red-500 mr-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={bale.baleSafirApiKey}
                      onChange={e => setBale(s => ({ ...s, baleSafirApiKey: e.target.value }))}
                      className="input-theme w-full pl-10"
                      placeholder="مثال: BbGvuEzn8Nwh3cfP"
                      dir="ltr"
                      disabled={bale.baleMock}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Bot ID */}
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1.5">
                    Bot ID (شناسه ربات)
                    <span className="text-red-500 mr-1">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bale.baleBotId}
                    onChange={e => setBale(s => ({ ...s, baleBotId: e.target.value.replace(/\D/g, '') }))}
                    className="input-theme w-full"
                    placeholder="مثال: 361469114"
                    dir="ltr"
                    disabled={bale.baleMock}
                  />
                  <p className="mt-1 text-xs text-theme-muted">شناسه عددی ربات (از پنل Safir)</p>
                </div>

                {/* curl test hint */}
                <div className="p-3 rounded-lg bg-theme-secondary text-xs text-theme-muted font-mono overflow-x-auto" dir="ltr">
                  {'curl -X POST https://safir.bale.ai/api/v3/send_message \\\n  -H \'api-access-key: '}
                  <span className="text-blue-500">{bale.baleSafirApiKey || '<api-key>'}</span>
                  {'\' \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"bot_id": '}
                  <span className="text-blue-500">{bale.baleBotId || '<bot-id>'}</span>
                  {', "phone_number": "989120000000", "message_data": {"otp_message": {"otp": "123456"}}}\''}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={baleSaving || (!bale.baleMock && (!bale.baleSafirApiKey || !bale.baleBotId))}
                    className="btn-theme-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {baleSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" />در حال ذخیره...</>
                      : <><Save className="w-4 h-4" />ذخیره تنظیمات</>
                    }
                  </button>
                </div>
              </form>
            )
          )}

          {/* ── General Tab ── */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">نام سامانه</label>
                <input className="input-theme w-full" value={general.siteName}
                  onChange={e => setGeneral(s => ({ ...s, siteName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">واحد پول</label>
                <select className="select-theme w-full" value={general.currency}
                  onChange={e => setGeneral(s => ({ ...s, currency: e.target.value }))}>
                  <option value="IRR">ریال ایران (IRR)</option>
                  <option value="IRT">تومان</option>
                </select>
              </div>
              <div className="flex justify-end pt-2">
                <button className="btn-theme-primary flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />ذخیره
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <p className="text-sm text-theme-secondary">تنظیمات نصب و کش اپلیکیشن موبایل</p>
              {[
                { label: 'فعال‌سازی کش خودکار', on: true },
                { label: 'نمایش پیام نصب اپلیکیشن', on: true },
                { label: 'بروزرسانی خودکار', on: false },
              ].map((item, i) => (
                <label key={i} className="flex items-center gap-3 p-3 rounded-lg bg-theme-secondary cursor-pointer">
                  <input type="checkbox" className="rounded w-4 h-4 accent-blue-600" defaultChecked={item.on} />
                  <span className="text-sm text-theme-primary">{item.label}</span>
                </label>
              ))}
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                پشتیبان‌گیری از دیتابیس را از سرور با دستور{' '}
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
