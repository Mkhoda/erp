"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { pageTitle } from "../../lib/branding";
import TicketInboxCard from "../components/tickets/TicketInboxCard";
import { readError } from "../../lib/http";
import {
  ArrowLeft, Boxes, Users, Handshake, Building, BarChart3, Plus, Activity, ArrowUpRight,
  Loader2, Check, Trash2, ChevronLeft, ChevronRight, CalendarDays, Fingerprint, Bell, Ticket,
  ListTodo, PieChart, Trophy,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Helpers ────────────────────────────────────────────────────────────────
const toFa   = (s: string) => s.replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const faNum  = (n: number) => (n ?? 0).toLocaleString("fa-IR");

function splitDaysHours(days: number): { d: number; h: number } {
  const d = Math.floor(days);
  const h = Math.round((days - d) * 8);
  return { d, h };
}
const fmtMin = (m: number) => { const h = Math.floor(Math.abs(m||0)/60); const mm = Math.abs(m||0)%60; return toFa(`${h}:${String(mm).padStart(2,"0")}`); };

// ── Jalali calendar algorithm (jdf, no dependency) ────────────────────────
function toJalali(gy0: number, gm: number, gd: number) {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy: number, gy: number;
  if (gy0 > 1600) { jy = 979; gy = gy0 - 1600; } else { jy = 0; gy = gy0 - 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365*gy + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) - 80 + gd + gdm[gm-1];
  jy += 33 * Math.floor(days/12053); days %= 12053;
  jy += 4 * Math.floor(days/1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days-1)/365); days = (days-1)%365; }
  const jm = days < 186 ? 1+Math.floor(days/31) : 7+Math.floor((days-186)/30);
  const jd = 1 + (days < 186 ? days%31 : (days-186)%30);
  return { jy, jm, jd };
}
function jalaliMonthLen(jy: number, jm: number) { return jm<=6?31:jm<=11?30:jy%4===3?30:29; }
function jalaliToGregorian(jy0: number, jm: number, jd: number) {
  let gy: number, jy: number;
  if (jy0 > 979) { gy = 1600; jy = jy0 - 979; } else { gy = 621; jy = jy0; }
  let days = 365*jy + Math.floor(jy/33)*8 + Math.floor(((jy%33)+3)/4) + 78 + jd + (jm<7?(jm-1)*31:(jm-7)*30+186);
  gy += 400*Math.floor(days/146097); days %= 146097;
  if (days > 36524) { gy += 100*Math.floor(--days/36524); days %= 36524; if (days >= 365) days++; }
  gy += 4*Math.floor(days/1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days-1)/365); days = (days-1)%365; }
  let gd = days+1;
  const sal = [0,31,(gy%4===0&&gy%100!==0)||gy%400===0?29:28,31,30,31,30,31,31,30,31,30,31];
  let gm = 1; for(; gm<=12; gm++) { if (gd <= sal[gm]) break; gd -= sal[gm]; }
  return new Date(gy, gm-1, gd);
}
function jalaliFirstWeekday(jy: number, jm: number) {
  const g = jalaliToGregorian(jy, jm, 1);
  return (g.getDay() + 1) % 7;
}
const J_MONTH_NAMES = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const J_DAYS = ["ش","ی","د","س","چ","پ","ج"];

function todayJalaliStr() {
  const t = new Date();
  const { jy, jm, jd } = toJalali(t.getFullYear(), t.getMonth()+1, t.getDate());
  const dow = t.toLocaleDateString("fa-IR", { weekday: "long" });
  return `${dow}، ${toFa(String(jd))} ${J_MONTH_NAMES[jm-1]} ${toFa(String(jy))}`;
}
function currentJYear(): number {
  const t = new Date();
  return toJalali(t.getFullYear(), t.getMonth()+1, t.getDate()).jy;
}

// ── Persian Calendar ──────────────────────────────────────────────────────
function PersianCalendar() {
  const today = new Date();
  const todayJ = toJalali(today.getFullYear(), today.getMonth()+1, today.getDate());
  const [vy, setVy] = React.useState(todayJ.jy);
  const [vm, setVm] = React.useState(todayJ.jm);

  const prev = () => { if(vm===1){setVm(12);setVy(y=>y-1);}else setVm(m=>m-1); };
  const next = () => { if(vm===12){setVm(1);setVy(y=>y+1);}else setVm(m=>m+1); };
  const len = jalaliMonthLen(vy, vm);
  const startDay = jalaliFirstWeekday(vy, vm);
  const cells: (number|null)[] = [...Array(startDay).fill(null), ...Array.from({length:len},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-4 card-theme" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
        <div className="text-center">
          <div className="font-bold text-theme-primary text-sm">{J_MONTH_NAMES[vm-1]}</div>
          <div className="text-theme-muted text-[11px]">{toFa(String(vy))}</div>
        </div>
        <button onClick={next} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {J_DAYS.map(d => <div key={d} className="text-center text-[10px] font-medium text-theme-muted py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          const isToday = day === todayJ.jd && vm === todayJ.jm && vy === todayJ.jy;
          return (
            <div key={i} className={`text-center text-xs py-1 rounded-lg leading-none ${!day ? "" : isToday ? "bg-blue-600 text-white font-bold" : "text-theme-secondary hover:bg-theme-hover cursor-default"}`}>
              {day ? toFa(String(day)) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Todo Widget ──────────────────────────────────────────────────────────
type Todo = { id: string; title: string; done: boolean };

function TodoWidget({ token }: { token: string }) {
  const h = { Authorization: `Bearer ${token}` };
  const [todos, setTodos] = React.useState<Todo[]>([]);
  const [input, setInput] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API}/todos`, { headers: h }).then(r => r.ok ? r.json() : []).then(setTodos).catch(() => {});
  }, []);

  const add = async () => {
    const title = input.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/todos`, { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      if (res.ok) { const t = await res.json(); setTodos(prev => [...prev, t]); setInput(""); }
    } finally { setAdding(false); }
  };

  const toggle = async (id: string) => {
    const res = await fetch(`${API}/todos/${id}/toggle`, { method: "PATCH", headers: h });
    if (res.ok) { const t = await res.json(); setTodos(prev => prev.map(x => x.id === id ? { ...x, ...t } : x)); }
  };

  const remove = async (id: string) => {
    await fetch(`${API}/todos/${id}`, { method: "DELETE", headers: h });
    setTodos(prev => prev.filter(x => x.id !== id));
  };

  const done = todos.filter(t => t.done).length;
  const total = todos.length;

  return (
    <div className="p-4 card-theme" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-theme-muted text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> یادداشت‌های من
        </h3>
        {total > 0 && (
          <span className="text-[10px] text-theme-muted">{toFa(String(done))}/{toFa(String(total))}</span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 bg-theme-secondary rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(done/total)*100}%` }} />
        </div>
      )}

      <div className="flex gap-1.5 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="اضافه کردن وظیفه..."
          className="flex-1 bg-theme-secondary border border-theme rounded-lg px-2.5 py-1.5 text-xs text-theme-primary placeholder:text-theme-muted outline-none focus:border-blue-500 transition-colors"
        />
        <button onClick={add} disabled={!input.trim() || adding}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0">
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </div>

      {todos.length === 0 ? (
        <p className="text-center text-theme-muted text-xs py-3">هیچ وظیفه‌ای ندارید</p>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {todos.map(t => (
            <div key={t.id} className={`flex items-center gap-2 group rounded-lg px-1.5 py-1 transition-colors ${t.done ? "bg-emerald-500/5" : "hover:bg-theme-hover"}`}>
              <button onClick={() => toggle(t.id)}
                className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-all ${t.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-theme hover:border-blue-400"}`}>
                {t.done && <Check className="w-2.5 h-2.5" />}
              </button>
              <span className={`flex-1 text-xs leading-snug transition-all ${t.done ? "line-through text-theme-primary opacity-50" : "text-theme-secondary"}`}>
                {t.title}
              </span>
              <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-500 transition-all shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Leave Balance Card ────────────────────────────────────────────────────
function LeaveCard({ leave }: { leave: any }) {
  const used = leave.usedDays || 0;
  const total = leave.entitlement || 30;
  const remaining = leave.remainingDays || 0;
  const usedPct = Math.min(100, (used / total) * 100);

  return (
    <div className="card-theme p-4" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-blue-500" />
          </div>
          <span className="font-semibold text-theme-primary text-sm">مرخصی سال {toFa(String(leave.jYear))}</span>
        </div>
        <Link href="/dashboard/attendance/my" className="text-blue-500 text-xs hover:underline flex items-center gap-0.5">
          جزئیات <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      {/* Balance display */}
      {(() => {
        const { d, h } = splitDaysHours(remaining);
        return (
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-2xl font-bold text-blue-600">{faNum(d)}</span>
              <span className="text-theme-muted text-sm">روز</span>
              {h > 0 && (
                <>
                  <span className="text-theme-muted text-xs">و</span>
                  <span className="text-base font-semibold text-blue-500">{faNum(h)}</span>
                  <span className="text-theme-muted text-xs">ساعت</span>
                </>
              )}
              <span className="text-theme-muted text-sm">مانده</span>
            </div>
            <span className="text-xs text-theme-muted shrink-0">از {faNum(total)} روز</span>
          </div>
        );
      })()}

      {/* Progress bar: remaining = blue, consumed = segmented */}
      <div className="h-2.5 bg-theme-secondary rounded-full overflow-hidden mb-3 flex gap-px">
        {/* Leaves taken */}
        {leave.fullDays > 0 && (
          <div className="h-full bg-blue-400 rounded-r-full" style={{ width: `${(leave.fullDays/total)*100}%` }} title="مرخصی روزانه" />
        )}
        {/* Absences */}
        {(leave.absentDays||0) > 0 && (
          <div className="h-full bg-red-400" style={{ width: `${((leave.absentDays||0)/total)*100}%` }} title="غیبت" />
        )}
        {/* Tardy */}
        {leave.tardyMinutes > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${Math.max(1,(leave.tardyMinutes/(leave.dailyReq||500))/total*100)}%` }} title="تاخیر/تعجیل" />
        )}
        {/* Remaining */}
        <div className="h-full bg-emerald-400 flex-1 rounded-l-full" />
      </div>

      {/* Legend row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400 shrink-0" />مرخصی: <b className="text-blue-600">{faNum(leave.fullDays)} روز</b></span>
        {(leave.absentDays||0) > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 shrink-0" />غیبت: <b className="text-red-600">{faNum(leave.absentDays)} روز</b></span>}
        {leave.tardyMinutes > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 shrink-0" />کسر تاخیر: <b className="text-amber-600">{fmtMin(leave.tardyMinutes)}</b></span>}
        {(() => { const { d, h } = splitDaysHours(remaining); return (
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 shrink-0" />مانده: <b className="text-emerald-600">{faNum(d)} روز{h > 0 ? ` و ${faNum(h)} ساعت` : ""}</b></span>
        ); })()}
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
type Stats = { totalUsers: number; totalDepartments: number; unreadNotifications: number; myOpenTickets: number };

const statColor: Record<string, string> = {
  blue:   "text-blue-600 dark:text-blue-400",
  green:  "text-green-600 dark:text-green-400",
  amber:  "text-amber-600 dark:text-amber-400",
  purple: "text-purple-600 dark:text-purple-400",
};
const statBg: Record<string, string> = {
  blue:   "from-blue-500 to-blue-600",
  green:  "from-green-500 to-green-600",
  amber:  "from-amber-500 to-amber-600",
  purple: "from-purple-500 to-purple-600",
};
const ROLE_FA: Record<string, string>  = { ADMIN: "مدیر سیستم", MANAGER: "مدیر", USER: "کاربر", EXPERT: "کارشناس" };
const ROLE_CLS: Record<string, string> = {
  ADMIN:   "bg-purple-500/15 text-purple-600",
  MANAGER: "bg-blue-500/15 text-blue-600",
  USER:    "bg-green-500/15 text-green-600",
  EXPERT:  "bg-amber-500/15 text-amber-600",
};

// ── Main Page ──────────────────────────────────────────────────────────────
const STATUS_FA: Record<string, string> = { PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص", LEAVE: "مرخصی", SICK_LEAVE: "استعلاجی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل", COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته", OFF_DUTY: "استراحت (شیفت)" };
const REPORT_STATE: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: "گزارش امروز ثبت شده", cls: "text-green-600" },
  LATE: { label: "گزارش با تأخیر ثبت شده", cls: "text-amber-600" },
  MISSING: { label: "گزارش ثبت نشده", cls: "text-red-600" },
  PENDING: { label: "گزارش امروز هنوز ثبت نشده", cls: "text-blue-600" },
  NOT_REQUIRED: { label: "امروز گزارش الزامی نیست", cls: "text-theme-muted" },
};
const faClock = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }) : "—";

export default function WorkspacePage() {
  const [me, setMe] = React.useState<any>(null);
  const [stats, setStats] = React.useState<Stats>({ totalUsers:0, totalDepartments:0, unreadNotifications:0, myOpenTickets:0 });
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [leave, setLeave] = React.useState<any>(null);
  // Today at a glance: my attendance + work log (one call), and — for whoever can see the
  // management dashboard — an organisation snapshot.
  const [board, setBoard] = React.useState<any>(null);
  const [org, setOrg] = React.useState<any>(null);
  const [tickets, setTickets] = React.useState<any>(null);
  const todayStr = React.useMemo(() => todayJalaliStr(), []);

  React.useEffect(() => { document.title = pageTitle("فضای کاری"); }, []);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

  React.useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/auth/me`,       { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/users`,         { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`,   { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/attendance/me/leave-balance?jYear=${currentJYear()}`, { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/notifications/unread-count`, { headers: h }).then(r => r.ok ? r.json() : { count: 0 }),
      fetch(`${API}/tickets/inbox`, { headers: h }).then(r => r.ok ? r.json() : null),
    ]).then(([meData, users, depts, lb, notifCount, inbox]) => {
      setTickets(inbox);
      setMe(meData);
      setLeave(lb);
      setStats({
        totalUsers:           Array.isArray(users) ? users.length : (users?.data?.length ?? 0),
        totalDepartments:     Array.isArray(depts) ? depts.length : (depts?.data?.length ?? 0),
        unreadNotifications:  notifCount?.count ?? 0,
        myOpenTickets:        inbox?.counts?.mine ?? 0,
      });
    }).catch(console.error).finally(() => setStatsLoading(false));
    fetch(`${API}/work-log/me/board`, { headers: h }).then(r => r.ok ? r.json() : null).then(setBoard).catch(() => {});
    // 403 for people without the management dashboard — the card simply stays hidden.
    fetch(`${API}/analytics/overview`, { headers: h }).then(r => r.ok ? r.json() : null).then(setOrg).catch(() => {});
  }, [token]);

  const role = me?.role;
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
  const isPrivileged     = role === "ADMIN" || role === "MANAGER" || role === "EXPERT";

  const statCards = [
    { title: "اعلان‌های خوانده‌نشده", value: stats.unreadNotifications, icon: Bell,     color: "blue",   href: "/dashboard/notifications" },
    { title: "کاربران سیستم",          value: stats.totalUsers,           icon: Users,    color: "green",  href: "/dashboard/users",         show: isAdminOrManager },
    { title: "تیکت‌های باز من",        value: stats.myOpenTickets,        icon: Ticket,   color: "amber",  href: "/dashboard/tickets/my" },
    { title: "دپارتمان‌ها",            value: stats.totalDepartments,     icon: Building, color: "purple", href: "/dashboard/departments",    show: role === "ADMIN" },
  ].filter(s => !("show" in s) || s.show || statsLoading);

  const quickActions = [
    { title: "عملکرد من",                      href: "/dashboard/work-log/my",          icon: ListTodo,     color: "from-violet-500 to-purple-600" },
    { title: "حضور من",                        href: "/dashboard/attendance/my",        icon: Fingerprint,  color: "from-cyan-500 to-teal-600" },
    { title: "تیکت جدید",                      href: "/dashboard/tickets/new",          icon: Ticket,       color: "from-amber-500 to-orange-600" },
    isPrivileged && { title: "دارایی‌ها",      href: "/dashboard/assets",               icon: Boxes,        color: "from-blue-500 to-blue-600" },
    isPrivileged && { title: "واگذاری جدید",   href: "/dashboard/assets/assignments",   icon: Handshake,    color: "from-green-500 to-green-600" },
    role === "ADMIN" && { title: "کاربر جدید", href: "/dashboard/users",                icon: Users,        color: "from-purple-500 to-purple-600" },
  ].filter(Boolean) as Array<{ title: string; href: string; icon: any; color: string }>;

  // My open tasks for today's card: overdue first, then by deadline.
  const openTasks = ((board?.tasks || []) as any[]).filter(t => !t.done && !t.archived)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || String(a.deadline || "9").localeCompare(String(b.deadline || "9")))
    .slice(0, 6);
  const att = board?.attendance;
  const rs = board ? REPORT_STATE[board.state] : null;
  const wl = org?.workLogToday;

  return (
    <div className="flex gap-4 h-[calc(100vh-88px)]" dir="rtl">

      {/* ═══ CENTER ═══ */}
      <div className="flex flex-col flex-1 min-w-0 gap-3 overflow-y-auto pb-2">

        {/* ── User greeting ── */}
        <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
          className="card-theme p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {me?.firstName?.[0] || "؟"}
            </div>
            <div>
              <h1 className="text-lg font-bold text-theme-primary leading-tight">
                {statsLoading
                  ? <span className="block w-36 h-5 skeleton rounded" />
                  : `سلام، ${me?.firstName || ""} ${me?.lastName || ""}!`}
              </h1>
              <div className="flex items-center flex-wrap gap-2 mt-1">
                {role && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_CLS[role] || "bg-theme-secondary text-theme-muted"}`}>{ROLE_FA[role] || role}</span>}
                {me?.department?.name && <span className="text-theme-muted text-xs">{me.department.name}</span>}
              </div>
            </div>
          </div>
          <div className="text-left hidden sm:block shrink-0">
            <div className="text-theme-primary font-medium text-sm">{todayStr}</div>
            <div className="text-xs text-theme-muted mt-0.5 text-left">امروز</div>
          </div>
        </motion.div>

        {/* ── Stat cards ── */}
        {statCards.length > 0 && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.05 }}
            className={`grid gap-3 ${statCards.length <= 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
            {statCards.map(s => (
              <Link key={s.title} href={s.href}
                className="group card-theme quick-action-card p-5 flex flex-col gap-3 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${statBg[s.color]} shadow-sm`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowUpRight className={`w-4 h-4 ${statColor[s.color]} opacity-0 group-hover:opacity-100 transition-opacity mt-0.5`} />
                </div>
                <div>
                  <div className={`text-3xl font-bold leading-none ${statColor[s.color]}`}>
                    {statsLoading ? <span className="block w-14 h-8 skeleton rounded" /> : s.value.toLocaleString("fa-IR")}
                  </div>
                  <div className="text-theme-muted text-sm mt-1.5">{s.title}</div>
                </div>
              </Link>
            ))}
          </motion.div>
        )}

        {/* ── My day: attendance + work log ── */}
        {board && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.08 }}
            className="card-theme p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-theme-primary text-sm flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-blue-500" /> امروز من</h2>
              <Link href="/dashboard/work-log/my" className="text-blue-600 dark:text-blue-400 text-xs hover:underline flex items-center gap-1">عملکرد من <ArrowLeft className="w-3 h-3" /></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="bg-theme-secondary/50 rounded-xl px-3 py-2">
                <div className="text-[11px] text-theme-muted">حضور</div>
                <div className="font-semibold text-theme-primary">{att ? (att.firstCheckIn && !att.lastCheckOut ? "در حال کار" : STATUS_FA[att.status] || att.status) : "ثبت نشده"}</div>
              </div>
              <div className="bg-theme-secondary/50 rounded-xl px-3 py-2">
                <div className="text-[11px] text-theme-muted">ورود / خروج</div>
                <div className="font-semibold text-theme-primary" dir="ltr">{faClock(att?.firstCheckIn)} — {faClock(att?.lastCheckOut)}</div>
              </div>
              <div className="bg-theme-secondary/50 rounded-xl px-3 py-2">
                <div className="text-[11px] text-theme-muted">زمان ثبت‌شده امروز</div>
                <div className="font-semibold text-theme-primary" dir="ltr">{fmtMin(board.capacity?.used || 0)}{board.capacity?.allowed != null ? ` / ${fmtMin(board.capacity.allowed)}` : ""}</div>
              </div>
              <div className="bg-theme-secondary/50 rounded-xl px-3 py-2">
                <div className="text-[11px] text-theme-muted">گزارش کار روزانه</div>
                <div className={`font-semibold text-xs mt-0.5 ${rs?.cls || ""}`}>{rs?.label}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-theme-muted mb-1.5">وظایف باز من</div>
              {openTasks.length === 0 ? (
                <div className="text-xs text-theme-muted">وظیفه‌ی بازی ندارید</div>
              ) : (
                <ul className="space-y-1">
                  {openTasks.map(t => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.category?.color || "#94a3b8" }} />
                      <span className="flex-1 truncate text-theme-primary">{t.title}</span>
                      {t.deadline && <span className={`text-[11px] ${t.overdue ? "text-red-600" : "text-theme-muted"}`}>مهلت {new Date(t.deadline).toLocaleDateString("fa-IR", { timeZone: "UTC" })}{t.overdue ? " (گذشته)" : ""}</span>}
                      {t.minutesOnDate > 0 && <span className="text-[11px] text-blue-600" dir="ltr">{fmtMin(t.minutesOnDate)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Tickets: my inbox + the ones I submitted ── */}
        {tickets && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.09 }}>
            <TicketInboxCard data={tickets} role={role} />
          </motion.div>
        )}

        {/* ── Organisation snapshot (management dashboard access only) ── */}
        {org && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.1 }}
            className="card-theme p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-theme-primary text-sm flex items-center gap-1.5"><Activity className="w-4 h-4 text-violet-500" /> وضعیت امروز سازمان</h2>
              <Link href="/dashboard/analytics" className="text-blue-600 dark:text-blue-400 text-xs hover:underline flex items-center gap-1">داشبورد مدیریتی <ArrowLeft className="w-3 h-3" /></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              {[
                { l: "حاضر امروز", v: faNum(org.attendanceToday?.present || 0) },
                { l: "غایب", v: faNum(org.attendanceToday?.statuses?.ABSENT || 0) },
                { l: "گزارش عملکرد ثبت‌شده", v: wl?.required ? `${faNum(Math.round(((wl.submitted + wl.late) / wl.required) * 100))}٪` : "—" },
                { l: "تیکت‌های باز", v: `${faNum(org.tickets?.open || 0)}${org.tickets?.overdue ? ` (${faNum(org.tickets.overdue)} دیرکرد)` : ""}` },
                { l: "درخواست حضور در انتظار", v: faNum(org.attendanceRequestsPending || 0) },
              ].map(x => (
                <div key={x.l} className="bg-theme-secondary/50 rounded-xl px-3 py-2">
                  <div className="text-[11px] text-theme-muted">{x.l}</div>
                  <div className="font-semibold text-theme-primary">{x.v}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Leave balance ── */}
        {leave && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.12 }}>
            <LeaveCard leave={leave} />
          </motion.div>
        )}
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <motion.div initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.25, delay:0.12 }}
        className="hidden lg:flex flex-col gap-3 w-72 overflow-y-auto pb-2 shrink-0">

        {/* Persian Calendar */}
        <PersianCalendar />

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="card-theme p-4">
            <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">اقدامات سریع</h3>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(qa => (
                <Link key={qa.title} href={qa.href}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-theme-secondary border border-theme hover:bg-theme-hover transition-all quick-action-card text-center">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${qa.color} shrink-0`}>
                    <qa.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-theme-primary text-xs leading-tight">{qa.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Personal TODO */}
        {token && <TodoWidget token={token} />}

        {/* Quick links */}
        {isAdminOrManager && (
          <div className="card-theme p-4">
            <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">دسترسی سریع</h3>
            <div className="space-y-1">
              {[
                { icon: PieChart,  label: "داشبورد مدیریتی", href: "/dashboard/analytics",        color: "text-violet-500" },
                { icon: Trophy,    label: "امتیاز عملکرد",   href: "/dashboard/performance",      color: "text-amber-500" },
                { icon: Boxes,     label: "دارایی‌ها",        href: "/dashboard/assets",           color: "text-green-500" },
              ].map(item => (
                <Link key={item.label} href={item.href}
                  className="flex items-center gap-2.5 hover:bg-theme-hover px-3 py-2 rounded-xl transition-colors">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-theme-secondary text-sm">{item.label}</span>
                  <ArrowUpRight className="w-3 h-3 text-theme-muted ms-auto" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
