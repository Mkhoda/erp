"use client";
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { isValidPhone, normalizeTo98 } from '../../../lib/phone';
import { useToast } from '../../components/ui/Toast';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [phone, setPhone] = React.useState('');
  const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');
  const [step, setStep] = React.useState<'phone' | 'otp'>('phone');
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';

  const validPhone = isValidPhone(phone);
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const canResend = expiresAt ? now >= expiresAt : true;
  const otpValue = otp.join('');

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length <= 11) {
      return digits.replace(/^(0)(\d{0,3})(\d{0,3})(\d{0,4})/, (_, p1, p2, p3, p4) => {
        let r = p1;
        if (p2) r += ' ' + p2;
        if (p3) r += ' ' + p3;
        if (p4) r += ' ' + p4;
        return r.trim();
      });
    }
    return digits.slice(0, 11);
  }

  async function sendOtp() {
    if (loading) return;
    setLoading(true);
    setPhoneError('');
    try {
      const phoneNorm = normalizeTo98(phone);
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, purpose: 'forgot' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) throw new Error('کاربری با این شماره در سامانه یافت نشد');
        if (res.status === 403) throw new Error('درخواست بیش از حد مجاز — کمی صبر کنید');
        throw new Error(data.message || 'ارسال کد ناموفق بود');
      }
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 60_000);
      setPhoneError('');
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (e: any) {
      const msg = e.message || 'خطا در ارسال کد';
      if (step === 'phone') {
        setPhoneError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const next = [...otp];
        next[index] = '';
        setOtp(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'ArrowRight' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = Array(6).fill('');
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setOtp(next);
    const focusIdx = Math.min(text.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (otpValue.length < 6) { toast.error('کد ۶ رقمی را کامل وارد کنید'); return; }
    if (newPassword.length < 6) { toast.error('رمز عبور باید حداقل ۶ کاراکتر باشد'); return; }
    setLoading(true);
    try {
      const phoneNorm = normalizeTo98(phone);
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, otp: otpValue, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) throw new Error('کد تایید نادرست یا منقضی شده است');
        throw new Error(data.message || 'خطا در تغییر رمز');
      }
      toast.success('رمز عبور با موفقیت تغییر کرد');
      setTimeout(() => { window.location.href = '/signin'; }, 1500);
    } catch (e: any) {
      toast.error(e.message || 'خطا در تغییر رمز');
    } finally {
      setLoading(false);
    }
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
            {step === 'phone' ? 'شماره خود را وارد کنید تا کد تایید برایتان ارسال شود' : 'کد ارسال شده را وارد کنید'}
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
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  inputMode="tel"
                  dir="ltr"
                  className={`bg-theme-primary px-4 py-3 border ${validPhone || !phone ? 'border-theme' : 'border-red-300 dark:border-red-600'} focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary text-right transition-all`}
                  placeholder="0912 345 6789"
                />
                {phone && !validPhone && (
                  <p className="mt-1 text-red-500 text-xs">شماره موبایل معتبر نیست</p>
                )}
              </div>
              <button
                onClick={sendOtp}
                disabled={loading || !phone || !validPhone}
                className="w-full px-4 py-3 rounded-xl font-medium text-sm transition-all bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                {loading ? (
                  <span className="flex justify-center items-center gap-2">
                    <span className="border-white/40 border-b-2 rounded-full w-4 h-4 animate-spin" />
                    ارسال کد...
                  </span>
                ) : 'ارسال کد تایید'}
              </button>
              {phoneError && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {phoneError}
                </div>
              )}
              <p className="text-theme-secondary text-sm text-center">
                بازگشت به{' '}
                <Link href="/signin" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">ورود</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={submitNewPassword} className="space-y-6">
              {/* Phone display */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-theme-muted">کد به <bdi dir="ltr" className="font-medium text-theme-primary">{phone}</bdi> ارسال شد</span>
                <button type="button" onClick={() => { setStep('phone'); setPhoneError(''); }} className="text-blue-600 hover:text-blue-500 text-xs">
                  تغییر شماره
                </button>
              </div>

              {/* OTP inputs — LTR so digit 1 is on left */}
              <div>
                <label className="block mb-3 font-medium text-theme-primary text-sm">کد تایید ۶ رقمی</label>
                <div className="flex justify-center gap-2 mb-4" dir="ltr" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      dir="ltr"
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="bg-theme-primary border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 w-12 h-12 font-semibold text-theme-primary text-lg text-center transition-all"
                    />
                  ))}
                </div>

                {/* Countdown + resend */}
                <div className="flex items-center justify-between">
                  <span className="text-theme-muted text-xs">
                    {canResend ? 'کد منقضی شد' : `انقضا: ${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, '0')}`}
                  </span>
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={!canResend || loading}
                    className="text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-blue-600 hover:text-blue-500"
                  >
                    {loading ? 'در حال ارسال...' : 'ارسال مجدد کد'}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block mb-2 font-medium text-theme-primary text-sm">رمز عبور جدید</label>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  className="bg-theme-primary px-4 py-3 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                  placeholder="حداقل ۶ کاراکتر"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpValue.length < 6 || newPassword.length < 6}
                className="w-full px-4 py-3 rounded-xl font-medium text-white text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex justify-center items-center gap-2">
                    <span className="border-white/40 border-b-2 rounded-full w-4 h-4 animate-spin" />
                    در حال ثبت...
                  </span>
                ) : 'تایید و تغییر رمز'}
              </button>

              <p className="text-theme-secondary text-sm text-center">
                بازگشت به{' '}
                <Link href="/signin" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">ورود</Link>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
