"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Boxes, Users, Shield, Settings, FileText, CircleDollarSign, Layers, Tag, Handshake, Menu, X, UserRound, LogOut, Search, Moon, Sun, ChevronLeft, UserCog, Building, MapPin, Home } from "lucide-react";
import TwoLayerSidebar from "../components/TwoLayerSidebar";

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
  const [allowedPages, setAllowedPages] = React.useState<string[]|null>(null);
  React.useEffect(()=>{
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const url = (process.env.NEXT_PUBLIC_API_URL||'http://localhost:3001') + '/permissions/menu';
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.ok?r.json():null).then(data=>{
      setAllowedPages(data?.menuPages || []);
    }).catch(()=>setAllowedPages([]));
  },[]);

  React.useEffect(()=>{
    if (!allowedPages) return; // still loading
    if (!pathname) return;
    // Allow dashboard root
    if (pathname === '/dashboard' || pathname === '/dashboard/profile' || pathname === '/signin') return;
    const ok = allowedPages.some(p => pathname === p || pathname.startsWith(p + '/') );
    if (!ok) {
      // redirect away if not allowed
      router.replace('/dashboard');
    }
  }, [allowedPages, pathname, router]);
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
    <div className="flex bg-theme-secondary min-h-dvh">
      {sidebarOpen && (<div className="md:hidden z-40 fixed inset-0 bg-black/30 dark:bg-black/50" onClick={()=>setSidebarOpen(false)} />)}
      {/* Sidebar */}
      <aside 
        className={`${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 right-0 z-50 w-72 md:w-64 transition-transform flex flex-col bg-theme-card backdrop-blur-xl border-r border-theme shadow-2xl md:shadow-lg`}
        aria-label="ناوبری اصلی"
        role="navigation"
        aria-hidden={!sidebarOpen ? "true" : "false"}
      >
        <div className="px-4 py-4 border-theme border-b">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-theme-primary">Arzesh ERP</div>
              <div className="text-theme-muted text-xs">داشبورد مدیریت</div>
            </div>
            <button className="md:hidden hover:bg-theme-secondary p-2 rounded-lg transition-colors" onClick={() => setSidebarOpen(false)} aria-label="بستن"><X className="w-5 h-5 text-theme-secondary"/></button>
          </div>
        </div>
        <div className="flex-1 p-2">
          <div className="px-3 py-2">
            {/* profile link */}
            <Link href="/dashboard/profile" onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${pathname==='/dashboard/profile'?'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30':'hover:bg-theme-secondary hover:text-blue-700 dark:hover:text-blue-300 text-theme-secondary'}`}><UserCog className="w-4 h-4"/> پروفایل</Link>
          </div>
          <div className="px-3 mt-2">
            <TwoLayerSidebar />
          </div>
        </div>
      </aside>
      {/* Main */}
      <div className="flex flex-col flex-1 bg-gradient-theme">
        {/* Header */}
        <header className="top-0 z-10 sticky">
          <div className="mx-auto px-4 max-w-7xl">
            <div className="flex items-center gap-3 bg-theme-card shadow-sm backdrop-blur-xl mt-4 px-4 py-3 border border-theme rounded-2xl transition-all duration-300">
              <button className="md:hidden bg-theme-primary hover:bg-theme-secondary backdrop-blur-sm p-2 border border-theme rounded-xl transition-all" onClick={() => setSidebarOpen(true)} aria-label="باز کردن منو"><Menu className="w-5 h-5 text-theme-primary"/></button>
              <nav aria-label="breadcrumb" className="flex items-center gap-1 text-theme-secondary text-xs sm:text-sm truncate">
                {breadcrumbs.map((c, idx) => (
                  <React.Fragment key={c.href}>
                    {idx>0 && <ChevronLeft className="opacity-60 w-4 h-4"/>}
                    <Link href={c.href} className={`inline-flex items-center gap-1 hover:text-blue-700 dark:hover:text-blue-300 transition-colors rounded-lg px-2 py-1 ${idx===breadcrumbs.length-1?'font-semibold text-theme-primary':''}`} onClick={()=> setSidebarOpen(false)}>
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
  <main className="mx-auto px-4 py-6 w-full max-w-7xl text-theme-primary transition-colors duration-300">{children}</main>
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
      <button onClick={() => setOpen(v=>!v)} className="inline-flex items-center gap-2 hover:bg-theme-secondary backdrop-blur-sm px-3 py-2 border border-transparent rounded-xl transition-all duration-200">
        <UserRound className="w-5 h-5 text-theme-primary"/>
        <span className="hidden sm:inline font-medium text-gray-800 dark:text-gray-200 text-sm">حساب</span>
      </button>
      {open && (
        <div className="left-0 absolute bg-theme-card shadow-2xl backdrop-blur-xl mt-2 border border-theme rounded-2xl w-48 overflow-hidden">
          <Link href="/" onClick={()=>setOpen(false)} className="block hover:bg-theme-hover px-4 py-3 font-medium text-theme-secondary text-sm transition-colors">صفحه اصلی</Link>
          <Link href="/dashboard/profile" onClick={()=>setOpen(false)} className="block hover:bg-theme-hover px-4 py-3 font-medium text-theme-secondary text-sm transition-colors">پروفایل</Link>
          <Link href="/about" onClick={()=>setOpen(false)} className="block hover:bg-theme-hover px-4 py-3 font-medium text-theme-secondary text-sm transition-colors">درباره</Link>
          <button onClick={()=>{ onToggleTheme?.(); }} className="flex items-center gap-2 hover:bg-theme-hover px-4 py-3 w-full font-medium text-theme-secondary text-sm text-left transition-colors">
            {theme==='dark'? <Sun className="w-4 h-4 text-yellow-500"/> : <Moon className="w-4 h-4 text-theme-secondary"/>}
            تغییر تم
          </button>
          <div className="border-theme border-t" />
          <button onClick={()=>{ setOpen(false); onLogout(); }} className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/50 px-4 py-3 w-full font-medium text-red-600 dark:text-red-400 text-sm transition-colors"><LogOut className="w-4 h-4"/> خروج</button>
        </div>
      )}
    </div>
  );
}