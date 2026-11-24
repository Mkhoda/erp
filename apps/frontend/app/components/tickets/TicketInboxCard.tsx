"use client";
// Home-page ticket card: tickets waiting for me (کارتابل) and the open ones I submitted,
// with a shortcut to create one.
import React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Ticket } from "lucide-react";

const STATUS_FA: Record<string, string> = { OPEN: "باز", ASSIGNED: "ارجاع‌شده", IN_PROGRESS: "در حال انجام", WAITING_USER: "منتظر کاربر", USER_REPLIED: "پاسخ کاربر", REOPENED: "بازگشایی" };
const STATUS_CLS: Record<string, string> = {
  OPEN: "bg-blue-500/15 text-blue-700 dark:text-blue-300", ASSIGNED: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300", IN_PROGRESS: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  WAITING_USER: "bg-amber-500/15 text-amber-700 dark:text-amber-300", USER_REPLIED: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300", REOPENED: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};
const PRIORITY: Record<string, { l: string; c: string }> = { HIGH: { l: "اولویت بالا", c: "text-amber-600" }, CRITICAL: { l: "بحرانی", c: "text-red-600" } };
const REASON: Record<string, string> = { ASSIGNED: "ارجاع به من", WAITING: "منتظر پاسخ من", QUEUE: "بدون مسئول" };
const fa = (n: number) => (n ?? 0).toLocaleString("fa-IR", { useGrouping: false });

export default function TicketInboxCard({ data, role }: { data: any; role?: string }) {
  const [tab, setTab] = React.useState<"inbox" | "mine">(data.counts.inbox > 0 || !data.counts.mine ? "inbox" : "mine");
  const c = data.counts;
  const rows = (tab === "inbox" ? data.inbox : data.mine) as any[];
  const total = tab === "inbox" ? c.inbox : c.mine;
  return (
    <div className="card-theme p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-theme-primary text-sm flex items-center gap-1.5"><Ticket className="w-4 h-4 text-amber-500" /> تیکت‌ها</h2>
        <div className="flex items-center gap-3">
          <Link href={tab === "inbox" && role === "ADMIN" ? "/dashboard/tickets" : "/dashboard/tickets/my"} className="text-blue-600 dark:text-blue-400 text-xs hover:underline flex items-center gap-1">مشاهده همه <ArrowLeft className="w-3 h-3" /></Link>
          <Link href="/dashboard/tickets/new" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-3.5 h-3.5" /> تیکت جدید</Link>
        </div>
      </div>
      <div className="flex bg-theme-secondary border border-theme p-0.5 rounded-lg text-xs w-fit">
        {([["inbox", "کارتابل من", c.inbox], ["mine", "ثبت‌شده توسط من", c.mine]] as const).map(([k, l, n]) => (
          <button type="button" key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1 rounded-md ${tab === k ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted"}`}>
            {l}<span className={`px-1.5 rounded-full text-[10px] ${n ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-theme-hover"}`}>{fa(n)}</span>
          </button>
        ))}
      </div>
      {tab === "inbox" && c.inbox > 0 && (
        <div className="flex flex-wrap gap-3 text-[11px] text-theme-muted">
          {c.assigned > 0 && <span>ارجاع به من: {fa(c.assigned)}</span>}
          {c.waiting > 0 && <span>منتظر پاسخ من: {fa(c.waiting)}</span>}
          {c.queue > 0 && <span>بدون مسئول: {fa(c.queue)}</span>}
        </div>
      )}
      {rows.length === 0 ? (
        <div className="text-xs text-theme-muted py-2">{tab === "inbox" ? "تیکتی در کارتابل شما نیست" : "تیکت بازی ثبت نکرده‌اید"}</div>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {rows.map(t => (
            <li key={t.id} className="border-b border-theme last:border-b-0">
              <Link href={`/dashboard/tickets/${t.id}`} className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-theme-hover">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-theme-primary truncate"><span className="text-theme-muted text-xs">#{fa(t.number)}</span> {t.title || t.category?.name}</div>
                  <div className="flex flex-wrap gap-x-2 text-[11px] text-theme-muted">
                    <span>{t.department?.name}</span>
                    {tab === "inbox" && <span>{t.requester?.firstName} {t.requester?.lastName}</span>}
                    {tab === "inbox" && <span className="text-blue-600 dark:text-blue-400">{REASON[t.reason]}</span>}
                    {PRIORITY[t.priority] && <span className={PRIORITY[t.priority].c}>{PRIORITY[t.priority].l}</span>}
                    {t.isOverSla && <span className="text-red-600">دیرکرد</span>}
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full ${STATUS_CLS[t.status] || "bg-theme-secondary text-theme-muted"}`}>{STATUS_FA[t.status] || t.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > rows.length && <div className="text-[11px] text-theme-muted">{fa(rows.length)} مورد از {fa(total)} نمایش داده شده است</div>}
    </div>
  );
}
