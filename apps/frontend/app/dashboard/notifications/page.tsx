"use client";
import React from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Search, Filter, CheckCheck, Archive, Pin, Trash2,
  ChevronRight, ChevronLeft, RefreshCw, X, AlertCircle,
  Info, CheckCircle, AlertTriangle, Zap, Calendar, Ticket,
  UserCheck, Clock, Shield, MessageCircle, Megaphone,
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import { useMessagingOptional } from "../../../lib/messaging";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const CATEGORY_FA: Record<string, string> = {
  SYSTEM: "سیستم", TICKET: "تیکت", WORKFLOW: "گردش‌کار", APPROVAL: "تایید",
  HR: "منابع انسانی", FINANCE: "مالی", IT: "فناوری اطلاعات", ATTENDANCE: "حضور و غیاب",
  SECURITY: "امنیت", CHAT: "پیام‌رسانی", REMINDER: "یادآوری", INFORMATION: "اطلاعات",
  WARNING: "هشدار", SUCCESS: "موفق", ERROR: "خطا", ANNOUNCEMENT: "اطلاعیه",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  SYSTEM: Bell, TICKET: Ticket, APPROVAL: UserCheck, HR: UserCheck,
  ATTENDANCE: Clock, SECURITY: Shield, CHAT: MessageCircle, ANNOUNCEMENT: Megaphone,
  WARNING: AlertTriangle, SUCCESS: CheckCircle, ERROR: AlertCircle, INFORMATION: Info,
  REMINDER: Calendar, WORKFLOW: Zap, FINANCE: Zap, IT: Zap,
};

const CATEGORY_COLORS: Record<string, string> = {
  SYSTEM: "text-slate-500 bg-slate-100 dark:bg-slate-800",
  TICKET: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
  APPROVAL: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  HR: "text-green-600 bg-green-50 dark:bg-green-950/40",
  ATTENDANCE: "text-purple-600 bg-purple-50 dark:bg-purple-950/40",
  SECURITY: "text-red-600 bg-red-50 dark:bg-red-950/40",
  CHAT: "text-pink-600 bg-pink-50 dark:bg-pink-950/40",
  ANNOUNCEMENT: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
  WARNING: "text-orange-600 bg-orange-50 dark:bg-orange-950/40",
  SUCCESS: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  ERROR: "text-red-700 bg-red-50 dark:bg-red-950/40",
  INFORMATION: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40",
  REMINDER: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
};

const PRIORITY_FA: Record<string, string> = {
  CRITICAL: "بحرانی", HIGH: "بالا", NORMAL: "عادی", LOW: "کم", INFO: "اطلاعات",
};
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-700 bg-red-100 dark:bg-red-950/50",
  HIGH: "text-orange-600 bg-orange-100 dark:bg-orange-950/40",
  NORMAL: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  LOW: "text-slate-500 bg-slate-100 dark:bg-slate-800",
  INFO: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30",
};

const CATEGORIES = Object.keys(CATEGORY_FA);

function fmtTime(iso: string) {
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return "همین الان";
  if (diff < 60) return `${diff} دقیقه پیش`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ساعت پیش`;
  return `${Math.floor(diff / 1440)} روز پیش`;
}

export default function NotificationsPage() {
  React.useEffect(() => { document.title = "مرکز اعلان‌ها | Arzesh"; }, []);
  const router = useRouter();
  const toast = useToast();
  const messaging = useMessagingOptional();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };

  const [rows, setRows] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const limit = 20;

  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [isRead, setIsRead] = React.useState<string>("");
  const [isArchived, setIsArchived] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async (p = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (isRead !== "") params.set("isRead", isRead);
      if (isArchived) params.set("isArchived", "true");
      if (isPinned) params.set("isPinned", "true");

      const r = await fetch(`${API}/notifications?${params}`, { headers: h as any });
      if (!r.ok) return;
      const data = await r.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, category, isRead, isArchived, isPinned]);

  React.useEffect(() => { setPage(1); load(1); }, [load]);

  const markRead = async (ids: string[]) => {
    await fetch(`${API}/notifications/mark-read`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" } as any,
      body: JSON.stringify({ ids }),
    });
    setRows(prev => prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n));
    messaging?.refreshNotifCount();
  };

  const markAllRead = async () => {
    await fetch(`${API}/notifications/mark-all-read`, { method: "POST", headers: h as any });
    setRows(prev => prev.map(n => ({ ...n, isRead: true })));
    messaging?.refreshNotifCount();
    toast.success("همه اعلان‌ها خوانده شدند");
  };

  const toggleArchive = async (id: string) => {
    await fetch(`${API}/notifications/${id}/archive`, { method: "PATCH", headers: h as any });
    setRows(prev => isArchived
      ? prev.filter(n => n.id !== id)
      : prev.map(n => n.id === id ? { ...n, isArchived: !n.isArchived } : n)
    );
  };

  const togglePin = async (id: string) => {
    await fetch(`${API}/notifications/${id}/pin`, { method: "PATCH", headers: h as any });
    setRows(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const deleteOne = async (id: string) => {
    await fetch(`${API}/notifications/${id}`, { method: "DELETE", headers: h as any });
    setRows(prev => prev.filter(n => n.id !== id));
    setTotal(t => t - 1);
    toast.success("اعلان حذف شد");
  };

  const deleteRead = async () => {
    await fetch(`${API}/notifications/read`, { method: "DELETE", headers: h as any });
    load(1);
    toast.success("اعلان‌های خوانده شده حذف شدند");
  };

  const markSelectedRead = () => {
    if (selected.size === 0) return;
    markRead(Array.from(selected));
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  };

  const unreadCount = rows.filter(r => !r.isRead).length;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-3xl mx-auto p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-theme-primary">مرکز اعلان‌ها</h1>
          <p className="text-sm text-theme-muted">
            {total > 0 ? `${total} اعلان` : "هیچ اعلانی"}{unreadCount > 0 ? ` · ${unreadCount} خوانده نشده` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(page)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary text-sm hover:bg-theme-hover"
          >
            <RefreshCw className="w-3.5 h-3.5" /> بازخوانی
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
              <CheckCheck className="w-3.5 h-3.5" /> خواندن همه
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-card border border-theme rounded-xl p-3 mb-4 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
          <input
            className="input-theme w-full pr-9 text-sm"
            placeholder="جستجو در اعلان‌ها..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-theme-muted" /></button>}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          <select className="input-theme text-sm py-1.5" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">همه دسته‌ها</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_FA[c]}</option>)}
          </select>
          <select className="input-theme text-sm py-1.5" value={isRead} onChange={e => setIsRead(e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            <option value="false">خوانده نشده</option>
            <option value="true">خوانده شده</option>
          </select>
          <button
            onClick={() => setIsPinned(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${isPinned ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}
          >
            <Pin className="w-3.5 h-3.5" /> سنجاق‌شده
          </button>
          <button
            onClick={() => setIsArchived(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${isArchived ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}
          >
            <Archive className="w-3.5 h-3.5" /> آرشیو
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-blue-600 text-white rounded-xl px-3 py-2 mb-3 flex items-center gap-3 text-sm">
          <span>{selected.size} مورد انتخاب شده</span>
          <button onClick={markSelectedRead} className="flex items-center gap-1 underline hover:no-underline">
            <CheckCheck className="w-3.5 h-3.5" /> خواندن
          </button>
          <button onClick={() => setSelected(new Set())} className="mr-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {/* List header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-theme">
          <input type="checkbox"
            checked={rows.length > 0 && selected.size === rows.length}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded"
          />
          <span className="text-xs text-theme-muted">
            {loading ? "در حال بارگذاری..." : `${rows.length} اعلان`}
          </span>
          <div className="mr-auto flex items-center gap-2">
            <button onClick={deleteRead} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> حذف خوانده‌ها
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="py-16 text-center">
            <Bell className="w-10 h-10 text-theme-muted mx-auto mb-3 opacity-40" />
            <p className="text-theme-muted text-sm">هیچ اعلانی پیدا نشد</p>
          </div>
        )}

        {!loading && rows.map((n: any) => {
          const Icon = CATEGORY_ICONS[n.category] ?? Bell;
          const iconCls = CATEGORY_COLORS[n.category] ?? "text-slate-500 bg-slate-100";
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-3 py-3 border-b border-theme last:border-0 hover:bg-theme-hover transition-colors group ${!n.isRead ? "bg-blue-500/[0.03]" : ""}`}
            >
              <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleSelect(n.id)}
                className="mt-1 w-3.5 h-3.5 rounded shrink-0" onClick={e => e.stopPropagation()} />

              <div className={`p-1.5 rounded-lg shrink-0 ${iconCls}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>

              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  if (!n.isRead) markRead([n.id]);
                  if (n.link) router.push(n.link);
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-theme-primary" : "text-theme-secondary"}`}>
                    {n.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[n.priority] ?? ""}`}>
                    {PRIORITY_FA[n.priority]}
                  </span>
                  {n.isPinned && <Pin className="w-3 h-3 text-amber-500" />}
                </div>
                <p className="text-xs text-theme-muted mt-0.5 line-clamp-2">{n.body}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-theme-muted">{CATEGORY_FA[n.category] ?? n.category}</span>
                  <span className="text-[10px] text-theme-muted">·</span>
                  <span className="text-[10px] text-theme-muted">{fmtTime(n.createdAt)}</span>
                  {n.sourceModule && <><span className="text-[10px] text-theme-muted">·</span><span className="text-[10px] text-theme-muted">از: {n.sourceModule}</span></>}
                </div>
              </div>

              {/* Actions - visible on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {!n.isRead && (
                  <button onClick={() => markRead([n.id])} title="علامت خوانده"
                    className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-blue-500">
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => togglePin(n.id)} title={n.isPinned ? "برداشتن سنجاق" : "سنجاق کردن"}
                  className={`p-1 rounded hover:bg-theme-hover ${n.isPinned ? "text-amber-500" : "text-theme-muted hover:text-amber-500"}`}>
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleArchive(n.id)} title={n.isArchived ? "خروج از آرشیو" : "آرشیو"}
                  className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-theme-secondary">
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteOne(n.id)} title="حذف"
                  className="p-1 rounded hover:bg-theme-hover text-theme-muted hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {!n.isRead && <span className="mt-2 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => { setPage(p => p + 1); load(page + 1); }} disabled={page >= totalPages}
            className="p-2 rounded-lg border border-theme text-theme-secondary hover:bg-theme-hover disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-theme-muted">صفحه {page} از {totalPages}</span>
          <button onClick={() => { setPage(p => p - 1); load(page - 1); }} disabled={page <= 1}
            className="p-2 rounded-lg border border-theme text-theme-secondary hover:bg-theme-hover disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
