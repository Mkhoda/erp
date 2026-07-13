"use client";
import React from "react";
import Link from "next/link";
import { Loader2, Plus, Filter, Download, AlertTriangle, Clock, CheckCircle2, RotateCcw, Search, Ticket } from "lucide-react";
import SearchSelect from "../../components/ui/SearchSelect";
import { useToast } from "../../components/ui/Toast";

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
const faTime = (s: string) => new Date(s).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });
const fmtMin = (m: number) => {
  if (!m) return "—";
  const h = Math.floor(m / 60), mn = m % 60;
  return `${faNum(h)}:${String(mn).padStart(2, "0")}`;
};

function StatCard({ label, value, cls }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
      <div className={`text-xl font-bold ${cls ?? "text-theme-primary"}`}>{typeof value === "number" ? faNum(value) : value}</div>
      <div className="text-[11px] text-theme-muted mt-0.5">{label}</div>
    </div>
  );
}

export default function TicketsPage() {
  React.useEffect(() => { document.title = "تیکت‌ها | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const toast = useToast();

  const [rows, setRows] = React.useState<any[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const pageSize = 50;

  // Filters
  const [search, setSearch] = React.useState("");
  const [deptId, setDeptId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [overSla, setOverSla] = React.useState("");

  // Stats derived from current rows
  const stats = React.useMemo(() => {
    const open = rows.filter(r => ["OPEN","ASSIGNED","IN_PROGRESS","USER_REPLIED","REOPENED"].includes(r.status)).length;
    const overSlaCount = rows.filter(r => r.isOverSla).length;
    const resolved = rows.filter(r => r.status === "RESOLVED" || r.status === "CLOSED").length;
    return { open, overSlaCount, resolved };
  }, [rows]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (search) params.set("search", search);
      if (deptId) params.set("departmentId", deptId);
      if (categoryId) params.set("categoryId", categoryId);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (assigneeId) params.set("assigneeId", assigneeId);
      if (overSla === "true") params.set("isOverSla", "true");

      const res = await fetch(`${API}/tickets?${params}`, { headers: h });
      if (!res.ok) { toast.error("خطا در دریافت تیکت‌ها"); return; }
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, deptId, categoryId, status, priority, assigneeId, overSla]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    Promise.all([
      fetch(`${API}/tickets/config/enabled`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([cfgs, us]) => {
      setDepartments(cfgs.map((c: any) => ({ id: c.department.id, name: c.department.name })));
      setCategories(cfgs.flatMap((c: any) => c.categories?.map((cat: any) => ({ id: cat.id, name: `${c.department.name} — ${cat.name}` })) ?? []));
      setUsers(Array.isArray(us) ? us : (us.data ?? []));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Ticket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">همه تیکت‌ها</h1>
            <p className="text-sm text-theme-muted">{faNum(total)} تیکت</p>
          </div>
        </div>
        <Link href="/dashboard/tickets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus className="w-4 h-4" /> تیکت جدید
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="باز" value={stats.open} cls="text-blue-600" />
        <StatCard label="تأخیر SLA" value={stats.overSlaCount} cls="text-red-600" />
        <StatCard label="حل‌شده" value={stats.resolved} cls="text-green-600" />
      </div>

      {/* Filters */}
      <div className="bg-theme-card border border-theme rounded-xl p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
        <div className="col-span-2 lg:col-span-2 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input
            className="input-theme text-sm pr-9 w-full" placeholder="جستجو (شماره، توضیحات...)"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <SearchSelect options={departments} value={deptId} onChange={v => { setDeptId(v); setCategoryId(""); setPage(1); }} emptyLabel="همه دپارتمان‌ها" placeholder="دپارتمان" />
        <select className="input-theme text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input-theme text-sm" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
          <option value="">همه اولویت‌ها</option>
          {Object.entries(PRIORITY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <SearchSelect options={users} value={assigneeId} onChange={v => { setAssigneeId(v); setPage(1); }}
          emptyLabel="همه مسئولین" displayKey="firstName" searchKey="lastName"
          placeholder="مسئول پیگیری" />
        <select className="input-theme text-sm" value={overSla} onChange={e => { setOverSla(e.target.value); setPage(1); }}>
          <option value="">وضعیت SLA</option>
          <option value="true">تأخیر دارد</option>
          <option value="false">در موعد</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="text-theme-muted border-b border-theme bg-theme-secondary/30">
                  <th className="py-2 px-3 font-medium text-right">شماره / موضوع</th>
                  <th className="px-3 font-medium">دپارتمان</th>
                  <th className="px-3 font-medium">وضعیت</th>
                  <th className="px-3 font-medium">اولویت</th>
                  <th className="px-3 font-medium">درخواست‌دهنده</th>
                  <th className="px-3 font-medium">مسئول</th>
                  <th className="px-3 font-medium">SLA</th>
                  <th className="px-3 font-medium">تاریخ</th>
                  <th className="px-3 font-medium">پیام‌ها</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="py-12 text-theme-muted">تیکتی یافت نشد</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className={`border-b border-theme/40 hover:bg-theme-hover transition-colors ${r.isOverSla ? "bg-red-500/5" : ""}`}>
                    <td className="py-2 px-3 text-right">
                      <Link href={`/dashboard/tickets/${r.id}`} className="group">
                        <div className="flex items-center gap-2">
                          {r.isOverSla && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          <div>
                            <div className="text-xs text-theme-muted font-mono">#{faNum(r.number)}</div>
                            <div className="text-theme-primary font-medium group-hover:text-blue-600 truncate max-w-48">{r.category?.name ?? "—"}</div>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 text-theme-secondary">{r.department?.name ?? "—"}</td>
                    <td className="px-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] ?? ""}`}>
                        {STATUS_FA[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className={`px-3 text-xs font-medium ${PRIORITY_CLS[r.priority] ?? ""}`}>{PRIORITY_FA[r.priority] ?? r.priority}</td>
                    <td className="px-3 text-theme-secondary text-xs">
                      {r.requester ? `${r.requester.firstName} ${r.requester.lastName}` : "—"}
                    </td>
                    <td className="px-3 text-theme-secondary text-xs">
                      {r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : <span className="text-theme-muted">تخصیص نیافته</span>}
                    </td>
                    <td className="px-3">
                      {r.slaMetric ? (
                        <div className="text-xs">
                          {r.slaMetric.resolutionBreached
                            ? <span className="text-red-600 font-medium flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> تأخیر</span>
                            : <span className="text-green-600 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> در موعد</span>
                          }
                          {r.slaMetric.resolutionDueAt && (
                            <div className="text-theme-muted mt-0.5">{faDate(r.slaMetric.resolutionDueAt)}</div>
                          )}
                        </div>
                      ) : <span className="text-theme-muted text-xs">—</span>}
                    </td>
                    <td className="px-3 text-xs text-theme-muted">
                      <div>{faDate(r.createdAt)}</div>
                      <div>{faTime(r.createdAt)}</div>
                    </td>
                    <td className="px-3 text-theme-secondary">{faNum(r._count?.comments ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-theme text-sm">
            <span className="text-theme-muted text-xs">{faNum(total)} تیکت</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40 text-theme-primary text-xs">قبلی</button>
              <span className="text-theme-muted text-xs">صفحه {faNum(page)} از {faNum(totalPages)}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40 text-theme-primary text-xs">بعدی</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
