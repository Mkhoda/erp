"use client";
import React from 'react';
import { normalizeTo98, isValidPhone } from '../../../lib/phone';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, Phone, Lock, User, UserPlus, ArrowRight, Moon, Sun } from 'lucide-react';

type Step = 'form' | 'otp';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('form');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  const API = process.env.NEXT_PUBLIC_API_URL || '/api';
  const validPhone = isValidPhone(phone);
  const passwordsMatch = password === confirmPassword;

  React.useEffect(() => {
    document.title = 'ثبت نام | ارزش ERP';
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      if (saved === 'dark') document.documentElement.classList.add('dark');
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [router]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const expiresMs = otpExpiresAt ? new Date(otpExpiresAt).getTime() : null;
  const remainingMs = expiresMs ? Math.max(0, expiresMs - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const canResend = expiresMs ? now >= expiresMs : false;

  const formatPhone = (raw: string) => {
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
    return digits;
  };

  const getStrength = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[a-z]/.test(p)) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strength = getStrength(password);
  const strengthColor = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'][strength - 1] || '#e2e8f0';
  const strengthLabel = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی', 'خیلی قوی'][strength - 1] || '';

  async function sendOtp() {
    setError(null);
    setLoading(true);
    try {
      const phoneNorm = normalizeTo98(phone);
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, purpose: 'signup' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'ارسال کد تایید ناموفق بود');
      setOtpExpiresAt(data.expiresAt || null);
    } catch (e: any) {
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validPhone) { setError('شماره موبایل نامعتبر است'); return; }
    if (!passwordsMatch) { setError('رمزهای عبور مطابقت ندارند'); return; }
    if (strength < 2) { setError('رمز عبور باید حداقل ۸ کاراکتر باشد'); return; }
    setLoading(true);
    try {
      await sendOtp();
      setStep('otp');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.length !== 6) { setError('کد تایید باید ۶ رقم باشد'); return; }
    setLoading(true);
    try {
      const phoneNorm = normalizeTo98(phone);
      // Verify OTP first
      const verifyRes = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, otp, purpose: 'signup' }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) throw new Error(verifyData.message || 'کد تایید اشتباه است');

      // Register the user
      const regRes = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone: phoneNorm, password }),
      });
      const regData = await regRes.json().catch(() => ({}));
      if (!regRes.ok) throw new Error(regData.message || 'ثبت نام ناموفق بود');

      // Auto-login after register
      const loginRes = await fetch(`${API}/auth/login-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNorm, password }),
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        localStorage.setItem('token', loginData.access_token);
        router.push('/dashboard');
      } else {
        router.push('/signin?message=registration-success');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const otpRefs = Array.from({ length: 6 }, () => React.createRef<HTMLInputElement>());

  return (
    <div className="relative flex justify-center items-center bg-gradient-theme-light px-4 py-10 min-h-screen overflow-hidden" dir="rtl">
      {/* Background blobs */}
      <div className="top-[-10%] left-[-5%] absolute bg-purple-500/10 dark:bg-purple-500/5 blur-3xl rounded-full w-96 h-96 pointer-events-none" />
      <div className="bottom-[-10%] right-[-5%] absolute bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full w-96 h-96 pointer-events-none" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="top-4 left-4 absolute bg-theme-card hover:bg-theme-hover p-2.5 border border-theme rounded-xl text-theme-secondary transition-all"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <div className="inline-flex justify-center items-center bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30 mb-4 rounded-2xl w-16 h-16">
            <UserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-bold text-theme-primary text-2xl">
            {step === 'form' ? 'ثبت نام' : 'تایید شماره موبایل'}
          </h1>
          <p className="mt-1 text-theme-muted text-sm">
            {step === 'form' ? 'حساب کاربری جدید بسازید' : `کد ارسال شده به ${phone} را وارد کنید`}
          </p>
        </motion.div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'form' ? 'bg-blue-600' : 'bg-blue-600'}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'otp' ? 'bg-blue-600' : 'bg-theme-secondary'}`} />
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-theme-card shadow-xl backdrop-blur-sm p-6 border border-theme rounded-2xl"
            >
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Name row */}
                <div className="gap-3 grid grid-cols-2">
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-primary text-xs">نام</label>
                    <div className="relative">
                      <User className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        required
                        className="input-theme pr-10 text-sm"
                        placeholder="نام"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-primary text-xs">نام خانوادگی</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      required
                      className="input-theme text-sm"
                      placeholder="نام خانوادگی"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block mb-1.5 font-medium text-theme-primary text-xs">شماره موبایل</label>
                  <div className="relative">
                    <Phone className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                    <input
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                      required
                      className={`input-theme pr-10 text-right text-sm ${phone && !validPhone ? 'border-red-400' : ''}`}
                      placeholder="0912 345 6789"
                    />
                  </div>
                  {phone && !validPhone && <p className="mt-1 text-red-500 text-xs">شماره موبایل معتبر نیست</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block mb-1.5 font-medium text-theme-primary text-xs">رمز عبور</label>
                  <div className="relative">
                    <Lock className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="input-theme pr-10 pl-10 text-sm"
                      placeholder="حداقل ۸ کاراکتر"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="top-1/2 left-3 absolute text-theme-muted -translate-y-1/2">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(l => (
                          <div key={l} className="flex-1 h-1 rounded-full transition-colors" style={{ backgroundColor: l <= strength ? strengthColor : undefined }} />
                        ))}
                      </div>
                      {strengthLabel && <p className="mt-0.5 text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>}
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block mb-1.5 font-medium text-theme-primary text-xs">تکرار رمز عبور</label>
                  <div className="relative">
                    <Lock className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      className={`input-theme pr-10 pl-10 text-sm ${confirmPassword && !passwordsMatch ? 'border-red-400' : ''}`}
                      placeholder="تکرار رمز عبور"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="top-1/2 left-3 absolute text-theme-muted -translate-y-1/2">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && <p className="mt-1 text-red-500 text-xs">رمزها مطابقت ندارند</p>}
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex-shrink-0 bg-red-500 rounded-full w-1.5 h-1.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || !validPhone || !passwordsMatch || strength < 2}
                  className="btn-theme-primary justify-center gap-2 w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="border-white/40 border-t-white border-2 rounded-full w-4 h-4 animate-spin" />
                      ارسال کد تایید...
                    </span>
                  ) : (
                    <>ارسال کد تایید <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                <p className="text-theme-muted text-sm">
                  قبلاً حساب دارید؟{' '}
                  <Link href="/signin" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">وارد شوید</Link>
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-theme-card shadow-xl backdrop-blur-sm p-6 border border-theme rounded-2xl"
            >
              <form onSubmit={handleOtpSubmit} className="space-y-5">
                {/* OTP boxes */}
                <div>
                  <label className="block mb-3 font-medium text-theme-primary text-sm text-center">کد ۶ رقمی را وارد کنید</label>
                  <div className="flex justify-center gap-2" dir="ltr">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        ref={otpRefs[i]}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otp[i] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const arr = otp.split('');
                          arr[i] = val;
                          setOtp(arr.join(''));
                          if (val && i < 5) otpRefs[i + 1].current?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          setOtp(pasted.padEnd(6, '').slice(0, 6));
                          const lastIdx = Math.min(pasted.length, 5);
                          otpRefs[lastIdx].current?.focus();
                        }}
                        className="bg-theme-primary focus:bg-white dark:focus:bg-slate-700 border border-theme focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 w-11 h-12 font-semibold text-theme-primary text-lg text-center transition-all"
                      />
                    ))}
                  </div>
                  {/* Timer */}
                  {otpExpiresAt && !canResend && (
                    <p className="mt-3 text-center text-theme-muted text-xs">
                      ارسال مجدد تا: {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
                    </p>
                  )}
                  {canResend && (
                    <div className="mt-3 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          try { await sendOtp(); }
                          catch (e: any) { setError(e.message); }
                        }}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm underline"
                      >
                        ارسال مجدد کد
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex-shrink-0 bg-red-500 rounded-full w-1.5 h-1.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn-theme-primary justify-center w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="border-white/40 border-t-white border-2 rounded-full w-4 h-4 animate-spin" />
                      در حال ثبت نام...
                    </span>
                  ) : 'تایید و ثبت نام'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('form'); setOtp(''); setError(null); }}
                  className="w-full text-center text-theme-muted hover:text-theme-secondary text-sm transition-colors"
                >
                  ← ویرایش اطلاعات
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
