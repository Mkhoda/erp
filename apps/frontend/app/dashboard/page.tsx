"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Send, ArrowLeft,
  Boxes, Users, Handshake, Building, BarChart3,
  MessageSquare, Plus, Activity, ArrowUpRight,
  Loader2, AlertCircle, Brain, Check, Trash2, ChevronLeft, ChevronRight,
  CalendarDays, Zap, Fingerprint,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Helpers ────────────────────────────────────────────────────────────────
const toFa   = (s: string) => s.replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const faNum  = (n: number) => (n ?? 0).toLocaleString("fa-IR");
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
    if (res.ok) { const t = await res.json(); setTodos(prev => prev.map(x => x.id === id ? t : x)); }
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
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="text-2xl font-bold text-blue-600">{faNum(remaining)}</span>
          <span className="text-theme-muted text-sm mr-1">روز مانده</span>
        </div>
        <span className="text-xs text-theme-muted">از {faNum(total)} روز</span>
      </div>

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
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 shrink-0" />مانده: <b className="text-emerald-600">{faNum(remaining)} روز</b></span>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
type Stats = { totalAssets: number; totalUsers: number; activeAssignments: number; totalDepartments: number };
type Message = { id: string; role: "user" | "assistant"; content: string; error?: boolean };
type Provider = { id: string; name: string; type: string; model: string | null };
type RecentConvo = { id: string; title: string | null; provider: string; updatedAt: string; messages: Array<{ content: string; role: string }> };

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
export default function WorkspacePage() {
  const [me, setMe] = React.useState<any>(null);
  const [stats, setStats] = React.useState<Stats>({ totalAssets:0, totalUsers:0, activeAssignments:0, totalDepartments:0 });
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [allProviders, setAllProviders] = React.useState<Provider[]>([]);
  const [provider, setProvider] = React.useState<Provider | null>(null);
  const [recentConvos, setRecentConvos] = React.useState<RecentConvo[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [leave, setLeave] = React.useState<any>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const todayStr = React.useMemo(() => todayJalaliStr(), []);

  React.useEffect(() => { document.title = "فضای کاری | Arzesh"; }, []);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

  React.useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/auth/me`,       { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/assets`,        { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`,         { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/asset-assignments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`,   { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/ai-settings/providers/active`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/chat-history/conversations/recent?limit=4`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/attendance/me/leave-balance?jYear=${currentJYear()}`, { headers: h }).then(r => r.ok ? r.json() : null),
    ]).then(([meData, assets, users, assignments, depts, providers, recent, lb]) => {
      setMe(meData);
      setLeave(lb);
      setStats({
        totalAssets: Array.isArray(assets) ? assets.length : (assets?.data?.length ?? 0),
        totalUsers:  Array.isArray(users)  ? users.length  : (users?.data?.length  ?? 0),
        activeAssignments: Array.isArray(assignments) ? assignments.filter((a: any) => !a.returnedAt).length : 0,
        totalDepartments:  Array.isArray(depts) ? depts.length : (depts?.data?.length ?? 0),
      });
      if (Array.isArray(recent)) setRecentConvos(recent);
      if (Array.isArray(providers) && providers.length > 0) {
        setAllProviders(providers);
        setProvider(providers[0]);
        setMessages([{ id: "welcome", role: "assistant", content: `سلام! می‌توانم با **${providers[0].name}** به شما کمک کنم. چه می‌خواهید؟` }]);
      } else {
        setMessages([{ id: "welcome", role: "assistant", content: "هیچ مدل هوش مصنوعی فعالی پیکربندی نشده است." }]);
      }
    }).catch(console.error).finally(() => setStatsLoading(false));
  }, [token]);

  React.useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || sending) return;
    if (!provider) { window.location.href = "/dashboard/ai-settings"; return; }
    setInputValue("");
    const newMessages = [...messages, { id: Date.now().toString(), role: "user" as const, content }];
    setMessages(newMessages);
    setSending(true);
    try {
      const history = newMessages.filter(m => m.id !== "welcome").map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API}/ai-settings/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ providerType: provider.type, messages: history, safeMode: true }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: data.content || "پاسخی دریافت نشد.", error: !data.success }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: "assistant", content: "خطا در اتصال.", error: true }]);
    } finally { setSending(false); }
  };

  const role = me?.role;
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
  const isPrivileged     = role === "ADMIN" || role === "MANAGER" || role === "EXPERT";

  const statCards = [
    { title: "کل دارایی‌ها",  value: stats.totalAssets,        icon: Boxes,     color: "blue",   href: "/dashboard/assets" },
    { title: "کاربران سیستم", value: stats.totalUsers,          icon: Users,     color: "green",  href: "/dashboard/users",             show: isAdminOrManager },
    { title: "واگذاری فعال",  value: stats.activeAssignments,   icon: Handshake, color: "amber",  href: "/dashboard/assets/assignments" },
    { title: "دپارتمان‌ها",   value: stats.totalDepartments,    icon: Building,  color: "purple", href: "/dashboard/departments",        show: isAdminOrManager },
  ].filter(s => !("show" in s) || s.show || statsLoading);

  const quickActions = [
    isPrivileged && { title: "دارایی جدید",    href: "/dashboard/assets",              icon: Boxes,        color: "from-blue-500 to-blue-600" },
    isPrivileged && { title: "واگذاری جدید",   href: "/dashboard/assets/assignments",  icon: Handshake,    color: "from-green-500 to-green-600" },
    role === "ADMIN" && { title: "کاربر جدید", href: "/dashboard/users",               icon: Users,        color: "from-purple-500 to-purple-600" },
    { title: "گفتگو با AI",                    href: "/dashboard/chat",                icon: MessageSquare, color: "from-violet-500 to-purple-600" },
    { title: "حضور من",                        href: "/dashboard/attendance/my",        icon: Fingerprint,  color: "from-cyan-500 to-teal-600" },
  ].filter(Boolean) as Array<{ title: string; href: string; icon: any; color: string }>;

  const totalMsgs = recentConvos.reduce((s, c) => s + (c.messages?.length || 0), 0);

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

        {/* ── Stat cards (2×2 grid for better visual weight) ── */}
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

        {/* ── Leave balance ── */}
        {leave && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.1 }}>
            <LeaveCard leave={leave} />
          </motion.div>
        )}

        {/* ── AI mini-chat ── */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25, delay:0.15 }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden card-theme" style={{ minHeight: 280 }}>

          <div className="flex justify-between items-center px-4 py-3 border-theme border-b shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex justify-center items-center bg-ai-gradient shadow rounded-lg w-7 h-7 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              {allProviders.length > 1 ? (
                <select value={provider?.type || ""}
                  onChange={e => { const p = allProviders.find(x => x.type === e.target.value); if (p) { setProvider(p); setMessages([{ id: "welcome", role: "assistant", content: `مدل تغییر یافت به **${p.name}**.` }]); } }}
                  className="bg-transparent text-theme-primary text-sm font-semibold outline-none border-none cursor-pointer">
                  {allProviders.map(p => <option key={p.type} value={p.type}>{p.name}</option>)}
                </select>
              ) : (
                <div>
                  <div className="font-semibold text-theme-primary text-sm">{provider ? provider.name : "دستیار هوشمند"}</div>
                  {provider && <div className="flex items-center gap-1 text-green-500 text-xs"><span className="inline-block bg-green-500 rounded-full w-1.5 h-1.5" />{provider.model || provider.type}</div>}
                </div>
              )}
            </div>
            <Link href="/dashboard/chat" className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs hover:underline shrink-0">
              چت کامل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          <div className="flex-1 space-y-3 px-4 py-4 overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {msg.role === "assistant" && (
                  <div className="flex justify-center items-center bg-ai-gradient shadow mt-0.5 rounded-full w-7 h-7 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "chat-bubble-user" : msg.error ? "chat-bubble-assistant border border-red-200 dark:border-red-800" : "chat-bubble-assistant"}`}>
                  {msg.error && <AlertCircle className="inline w-3.5 h-3.5 text-red-500 me-1" />}
                  <span dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                </div>
                {msg.role === "user" && (
                  <div className="flex justify-center items-center bg-theme-secondary mt-0.5 border border-theme rounded-full w-7 h-7 font-bold text-theme-secondary text-xs shrink-0">
                    {(me?.firstName?.[0] || "م").toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-start gap-2.5">
                <div className="flex justify-center items-center bg-ai-gradient shadow rounded-full w-7 h-7 shrink-0"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
                <div className="flex items-center gap-2 px-4 py-3 chat-bubble-assistant">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span className="text-xs text-theme-muted">در حال پاسخ...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 pb-4 pt-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 chat-input-container">
              <input value={inputValue} onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
                disabled={sending || !provider}
                placeholder={!provider ? "مدل AI پیکربندی نشده..." : "پیام بنویس..."}
                className="flex-1 bg-transparent outline-none text-theme-primary placeholder:text-theme-muted text-sm text-right disabled:opacity-50" />
              <button onClick={() => sendMessage()} disabled={!inputValue.trim() || sending || !provider}
                className="flex justify-center items-center bg-ai-gradient hover:opacity-90 disabled:opacity-40 shadow rounded-xl w-8 h-8 text-white transition-opacity disabled:cursor-not-allowed">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══ RIGHT PANEL ═══ */}
      <motion.div initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.25, delay:0.12 }}
        className="hidden lg:flex flex-col gap-3 w-72 overflow-y-auto pb-2 shrink-0">

        {/* AI usage summary */}
        {recentConvos.length > 0 && (
          <div className="card-theme p-4">
            <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> مصرف AI
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-theme-secondary rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-violet-600">{faNum(recentConvos.length)}</div>
                <div className="text-[11px] text-theme-muted mt-0.5">گفتگو اخیر</div>
              </div>
              <div className="bg-theme-secondary rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{faNum(totalMsgs)}</div>
                <div className="text-[11px] text-theme-muted mt-0.5">پیام تبادل‌شده</div>
              </div>
            </div>
            <Link href="/dashboard/chat" className="flex items-center justify-center gap-1 text-blue-500 text-xs hover:underline">
              مشاهده همه گفتگوها <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
        )}

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

        {/* Recent conversations */}
        <div className="card-theme p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-theme-muted text-xs uppercase tracking-wider">گفتگوهای اخیر</h3>
            <Link href="/dashboard/chat" className="text-blue-500 text-[10px] hover:underline flex items-center gap-0.5">همه <ArrowLeft className="w-2.5 h-2.5" /></Link>
          </div>
          {recentConvos.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <MessageSquare className="w-6 h-6 text-theme-muted/30 mb-1" />
              <p className="text-theme-muted text-xs">هنوز گفتگویی ندارید</p>
              <Link href="/dashboard/chat" className="btn-primary text-xs px-3 py-1.5 mt-2 flex items-center gap-1"><Plus className="w-3 h-3" /> شروع گفتگو</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentConvos.map(c => (
                <Link key={c.id} href={`/dashboard/chat?id=${c.id}`}
                  className="flex items-start gap-2 p-2 rounded-xl hover:bg-theme-hover transition-colors group">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-theme-secondary text-xs font-medium truncate">{c.title || "گفتگوی جدید"}</div>
                    <div className="text-theme-muted text-[10px] truncate">{c.messages[0]?.content?.substring(0, 40) || "..."}</div>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-theme-muted opacity-0 group-hover:opacity-100 shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        {isAdminOrManager && (
          <div className="card-theme p-4">
            <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">دسترسی سریع</h3>
            <div className="space-y-1">
              {[
                { icon: Brain,     label: "حافظه AI",   href: "/dashboard/chat",    color: "text-purple-500" },
                { icon: BarChart3, label: "گزارش‌ها",    href: "/dashboard/reports", color: "text-blue-500" },
                { icon: Boxes,     label: "دارایی‌ها",   href: "/dashboard/assets",  color: "text-green-500" },
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
