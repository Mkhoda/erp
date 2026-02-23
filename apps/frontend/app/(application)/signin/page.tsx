"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { isValidPhone, normalizeTo98 } from '../../../lib/phone';

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<'phone' | 'email'>('phone');

  // Phone + password fields
  const [phone, setPhone] = React.useState('');
  const [phonePassword, setPhonePassword] = React.useState('');

  // Email + password fields
  const [email, setEmail] = React.useState('');
  const [emailPassword, setEmailPassword] = React.useState('');

  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validPhone = isValidPhone(phone);

  React.useEffect(() => {
    document.title = 'ظˆط±ظˆط¯ | ط§ط±ط²ط´ ERP';
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      if (mode === 'phone') {
        const phoneDigits = normalizeTo98(phone);
        if (!/^98\d{10}$/.test(phoneDigits)) {
          throw new Error('ط´ظ…ط§ط±ظ‡ ظ…ظˆط¨ط§غŒظ„ ظ†ط§ظ…ط¹طھط¨ط± ط§ط³طھ');
        }
        const res = await fetch(`${API}/auth/login-phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneDigits, password: phonePassword }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'ظˆط±ظˆط¯ ظ†ط§ظ…ظˆظپظ‚ ط¨ظˆط¯');
        }
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        router.push('/dashboard');
      } else {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: emailPassword }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'ظˆط±ظˆط¯ ظ†ط§ظ…ظˆظپظ‚ ط¨ظˆط¯');
        }
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        router.push('/dashboard');
      }
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-bold text-transparent text-3xl">
            ط®ظˆط´ ط¢ظ…ط¯غŒط¯
          </h2>
          <p className="mt-2 text-theme-muted">
            ط¨ط±ط§غŒ ط§ط¯ط§ظ…ظ‡طŒ ظˆط§ط±ط¯ ط­ط³ط§ط¨ ع©ط§ط±ط¨ط±غŒ ط®ظˆط¯ ط´ظˆغŒط¯
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-theme-card shadow-xl backdrop-blur-sm p-8 border border-theme rounded-2xl"
        >
          {/* Mode tabs */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setMode('phone'); setError(null); }}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'phone' ? 'bg-blue-600 text-white' : 'bg-theme-secondary text-theme-muted'}`}
            >
              ظˆط±ظˆط¯ ط¨ط§ ط´ظ…ط§ط±ظ‡ ظ…ظˆط¨ط§غŒظ„
            </button>
            <button
              type="button"
              onClick={() => { setMode('email'); setError(null); }}
              className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'email' ? 'bg-blue-600 text-white' : 'bg-theme-secondary text-theme-muted'}`}
            >
              ظˆط±ظˆط¯ ط¨ط§ ط§غŒظ…غŒظ„
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'phone' ? (
              <>
                {/* Phone field */}
                <div>
                  <label htmlFor="phone" className="block mb-2 font-medium text-theme-primary text-sm">
                    ط´ظ…ط§ط±ظ‡ ظ…ظˆط¨ط§غŒظ„
                  </label>
                  <div className="relative">
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        let formatted = '';
                        if (digits.startsWith('0') && digits.length <= 11) {
                          formatted = digits.replace(/^(0)(\d{0,3})(\d{0,3})(\d{0,4})/, (_m, p1, p2, p3, p4) => {
                            let r = p1;
                            if (p2) r += ' ' + p2;
                            if (p3) r += ' ' + p3;
                            if (p4) r += ' ' + p4;
                            return r.trim();
                          });
                        } else if (digits.length > 0 && digits.length <= 10) {
                          formatted = '0 ' + digits.replace(/(\d{0,3})(\d{0,3})(\d{0,4})/, (_m, p1, p2, p3) => {
                            let r = p1;
                            if (p2) r += ' ' + p2;
                            if (p3) r += ' ' + p3;
                            return r.trim();
                          });
                        }
                        setPhone(formatted);
                      }}
                      required
                      inputMode="tel"
                      className={`bg-theme-primary px-12 py-3 border ${validPhone || !phone ? 'border-theme' : 'border-red-300 dark:border-red-600'} focus:border-transparent rounded-xl outline-none focus:ring-2 ${validPhone || !phone ? 'focus:ring-blue-500' : 'focus:ring-red-500'} w-full text-theme-primary transition-all`}
                      placeholder="0912 345 6789"
                    />
                    <div className="top-3 right-3 absolute flex items-center gap-1 text-theme-muted text-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                      </svg>
                      <span>+</span>
                    </div>
                  </div>
                  <p className="mt-1 text-theme-muted text-xs">ظپط±ظ…طھ: 0XXX XXX XXXX</p>
                </div>

                {/* Password field for phone mode */}
                <div>
                  <label htmlFor="phone-password" className="block mb-2 font-medium text-theme-primary text-sm">
                    ط±ظ…ط² ط¹ط¨ظˆط±
                  </label>
                  <div className="relative">
                    <input
                      id="phone-password"
                      type={showPassword ? 'text' : 'password'}
                      value={phonePassword}
                      onChange={e => setPhonePassword(e.target.value)}
                      required
                      className="bg-theme-primary px-4 py-3 pl-12 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                      placeholder="ط±ظ…ط² ط¹ط¨ظˆط± ط®ظˆط¯ ط±ط§ ظˆط§ط±ط¯ ع©ظ†غŒط¯"
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
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <input
                      id="remember-me-phone"
                      name="remember-me"
                      type="checkbox"
                      className="border-theme rounded focus:ring-blue-500 w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="remember-me-phone" className="block mr-2 text-theme-primary text-sm">
                      ظ…ط±ط§ ط¨ظ‡ ط®ط§ط·ط± ط¨ط³ظ¾ط§ط±
                    </label>
                  </div>
                  <div className="text-sm">
                    <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                      ظپط±ط§ظ…ظˆط´غŒ ط±ظ…ط² ط¹ط¨ظˆط±طں
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Email field */}
                <div>
                  <label htmlFor="email" className="block mb-2 font-medium text-theme-primary text-sm">
                    ط¢ط¯ط±ط³ ط§غŒظ…غŒظ„
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

                {/* Password field for email mode */}
                <div>
                  <label htmlFor="email-password" className="block mb-2 font-medium text-theme-primary text-sm">
                    ط±ظ…ط² ط¹ط¨ظˆط±
                  </label>
                  <div className="relative">
                    <input
                      id="email-password"
                      type={showPassword ? 'text' : 'password'}
                      value={emailPassword}
                      onChange={e => setEmailPassword(e.target.value)}
                      required
                      className="bg-theme-primary px-4 py-3 pl-12 border border-theme focus:border-transparent rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full text-theme-primary transition-all"
                      placeholder="ط±ظ…ط² ط¹ط¨ظˆط± ط®ظˆط¯ ط±ط§ ظˆط§ط±ط¯ ع©ظ†غŒط¯"
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
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <input
                      id="remember-me-email"
                      name="remember-me"
                      type="checkbox"
                      className="border-theme rounded focus:ring-blue-500 w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="remember-me-email" className="block mr-2 text-theme-primary text-sm">
                      ظ…ط±ط§ ط¨ظ‡ ط®ط§ط·ط± ط¨ط³ظ¾ط§ط±
                    </label>
                  </div>
                  <div className="text-sm">
                    <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                      ظپط±ط§ظ…ظˆط´غŒ ط±ظ…ط² ط¹ط¨ظˆط±طں
                    </Link>
                  </div>
                </div>
              </>
            )}

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
              disabled={loading || (mode === 'phone' && (!phone || !validPhone))}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl w-full font-medium text-white text-sm transition-all"
            >
              {loading ? (
                <div className="flex justify-center items-center gap-2">
                  <div className="border-white border-b-2 rounded-full w-4 h-4 animate-spin"></div>
                  ط¯ط± ط­ط§ظ„ ظˆط±ظˆط¯...
                </div>
              ) : (
                'ظˆط±ظˆط¯'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="border-theme border-t w-full" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-theme-primary px-2 text-theme-muted">غŒط§</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-theme-secondary text-sm">
                ط­ط³ط§ط¨ ع©ط§ط±ط¨ط±غŒ ظ†ط¯ط§ط±غŒط¯طں{' '}
                <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                  ط«ط¨طھ ظ†ط§ظ… ع©ظ†غŒط¯
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center"
        >
          <p className="text-theme-muted text-xs">
            ط¨ط§ ظˆط±ظˆط¯ ط¨ظ‡ ط³غŒط³طھظ…طŒ ط´ظ…ط§ ط¨ط§{' '}
            <Link href="/terms" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
              ط´ط±ط§غŒط· ظˆ ظ‚ظˆط§ظ†غŒظ†
            </Link>{' '}
            ظˆ{' '}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
              ط­ط±غŒظ… ط®طµظˆطµغŒ
            </Link>{' '}
            ظ…ظˆط§ظپظ‚طھ ظ…غŒâ€Œع©ظ†غŒط¯.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
