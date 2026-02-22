"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { isValidPhone, normalizeTo98 } from '../../../lib/phone';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [mode, setMode] = React.useState<'email' | 'otp'>('otp');
  const [phone, setPhone] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = React.useState<string | null>(null);
  // use centralized phone helper
  const validPhone = isValidPhone(phone);
  const [now, setNow] = React.useState<number>(Date.now());
  // no mock OTP exposure in UI
  const [mockOtp, setMockOtp] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    document.title = 'ورود | ارزش ERP';
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
  }, [router]);

  React.useEffect(() => {
    const t = setInterval(()=> setNow(Date.now()), 1000);
    return ()=> clearInterval(t);
  }, []);

  const expiresAtMs = React.useMemo(()=> otpExpiresAt ? new Date(otpExpiresAt).getTime() : null, [otpExpiresAt]);
  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const remainingSec = Math.ceil(remainingMs/1000);
  const canResend = expiresAtMs ? now >= expiresAtMs : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); 
    setError(null);
    
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      if (mode === 'email') {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'ورود ناموفق بود');
        }
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        router.push('/dashboard');
      } else {
        // OTP flow: verify entered code
        const phoneDigits = normalizeTo98(phone);
        if (!/^98\d{10}$/.test(phoneDigits)) {
          throw new Error('شماره موبایل نامعتبر است');
        }
        if (!otpSent) {
          // if user didn't click send code, do it now
          const sendRes = await fetch(`${API}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneDigits, purpose: 'login' })
          });
          const sendData = await sendRes.json().catch(() => ({}));
          if (!sendRes.ok) {
            throw new Error(sendData.message || 'ارسال کد تایید ناموفق بود');
          }
          setOtpSent(true);
          setOtpExpiresAt(sendData.expiresAt || null);
          // do not surface mockOtp
          setMockOtp(null);
          throw new Error('کد تایید ارسال شد. لطفا کد را وارد کنید.');
        }
        if (!/^\d{4,6}$/.test(otp)) {
          throw new Error('کد تایید نامعتبر است');
        }
        const verifyRes = await fetch(`${API}/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneDigits, otp })
        });
        const verifyData = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok) {
          throw new Error(verifyData.message || 'تایید کد ناموفق بود');
        }
        localStorage.setItem('token', verifyData.access_token);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp() {
    try {
      setError(null);
      setLoading(true);
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const phoneDigits = normalizeTo98(phone);
      if (!/^98\d{10}$/.test(phoneDigits)) {
        throw new Error('شماره موبایل نامعتبر است');
      }
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, purpose: 'login' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setError('این شماره یافت نشد. لطفاً ثبت‌نام کنید.');
        } else {
          setError(data.message || 'ارسال کد تایید ناموفق بود');
        }
        return;
      }
      setOtpSent(true);
      setOtpExpiresAt(data.expiresAt || null);
  // do not surface mockOtp
  setMockOtp(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!canResend) return;
    await sendOtp();
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
            خوش آمدید
          </h2>
          <p className="mt-2 text-theme-muted">
            برای ادامه، وارد حساب کاربری خود شوید
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-theme-card shadow-xl backdrop-blur-sm p-8 border border-theme rounded-2xl"
        >
          <div className="flex gap-2 mb-6">
            <button type="button" onClick={()=>setMode('otp')} className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode==='otp'?'bg-blue-600 text-white':'bg-theme-secondary text-theme-muted'}`}>ورود با شماره موبایل</button>
            <button type="button" onClick={()=>setMode('email')} className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode==='email'?'bg-blue-600 text-white':'bg-theme-secondary text-theme-muted'}`}>ورود با ایمیل</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode==='otp' ? (
              <>
                <div>
                  <label htmlFor="phone" className="block mb-2 font-medium text-theme-primary text-sm">
                    شماره موبایل
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
                      required
                      inputMode="tel"
                      className={`bg-theme-primary px-12 py-3 border ${validPhone||!phone? 'border-theme':'border-red-300 dark:border-red-600'} focus:border-transparent rounded-xl outline-none focus:ring-2 ${validPhone||!phone? 'focus:ring-blue-500':'focus:ring-red-500'} w-full text-theme-primary transition-all ${otpSent && !canResend ? 'opacity-60 cursor-not-allowed':''}`}
                      disabled={otpSent && !canResend}
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
                    {otpSent && otpExpiresAt && (
                      <p className="text-theme-muted text-xs">انقضا: {Math.floor(remainingSec/60)}:{String(remainingSec%60).padStart(2,'0')}</p>
                    )}
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block mb-3 font-medium text-theme-primary text-sm">
                      کد تایید 6 رقمی
                    </label>
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
                      <div className="flex justify-between items-center">
                        <p className="text-theme-muted text-xs">انقضا: {new Date(otpExpiresAt).toLocaleTimeString()}</p>
                        <p className="text-theme-muted text-xs">باقیمانده: {Math.floor(remainingSec/60)}:{String(remainingSec%60).padStart(2,'0')}</p>
                      </div>
                    )}
                  </div>
                )}

                {!otpSent ? (
                  <button 
                    type="button" 
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
                ) : (
                  <>
                    {canResend && (
                      <button 
                        type="button" 
                        onClick={resendOtp} 
                        disabled={loading}
                        className="bg-theme-secondary hover:bg-theme-primary disabled:opacity-50 px-4 py-2 border border-theme rounded-xl w-full font-medium text-theme-secondary text-sm transition-all"
                      >
                        ارسال مجدد کد
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={loading || otp.length < 4}
                      className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                        otp.length >= 4 && !loading
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-theme-secondary text-theme-muted cursor-not-allowed'
                      }`}
                    >
                      {loading ? (
                        <div className="flex justify-center items-center gap-2">
                          <div className="border-white border-b-2 rounded-full w-4 h-4 animate-spin"></div>
                          در حال تایید...
                        </div>
                      ) : (
                        'تایید و ورود'
                      )}
                    </button>
                  </>
                )}

                <div className="text-sm text-center">
                  <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                    فراموشی رمز عبور؟
                  </Link>
                </div>
              </>
            ) : (
              <>
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
                  placeholder="رمز عبور خود را وارد کنید"
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
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="border-theme rounded focus:ring-blue-500 w-4 h-4 text-blue-600"
                />
                <label htmlFor="remember-me" className="block mr-2 text-theme-primary text-sm">
                  مرا به خاطر بسپار
                </label>
              </div>

              <div className="text-sm">
                <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                  فراموشی رمز عبور؟
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                email && password && !loading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-theme-secondary text-theme-muted cursor-not-allowed'
              }`}
            >
              {loading ? (
                <div className="flex justify-center items-center gap-2">
                  <div className="border-white border-b-2 rounded-full w-4 h-4 animate-spin"></div>
                  در حال ورود...
                </div>
              ) : (
                'ورود به حساب کاربری'
              )}
            </button>
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

          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="border-theme border-t w-full" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-theme-primary px-2 text-theme-muted">یا</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-theme-secondary text-sm">
                حساب کاربری ندارید؟{' '}
                <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500 dark:hover:text-blue-300 dark:text-blue-400">
                  ثبت نام کنید
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
            با ورود به سیستم، شما با{' '}
            <Link href="/terms" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
              شرایط و قوانین
            </Link>{' '}
            و{' '}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
              حریم خصوصی
            </Link>{' '}
            موافقت می‌کنید.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
