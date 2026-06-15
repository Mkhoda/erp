"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, Phone, Lock, LogIn, Moon, Sun } from 'lucide-react';
import { isValidPhone, normalizeTo98 } from '../../../lib/phone';

export default function SignInPage() {
  const router = useRouter();
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  const validPhone = isValidPhone(phone);
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';

  React.useEffect(() => {
    document.title = 'ورود | ارزش ERP';
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      if (saved === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
  }, [router]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const phoneDigits = normalizeTo98(phone);
      if (!/^98\d{10}$/.test(phoneDigits)) throw new Error('شماره موبایل نامعتبر است');
      const res = await fetch(`${API}/auth/login-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'نام کاربری یا رمز عبور اشتباه است');
      }
      const data = await res.json();
      if (!data.access_token) throw new Error('پاسخ نامعتبر از سرور — لطفاً دوباره تلاش کنید');
      localStorage.setItem('token', data.access_token);
      // Also set cookie for middleware auth check
      document.cookie = `token=${data.access_token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex justify-center items-center bg-gradient-theme-light px-4 min-h-screen overflow-hidden" dir="rtl">
      {/* Background blobs */}
      <div className="top-[-10%] right-[-5%] absolute bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full w-96 h-96 pointer-events-none" />
      <div className="bottom-[-10%] left-[-5%] absolute bg-purple-500/10 dark:bg-purple-500/5 blur-3xl rounded-full w-96 h-96 pointer-events-none" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="top-4 left-4 absolute bg-theme-card hover:bg-theme-hover p-2.5 border border-theme rounded-xl text-theme-secondary transition-all"
        aria-label="تغییر تم"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="relative space-y-6 w-full max-w-sm">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex justify-center items-center bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/30 mb-5 rounded-2xl w-16 h-16">
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-bold text-theme-primary text-2xl">خوش آمدید</h1>
          <p className="mt-1 text-theme-muted text-sm">با شماره موبایل وارد شوید</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="bg-theme-card shadow-xl backdrop-blur-sm p-7 border border-theme rounded-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block mb-1.5 font-medium text-theme-primary text-sm">
                شماره موبایل
              </label>
              <div className="relative">
                <Phone className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  required
                  className={`input-theme pr-10 text-right ${phone && !validPhone ? 'border-red-400 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-900' : ''}`}
                  placeholder="0912 345 6789"
                  autoComplete="tel"
                />
              </div>
              {phone && !validPhone && (
                <p className="mt-1 text-red-500 text-xs">شماره موبایل معتبر نیست</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="font-medium text-theme-primary text-sm">رمز عبور</label>
                <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs transition-colors">
                  فراموشی رمز؟
                </Link>
              </div>
              <div className="relative">
                <Lock className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="input-theme pr-10 pl-10"
                  placeholder="رمز عبور"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="top-1/2 left-3 absolute text-theme-muted hover:text-theme-secondary -translate-y-1/2 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <div className="flex-shrink-0 w-1.5 h-1.5 bg-red-500 rounded-full" />
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !phone || !validPhone || !password}
              className="btn-theme-primary justify-center w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="border-white/40 border-t-white border-2 rounded-full w-4 h-4 animate-spin" />
                  در حال ورود...
                </span>
              ) : 'ورود به سیستم'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-theme-muted text-sm">
              حساب کاربری ندارید؟{' '}
              <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">
                ثبت نام کنید
              </Link>
            </p>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-theme-muted text-xs"
        >
          با ورود، <Link href="/terms" className="text-blue-600 dark:text-blue-400">شرایط و قوانین</Link> را می‌پذیرید
        </motion.p>
      </div>
    </div>
  );
}
