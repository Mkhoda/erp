"use client";
import React from "react";
import {
  Monitor, Smartphone, Tablet, Globe, RefreshCw,
  Shield, ShieldOff, Wifi, WifiOff, Trash2,
  LogOut, AlertTriangle, Search, ChevronLeft, ChevronRight,
  Clock, MapPin, Bot,
} from "lucide-react";
import { useToast } from "../../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function faNum(n: number | string) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "همین الان";
  if (s < 3600) return `${faNum(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${faNum(Math.floor(s / 3600))} ساعت پیش`;
  return `${faNum(Math.floor(s / 86400))} روز پیش`;
}

function isOnline(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "short", day: "numeric" });
}

type DeviceKind = "desktop" | "mobile" | "tablet" | "bot" | null;

function DeviceIcon({ type, className }: { type: DeviceKind; className?: string }) {
  const cls = className || "w-5 h-5";
  if (type === "mobile") return <Smartphone className={cls} />;
  if (type === "tablet") return <Tablet className={cls} />;
  if (type === "bot") return <Bot className={cls} />;
  return <Monitor className={cls} />;
}

type Session = {
  id: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; role: string };
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ipAddress: string | null;
  deviceType: DeviceKind;
  deviceModel: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  authMethod: string;
  rememberMe: boolean;
  isRevoked: boolean;
  revokedAt: string | null;
};

type Stats = { active: number; online: number; totalRevoked: number };

const ROLE_FA: Record<string, string> = {
  ADMIN: "ادمین", MANAGER: "مدیر", EXPERT: "کارشناس", USER: "کاربر",
};
const ROLE_CLS: Record<string, string> = {
  ADMIN: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  MANAGER: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  EXPERT: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  USER: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border border-theme ${bg}`}>
      <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-theme-primary">{value}</p>
        <p className="text-xs text-theme-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function SessionRow({
  session: s, revoking, onRevoke,
}: { session: Session; revoking: boolean; onRevoke: () => void }) {
  const online = isOnline(s.lastSeenAt);
  const deviceLabel = [s.browser, s.browserVersion].filter(Boolean).join(" ");

  return (
    <tr className="hover:bg-theme-hover/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
              {s.user.firstName[0]}{s.user.lastName[0]}
            </span>
          </div>
          <div>
            <p className="font-medium text-theme-primary text-sm leading-tight">
              {s.user.firstName} {s.user.lastName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_CLS[s.user.role] || ROLE_CLS.USER}`}>
                {ROLE_FA[s.user.role] || s.user.role}
              </span>
              {s.rememberMe && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                  مرا به خاطر بسپار
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <DeviceIcon type={s.deviceType} className="w-4 h-4 text-theme-muted flex-shrink-0" />
          <div>
            <p className="text-theme-primary text-sm leading-tight">{deviceLabel || "—"}</p>
            <p className="text-xs text-theme-muted">{s.os || "—"}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-theme-muted text-sm">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-mono text-xs">{s.ipAddress || "—"}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
          <span className="text-sm text-theme-secondary">{relativeTime(s.lastSeenAt)}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className="text-xs text-theme-muted">{formatExpiry(s.expiresAt)}</span>
      </td>

      <td className="px-4 py-3">
        {s.isRevoked ? (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            <ShieldOff className="w-3 h-3" /> لغو شده
          </span>
        ) : online ? (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
            <Wifi className="w-3 h-3" /> آنلاین
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3" /> غیرفعال
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {!s.isRevoked && (
          <button
            onClick={onRevoke}
            disabled={revoking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-xs transition-colors disabled:opacity-50"
          >
            {revoking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            لغو
          </button>
        )}
      </td>
    </tr>
  );
}

function ConfirmDialog({
  title, message, icon, confirmLabel, confirmCls, onConfirm, onCancel,
}: {
  title: string; message: string; icon: React.ReactNode;
  confirmLabel: string; confirmCls: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-theme-card border border-theme rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="font-bold text-theme-primary text-lg">{title}</h3>
        </div>
        <p className="text-sm text-theme-secondary leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onConfirm} className={`flex-1 py-2 rounded-xl font-medium text-sm transition-colors ${confirmCls}`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl font-medium text-sm border border-theme hover:bg-theme-hover text-theme-secondary transition-colors">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const toast = useToast();
  const [stats, setStats] = React.useState<Stats>({ active: 0, online: 0, totalRevoked: 0 });
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [onlineOnly, setOnlineOnly] = React.useState(false);
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const [confirmAll, setConfirmAll] = React.useState(false);
  const [confirmForce, setConfirmForce] = React.useState(false);

  async function loadStats() {
    const r = await fetch(`${API}/sessions/stats`, { headers: authHeaders() });
    if (r.ok) setStats(await r.json());
  }

  async function loadSessions(p = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "15", ...(onlineOnly ? { onlineOnly: "true" } : {}) });
      const r = await fetch(`${API}/sessions?${params}`, { headers: authHeaders() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(p);
    } catch {
      toast.error("خطا در بارگذاری نشست‌ها");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadStats();
    loadSessions(1);
  }, [onlineOnly]);

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      const r = await fetch(`${API}/sessions/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error();
      toast.success("نشست با موفقیت لغو شد");
      await Promise.all([loadStats(), loadSessions(page)]);
    } catch {
      toast.error("خطا در لغو نشست");
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAll() {
    setConfirmAll(false);
    try {
      const r = await fetch(`${API}/sessions/revoke-all`, { method: "POST", headers: authHeaders() });
      if (!r.ok) throw new Error();
      toast.success("تمام نشست‌های فعال لغو شدند");
      await Promise.all([loadStats(), loadSessions(1)]);
    } catch {
      toast.error("خطا در لغو نشست‌ها");
    }
  }

  async function forceGlobalLogout() {
    setConfirmForce(false);
    try {
      const r = await fetch(`${API}/auth-settings/force-logout`, { method: "POST", headers: authHeaders() });
      if (!r.ok) throw new Error();
      toast.success("توکن سراسری باطل شد — همه کاربران باید مجدداً وارد شوند");
      await Promise.all([loadStats(), loadSessions(1)]);
    } catch {
      toast.error("خطا در خروج اجباری سراسری");
    }
  }

  const filtered = search.trim()
    ? sessions.filter((s) => {
        const q = search.toLowerCase();
        return (
          (s.user.firstName + " " + s.user.lastName).toLowerCase().includes(q) ||
          s.user.email?.toLowerCase().includes(q) ||
          s.user.phone?.includes(q) ||
          s.ipAddress?.includes(q) ||
          s.browser?.toLowerCase().includes(q) ||
          s.os?.toLowerCase().includes(q)
        );
      })
    : sessions;

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-theme-primary text-xl">مدیریت نشست‌ها</h1>
          <p className="mt-0.5 text-sm text-theme-muted">نشست‌های فعال کاربران را مشاهده و مدیریت کنید</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setConfirmForce(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-sm font-medium transition-colors"
          >
            <ShieldOff className="w-4 h-4" />
            خروج اجباری سراسری
          </button>
          <button
            onClick={() => setConfirmAll(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            لغو تمام نشست‌ها
          </button>
          <button
            onClick={() => { loadStats(); loadSessions(page); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-theme bg-theme-card hover:bg-theme-hover text-theme-secondary text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Shield className="w-5 h-5 text-blue-500" />}
          label="نشست‌های فعال"
          value={faNum(stats.active)}
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          icon={<Wifi className="w-5 h-5 text-emerald-500" />}
          label="آنلاین (۵ دقیقه اخیر)"
          value={faNum(stats.online)}
          bg="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <StatCard
          icon={<WifiOff className="w-5 h-5 text-slate-400" />}
          label="کل نشست‌های لغو شده"
          value={faNum(stats.totalRevoked)}
          bg="bg-slate-50 dark:bg-slate-800/50"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو: نام، ایمیل، IP، مرورگر، سیستم‌عامل..."
            className="input-theme pr-10 w-full text-sm"
          />
        </div>
        <label className="flex items-center gap-2 px-4 py-2 bg-theme-card border border-theme rounded-xl cursor-pointer select-none text-sm text-theme-secondary whitespace-nowrap">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} className="accent-blue-600 w-4 h-4" />
          فقط آنلاین
        </label>
      </div>

      {/* Table */}
      <div className="bg-theme-card border border-theme rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-theme bg-theme-secondary/5">
                {["کاربر", "دستگاه / مرورگر", "آدرس IP", "آخرین فعالیت", "انقضا", "وضعیت", "عملیات"].map((h) => (
                  <th key={h} className="text-right px-4 py-3 font-semibold text-theme-muted text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-theme-muted"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-theme-muted">نشستی یافت نشد</td></tr>
              ) : (
                filtered.map((s) => (
                  <SessionRow key={s.id} session={s} revoking={revoking === s.id} onRevoke={() => revokeSession(s.id)} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-theme">
            <span className="text-sm text-theme-muted">
              {faNum(total)} نشست — صفحه {faNum(page)} از {faNum(pages)}
            </span>
            <div className="flex gap-1">
              <button onClick={() => loadSessions(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg border border-theme hover:bg-theme-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4 text-theme-secondary" />
              </button>
              <button onClick={() => loadSessions(page + 1)} disabled={page >= pages} className="p-1.5 rounded-lg border border-theme hover:bg-theme-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4 text-theme-secondary" />
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmAll && (
        <ConfirmDialog
          title="لغو تمام نشست‌ها"
          message="تمام نشست‌های فعال لغو خواهند شد. کاربران باید مجدداً وارد شوند. ادامه می‌دهید؟"
          icon={<LogOut className="w-6 h-6 text-orange-500" />}
          confirmLabel="بله، لغو کن"
          confirmCls="bg-orange-600 hover:bg-orange-700 text-white"
          onConfirm={revokeAll}
          onCancel={() => setConfirmAll(false)}
        />
      )}

      {confirmForce && (
        <ConfirmDialog
          title="خروج اجباری سراسری"
          message="نسخه توکن سراسری افزایش می‌یابد. تمام توکن‌های صادر شده فوراً باطل می‌شوند — حتی کاربرانی که نشست فعال دارند. این عملیات قابل بازگشت نیست."
          icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
          confirmLabel="بله، باطل کن"
          confirmCls="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={forceGlobalLogout}
          onCancel={() => setConfirmForce(false)}
        />
      )}
    </div>
  );
}
