"use client";
import React from 'react';
import { normalizeTo98, isValidPhone } from '../../../lib/phone';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  React.useEffect(() => {
    document.title = 'ثبت نام | ارزش ERP';
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
  }, [router]);

  // Password strength calculation
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'قوی', 'خیلی قوی'];
  const strengthColors = ['red', 'orange', 'yellow', 'green', 'green'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    const phoneDigits = phone.replace(/\s+/g, '');
    if (!isValidPhone(phoneDigits)) {
      setError('شماره موبایل باید با 0 شروع شود و 11 رقم باشد یا با کد کشور 98. مثال: 09121234567 یا 989121234567');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('رمزهای عبور مطابقت ندارند');
      setLoading(false);
      return;
    }

    if (passwordStrength < 2) {
      setError('رمز عبور باید حداقل ۸ کاراکتر و شامل حروف و اعداد باشد');
      setLoading(false);
      return;
    }

    if (!acceptTerms) {
      setError('پذیرش شرایط و قوانین الزامی است');
      setLoading(false);
      return;
    }

    try {
      // normalize phone to backend expected format: 98XXXXXXXXXX
      let phoneForApi = normalizeTo98(phoneDigits);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, phone: phoneForApi })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'ثبت نام ناموفق بود (ایمیل یا شماره تکراری است)');
      }
      
      router.push('/signin?message=registration-success');
    } catch (err: any) {
      setError(err.message);
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-bold text-transparent text-3xl">
            ثبت نام
          </h2>
          <p className="mt-2 text-theme-muted">
            حساب کاربری جدید ایجاد کنید
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-theme-card shadow-xl backdrop-blur-sm p-8 border border-theme rounded-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block mb-2 font-medium text-theme-primary text-sm">نام</label>
                <div className="relative">
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    className="bg-theme-primary px-4 py-3 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                    placeholder="نام"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lastName" className="block mb-2 font-medium text-theme-primary text-sm">نام خانوادگی</label>
                <div className="relative">
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                    className="bg-theme-primary px-4 py-3 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                    placeholder="نام خانوادگی"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block mb-2 font-medium text-theme-primary text-sm">شماره موبایل (فرمت: 0XXXXXXXXXX)</label>
              <div className="relative">
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\s+/g,''))}
                  required
                  pattern="0\\d{10}"
                  className={`bg-theme-primary px-4 py-3 border ${/^0\d{10}$/.test(phone)||!phone? 'border-theme':'border-red-300 dark:border-red-600'} focus:border-transparent rounded-xl outline-none focus:ring-2 ${/^0\d{10}$/.test(phone)||!phone? 'focus:ring-blue-500':'focus:ring-red-500'} w-full text-theme-primary transition-all`}
                  placeholder="مثال: 09121234567"
                />
                <span className="top-3 left-3 absolute text-theme-muted text-xs">IR</span>
              </div>
              <p className="mt-1 text-theme-muted text-xs">شماره باید با 0 شروع شود و 11 رقم باشد.</p>
            </div>

            <div>
              <label htmlFor="email" className="block mb-2 font-medium text-theme-primary text-sm">
                آدرس ایمیل
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="bg-theme-primary px-4 py-3 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                  placeholder="your@email.com"
                />
                <svg className="top-3 left-3 absolute w-5 h-5 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block mb-2 font-medium text-theme-primary text-sm">
                رمز عبور
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="bg-theme-primary px-4 py-3 pl-12 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                  placeholder="رمز عبور قوی انتخاب کنید"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="top-3 left-3 absolute text-theme-muted hover:text-theme-secondary"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-secondary">قدرت رمز عبور:</span>
                    <span className={`font-medium text-${strengthColors[passwordStrength - 1]}-600`}>
                      {strengthLabels[passwordStrength - 1] || 'خیلی ضعیف'}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${
                          level <= passwordStrength
                            ? `bg-${strengthColors[passwordStrength - 1]}-500`
                            : 'bg-theme-secondary'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block mb-2 font-medium text-theme-primary text-sm">
                تکرار رمز عبور
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="bg-theme-primary px-4 py-3 pl-12 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                  placeholder="رمز عبور را مجدداً وارد کنید"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="top-3 left-3 absolute text-theme-muted hover:text-theme-secondary"
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-red-600 dark:text-red-400 text-sm">رمزهای عبور مطابقت ندارند</p>
              )}
            </div>

            <div className="flex items-center">
              <input
                id="accept-terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="border-gray-300 rounded focus:ring-blue-500 w-4 h-4 text-blue-600"
              />
              <label htmlFor="accept-terms" className="block mr-2 text-theme-primary text-sm">
                من با{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                  شرایط و قوانین
                </Link>{' '}
                و{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                  حریم خصوصی
                </Link>{' '}
                موافقم
              </label>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 p-3 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !acceptTerms}
              className="flex justify-center bg-gradient-to-r from-blue-600 hover:from-blue-700 to-purple-600 hover:to-purple-700 disabled:opacity-50 shadow-sm px-4 py-3 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full font-medium text-white text-sm transition-all duration-200 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="border-white border-b-2 rounded-full w-4 h-4 animate-spin"></div>
                  در حال ثبت نام...
                </div>
              ) : (
                'ثبت نام'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="border-theme border-t w-full" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-theme-card px-2 text-theme-muted">یا</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-theme-secondary text-sm">
                قبلاً حساب کاربری دارید؟{' '}
                <Link href="/signin" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                  وارد شوید
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
