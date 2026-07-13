"use client";
import React from "react";
import Link from "next/link";
import { Loader2, Plus, AlertTriangle, Search, TicketCheck, Users, Inbox } from "lucide-react";
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

function getUserRole(): string {
  if (typeof window === "undefined") return "USER";
  try {
    const token = localStorage.getItem("token");
    if (!token) return "USER";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? "USER";
  } catch { return "USER"; }
}

type TicketRow = any;

function TicketList({ rows, loading }: { rows: TicketRow[]; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-theme-muted">
        <TicketCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>تیکتی یافت نشد</p>
      </div>
    );
  }
  return (
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
                  <span className="text-xs text-amber-600 font-medium">⚠ منتظر پاسخ</span>
                )}
              </div>
              <div className="mt-1 font-medium text-theme-primary truncate">{r.category?.name ?? "—"}</div>
              <div className="mt-0.5 text-xs text-theme-muted flex items-center gap-3 flex-wrap">
                <span>{r.department?.name ?? "—"}</span>
                <span>{faDate(r.createdAt)}</span>
                {r.requester && <span className="text-theme-muted">از: {r.requester.firstName} {r.requester.lastName}</span>}
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
  );
}

export default function MyTicketsPage() {
  React.useEffect(() => { document.title = "تیکت‌های من | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const toast = useToast();

  const role = React.useMemo(() => getUserRole(), []);
  const isManager = role === "MANAGER" || role === "ADMIN";

  // "my" tab: own submitted tickets (for all users + managers)
  const [myRows, setMyRows] = React.useState<TicketRow[]>([]);
  const [myTotal, setMyTotal] = React.useState(0);
  const [myLoading, setMyLoading] = React.useState(true);
  const [myPage, setMyPage] = React.useState(1);
  const [mySearch, setMySearch] = React.useState("");
  const [myStatus, setMyStatus] = React.useState("");

  // "dept" tab: dept's tickets (managers only — fetches /tickets with role filtering)
  const [deptRows, setDeptRows] = React.useState<TicketRow[]>([]);
  const [deptTotal, setDeptTotal] = React.useState(0);
  const [deptLoading, setDeptLoading] = React.useState(false);
  const [deptPage, setDeptPage] = React.useState(1);
  const [deptSearch, setDeptSearch] = React.useState("");
  const [deptStatus, setDeptStatus] = React.useState("");

  const [activeTab, setActiveTab] = React.useState<"my" | "dept">("my");
  const pageSize = 25;

  const loadMy = React.useCallback(async () => {
    setMyLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(myPage));
      params.set("limit", String(pageSize));
      // For managers on the "my" tab, we want ONLY their own submitted tickets
      // So we call /tickets (not /tickets/my which now returns dept tickets for managers)
      if (mySearch) params.set("search", mySearch);
      if (myStatus) params.set("status", myStatus);
      // Force own requesterId if manager, so they see their submitted tickets on this tab
      if (isManager && token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          params.set("requesterId", payload.sub);
        } catch {}
      }
      const endpoint = isManager ? `${API}/tickets?${params}` : `${API}/tickets/my?${params}`;
      const res = await fetch(endpoint, { headers: h });
      if (!res.ok) { toast.error("خطا در دریافت تیکت‌ها"); return; }
      const data = await res.json();
      setMyRows(data.rows ?? []);
      setMyTotal(data.total ?? 0);
    } finally { setMyLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPage, mySearch, myStatus, isManager]);

  const loadDept = React.useCallback(async () => {
    if (!isManager) return;
    setDeptLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(deptPage));
      params.set("limit", String(pageSize));
      if (deptSearch) params.set("search", deptSearch);
      if (deptStatus) params.set("status", deptStatus);
      const res = await fetch(`${API}/tickets/my?${params}`, { headers: h });
      if (!res.ok) { toast.error("خطا در دریافت تیکت‌های دپارتمان"); return; }
      const data = await res.json();
      setDeptRows(data.rows ?? []);
      setDeptTotal(data.total ?? 0);
    } finally { setDeptLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptPage, deptSearch, deptStatus, isManager]);

  React.useEffect(() => { loadMy(); }, [loadMy]);
  React.useEffect(() => {
    if (isManager && activeTab === "dept" && deptRows.length === 0 && !deptLoading) {
      loadDept();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isManager]);
  React.useEffect(() => { if (activeTab === "dept") loadDept(); }, [loadDept, activeTab]);

  const myPageCount = Math.max(1, Math.ceil(myTotal / pageSize));
  const deptPageCount = Math.max(1, Math.ceil(deptTotal / pageSize));
  const openCount = myRows.filter(r => ["OPEN","ASSIGNED","IN_PROGRESS","USER_REPLIED","REOPENED","WAITING_USER"].includes(r.status)).length;
  const waitingReply = myRows.filter(r => r.status === "WAITING_USER").length;
  const openDept = deptRows.filter(r => ["OPEN","ASSIGNED","IN_PROGRESS","USER_REPLIED","REOPENED"].includes(r.status)).length;

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
            <p className="text-sm text-theme-muted">{isManager ? "مدیریت درخواست‌ها" : `${faNum(myTotal)} تیکت`}</p>
          </div>
        </div>
        <Link href="/dashboard/tickets/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
          <Plus className="w-4 h-4" /> تیکت جدید
        </Link>
      </div>

      {/* Tabs — only for manager/admin */}
      {isManager && (
        <div className="flex gap-1 bg-theme-card border border-theme rounded-xl p-1">
          <button onClick={() => setActiveTab("my")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors ${activeTab === "my" ? "bg-blue-600 text-white" : "text-theme-secondary hover:bg-theme-hover"}`}>
            <Inbox className="w-4 h-4" />
            تیکت‌های ثبتی من
            {myTotal > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "my" ? "bg-white/20" : "bg-theme-secondary"}`}>{faNum(myTotal)}</span>}
          </button>
          <button onClick={() => setActiveTab("dept")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors ${activeTab === "dept" ? "bg-blue-600 text-white" : "text-theme-secondary hover:bg-theme-hover"}`}>
            <Users className="w-4 h-4" />
            تیکت‌های دپارتمان
            {deptTotal > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === "dept" ? "bg-white/20" : "bg-theme-secondary"}`}>{faNum(deptTotal)}</span>}
          </button>
        </div>
      )}

      {/* ── MY TICKETS TAB ── */}
      {activeTab === "my" && (
        <>
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
                value={mySearch} onChange={e => { setMySearch(e.target.value); setMyPage(1); }} />
            </div>
            <select className="input-theme text-sm" value={myStatus} onChange={e => { setMyStatus(e.target.value); setMyPage(1); }}>
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <TicketList rows={myRows} loading={myLoading} />
            {!myLoading && myTotal > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-theme text-xs text-theme-muted">
                <span>{faNum(myTotal)} تیکت</span>
                <div className="flex items-center gap-2">
                  <button disabled={myPage <= 1} onClick={() => setMyPage(p => p - 1)}
                    className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40">قبلی</button>
                  <span>صفحه {faNum(myPage)} از {faNum(myPageCount)}</span>
                  <button disabled={myPage >= myPageCount} onClick={() => setMyPage(p => p + 1)}
                    className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40">بعدی</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── DEPT TAB (manager only) ── */}
      {activeTab === "dept" && isManager && (
        <>
          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-violet-600">{faNum(deptTotal)}</div>
              <div className="text-xs text-theme-muted mt-0.5">کل تیکت‌ها</div>
            </div>
            <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{faNum(openDept)}</div>
              <div className="text-xs text-theme-muted mt-0.5">در جریان</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-theme-card border border-theme rounded-xl p-3 flex flex-wrap gap-2">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input className="input-theme text-sm pr-9 w-full" placeholder="جستجو..."
                value={deptSearch} onChange={e => { setDeptSearch(e.target.value); setDeptPage(1); }} />
            </div>
            <select className="input-theme text-sm" value={deptStatus} onChange={e => { setDeptStatus(e.target.value); setDeptPage(1); }}>
              <option value="">همه وضعیت‌ها</option>
              {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <TicketList rows={deptRows} loading={deptLoading} />
            {!deptLoading && deptTotal > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-theme text-xs text-theme-muted">
                <span>{faNum(deptTotal)} تیکت</span>
                <div className="flex items-center gap-2">
                  <button disabled={deptPage <= 1} onClick={() => setDeptPage(p => p - 1)}
                    className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40">قبلی</button>
                  <span>صفحه {faNum(deptPage)} از {faNum(deptPageCount)}</span>
                  <button disabled={deptPage >= deptPageCount} onClick={() => setDeptPage(p => p + 1)}
                    className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme disabled:opacity-40">بعدی</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
