"use client";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, Send, Paperclip, X, AlertTriangle, CheckCircle2,
  Clock, User, MessageSquare, Lock, History, ChevronLeft,
  UserCog, ArrowRightLeft, XCircle, RotateCcw, RefreshCw,
} from "lucide-react";
import SearchSelect from "../../../components/ui/SearchSelect";
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
const EVENT_FA: Record<string, string> = {
  CREATED: "تیکت ثبت شد",
  ASSIGNED: "تخصیص داده شد",
  REASSIGNED: "مسئول تغییر کرد",
  TRANSFERRED: "به دپارتمان دیگری منتقل شد",
  STATUS_CHANGED: "وضعیت تغییر کرد",
  PRIORITY_CHANGED: "اولویت تغییر کرد",
  COMMENT_ADDED: "پیام جدید",
  INTERNAL_NOTE: "یادداشت داخلی",
  ATTACHMENT_ADDED: "فایل پیوست شد",
  CLOSED: "تیکت بسته شد",
  REOPENED: "تیکت بازگشایی شد",
  SLA_BREACHED: "تأخیر SLA",
};
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const faDate = (s: string) => new Date(s).toLocaleDateString("fa-IR", { timeZone: "Asia/Tehran" });
const faDateTime = (s: string) => new Date(s).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
const fullName = (u: any) => u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "—";

type Tab = "conversation" | "timeline";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const toast = useToast();

  const [ticket, setTicket] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>("conversation");
  const [users, setUsers] = React.useState<any[]>([]);
  const [myRole, setMyRole] = React.useState<string>("");

  // Compose
  const [replyText, setReplyText] = React.useState("");
  const [isInternal, setIsInternal] = React.useState(false);
  const [replyFiles, setReplyFiles] = React.useState<File[]>([]);
  const [sending, setSending] = React.useState(false);

  // Modals
  const [assignModal, setAssignModal] = React.useState(false);
  const [transferModal, setTransferModal] = React.useState(false);
  const [assigneeId, setAssigneeId] = React.useState("");
  const [transferDeptId, setTransferDeptId] = React.useState("");
  const [transferCatId, setTransferCatId] = React.useState("");
  const [transferNote, setTransferNote] = React.useState("");
  const [deptConfigs, setDeptConfigs] = React.useState<any[]>([]);
  const [actionLoading, setActionLoading] = React.useState(false);

  const loadTicket = React.useCallback(async () => {
    const res = await fetch(`${API}/tickets/${id}`, { headers: h as any });
    if (!res.ok) { toast.error("تیکت یافت نشد"); return; }
    const data = await res.json();
    setTicket(data);
    document.title = `#${data.number} | تیکت | Arzesh`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      loadTicket(),
      fetch(`${API}/auth/me`, { headers: h as any }).then(r => r.ok ? r.json() : {}),
      fetch(`${API}/users`, { headers: h as any }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/tickets/config/enabled`, { headers: h as any }).then(r => r.ok ? r.json() : []),
    ]).then(([, me, us, cfgs]) => {
      setMyRole(me.role ?? "");
      setUsers(Array.isArray(us) ? us : (us.data ?? []));
      setDeptConfigs(cfgs);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isStaff = ["ADMIN", "MANAGER", "EXPERT"].includes(myRole);
  const canManage = ["ADMIN", "MANAGER"].includes(myRole);
  const isActive = ticket && !["CLOSED", "CANCELLED", "REJECTED"].includes(ticket.status);

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/tickets/${id}/comments`, {
        method: "POST",
        headers: h as any,
        body: JSON.stringify({ content: replyText.trim(), isInternal }),
      });
      if (!res.ok) { toast.error("خطا در ارسال پیام"); return; }
      setReplyText("");
      setIsInternal(false);

      // Upload files
      for (const file of replyFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`${API}/tickets/${id}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${token}` } as any, body: fd });
      }
      setReplyFiles([]);
      await loadTicket();
    } finally { setSending(false); }
  };

  const doAction = async (action: string, body?: any) => {
    setActionLoading(true);
    try {
      // close/reopen use PATCH /:id/close, /:id/reopen; status changes use PATCH /:id
      const url = action === "status" ? `${API}/tickets/${id}` : `${API}/tickets/${id}/${action}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: h as any,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) { toast.error("خطا در انجام عملیات"); return; }
      toast.success("عملیات انجام شد");
      await loadTicket();
    } finally { setActionLoading(false); }
  };

  const doAssign = async () => {
    if (!assigneeId) { toast.warning("مسئول را انتخاب کنید"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/tickets/${id}/assign`, {
        method: "PATCH", headers: h as any, body: JSON.stringify({ assigneeId }),
      });
      if (!res.ok) { toast.error("خطا در تخصیص"); return; }
      toast.success("تیکت تخصیص یافت");
      setAssignModal(false);
      await loadTicket();
    } finally { setActionLoading(false); }
  };

  const doTransfer = async () => {
    if (!transferDeptId || !transferCatId) { toast.warning("دپارتمان و دسته‌بندی را انتخاب کنید"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/tickets/${id}/transfer`, {
        method: "PATCH", headers: h as any,
        body: JSON.stringify({ departmentId: transferDeptId, categoryId: transferCatId, note: transferNote }),
      });
      if (!res.ok) { toast.error("خطا در انتقال"); return; }
      toast.success("تیکت منتقل شد");
      setTransferModal(false);
      await loadTicket();
    } finally { setActionLoading(false); }
  };

  const transferCats = React.useMemo(() => {
    if (!transferDeptId) return [];
    return deptConfigs.find((c: any) => c.department.id === transferDeptId)?.categories ?? [];
  }, [transferDeptId, deptConfigs]);

  const deptOptions = deptConfigs.map((c: any) => ({ id: c.department.id, name: c.department.name }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }
  if (!ticket) return null;

  const sla = ticket.slaMetric;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-theme-muted hover:text-theme-primary">
        <ChevronLeft className="w-4 h-4" /> بازگشت
      </button>

      {/* Header card */}
      <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-theme-muted">#{faNum(ticket.number)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[ticket.status] ?? ""}`}>{STATUS_FA[ticket.status] ?? ticket.status}</span>
              <span className={`text-xs font-medium ${PRIORITY_CLS[ticket.priority] ?? ""}`}>{PRIORITY_FA[ticket.priority] ?? ticket.priority}</span>
              {ticket.isOverSla && <span className="text-xs text-red-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> تأخیر SLA</span>}
            </div>
            <h1 className="text-lg font-bold text-theme-primary mt-1">{ticket.category?.name ?? "—"}</h1>
            <div className="text-sm text-theme-muted mt-0.5">{ticket.department?.name}</div>
          </div>
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canManage && isActive && (
              <>
                <button onClick={() => setAssignModal(true)} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary text-xs hover:bg-theme-hover">
                  <UserCog className="w-3.5 h-3.5" /> تخصیص
                </button>
                <button onClick={() => setTransferModal(true)} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary text-xs hover:bg-theme-hover">
                  <ArrowRightLeft className="w-3.5 h-3.5" /> انتقال
                </button>
                <button onClick={() => doAction("close")} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/40 text-green-600 text-xs hover:bg-green-500/10">
                  <CheckCircle2 className="w-3.5 h-3.5" /> بستن
                </button>
              </>
            )}
            {canManage && ["CLOSED","RESOLVED"].includes(ticket.status) && (
              <button onClick={() => doAction("reopen")} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-600 text-xs hover:bg-amber-500/10">
                <RotateCcw className="w-3.5 h-3.5" /> بازگشایی
              </button>
            )}
            {canManage && isActive && (
              <button onClick={() => doAction("status", { status: "REJECTED" })} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-600 text-xs hover:bg-red-500/10">
                <XCircle className="w-3.5 h-3.5" /> رد
              </button>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-theme">
          <div>
            <div className="text-theme-muted mb-0.5">درخواست‌دهنده</div>
            <div className="text-theme-primary font-medium flex items-center gap-1"><User className="w-3 h-3" />{fullName(ticket.requester)}</div>
          </div>
          <div>
            <div className="text-theme-muted mb-0.5">مسئول</div>
            <div className="text-theme-primary font-medium flex items-center gap-1"><UserCog className="w-3 h-3" />{ticket.assignee ? fullName(ticket.assignee) : <span className="text-theme-muted">تخصیص نیافته</span>}</div>
          </div>
          <div>
            <div className="text-theme-muted mb-0.5">تاریخ ثبت</div>
            <div className="text-theme-primary" dir="ltr">{faDateTime(ticket.createdAt)}</div>
          </div>
          <div>
            <div className="text-theme-muted mb-0.5">آخرین فعالیت</div>
            <div className="text-theme-primary" dir="ltr">{faDateTime(ticket.updatedAt)}</div>
          </div>
        </div>

        {/* SLA */}
        {sla && (
          <div className={`flex flex-wrap gap-4 text-xs p-2 rounded-lg border ${sla.resolutionBreached ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
            <div>
              <span className="text-theme-muted">پاسخ اول: </span>
              <span className={sla.firstResponseBreached ? "text-red-600 font-medium" : "text-green-600"}>
                {ticket.firstResponseAt ? `${faDateTime(ticket.firstResponseAt)} ✓` : (sla.firstResponseDueAt ? `موعد: ${faDate(sla.firstResponseDueAt)}` : "—")}
              </span>
            </div>
            <div>
              <span className="text-theme-muted">حل نهایی: </span>
              <span className={sla.resolutionBreached ? "text-red-600 font-medium" : "text-green-600"}>
                {ticket.resolvedAt ? `${faDateTime(ticket.resolvedAt)} ✓` : (sla.resolutionDueAt ? `موعد: ${faDate(sla.resolutionDueAt)}` : "—")}
              </span>
            </div>
          </div>
        )}

        {/* Tags */}
        {ticket.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ticket.tags.map((t: string) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-theme-secondary border border-theme text-theme-muted">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-theme-card border border-theme rounded-xl p-1">
        <button onClick={() => setTab("conversation")}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm transition-colors
            ${tab === "conversation" ? "bg-blue-600 text-white" : "text-theme-secondary hover:bg-theme-hover"}`}>
          <MessageSquare className="w-4 h-4" /> گفتگو
        </button>
        <button onClick={() => setTab("timeline")}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm transition-colors
            ${tab === "timeline" ? "bg-blue-600 text-white" : "text-theme-secondary hover:bg-theme-hover"}`}>
          <History className="w-4 h-4" /> تاریخچه
        </button>
      </div>

      {/* Conversation */}
      {tab === "conversation" && (
        <div className="space-y-3">
          {/* Original description */}
          <div className="bg-theme-card border border-theme rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600">
                {ticket.requester?.firstName?.[0] ?? "?"}
              </div>
              <span className="text-sm font-medium text-theme-primary">{fullName(ticket.requester)}</span>
              <span className="text-xs text-theme-muted mr-auto" dir="ltr">{faDateTime(ticket.createdAt)}</span>
            </div>
            <p className="text-sm text-theme-secondary whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Comments */}
          {(ticket.comments ?? []).map((c: any) => (
            <div key={c.id} className={`rounded-xl p-4 border ${c.isInternal ? "border-amber-500/30 bg-amber-500/5" : "bg-theme-card border-theme"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${c.isInternal ? "bg-amber-500/20 text-amber-700" : "bg-green-500/20 text-green-700"}`}>
                  {c.author?.firstName?.[0] ?? "?"}
                </div>
                <span className="text-sm font-medium text-theme-primary">{fullName(c.author)}</span>
                {c.isInternal && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    <Lock className="w-3 h-3" /> داخلی
                  </span>
                )}
                <span className="text-xs text-theme-muted mr-auto" dir="ltr">{faDateTime(c.createdAt)}</span>
              </div>
              <p className="text-sm text-theme-secondary whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}

          {/* Attachments */}
          {(ticket.attachments ?? []).length > 0 && (
            <div className="bg-theme-card border border-theme rounded-xl p-3">
              <div className="text-xs text-theme-muted font-medium mb-2">پیوست‌ها</div>
              <div className="flex flex-wrap gap-2">
                {ticket.attachments.map((a: any) => (
                  <a key={a.id} href={`${API.replace("/api", "")}${a.url}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-theme-secondary border border-theme hover:bg-theme-hover">
                    <Paperclip className="w-3 h-3 text-theme-muted" />
                    <span className="max-w-36 truncate">{a.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reply box */}
          {isActive && (
            <div className={`bg-theme-card border rounded-xl p-4 space-y-3 ${isInternal ? "border-amber-500/40" : "border-theme"}`}>
              {isStaff && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setIsInternal(false)}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${!isInternal ? "bg-blue-600 border-blue-600 text-white" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}>
                    پاسخ عمومی
                  </button>
                  <button type="button" onClick={() => setIsInternal(true)}
                    className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg border transition-colors ${isInternal ? "bg-amber-500 border-amber-500 text-white" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}>
                    <Lock className="w-3 h-3" /> یادداشت داخلی
                  </button>
                </div>
              )}
              <textarea
                className={`input-theme text-sm w-full resize-none ${isInternal ? "border-amber-500/40" : ""}`}
                rows={4} placeholder={isInternal ? "یادداشت داخلی (فقط تیم پشتیبانی می‌بیند)..." : "پاسخ خود را بنویسید..."}
                value={replyText} onChange={e => setReplyText(e.target.value)} />
              {replyFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {replyFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs bg-theme-secondary border border-theme px-2 py-1 rounded">
                      <Paperclip className="w-3 h-3 text-theme-muted" />
                      <span className="max-w-28 truncate">{f.name}</span>
                      <button onClick={() => setReplyFiles(p => p.filter((_, j) => j !== i))} className="text-theme-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-theme-muted hover:text-blue-600">
                  <Paperclip className="w-4 h-4" /> پیوست
                  <input type="file" multiple className="hidden" onChange={e => {
                    if (e.target.files) { setReplyFiles(p => [...p, ...Array.from(e.target.files!)].slice(0, 5)); e.target.value = ""; }
                  }} />
                </label>
                <button onClick={sendReply} disabled={sending || !replyText.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  ارسال
                </button>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="text-center py-6 text-sm text-theme-muted">
              این تیکت بسته شده — برای ادامه، تیکت را بازگشایی کنید
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {tab === "timeline" && (
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          {(ticket.events ?? []).length === 0 ? (
            <p className="text-center text-theme-muted text-sm py-8">رویدادی ثبت نشده</p>
          ) : (
            <div className="space-y-3">
              {(ticket.events as any[]).map((ev: any) => (
                <div key={ev.id} className="flex gap-3 text-sm">
                  <div className="mt-1 w-5 h-5 rounded-full bg-theme-secondary border border-theme flex items-center justify-center shrink-0">
                    <Clock className="w-3 h-3 text-theme-muted" />
                  </div>
                  <div>
                    <span className="text-theme-primary">{EVENT_FA[ev.type] ?? ev.type}</span>
                    {ev.actor && <span className="text-theme-muted text-xs mr-1.5">— {fullName(ev.actor)}</span>}
                    <div className="text-xs text-theme-muted mt-0.5" dir="ltr">{faDateTime(ev.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => { if (e.target === e.currentTarget) setAssignModal(false); }}>
          <div className="bg-theme-card border border-theme rounded-2xl p-5 w-full max-w-sm space-y-4" dir="rtl">
            <h2 className="text-base font-bold text-theme-primary">تخصیص تیکت</h2>
            <SearchSelect options={users} value={assigneeId} onChange={setAssigneeId}
              emptyLabel="انتخاب مسئول" placeholder="جستجوی مسئول"
              displayKey="firstName" searchKey="lastName" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignModal(false)} className="px-4 py-2 rounded-xl border border-theme text-theme-secondary text-sm">انصراف</button>
              <button onClick={doAssign} disabled={actionLoading || !assigneeId}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تخصیص"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => { if (e.target === e.currentTarget) setTransferModal(false); }}>
          <div className="bg-theme-card border border-theme rounded-2xl p-5 w-full max-w-sm space-y-4" dir="rtl">
            <h2 className="text-base font-bold text-theme-primary">انتقال تیکت</h2>
            <div>
              <label className="block text-xs text-theme-muted mb-1.5">دپارتمان مقصد</label>
              <SearchSelect options={deptOptions} value={transferDeptId}
                onChange={v => { setTransferDeptId(v); setTransferCatId(""); }}
                emptyLabel="انتخاب دپارتمان" placeholder="دپارتمان" />
            </div>
            <div>
              <label className="block text-xs text-theme-muted mb-1.5">دسته‌بندی مقصد</label>
              <SearchSelect options={transferCats} value={transferCatId} onChange={setTransferCatId}
                emptyLabel="انتخاب دسته‌بندی" placeholder="دسته‌بندی" disabled={!transferDeptId} />
            </div>
            <div>
              <label className="block text-xs text-theme-muted mb-1.5">یادداشت (اختیاری)</label>
              <textarea className="input-theme text-sm w-full resize-none" rows={2}
                value={transferNote} onChange={e => setTransferNote(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setTransferModal(false)} className="px-4 py-2 rounded-xl border border-theme text-theme-secondary text-sm">انصراف</button>
              <button onClick={doTransfer} disabled={actionLoading || !transferDeptId || !transferCatId}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "انتقال"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
