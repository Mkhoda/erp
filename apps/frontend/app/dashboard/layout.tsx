"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, X, UserRound, LogOut, Moon, Sun, Monitor,
  ChevronLeft, LayoutDashboard, Boxes, Layers, Tag,
  Handshake, UserCog, Building, MapPin, Home,
  CircleDollarSign, Users, Shield, FileText, Settings,
  BookOpen, Bell, Search, ChevronDown, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TwoLayerSidebar from "../components/TwoLayerSidebar";
import CommandPalette from "../components/CommandPalette";
import { ToastProvider } from "../components/ui/Toast";
import type { Role } from "../../lib/menu";

const ROUTE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  "/dashboard": { label: "فضای کاری", Icon: LayoutDashboard },
  "/dashboard/chat": { label: "گفتگو با AI", Icon: Sparkles },
  "/dashboard/knowledge": { label: "پایگاه دانش", Icon: BookOpen },
  "/dashboard/workflows": { label: "گردش‌کارها", Icon: LayoutDashboard },
  "/dashboard/agents": { label: "عوامل هوشمند", Icon: Sparkles },
  "/dashboard/profile": { label: "پروفایل", Icon: UserCog },
  "/dashboard/assets": { label: "دارایی‌ها", Icon: Boxes },
  "/dashboard/assets/types": { label: "انواع دارایی", Icon: Layers },
  "/dashboard/assets/categories": { label: "دسته‌بندی‌ها", Icon: Tag },
  "/dashboard/assets/assignments": { label: "واگذاری‌ها", Icon: Handshake },
  "/dashboard/users": { label: "کاربران", Icon: Users },
  "/dashboard/roles": { label: "نقش‌ها", Icon: Shield },
  "/dashboard/access": { label: "دسترسی صفحات", Icon: FileText },
  "/dashboard/settings": { label: "تنظیمات", Icon: Settings },
  "/dashboard/accounting": { label: "حسابداری دارایی", Icon: CircleDollarSign },
  "/dashboard/buildings": { label: "ساختمان‌ها", Icon: Building },
  "/dashboard/floors": { label: "طبقات", Icon: Layers },
  "/dashboard/rooms": { label: "اتاق‌ها", Icon: Home },
  "/dashboard/departments": { label: "دپارتمان‌ها", Icon: MapPin },
  "/dashboard/reports": { label: "گزارش‌ها", Icon: LayoutDashboard },
  "/dashboard/change-password": { label: "تغییر رمز عبور", Icon: Shield },
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدیر ارشد",
  MANAGER: "مدیر",
  USER: "کاربر",
  EXPERT: "کارشناس",
};

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [me, setMe] = React.useState<any>(null);
  const [role, setRole] = React.useState<Role | null>(null);
  const [allowedPages, setAllowedPages] = React.useState<string[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [theme, setTheme] = React.useState<Theme>("system");
  const [cmdOpen, setCmdOpen] = React.useState(false);

  // Auth
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/signin"); return; }
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setMe(data); setRole(data?.role ?? null); })
      .catch(() => setRole(null));
  }, [router]);

  // Permissions
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${API}/permissions/menu`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setAllowedPages(data?.menuPages ?? []))
      .catch(() => setAllowedPages([]));
  }, []);

  // Redirect if page not allowed
  React.useEffect(() => {
    if (!allowedPages || !pathname) return;
    if (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/profile") ||
      pathname.startsWith("/dashboard/change-password") ||
      pathname.startsWith("/dashboard/chat") ||
      pathname.startsWith("/dashboard/knowledge") ||
      pathname.startsWith("/dashboard/workflows") ||
      pathname.startsWith("/dashboard/agents")
    ) return;
    const ok = allowedPages.some(p => pathname === p || pathname.startsWith(p + "/"));
    if (!ok) router.replace("/dashboard");
  }, [allowedPages, pathname, router]);

  // Theme
  React.useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(saved);
    applyTheme(saved);

    // Watch system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (saved === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const cycleTheme = () => {
    const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
    const t = next[theme];
    setTheme(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const themeLabel = theme === "dark" ? "تاریک" : theme === "light" ? "روشن" : "سیستم";

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close mobile sidebar on navigation
  React.useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Breadcrumbs
  const breadcrumbs = React.useMemo(() => {
    if (!pathname) return [];
    const parts = pathname.split("/").filter(Boolean);
    const items: Array<{ href: string; label: string; Icon: React.ElementType }> = [];
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      acc += "/" + parts[i];
      if (acc.startsWith("/dashboard/assets/") && acc.split("/").length === 4 && !ROUTE_MAP[acc]) {
        items.push({ href: "/dashboard", label: "فضای کاری", Icon: LayoutDashboard });
        items.push({ href: "/dashboard/assets", label: "دارایی‌ها", Icon: Boxes });
        items.push({ href: acc, label: "جزئیات دارایی", Icon: Boxes });
        break;
      }
      const m = ROUTE_MAP[acc];
      if (m) items.push({ href: acc, label: m.label, Icon: m.Icon });
    }
    return items;
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    router.replace("/signin");
  };

  const fullName = me
    ? `${me.firstName || ""} ${me.lastName || ""}`.trim() || me.phone || "کاربر"
    : "";
  const initial = (me?.firstName?.[0] || me?.phone?.[0] || "U").toUpperCase();

  return (
    <div className="flex bg-theme-base min-h-dvh" dir="rtl">
      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden z-40 fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SIDEBAR ── */}
      <aside
        className={`
          fixed inset-y-0 right-0 z-50 flex flex-col
          md:relative md:translate-x-0 md:inset-auto
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          ${sidebarCollapsed ? "md:w-[68px]" : "w-64 md:w-64"}
          p-3
        `}
      >
        <div className="flex flex-col flex-1 bg-theme-card backdrop-blur-xl border border-theme rounded-2xl shadow-2xl overflow-hidden">

          {/* Brand */}
          <div className={`flex items-center border-theme border-b px-3 py-3.5 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Logo mark */}
              <div className="flex justify-center items-center bg-ai-gradient rounded-xl w-8 h-8 shrink-0 shadow-md shadow-blue-500/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="font-bold text-theme-primary text-sm leading-tight">Arzesh AI</div>
                  <div className="text-[10px] text-theme-muted leading-tight">پلتفرم هوشمند سازمانی</div>
                </div>
              )}
            </div>

            {/* Collapse toggle — desktop only */}
            <button
              className="hidden md:flex items-center justify-center hover:bg-theme-hover p-1 rounded-lg transition-colors shrink-0"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? "باز کردن منو" : "بستن منو"}
            >
              <ChevronLeft className={`w-4 h-4 text-theme-muted transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`} />
            </button>

            {/* Close — mobile only */}
            <button
              className="md:hidden hover:bg-theme-hover p-1.5 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4 text-theme-secondary" />
            </button>
          </div>

          {/* User card */}
          {me && !sidebarCollapsed && (
            <div className="mx-3 mt-3 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-950/50 dark:to-purple-950/50 p-3 border border-blue-200/50 dark:border-blue-800/50 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="flex justify-center items-center bg-ai-gradient rounded-full w-8 h-8 font-bold text-white text-sm shrink-0 shadow">
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-theme-primary text-sm truncate">{fullName}</div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400">{ROLE_LABELS[role || ""] || role}</div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed avatar */}
          {me && sidebarCollapsed && (
            <div className="flex justify-center mt-3">
              <div className="flex justify-center items-center bg-ai-gradient rounded-full w-8 h-8 font-bold text-white text-sm shadow">
                {initial}
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex-1 px-2 py-3 overflow-y-auto">
            {/* Profile link */}
            {!sidebarCollapsed && (
              <Link
                href="/dashboard/profile"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium mb-2 transition-all duration-200
                  ${pathname === "/dashboard/profile"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "text-theme-secondary hover:bg-theme-hover hover:text-theme-primary"
                  }`}
              >
                <UserCog className={`w-4 h-4 shrink-0 ${pathname === "/dashboard/profile" ? "text-white" : "text-theme-muted"}`} />
                پروفایل
              </Link>
            )}

            {!sidebarCollapsed && <div className="mb-2 border-theme border-t" />}

            <TwoLayerSidebar
              allowedPages={allowedPages}
              role={role}
              collapsed={sidebarCollapsed}
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>

          {/* Bottom actions */}
          <div className={`px-3 pb-3 border-theme border-t pt-3 space-y-1 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
            {!sidebarCollapsed ? (
              <button
                onClick={logout}
                className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2.5 rounded-xl w-full text-red-600 dark:text-red-400 text-sm font-medium transition-all"
              >
                <LogOut className="w-4 h-4" />
                خروج از سیستم
              </button>
            ) : (
              <button
                onClick={logout}
                title="خروج"
                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Floating header */}
        <header className="top-0 z-30 sticky p-3">
          <div className="flex items-center gap-3 bg-theme-card backdrop-blur-xl border border-theme rounded-2xl shadow-sm px-4 py-2.5">
            {/* Mobile menu */}
            <button
              className="md:hidden flex-shrink-0 hover:bg-theme-hover p-2 border border-theme rounded-xl transition-all"
              onClick={() => setSidebarOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu className="w-4 h-4 text-theme-secondary" />
            </button>

            {/* Breadcrumbs */}
            <nav aria-label="breadcrumb" className="flex items-center gap-0.5 min-w-0 text-sm truncate">
              {breadcrumbs.map((c, idx) => (
                <React.Fragment key={c.href}>
                  {idx > 0 && <ChevronLeft className="mx-0.5 opacity-40 w-3.5 h-3.5 text-theme-muted shrink-0" />}
                  <Link
                    href={c.href}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors shrink-0
                      ${idx === breadcrumbs.length - 1
                        ? "font-semibold text-theme-primary"
                        : "text-theme-muted hover:text-theme-secondary"
                      }`}
                  >
                    <c.Icon className="w-3.5 h-3.5" />
                    <span className="max-w-[8rem] truncate text-xs sm:text-sm">{c.label}</span>
                  </Link>
                </React.Fragment>
              ))}
            </nav>

            {/* Search bar — opens command palette */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden sm:flex items-center gap-2 ms-auto flex-1 max-w-xs bg-theme-secondary border border-theme rounded-xl px-3 py-1.5 text-sm text-theme-muted hover:bg-theme-hover hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-right text-xs">جستجو...</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-theme-card border border-theme rounded group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                ⌘K
              </kbd>
            </button>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 ms-auto sm:ms-0 shrink-0">
              {/* Mobile search */}
              <button
                className="sm:hidden flex items-center justify-center hover:bg-theme-hover p-2 border border-theme rounded-xl text-theme-secondary transition-all"
                onClick={() => setCmdOpen(true)}
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Theme toggle */}
              <button
                onClick={cycleTheme}
                className="flex items-center justify-center hover:bg-theme-hover p-2 border border-theme rounded-xl text-theme-secondary transition-all"
                title={`تم: ${themeLabel}`}
              >
                <ThemeIcon className={`w-4 h-4 ${theme === "dark" ? "text-amber-400" : theme === "light" ? "text-amber-500" : ""}`} />
              </button>

              {/* Notifications */}
              <NotificationBell />

              {/* User menu */}
              <HeaderUserMenu me={me} role={role} onLogout={logout} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-3 pb-6 page-enter">
          <ToastProvider>
            {children}
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}

/* ── Notification Bell ── */
function NotificationBell() {
  const [count] = React.useState(3);
  return (
    <div className="relative">
      <button className="flex items-center justify-center hover:bg-theme-hover p-2 border border-theme rounded-xl text-theme-secondary transition-all">
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 notif-pulse" />
        )}
      </button>
    </div>
  );
}

/* ── Header User Menu ── */
function HeaderUserMenu({ me, role, onLogout }: { me: any; role: Role | null; onLogout: () => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);

  const fullName = me ? `${me.firstName || ""} ${me.lastName || ""}`.trim() || me.phone || "کاربر" : "حساب";
  const initial = (me?.firstName?.[0] || me?.phone?.[0] || "U").toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 hover:bg-theme-hover px-2 py-1.5 border border-transparent hover:border-theme rounded-xl transition-all"
      >
        <div className="flex justify-center items-center bg-ai-gradient rounded-full w-7 h-7 font-semibold text-white text-xs shadow">
          {initial}
        </div>
        <span className="hidden sm:block font-medium text-theme-primary text-sm max-w-[7rem] truncate">{fullName}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="left-0 absolute bg-theme-card shadow-2xl backdrop-blur-xl mt-2 border border-theme rounded-2xl w-52 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-theme border-b">
              <div className="font-semibold text-theme-primary text-sm truncate">{fullName}</div>
              {me?.phone && <div className="text-theme-muted text-xs mt-0.5 dir-ltr">{me.phone}</div>}
              {role && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-full text-[11px] font-medium">
                  {ROLE_LABELS[role] || role}
                </span>
              )}
            </div>

            <div className="p-1.5">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5 hover:bg-theme-hover px-3 py-2 rounded-lg text-theme-secondary text-sm transition-colors">
                <LayoutDashboard className="w-4 h-4 text-theme-muted" /> فضای کاری
              </Link>
              <Link href="/dashboard/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 hover:bg-theme-hover px-3 py-2 rounded-lg text-theme-secondary text-sm transition-colors">
                <UserCog className="w-4 h-4 text-theme-muted" /> پروفایل
              </Link>
              <Link href="/dashboard/change-password" onClick={() => setOpen(false)} className="flex items-center gap-2.5 hover:bg-theme-hover px-3 py-2 rounded-lg text-theme-secondary text-sm transition-colors">
                <Shield className="w-4 h-4 text-theme-muted" /> تغییر رمز عبور
              </Link>
            </div>

            <div className="border-theme border-t" />
            <div className="p-1.5">
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="flex items-center gap-2.5 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2 rounded-lg w-full text-red-600 dark:text-red-400 text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" /> خروج از سیستم
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
