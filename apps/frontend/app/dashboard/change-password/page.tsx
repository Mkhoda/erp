"use client";
import React from 'react';
import { Key, Send, Check, AlertCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function ChangePasswordPage() {
  const [otp, setOtp] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [msg, setMsg] = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function requestOtp() {
    setSending(true); setMsg(null);
    try {
      const token = localStorage.getItem('token');
      const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      if (!me?.phone) { setMsg({ type: 'err', text: 'شماره موبایل ثبت نشده است' }); return; }
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: me.phone, purpose: 'change' }),
      });
      if (res.ok) { setOtpSent(true); setMsg({ type: 'ok', text: 'کد تایید ارسال شد' }); }
      else setMsg({ type: 'err', text: 'ارسال کد ناموفق بود' });
    } catch { setMsg({ type: 'err', text: 'خطا در ارسال کد' }); }
    finally { setSending(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setMsg({ type: 'ok', text: 'رمز عبور با موفقیت تغییر کرد' }); setOtp(''); setNewPassword(''); setOtpSent(false); }
      else setMsg({ type: 'err', text: data.message || 'خطا در تغییر رمز' });
    } catch { setMsg({ type: 'err', text: 'خطا در ارتباط با سرور' }); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-md space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex justify-center items-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl w-10 h-10">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-theme-primary text-xl">تغییر رمز عبور</h1>
              <p className="text-theme-muted text-sm">با کد تایید بله</p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={requestOtp}
              disabled={sending}
              className="btn-theme-secondary w-full justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'در حال ارسال...' : otpSent ? 'ارسال مجدد کد' : 'ارسال کد تایید'}
            </button>

            {otpSent && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">کد تایید</label>
                  <input
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="input-theme text-center font-mono tracking-widest"
                    placeholder="_ _ _ _ _ _"
                    maxLength={6}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">رمز عبور جدید</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input-theme"
                    placeholder="حداقل ۶ کاراکتر"
                  />
                </div>
                <button type="submit" disabled={loading || !otp || !newPassword} className="btn-theme-primary w-full justify-center disabled:opacity-50">
                  {loading ? 'در حال ثبت...' : 'تغییر رمز عبور'}
                </button>
              </form>
            )}

            {msg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${msg.type === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                {msg.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {msg.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
