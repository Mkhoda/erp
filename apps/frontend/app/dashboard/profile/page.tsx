"use client";
import React from 'react';
import { User, Shield, Save, Key, Bell, Phone, Check, AlertCircle } from 'lucide-react';
import { isValidPhone, normalizeTo98 } from '../../../lib/phone';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Me = { id: string; email?: string; phone?: string; hasPassword?: boolean; firstName?: string; lastName?: string; role?: string };

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: 'مدیر ارشد', cls: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  MANAGER: { label: 'مدیر', cls: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  EXPERT: { label: 'کارشناس', cls: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  USER: { label: 'کاربر', cls: 'bg-theme-secondary text-theme-secondary border-theme' },
};

export default function ProfilePage() {
  React.useEffect(() => { document.title = "پروفایل | Arzesh AI"; }, []);

  const [me, setMe] = React.useState<Me | null>(null);
  const [edit, setEdit] = React.useState<Partial<Me>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = React.useState('profile');

  // OTP / change password
  const [sendingOtp, setSendingOtp] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otp, setOtp] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [otpExpiresAt, setOtpExpiresAt] = React.useState<string | null>(null);
  const [pwMsg, setPwMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [now, setNow] = React.useState(Date.now());

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setMe(data);
        setEdit({ firstName: data?.firstName || '', lastName: data?.lastName || '' });
      })
      .catch(() => {});
  }, [token]);

  const expiresMs = otpExpiresAt ? new Date(otpExpiresAt).getTime() : null;
  const remainingSec = expiresMs ? Math.max(0, Math.ceil((expiresMs - now) / 1000)) : 0;
  const canResend = expiresMs ? now >= expiresMs : true;

  async function save() {
    if (!me) return;
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch(`${API}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: edit.firstName, lastName: edit.lastName }),
      });
      if (!res.ok) throw new Error('خطا در ذخیره');
      setMe(prev => prev ? { ...prev, firstName: edit.firstName, lastName: edit.lastName } : prev);
      setSaveMsg({ type: 'ok', text: 'اطلاعات با موفقیت ذخیره شد' });
    } catch { setSaveMsg({ type: 'err', text: 'خطا در ذخیره اطلاعات' }); }
    finally { setSaving(false); }
  }

  async function sendOtp() {
    if (!me?.phone) return;
    setSendingOtp(true); setPwMsg(null);
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: me.phone, purpose: 'change' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'ارسال کد ناموفق');
      setOtpSent(true); setOtpExpiresAt(data.expiresAt || null);
    } catch (e: any) { setPwMsg({ type: 'err', text: e.message }); }
    finally { setSendingOtp(false); }
  }

  async function changePassword() {
    setPwMsg(null);
    if (!/^\d{4,6}$/.test(otp)) { setPwMsg({ type: 'err', text: 'کد تایید نامعتبر است' }); return; }
    if (newPassword.length < 6) { setPwMsg({ type: 'err', text: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }); return; }
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'تغییر رمز ناموفق');
      setPwMsg({ type: 'ok', text: 'رمز عبور با موفقیت تغییر کرد' });
      setOtp(''); setNewPassword(''); setOtpSent(false); setOtpExpiresAt(null);
    } catch (e: any) { setPwMsg({ type: 'err', text: e.message }); }
  }

  if (!me) return (
    <div className="flex justify-center items-center min-h-64">
      <div className="flex flex-col items-center gap-3 text-theme-muted">
        <div className="border-blue-600 border-t-transparent border-2 rounded-full w-8 h-8 animate-spin" />
        <span className="text-sm">در حال بارگذاری...</span>
      </div>
    </div>
  );

  const role = ROLE_LABELS[me.role || ''] || ROLE_LABELS.USER;
  const fullName = `${me.firstName || ''} ${me.lastName || ''}`.trim() || 'کاربر';
  const initial = (me.firstName?.[0] || me.phone?.[0] || 'U').toUpperCase();

  const tabs = [
    { id: 'profile', label: 'اطلاعات شخصی', Icon: User },
    { id: 'security', label: 'امنیت و رمز عبور', Icon: Key },
    { id: 'notifications', label: 'اعلان‌ها', Icon: Bell },
  ];

  return (
    <div className="space-y-4 max-w-3xl" dir="rtl">
      {/* Header card */}
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex items-center gap-4">
            <div className="flex justify-center items-center bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20 rounded-2xl w-16 h-16 text-2xl font-bold text-white shrink-0">
              {initial}
            </div>
            <div>
              <h1 className="font-bold text-theme-primary text-xl">{fullName}</h1>
              {me.phone && <p className="text-theme-muted text-sm mt-0.5" dir="ltr">{me.phone}</p>}
              <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${role.cls}`}>
                <Shield className="w-3 h-3" /> {role.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-theme overflow-hidden">
        <div className="flex border-theme border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-transparent text-theme-muted hover:text-theme-secondary hover:bg-theme-hover'
              }`}
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card-theme-body">
          {/* Profile tab */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="gap-4 grid md:grid-cols-2">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام</label>
                  <input value={edit.firstName || ''} onChange={e => setEdit(s => ({ ...s, firstName: e.target.value }))} className="input-theme" placeholder="نام" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام خانوادگی</label>
                  <input value={edit.lastName || ''} onChange={e => setEdit(s => ({ ...s, lastName: e.target.value }))} className="input-theme" placeholder="نام خانوادگی" />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-medium text-theme-secondary text-sm">شماره موبایل</label>
                <div className="relative">
                  <Phone className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                  <input
                    type="tel" dir="ltr" value={me.phone || ''} disabled
                    className="input-theme pr-10 text-right opacity-60 cursor-not-allowed bg-theme-hover"
                  />
                </div>
                <p className="mt-1 text-theme-muted text-xs">شماره موبایل قابل تغییر نیست</p>
              </div>

              {me.email && (
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">ایمیل</label>
                  <input value={me.email} disabled className="input-theme opacity-60 cursor-not-allowed" dir="ltr" />
                </div>
              )}

              {saveMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${saveMsg.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                  {saveMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {saveMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={save} disabled={saving} className="btn-theme-primary disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </div>
          )}

          {/* Security tab */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <h2 className="font-semibold text-theme-primary">تغییر رمز عبور</h2>

              {me.phone ? (
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-theme-secondary text-sm">شماره: <span className="font-mono text-theme-primary" dir="ltr">{me.phone}</span></span>
                  </div>

                  {!otpSent ? (
                    <button
                      onClick={sendOtp}
                      disabled={sendingOtp}
                      className="btn-theme-primary text-sm disabled:opacity-50"
                    >
                      {sendingOtp ? (
                        <span className="flex items-center gap-2">
                          <span className="border-white/40 border-t-white border-2 rounded-full w-3.5 h-3.5 animate-spin" />
                          ارسال کد...
                        </span>
                      ) : 'ارسال کد تایید بله'}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-theme-muted text-xs">
                          {canResend ? 'می‌توانید کد را مجدد ارسال کنید' : `ارسال مجدد: ${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`}
                        </span>
                        {canResend && (
                          <button onClick={sendOtp} disabled={sendingOtp} className="text-blue-600 dark:text-blue-400 text-xs underline">ارسال مجدد</button>
                        )}
                      </div>
                      <div className="gap-3 grid md:grid-cols-2">
                        <div>
                          <label className="block mb-1.5 text-theme-secondary text-xs">کد تایید</label>
                          <input
                            value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                            className="input-theme text-center font-mono tracking-widest"
                            placeholder="_ _ _ _ _ _"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block mb-1.5 text-theme-secondary text-xs">رمز عبور جدید</label>
                          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-theme" placeholder="حداقل ۶ کاراکتر" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={changePassword} className="btn-theme-primary text-sm">تایید و تغییر رمز</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50 rounded-xl p-4">
                  <p className="text-amber-700 dark:text-amber-300 text-sm">برای تغییر رمز عبور، ابتدا شماره موبایل خود را در تب اطلاعات شخصی ثبت کنید.</p>
                </div>
              )}

              {pwMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${pwMsg.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                  {pwMsg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {pwMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-theme-primary">تنظیمات اعلان‌ها</h2>
              {[
                { title: 'اعلان‌های سیستم', desc: 'دریافت اعلان‌های مهم سیستم', on: true },
                { title: 'اعلان واگذاری', desc: 'اطلاع از واگذاری‌های جدید', on: true },
                { title: 'گزارش‌های دوره‌ای', desc: 'دریافت گزارش‌های هفتگی', on: false },
              ].map((n, i) => (
                <div key={i} className="flex justify-between items-center p-4 border border-theme rounded-xl">
                  <div>
                    <div className="font-medium text-theme-primary text-sm">{n.title}</div>
                    <div className="text-theme-muted text-xs mt-0.5">{n.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={n.on} />
                    <div className="bg-theme-secondary peer-checked:bg-blue-600 rounded-full w-10 h-5 after:absolute after:top-0.5 after:right-0.5 peer-checked:after:right-auto peer-checked:after:left-0.5 after:bg-white after:rounded-full after:w-4 after:h-4 after:transition-all" />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
