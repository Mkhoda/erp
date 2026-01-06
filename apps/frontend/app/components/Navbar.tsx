"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Info, BookOpen, Phone, Sparkles, Menu, X, LogIn, UserRound, LayoutDashboard, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const links = [
  { href: '/', label: 'خانه', icon: Home },
  { href: '/about', label: 'درباره ما', icon: Info },
  { href: '/services', label: 'خدمات', icon: Sparkles },
  { href: '/blog', label: 'وبلاگ', icon: BookOpen },
  { href: '/contact', label: 'تماس', icon: Phone },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light'|'dark'>('light');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'light'|'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  React.useEffect(()=>{
    if (!mounted) return;
    
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <motion.header 
      className="top-0 z-40 sticky h-0"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="mx-auto px-4 max-w-5xl">
        <div className="relative flex items-center gap-4 bg-theme-navbar shadow-sm backdrop-blur-md mt-4 px-4 py-2 border border-theme rounded-2xl">
          {/* Mobile menu toggle */}
          <button 
            className="sm:hidden hover:bg-theme-hover p-2 rounded-lg text-theme-secondary" 
            aria-label="منو" 
            onClick={() => setMobileOpen(v => !v)}
          >
            {mobileOpen ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
          </button>
          
          {/* Logo */}
          <Link href="/" className="font-semibold text-theme-primary tracking-tight shrink-0">
            ارزش ERP
          </Link>
          
          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 mx-auto text-sm">
            {links.map(({ href, label, icon: Icon }, index) => {
              const active = pathname === href;
              return (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ${
                      active 
                        ? 'bg-blue-600 text-white' 
                        : 'text-theme-secondary hover:bg-theme-hover hover:text-blue-700 dark:hover:text-blue-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>
          
          {/* Right side - Theme toggle + Auth */}
          <div className="flex items-center gap-2 ms-auto">
            {/* Theme Toggle */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              onClick={toggleTheme}
              className="bg-theme-card hover:bg-theme-hover p-2 rounded-lg text-theme-secondary transition-all duration-200"
              aria-label="تغییر تم"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </motion.button>
            
            <AuthCorner />
          </div>

          {/* Mobile panel */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div 
                className="top-full z-50 absolute inset-x-0 mt-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-theme-card shadow-lg p-2 border border-theme rounded-2xl">
                  <nav className="flex flex-col gap-1 text-sm">
                    {links.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                            active 
                              ? 'bg-blue-600 text-white' 
                              : 'text-theme-secondary hover:bg-theme-hover hover:text-blue-700 dark:hover:text-blue-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="my-2 border-theme border-t" />
                  <div className="px-1"><AuthCorner onAction={() => setMobileOpen(false)} /></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}

function AuthCorner({ onAction }: { onAction?: () => void } = {}) {
  const [token, setToken] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<any>(null);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setToken(t);
    if (t) {
      fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/auth/me', { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => setMe(data))
        .catch(() => setMe(null));
    }
  }, []);

  React.useEffect(()=>{
    function onDoc(e: MouseEvent){ if (!ref.current) return; if (!ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent){ if (e.key==='Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setMe(null);
    setOpen(false);
    onAction?.();
  };

  if (!token) return (
    <Link 
      href="/signin" 
      onClick={onAction} 
      className="inline-flex items-center gap-1.5 hover:bg-theme-hover px-3 py-1.5 rounded-full font-medium text-blue-600 dark:text-blue-400 transition-colors"
    >
      <LogIn className="w-4 h-4" />
      <span className="hidden sm:inline text-sm">ورود</span>
    </Link>
  );

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setOpen(v => !v)} 
        className="inline-flex items-center gap-2 hover:bg-theme-hover backdrop-blur-sm px-3 py-2 border border-transparent rounded-xl transition-all duration-200"
      >
        <UserRound className="w-5 h-5 text-theme-primary" />
        <span className="hidden sm:inline font-medium text-theme-primary text-sm">
          {me?.firstName ? `${me.firstName} ${me?.lastName || ''}` : 'حساب کاربری'}
        </span>
      </button>
      
      <AnimatePresence>
        {open && (
          <motion.div 
            className="sm:right-0 left-0 sm:left-auto z-50 absolute bg-theme-card shadow-theme-lg backdrop-blur-md mt-2 border border-theme rounded-xl w-56 overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 py-2 text-sm">
              <div className="font-medium text-theme-primary">
                {me?.firstName ? `${me.firstName} ${me?.lastName || ''}` : me?.email || 'کاربر'}
              </div>
              {me?.role && <div className="text-[11px] text-theme-muted">نقش: {me.role}</div>}
            </div>
            <div className="border-theme border-t" />
            <div className="p-1">
              <Link 
                href="/dashboard" 
                onClick={() => { setOpen(false); onAction?.(); }} 
                className="flex items-center gap-2 hover:bg-theme-hover px-3 py-2 rounded-lg text-theme-secondary text-sm transition-colors"
              >
                <LayoutDashboard className="w-4 h-4"/> داشبورد
              </Link>
              <Link 
                href="/services" 
                onClick={() => { setOpen(false); onAction?.(); }} 
                className="flex items-center gap-2 hover:bg-theme-hover px-3 py-2 rounded-lg text-theme-secondary text-sm transition-colors"
              >
                <Sparkles className="w-4 h-4"/> خدمات
              </Link>
              <Link 
                href="/about" 
                onClick={() => { setOpen(false); onAction?.(); }} 
                className="flex items-center gap-2 hover:bg-theme-hover px-3 py-2 rounded-lg text-theme-secondary text-sm transition-colors"
              >
                <Info className="w-4 h-4"/> درباره ما
              </Link>
            </div>
            <div className="border-theme border-t" />
            <button 
              onClick={logout} 
              className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950 px-3 py-2 w-full text-red-600 dark:text-red-400 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4"/> خروج
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
