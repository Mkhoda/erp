"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Boxes, Users, Shield, Settings, FileText, CircleDollarSign, Layers, Tag, Handshake, Menu, X, UserRound, LogOut, Search, Moon, Sun, ChevronLeft, UserCog, Building, MapPin, Home } from "lucide-react";

const links = [
  { href: "/dashboard", label: "نمای کلی", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "دارایی‌ها", icon: Boxes },
  { href: "/dashboard/users", label: "کاربران", icon: Users },
  { href: "/dashboard/roles", label: "نقش‌ها", icon: Shield },
  { href: "/dashboard/access", label: "دسترسی صفحات", icon: FileText },
  { href: "/dashboard/settings", label: "تنظیمات", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role,setRole]=React.useState<string|null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<'light'|'dark'>(()=> (typeof window!=='undefined' && (localStorage.getItem('theme') as 'light'|'dark')) || 'light');
  // Persian labels and icons for breadcrumbs
  const routeMap: Record<string, { label: string; icon: any }> = React.useMemo(()=>({
    '/dashboard': { label: 'نمای کلی', icon: LayoutDashboard },
  '/dashboard/profile': { label: 'پروفایل', icon: UserCog },
    '/dashboard/assets': { label: 'دارایی‌ها', icon: Boxes },
    '/dashboard/assets/types': { label: 'انواع دارایی', icon: Layers },
    '/dashboard/assets/categories': { label: 'دسته‌بندی‌ها', icon: Tag },
    '/dashboard/assets/assignments': { label: 'واگذاری‌ها', icon: Handshake },
    '/dashboard/users': { label: 'کاربران', icon: Users },
    '/dashboard/roles': { label: 'نقش‌ها', icon: Shield },
    '/dashboard/access': { label: 'دسترسی صفحات', icon: FileText },
    '/dashboard/settings': { label: 'تنظیمات', icon: Settings },
    '/dashboard/accounting': { label: 'حسابداری دارایی', icon: CircleDollarSign },
    '/dashboard/buildings': { label: 'ساختمان‌ها', icon: Building },
    '/dashboard/floors': { label: 'طبقات', icon: Layers },
    '/dashboard/rooms': { label: 'اتاق‌ها', icon: Home },
    '/dashboard/departments': { label: 'دپارتمان‌ها', icon: MapPin },
  }), []);
  const breadcrumbs = React.useMemo(()=>{
    const items: Array<{ href: string; label: string; Icon: any }> = [];
    if (!pathname) return items;
    const parts = pathname.split('/').filter(Boolean);
    let acc = '';
    for (let i=0; i<parts.length; i++) {
      acc += '/' + parts[i];
      if (acc.startsWith('/dashboard/assets/') && acc.split('/').length === 4) {
        items.push({ href: '/dashboard', label: routeMap['/dashboard'].label, Icon: routeMap['/dashboard'].icon });
        items.push({ href: '/dashboard/assets', label: routeMap['/dashboard/assets'].label, Icon: routeMap['/dashboard/assets'].icon });
        items.push({ href: acc, label: 'جزئیات دارایی', Icon: Boxes });
        break;
      }
      const m = routeMap[acc as keyof typeof routeMap];
      if (m) items.push({ href: acc, label: m.label, Icon: m.icon });
    }
    return items;
  }, [pathname, routeMap]);
  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) router.replace('/signin');
    else {
      fetch((process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001')+'/auth/me', { headers:{ Authorization:`Bearer ${token}` }}).then(r=>r.ok?r.json():null).then(me=>setRole(me?.role||null)).catch(()=>setRole(null));
    }
  }, [router]);
  React.useEffect(()=>{
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
      try { localStorage.setItem('theme', theme); } catch {}
    }
  }, [theme]);
  // Remove custom event dependency; state drives theme
  React.useEffect(()=>{ setSidebarOpen(false); }, [pathname]);
  
  // Handle keyboard navigation for sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);
  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 min-h-dvh">
      {sidebarOpen && (<div className="md:hidden z-40 fixed inset-0 bg-black/30 dark:bg-black/50" onClick={()=>setSidebarOpen(false)} />)}
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 right-0 z-50 w-72 md:w-64 transition-transform flex flex-col bg-white/95 dark:bg-gray-900/95 supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-gray-900/80 backdrop-blur-xl border-r border-gray-200/60 dark:border-gray-700/60 shadow-2xl md:shadow-lg`}
        aria-label="ناوبری اصلی"
        role="navigation"
        aria-hidden={!sidebarOpen ? "true" : "false"}
      >
        <div className="px-4 py-4 border-gray-200/60 dark:border-gray-700/60 border-b">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-gray-900 dark:text-gray-100">Arzesh ERP</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">داشبورد مدیریت</div>
            </div>
            <button className="md:hidden hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors" onClick={() => setSidebarOpen(false)} aria-label="بستن"><X className="w-5 h-5 text-gray-700 dark:text-gray-300"/></button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}>
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            );
          })}
          <Link href="/dashboard/profile" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/profile'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><UserCog className="w-4 h-4"/> پروفایل</Link>
          <div className="mt-6 px-3 font-semibold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">مدیریت دارایی</div>
          <Link href="/dashboard/assets" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/assets'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Boxes className="w-4 h-4"/> دارایی‌ها</Link>
          <Link href="/dashboard/assets/types" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/assets/types'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Layers className="w-4 h-4"/> انواع دارایی</Link>
          <Link href="/dashboard/assets/categories" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/assets/categories'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Tag className="w-4 h-4"/> دسته‌بندی‌ها</Link>
          <Link href="/dashboard/assets/assignments" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/assets/assignments'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Handshake className="w-4 h-4"/> واگذاری‌ها</Link>
          {(role==='EXPERT'||role==='ADMIN'||role==='MANAGER') && (
            <Link href="/dashboard/accounting" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/accounting'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}>
              <CircleDollarSign className="w-4 h-4"/>
              <span>حسابداری دارایی</span>
              <span className="inline-block bg-amber-100 dark:bg-amber-900/50 ms-auto px-1.5 py-0.5 rounded-md font-medium text-[10px] text-amber-700 dark:text-amber-300">EXPERT</span>
            </Link>
          )}
          
          <div className="mt-6 px-3 font-semibold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">مدیریت سازمان</div>
          <Link href="/dashboard/departments" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/departments'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><MapPin className="w-4 h-4"/> دپارتمان‌ها</Link>
          <Link href="/dashboard/buildings" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/buildings'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Building className="w-4 h-4"/> ساختمان‌ها</Link>
          <Link href="/dashboard/floors" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/floors'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Layers className="w-4 h-4"/> طبقات</Link>
          <Link href="/dashboard/rooms" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/rooms'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`}><Home className="w-4 h-4"/> اتاق‌ها</Link>
        </nav>
      </aside>
      {/* Main */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="top-0 z-10 sticky">
          <div className="mx-auto px-4 max-w-7xl">
            <div className="flex items-center gap-3 bg-white/60 supports-[backdrop-filter]:bg-white/40 dark:bg-gray-900/60 dark:supports-[backdrop-filter]:bg-gray-900/40 shadow-sm backdrop-blur-xl mt-4 px-4 py-3 border border-white/70 dark:border-gray-700/50 rounded-2xl transition-all duration-300">
              <button className="md:hidden bg-white/80 hover:bg-white dark:bg-gray-900/80 dark:hover:bg-gray-800 backdrop-blur-sm p-2 border border-gray-200/50 dark:border-gray-700/50 rounded-xl transition-all" onClick={() => setSidebarOpen(true)} aria-label="باز کردن منو"><Menu className="w-5 h-5 text-gray-700 dark:text-gray-300"/></button>
              <nav aria-label="breadcrumb" className="flex items-center gap-1 text-gray-600 dark:text-gray-300 text-xs sm:text-sm truncate">
                {breadcrumbs.map((c, idx) => (
                  <React.Fragment key={c.href}>
                    {idx>0 && <ChevronLeft className="opacity-60 w-4 h-4"/>}
                    <Link href={c.href} className={`inline-flex items-center gap-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors rounded-lg px-2 py-1 ${idx===breadcrumbs.length-1?'font-semibold text-gray-900 dark:text-gray-100':''}`} onClick={()=> setSidebarOpen(false)}>
                      <c.Icon className="w-4 h-4"/>
                      <span className="max-w-[10ch] sm:max-w-none truncate">{c.label}</span>
                    </Link>
                  </React.Fragment>
                ))}
              </nav>
              <div className="flex items-center gap-2 ms-auto">
                <UserMenu theme={theme} onToggleTheme={()=>{
                  const next = theme==='dark'?'light':'dark';
                  setTheme(next);
                }} onLogout={()=>{localStorage.removeItem('token'); router.replace('/signin');}} />
              </div>
            </div>
          </div>
        </header>
  <main className="supports-[backdrop-filter]:bg-transparent bg-gradient-to-b from-gray-50/80 dark:from-gray-900/80 to-white/60 dark:to-gray-800/60 mx-auto px-4 py-6 w-full max-w-7xl text-gray-900 dark:text-gray-100 transition-colors duration-300">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ onLogout, theme, onToggleTheme }: { onLogout: () => void, theme?: 'light'|'dark', onToggleTheme?: ()=>void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{
    function onDocClick(e: MouseEvent){ if (!ref.current) return; if (!ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent){ if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return ()=>{ document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v=>!v)} className="inline-flex items-center gap-2 hover:bg-white/60 dark:hover:bg-gray-800/60 backdrop-blur-sm px-3 py-2 border border-transparent rounded-xl transition-all duration-200">
        <UserRound className="w-5 h-5 text-gray-700 dark:text-gray-300"/>
        <span className="hidden sm:inline font-medium text-gray-800 dark:text-gray-200 text-sm">حساب</span>
      </button>
      {open && (
        <div className="left-0 absolute bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-xl mt-2 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl w-48 overflow-hidden">
          <Link href="/" onClick={()=>setOpen(false)} className="block hover:bg-blue-50 dark:hover:bg-blue-950/50 px-4 py-3 font-medium text-gray-800 dark:text-gray-200 text-sm transition-colors">صفحه اصلی</Link>
          <Link href="/dashboard/profile" onClick={()=>setOpen(false)} className="block hover:bg-blue-50 dark:hover:bg-blue-950/50 px-4 py-3 font-medium text-gray-800 dark:text-gray-200 text-sm transition-colors">پروفایل</Link>
          <Link href="/about" onClick={()=>setOpen(false)} className="block hover:bg-blue-50 dark:hover:bg-blue-950/50 px-4 py-3 font-medium text-gray-800 dark:text-gray-200 text-sm transition-colors">درباره</Link>
          <button onClick={()=>{ onToggleTheme?.(); }} className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-4 py-3 w-full font-medium text-gray-800 dark:text-gray-200 text-sm text-left transition-colors">
            {theme==='dark'? <Sun className="w-4 h-4 text-yellow-500"/> : <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400"/>}
            تغییر تم
          </button>
          <div className="border-gray-200/60 dark:border-gray-700/60 border-t" />
          <button onClick={()=>{ setOpen(false); onLogout(); }} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/50 px-4 py-3 w-full font-medium text-red-600 dark:text-red-400 text-sm transition-colors"><LogOut className="w-4 h-4"/> خروج</button>
        </div>
      )}
    </div>
  );
}