"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, X, LogOut, Moon, Sun, Monitor,
  ChevronLeft, LayoutDashboard, Boxes, Layers, Tag,
  Handshake, UserCog, Building, MapPin, Home,
  CircleDollarSign, Users, Shield, FileText, Settings,
  Bell, Sparkles, Cpu, Calendar, ShieldOff, MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TwoLayerSidebar from "../components/TwoLayerSidebar";
import CommandPalette from "../components/CommandPalette";
import { ToastProvider } from "../components/ui/Toast";
import { MessagingProvider, useMessagingOptional } from "../../lib/messaging";
import ChatWidget from "../components/messaging/ChatWidget";
import type { Role } from "../../lib/menu";

const ROUTE_MAP: Record<string, { label: string; Icon: React.ElementType }> = {
  "/dashboard": { label: "فضای کاری", Icon: LayoutDashboard },
  "/dashboard/chat": { label: "گفتگو با AI", Icon: Sparkles },
  "/dashboard/knowledge": { label: "پایگاه دانش", Icon: Sparkles },
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
  "/dashboard/ai-settings": { label: "تنظیمات هوش مصنوعی", Icon: Cpu },
  "/dashboard/settings": { label: "تنظیمات", Icon: Settings },
  "/dashboard/notifications": { label: "مرکز اعلان‌ها", Icon: Bell },
  "/dashboard/notifications/announcements": { label: "مدیریت اطلاعیه‌ها", Icon: Bell },
  "/dashboard/notifications/dashboard": { label: "آمار اعلان‌ها", Icon: Bell },
  "/dashboard/accounting": { label: "حسابداری دارایی", Icon: CircleDollarSign },
  "/dashboard/buildings": { label: "ساختمان‌ها", Icon: Building },
  "/dashboard/floors": { label: "طبقات", Icon: Layers },
  "/dashboard/rooms": { label: "اتاق‌ها", Icon: Home },
  "/dashboard/departments": { label: "دپارتمان‌ها", Icon: MapPin },
  "/dashboard/reports": { label: "گزارش‌ها", Icon: LayoutDashboard },
  "/dashboard/change-password": { label: "تغییر رمز عبور", Icon: Shield },
  "/dashboard/system-logs": { label: "لاگ سیستم", Icon: Bell },
  "/dashboard/ai-usage": { label: "مصرف AI", Icon: Cpu },
  "/dashboard/messaging": { label: "پیام‌رسانی", Icon: MessageSquare },
  "/dashboard/messaging/admin": { label: "تنظیمات پیام‌رسانی", Icon: Settings },
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
  const [authReady, setAuthReady] = React.useState(false);
  const [accessDenied, setAccessDenied] = React.useState(false);

  // Auth
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      document.cookie = "token=; path=/; max-age=0";
      router.replace("/signin");
      return;
    }
    const API = process.env.NEXT_PUBLIC_API_URL || "/api";
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then(data => {
        setMe(data);
        setRole(data?.role ?? null);
        setAuthReady(true);
      })
      .catch(() => {
        localStorage.removeItem("token");
        document.cookie = "token=; path=/; max-age=0";
        router.replace("/signin");
      });
  }, [router]);

  // Permissions
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "/api";
    fetch(`${API}/permissions/menu`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setAllowedPages(data?.menuPages ?? []))
      .catch(() => setAllowedPages([]));
  }, []);

  // Check page access — show forbidden screen instead of silent redirect
  // NOTE: "/dashboard" exact-only — prefix would match every sub-page and bypass the check
  const BASE_ALWAYS_ALLOWED_EXACT = ["/dashboard"];
  const BASE_ALWAYS_ALLOWED_PREFIX = [
    "/dashboard/profile",
    "/dashboard/change-password",
    "/dashboard/chat",
    "/dashboard/messaging",
    "/dashboard/attendance/my",
    "/dashboard/tickets/my",
  ];
  React.useEffect(() => {
    if (!allowedPages || !pathname) return;
    const isBase =
      BASE_ALWAYS_ALLOWED_EXACT.includes(pathname) ||
      BASE_ALWAYS_ALLOWED_PREFIX.some(p => pathname === p || pathname.startsWith(p + "/"));
    if (isBase) { setAccessDenied(false); return; }
    const ok = allowedPages.some(p => pathname === p || pathname.startsWith(p + "/"));
    setAccessDenied(!ok);
  }, [allowedPages, pathname]);

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
    document.cookie = "token=; path=/; max-age=0";
    router.replace("/signin");
  };

  const fullName = me
    ? `${me.firstName || ""} ${me.lastName || ""}`.trim() || me.phone || "کاربر"
    : "";
  const initial = (me?.firstName?.[0] || me?.phone?.[0] || "U").toUpperCase();

  // Don't render dashboard at all until we confirm auth — prevents flash
  if (!authReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-theme-base gap-6" dir="rtl">
        <div className="flex justify-center items-center bg-ai-gradient shadow-lg shadow-blue-500/30 rounded-2xl w-14 h-14">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <div className="flex gap-2">
          {[0, 150, 300].map(delay => (
            <span key={delay} className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
        <p className="text-theme-muted text-sm">در حال بارگذاری پلتفرم...</p>
      </div>
    );
  }

  return (
    <MessagingProvider>
    <div className="flex bg-theme-base h-dvh overflow-hidden" dir="rtl">
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
          bg-theme-card border-l border-theme
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
          ${sidebarCollapsed ? "md:w-[64px]" : "w-60 md:w-60"}
        `}
      >
          {/* Brand */}
          <div className={`flex items-center border-b border-theme px-3 py-4 shrink-0 ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex justify-center items-center bg-ai-gradient rounded-lg w-7 h-7 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="font-bold text-theme-primary text-sm leading-tight">Arzesh AI</div>
                  <div className="text-[10px] text-theme-muted leading-tight">پلتفرم هوشمند سازمانی</div>
                </div>
              )}
            </div>
            <button
              className="hidden md:flex justify-center items-center hover:bg-theme-hover p-1 rounded-md transition-colors shrink-0"
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? "باز کردن منو" : "بستن منو"}
            >
              <ChevronLeft className={`w-4 h-4 text-theme-muted transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`} />
            </button>
            <button
              className="md:hidden hover:bg-theme-hover p-1.5 rounded-md transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4 text-theme-secondary" />
            </button>
          </div>

          {/* User info */}
          {me && !sidebarCollapsed && (
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-theme shrink-0">
              <div className="flex justify-center items-center bg-ai-gradient rounded-full w-7 h-7 font-bold text-white text-xs shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-theme-primary text-xs truncate">{fullName}</div>
                <div className="text-[10px] text-theme-muted">{ROLE_LABELS[role || ""] || role}</div>
              </div>
            </div>
          )}
          {me && sidebarCollapsed && (
            <div className="flex justify-center py-2 border-b border-theme shrink-0">
              <div className="flex justify-center items-center bg-ai-gradient rounded-full w-7 h-7 font-bold text-white text-xs">
                {initial}
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex-1 px-2 py-2 overflow-y-auto">
            {!sidebarCollapsed && (
              <Link
                href="/dashboard/profile"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors
                  ${pathname === "/dashboard/profile"
                    ? "bg-blue-600 text-white"
                    : "text-theme-secondary hover:bg-theme-hover"
                  }`}
              >
                <UserCog className={`w-4 h-4 shrink-0 ${pathname === "/dashboard/profile" ? "text-white" : "text-theme-muted"}`} />
                پروفایل
              </Link>
            )}
            {!sidebarCollapsed && <div className="mb-1 border-theme border-t" />}
            <TwoLayerSidebar
              allowedPages={allowedPages}
              role={role}
              collapsed={sidebarCollapsed}
              onNavigate={() => setSidebarOpen(false)}
            />
          </div>

          {/* Bottom actions */}
          <div className={`px-2 py-2 border-t border-theme shrink-0 ${sidebarCollapsed ? "flex flex-col items-center" : ""}`}>
            {!sidebarCollapsed ? (
              <button
                onClick={logout}
                className="flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2 rounded-lg w-full text-red-600 dark:text-red-400 text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                خروج از سیستم
              </button>
            ) : (
              <button onClick={logout} title="خروج"
                className="hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

      {/* ── MAIN ── */}
      </aside>
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="top-0 z-30 sticky bg-theme-card border-b border-theme">
          <div className="flex items-center gap-3 px-4 py-2.5">
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
                  {idx > 0 && <ChevronLeft className="opacity-40 mx-0.5 w-3.5 h-3.5 text-theme-muted shrink-0" />}
                  <Link
                    href={c.href}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors shrink-0
                      ${idx === breadcrumbs.length - 1
                        ? "font-semibold text-theme-primary"
                        : "text-theme-muted hover:text-theme-secondary"
                      }`}
                  >
                    <c.Icon className="w-3.5 h-3.5" />
                    <span className="max-w-[8rem] text-xs sm:text-sm truncate">{c.label}</span>
                  </Link>
                </React.Fragment>
              ))}
            </nav>

            {/* Date display */}
            <div className="hidden sm:flex items-center gap-1.5 ms-auto text-theme-muted text-xs shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              {new Date().toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5 ms-auto sm:ms-3 shrink-0">

              {/* Theme toggle */}
              <button
                onClick={cycleTheme}
                className="flex justify-center items-center hover:bg-theme-hover p-1.5 rounded-lg text-theme-secondary transition-colors"
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
        <main className="flex-1 p-4 overflow-auto">
          <ToastProvider>
            {allowedPages === null ? (
              // Permissions still loading — don't render page content yet
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : accessDenied ? (
              <ForbiddenScreen pathname={pathname} />
            ) : (
              <div className="page-enter">{children}</div>
            )}
            <ChatWidget />
          </ToastProvider>
        </main>
      </div>
    </div>
    </MessagingProvider>
  );
}

/* ── Forbidden Screen ── */
function ForbiddenScreen({ pathname }: { pathname: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6" dir="rtl">
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
        <ShieldOff className="w-10 h-10 text-red-500 dark:text-red-400" />
      </div>
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold text-theme-primary mb-2">دسترسی مجاز نیست</h1>
        <p className="text-theme-muted text-sm leading-relaxed">
          شما مجاز به مشاهده این صفحه نیستید.
          <br />
          برای دسترسی به این بخش با مدیر سیستم تماس بگیرید.
        </p>
        <code className="inline-block mt-3 text-[11px] text-theme-muted font-mono bg-theme-hover px-2 py-1 rounded">{pathname}</code>
      </div>
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <LayoutDashboard className="w-4 h-4" />
        بازگشت به داشبورد
      </button>
    </div>
  );
}

/* ── Notification Bell ── */
function NotificationBell() {
  const messaging = useMessagingOptional();
  const unreadCount = messaging?.notifUnreadCount ?? 0;
  const [open, setOpen] = React.useState(false);
  const [recent, setRecent] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  const API = process.env.NEXT_PUBLIC_API_URL || "/api";
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const fetchRecent = React.useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/notifications/recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setRecent(data.rows ?? []);
        if (messaging) patch_notif(messaging, data.unreadCount);
      }
    } finally { setLoading(false); }
  }, [token, API]); // eslint-disable-line react-hooks/exhaustive-deps

  function patch_notif(m: any, count: number) {
    if (typeof m.refreshNotifCount === "function" && count !== undefined) {
      // side-effect: recount will fetch from API, but we already have it — just trigger refresh
    }
  }

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);

  React.useEffect(() => { if (open) fetchRecent(); }, [open, fetchRecent]);

  const markAllRead = async () => {
    if (!token) return;
    await fetch(`${API}/notifications/mark-all-read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setRecent(prev => prev.map(n => ({ ...n, isRead: true })));
    messaging?.refreshNotifCount();
  };

  const CATEGORY_COLORS: Record<string, string> = {
    SYSTEM: "bg-slate-500", TICKET: "bg-blue-500", APPROVAL: "bg-amber-500",
    HR: "bg-green-500", ATTENDANCE: "bg-purple-500", SECURITY: "bg-red-500",
    CHAT: "bg-pink-500", ANNOUNCEMENT: "bg-indigo-500", SUCCESS: "bg-emerald-500",
    WARNING: "bg-orange-500", ERROR: "bg-red-600", INFORMATION: "bg-cyan-500",
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso), now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diff < 1) return "همین الان";
    if (diff < 60) return `${diff} دقیقه پیش`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ساعت پیش`;
    return `${Math.floor(diff / 1440)} روز پیش`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex justify-center items-center hover:bg-theme-hover p-1.5 rounded-lg text-theme-secondary transition-colors"
        title="اعلان‌ها"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="top-0.5 right-0.5 absolute flex items-center justify-center bg-blue-500 rounded-full min-w-[14px] h-[14px] px-0.5 text-white text-[9px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-theme-card border border-theme rounded-xl shadow-xl z-50 overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-theme">
            <span className="font-semibold text-sm text-theme-primary">اعلان‌ها</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-500 hover:text-blue-600">
                  خواندن همه
                </button>
              )}
              <button
                onClick={() => { setOpen(false); router.push("/dashboard/notifications"); }}
                className="text-xs text-theme-muted hover:text-theme-secondary"
              >
                مشاهده همه
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-theme">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loading && recent.length === 0 && (
              <div className="py-8 text-center text-theme-muted text-sm">هیچ اعلانی وجود ندارد</div>
            )}
            {!loading && recent.map((n: any) => (
              <div
                key={n.id}
                className={`flex gap-2.5 px-3 py-2.5 hover:bg-theme-hover cursor-pointer transition-colors ${!n.isRead ? "bg-blue-500/5" : ""}`}
                onClick={() => {
                  if (n.link) { setOpen(false); router.push(n.link); }
                }}
              >
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[n.category] ?? "bg-slate-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs leading-snug ${!n.isRead ? "text-theme-primary font-medium" : "text-theme-secondary"}`}>
                    {n.title}
                  </p>
                  <p className="text-[11px] text-theme-muted mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-theme-muted mt-1">{fmtTime(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-theme px-3 py-2">
            <button
              onClick={() => { setOpen(false); router.push("/dashboard/notifications"); }}
              className="w-full text-center text-xs text-blue-500 hover:text-blue-600 py-0.5"
            >
              مشاهده مرکز اعلان‌ها ←
            </button>
          </div>
        </div>
      )}
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
        <div className="flex justify-center items-center bg-ai-gradient shadow rounded-full w-7 h-7 font-semibold text-white text-xs">
          {initial}
        </div>
        <span className="hidden sm:block max-w-[7rem] font-medium text-theme-primary text-sm truncate">{fullName}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="left-0 z-50 absolute bg-theme-card shadow-xl mt-1 border border-theme rounded-xl w-52 overflow-hidden"
          >
            <div className="px-4 py-3 border-theme border-b">
              <div className="font-semibold text-theme-primary text-sm truncate">{fullName}</div>
              {me?.phone && <div className="mt-0.5 text-theme-muted text-xs dir-ltr">{me.phone}</div>}
              {role && (
                <span className="inline-block bg-blue-100 dark:bg-blue-950/50 mt-1 px-2 py-0.5 rounded-full font-medium text-[11px] text-blue-700 dark:text-blue-300">
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
