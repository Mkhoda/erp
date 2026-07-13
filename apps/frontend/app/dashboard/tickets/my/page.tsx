"use client";
import React from "react";
import Link from "next/link";
import { Loader2, Plus, AlertTriangle, CheckCircle2, Search, TicketCheck } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_FA: Record<string, string> = {
  OPEN: "باز", ASSIGNED: "تخصیص‌یافته", IN_PROGRESS: "در جریان",
  WAITING_USER: "منتظر کاربر", USER_REPLIED: "پاسخ کاربر", RESOLVED: "حل‌شده",
  CLOSED: "بسته", CANCELLED: "لغو", REJECTED: "رد", REOPENED: "بازگشایی",
};
const STATUS_CLS: Record<string, string> = {
  OPEN: "bg-blue-500/15 text-blue-600",
  ASSIGNED: "bg-indigo-500/15 text-indigo-600",
  IN_PROGRESS: "bg-violet-500/15 text-violet-600",
  WAITING_USER: "bg-amber-500/15 text-amber-600",
  USER_REPLIED: "bg-cyan-500/15 text-cyan-600",
  RESOLVED: "bg-green-500/15 text-green-600",
  CLOSED: "bg-slate-400/15 text-slate-500",
  CANCELLED: "bg-red-400/15 text-red-500",
  REJECTED: "bg-red-600/15 text-red-700",
  REOPENED: "bg-orange-500/15 text-orange-600",
};
const PRIORITY_FA: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "بالا", CRITICAL: "بحرانی" };
const PRIORITY_CLS: Record<string, string> = {
  LOW: "text-slate-500", MEDIUM: "text-blue-600", HIGH: "text-amber-600", CRITICAL: "text-red-600 font-bold",
};
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const faDate = (s: string) => new Date(s).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });

export default function MyTicketsPage() {
  React.useEffect(() => { document.title = "تیکت‌های من | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const toast = useToast();

  const [rows, setRows] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const pageSize = 25;

  // Filters
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await fetch(`${API}/tickets/my?${params}`, { headers: h });
      if (!res.ok) { toast.error("خطا در دریافت تیکت‌ها"); return; }
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);

  React.useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const openCount = rows.filter(r => ["OPEN","ASSIGNED","IN_PROGRESS","USER_REPLIED","REOPENED","WAITING_USER"].includes(r.status)).length;
  const waitingReply = rows.filter(r => r.status === "WAITING_USER").length;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <TicketCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">تیکت‌های من</h1>
            <p className="text-sm text-theme-muted">{faNum(total)} تیکت</p>
          </div>
        </div>
        <Link href="/dashboard/tickets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus className="w-4 h-4" /> تیکت جدید
        </Link>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{faNum(openCount)}</div>
          <div className="text-xs text-theme-muted mt-0.5">باز</div>
        </div>
        <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-amber-600">{faNum(waitingReply)}</div>
          <div className="text-xs text-theme-muted mt-0.5">منتظر پاسخ شما</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-card border border-theme rounded-xl p-3 flex flex-wrap gap-2">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input className="input-theme text-sm pr-9 w-full" placeholder="جستجو..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input-theme text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-theme-muted">
            <TicketCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>تیکتی یافت نشد</p>
            <Link href="/dashboard/tickets/new" className="inline-block mt-3 text-blue-600 text-sm hover:underline">ثبت تیکت جدید</Link>
          </div>
        ) : (
          <div className="divide-y divide-theme/40">
            {rows.map(r => (
              <Link key={r.id} href={`/dashboard/tickets/${r.id}`}
                className={`block px-4 py-3 hover:bg-theme-hover transition-colors ${r.status === "WAITING_USER" ? "border-r-2 border-amber-500" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-theme-muted">#{faNum(r.number)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] ?? ""}`}>{STATUS_FA[r.status] ?? r.status}</span>
                      <span className={`text-xs font-medium ${PRIORITY_CLS[r.priority] ?? ""}`}>{PRIORITY_FA[r.priority] ?? r.priority}</span>
                      {r.status === "WAITING_USER" && (
                        <span className="text-xs text-amber-600 font-medium">⚠ منتظر پاسخ شما</span>
                      )}
                    </div>
                    <div className="mt-1 font-medium text-theme-primary truncate">{r.category?.name ?? "—"}</div>
                    <div className="mt-0.5 text-xs text-theme-muted flex items-center gap-3">
                      <span>{r.department?.name ?? "—"}</span>
                      <span>{faDate(r.createdAt)}</span>
                      {(r._count?.comments ?? 0) > 0 && <span>{faNum(r._count.comments)} پیام</span>}
                    </div>
                  </div>
                  {r.slaMetric?.resolutionBreached && (
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-1" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-theme text-xs text-theme-muted">
            <span>{faNum(total)} تیکت</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40">قبلی</button>
              <span>صفحه {faNum(page)} از {faNum(totalPages)}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40">بعدی</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
