"use client";
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { isValidPhone, normalizeTo98 } from '../../../lib/phone';

export default function ForgotPasswordPage() {
  const [phone, setPhone] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<'phone' | 'otp'>('phone');
  const [otpExpiresAt, setOtpExpiresAt] = React.useState<string | null>(null);
  // no mock otp exposure
  const [mockOtp, setMockOtp] = React.useState<string | null>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';
  const [now, setNow] = React.useState<number>(Date.now());
  const [otpSent, setOtpSent] = React.useState(false);
  const validPhone = isValidPhone(phone);

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresAtMs = React.useMemo(() => otpExpiresAt ? new Date(otpExpiresAt).getTime() : null, [otpExpiresAt]);
  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const canResend = expiresAtMs ? now >= expiresAtMs : false;

  async function sendOtp() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const phoneNorm = normalizeTo98(phone);
      if (!/^98\d{10}$/.test(phoneNorm)) {
        throw new Error('شماره موبایل نامعتبر است');
      }
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, purpose: 'forgot' })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        if (res.status === 404) throw new Error('کاربری با این شماره پیدا نشد');
        throw new Error(data.message || 'ارسال کد ناموفق بود');
      }
      setStep('otp');
      setInfo('کد تایید ارسال شد.');
      setOtpExpiresAt(data.expiresAt || null);
      setOtpSent(true);
      setMockOtp(null);
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function resendOtp() {
    if (!canResend) return;
    await sendOtp();
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      const phoneNorm = normalizeTo98(phone);
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, otp, newPassword })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.message || 'خطا در تغییر رمز');
      setInfo('رمز عبور با موفقیت تغییر کرد. اکنون وارد شوید.');
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex justify-center items-center bg-gradient-theme-light px-4 py-12 min-h-screen">
      <div className="space-y-8 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="flex justify-center items-center bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-6 rounded-2xl w-16 h-16">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-3.314 0-6 2.239-6 5v1h12v-1c0-2.761-2.686-5-6-5z" />
            </svg>
          </div>
          <h2 className="bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-bold text-transparent text-3xl">
            بازیابی رمز عبور
          </h2>
          <p className="mt-2 text-theme-muted">
            شماره خود را وارد کنید تا کد تایید برایتان ارسال شود
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-theme-card shadow-xl backdrop-blur-sm p-8 border border-theme rounded-2xl"
        >
          {step === 'phone' ? (
            <div className="space-y-6">
              <div>
                <label className="block mb-2 font-medium text-theme-primary text-sm">شماره موبایل</label>
                <div className="relative">
                  <input
                    value={phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      let formatted = '';
                      if (digits.startsWith('0') && digits.length <= 11) {
                        formatted = digits.replace(/^(0)(\d{0,3})(\d{0,3})(\d{0,4})/, (match, p1, p2, p3, p4) => {
                          let result = p1;
                          if (p2) result += ' ' + p2;
                          if (p3) result += ' ' + p3;
                          if (p4) result += ' ' + p4;
                          return result.trim();
                        });
                      } else if (digits.length > 0 && digits.length <= 10) {
                        formatted = '0 ' + digits.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (match, p1, p2, p3) => {
                          let result = p1;
                          if (p2) result += ' ' + p2;
                          if (p3) result += ' ' + p3;
                          return result.trim();
                        });
                      }
                      setPhone(formatted);
                    }}
                    inputMode="tel"
                    disabled={otpSent && !canResend}
                    dir="ltr"
                    className={`bg-theme-primary px-12 py-3 border ${validPhone||!phone? 'border-theme':'border-red-300 dark:border-red-600'} focus:border-transparent rounded-xl outline-none focus:ring-2 ${validPhone||!phone? 'focus:ring-blue-500':'focus:ring-red-500'} w-full text-theme-primary text-right transition-all ${otpSent && !canResend ? 'opacity-60 cursor-not-allowed':''}`}
                    placeholder="0912 345 6789"
                  />
                  <div className="top-3 right-3 absolute flex items-center gap-1 text-theme-muted text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                    <span>+</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-theme-muted text-xs">فرمت: 0XXX XXX XXXX</p>
                  {otpExpiresAt && (
                    <p className="text-theme-muted text-xs">انقضا: {Math.floor(remainingSec/60)}:{String(remainingSec%60).padStart(2,'0')}</p>
                  )}
                </div>
              </div>
              <button 
                onClick={sendOtp} 
                  disabled={loading || !phone || !validPhone} 
                className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${phone && validPhone && !loading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-theme-secondary text-theme-muted cursor-not-allowed'}`}
              >
                {loading ? (
                  <div className="flex justify-center items-center gap-2">
                    <div className="border-theme border-b-2 rounded-full w-4 h-4 animate-spin"></div>
                    ارسال کد...
                  </div>
                ) : (
                  'ارسال کد تایید'
                )}
              </button>
              <div className="text-theme-secondary text-sm">
                بازگشت به{' '}<Link href="/signin" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">ورود</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-6">
              <div>
                <label className="block mb-3 font-medium text-theme-primary text-sm">کد تایید 6 رقمی</label>
                <div className="flex justify-center gap-2 mb-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otp[index] || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        const newOtp = otp.split('');
                        newOtp[index] = value;
                        setOtp(newOtp.join(''));
                        
                        // Auto-focus next input
                        if (value && index < 5) {
                          const target = e.target as HTMLInputElement;
                          const nextInput = target.parentElement?.children[index + 1] as HTMLInputElement;
                          nextInput?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle backspace to focus previous input
                        if (e.key === 'Backspace' && !otp[index] && index > 0) {
                          const target = e.target as HTMLInputElement;
                          const prevInput = target.parentElement?.children[index - 1] as HTMLInputElement;
                          prevInput?.focus();
                        }
                      }}
                      className="bg-theme-primary border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 w-12 h-12 font-semibold text-theme-primary text-lg text-center transition-all"
                    />
                  ))}
                </div>
                {otpExpiresAt && (
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-theme-muted text-xs">انقضا: {new Date(otpExpiresAt).toLocaleTimeString()}</p>
                    <p className="text-theme-muted text-xs">باقیمانده: {Math.floor(remainingSec/60)}:{String(remainingSec%60).padStart(2,'0')}</p>
                  </div>
                )}
                {canResend && (
                  <div className="flex justify-center mb-3">
                    <button 
                      type="button" 
                      onClick={resendOtp} 
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-medium text-white text-sm transition-all"
                    >
                      ارسال مجدد کد
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block mb-2 font-medium text-theme-primary text-sm">رمز عبور جدید</label>
                <input
                  value={newPassword}
                  onChange={(e)=> setNewPassword(e.target.value)}
                  type="password"
                  className="bg-theme-primary px-4 py-3 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                  placeholder="حداقل ۶ کاراکتر"
                />
              </div>
              <button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-3 rounded-xl font-medium text-white text-sm">
                {loading ? 'در حال ثبت...' : 'تایید و تغییر رمز'}
              </button>
              <div className="text-theme-secondary text-sm">
                بازگشت به{' '}<Link href="/signin" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">ورود</Link>
              </div>
            </form>
          )}

          {(error || info) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`mt-4 flex items-center gap-2 p-3 border rounded-xl ${error ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'}`}
            >
              <svg className={`w-5 h-5 ${error ? 'text-red-500' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`text-sm ${error ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{error || info}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
