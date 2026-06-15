"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Send, ArrowLeft,
  Boxes, Users, Handshake, Building, BarChart3,
  MessageSquare, Plus, Activity, ArrowUpRight,
  Loader2, AlertCircle, Brain, Check, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Jalali calendar (pure math, no dependency) ─────────────────────────────
function toJalali(gy: number, gm: number, gd: number) {
  const g_d_no = [31,28+(gy%4===0&&(gy%100!==0||gy%400===0)?1:0),31,30,31,30,31,31,30,31,30,31];
  let jy = gy - 1600, jm = 0, jd = 0;
  let g_d_no2 = 365*gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) + Math.floor((gy+399)/400);
  for (let i=0;i<gm-1;i++) g_d_no2 += g_d_no[i];
  g_d_no2 += gd - 1;
  let j_d_no = g_d_no2 - 79;
  const j_np = Math.floor(j_d_no/12053); j_d_no %= 12053;
  jy = 979 + 33*j_np + 4*Math.floor(j_d_no/1461);
  j_d_no %= 1461;
  if (j_d_no >= 366) { jy += Math.floor((j_d_no-1)/365); j_d_no = (j_d_no-1)%365; }
  const il = [0,31,60,91,121,152,182,213,244,274,305,335];
  for (let i=11;i>=0;i--) { if (j_d_no >= il[i]) { jm = i+1; jd = j_d_no - il[i] + 1; break; } }
  return { jy, jm, jd };
}
function jalaliMonthLen(jy: number, jm: number) { return jm<=6?31:jm<=11?30:jy%4===3?30:29; }
function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = jy <= 979 ? 1600 : 1976;
  if (jy <= 979) jy += 979; else jy -= 979;
  let days = 365*jy + Math.floor(jy/33)*8 + Math.floor((jy%33+3)/4) + 78 + jd + (jm<=6?(jm-1)*31:((jm-1)*30)+6);
  gy += 400*Math.floor(days/146097); days %= 146097;
  if (days > 36524) { gy += 100*Math.floor(--days/36524); days %= 36524; if (days >= 365) days++; }
  gy += 4*Math.floor(days/1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days-1)/365); days = (days-1)%365; }
  const gd = days+1;
  const mArr = [0,31,28+(gy%4===0&&(gy%100!==0||gy%400===0)?1:0),31,30,31,30,31,31,30,31,30,31];
  let gm = 0;
  for (let i=1;i<13;i++) { if (gd<=mArr[i]) {gm=i;break;} else mArr[i+1]+=mArr[i]; }
  return new Date(gy, gm-1, gd - (mArr[gm-1] || 0));
}
function jalaliFirstWeekday(jy: number, jm: number) {
  const g = jalaliToGregorian(jy, jm, 1);
  return (g.getDay() + 1) % 7; // 0=Saturday (Farsi week starts Sat)
}
const J_MONTH_NAMES = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const J_DAYS = ["ش","ی","د","س","چ","پ","ج"];

function PersianCalendar() {
  const today = new Date();
  const todayJ = toJalali(today.getFullYear(), today.getMonth()+1, today.getDate());
  const [viewYear, setViewYear] = React.useState(todayJ.jy);
  const [viewMonth, setViewMonth] = React.useState(todayJ.jm);

  const prev = () => { if(viewMonth===1){setViewMonth(12);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); };
  const next = () => { if(viewMonth===12){setViewMonth(1);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); };

  const len = jalaliMonthLen(viewYear, viewMonth);
  const startDay = jalaliFirstWeekday(viewYear, viewMonth);
  const cells: (number|null)[] = [...Array(startDay).fill(null), ...Array.from({length:len},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-4 card-theme" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="text-center">
          <div className="font-bold text-theme-primary text-sm">{J_MONTH_NAMES[viewMonth-1]}</div>
          <div className="text-theme-muted text-[11px]">{viewYear.toLocaleString("fa-IR")}</div>
        </div>
        <button onClick={next} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {J_DAYS.map(d => <div key={d} className="text-center text-[10px] font-medium text-theme-muted py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          const isToday = day === todayJ.jd && viewMonth === todayJ.jm && viewYear === todayJ.jy;
          return (
            <div key={i} className={`text-center text-xs py-1 rounded-lg leading-none
              ${!day ? "" : isToday
                ? "bg-blue-600 text-white font-bold"
                : "text-theme-secondary hover:bg-theme-hover cursor-default"
              }`}>
              {day ? day.toLocaleString("fa-IR") : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Personal TODO ─────────────────────────────────────────────────────────
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

  return (
    <div className="p-4 card-theme" dir="rtl">
      <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" /> یادداشت‌های من
      </h3>

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
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {todos.map(t => (
            <div key={t.id} className="flex items-center gap-2 group">
              <button onClick={() => toggle(t.id)}
                className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-all ${t.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-theme hover:border-blue-400"}`}>
                {t.done && <Check className="w-2.5 h-2.5" />}
              </button>
              <span className={`flex-1 text-xs leading-snug ${t.done ? "line-through text-theme-muted" : "text-theme-secondary"}`}>{t.title}</span>
              <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-500 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────
type Stats = { totalAssets: number; totalUsers: number; activeAssignments: number; totalDepartments: number };
type Message = { id: string; role: "user" | "assistant"; content: string; error?: boolean };
type Provider = { id: string; name: string; type: string; model: string | null };
type RecentConvo = { id: string; title: string | null; provider: string; updatedAt: string; messages: Array<{ content: string; role: string }> };

const statColor: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  purple: "text-purple-600 dark:text-purple-400",
};

export default function WorkspacePage() {
  const [me, setMe] = React.useState<any>(null);
  const [stats, setStats] = React.useState<Stats>({ totalAssets: 0, totalUsers: 0, activeAssignments: 0, totalDepartments: 0 });
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [allProviders, setAllProviders] = React.useState<Provider[]>([]);
  const [provider, setProvider] = React.useState<Provider | null>(null);
  const [recentConvos, setRecentConvos] = React.useState<RecentConvo[]>([]);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { document.title = "فضای کاری | Arzesh AI"; }, []);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

  React.useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/auth/me`, { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/assets`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/asset-assignments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/ai-settings/providers/active`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/chat-history/conversations/recent?limit=4`, { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([meData, assets, users, assignments, depts, providers, recent]) => {
      setMe(meData);
      setStats({
        totalAssets: Array.isArray(assets) ? assets.length : (assets?.data?.length ?? 0),
        totalUsers: Array.isArray(users) ? users.length : (users?.data?.length ?? 0),
        activeAssignments: Array.isArray(assignments) ? assignments.filter((a: any) => !a.returnedAt).length : 0,
        totalDepartments: Array.isArray(depts) ? depts.length : (depts?.data?.length ?? 0),
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
  const isPrivileged = role === "ADMIN" || role === "MANAGER" || role === "EXPERT";

  // Show stat cards relevant to the user's access
  const statCards = [
    { title: "کل دارایی‌ها", value: stats.totalAssets, icon: Boxes, color: "blue", href: "/dashboard/assets", show: isPrivileged },
    { title: "کاربران سیستم", value: stats.totalUsers, icon: Users, color: "green", href: "/dashboard/users", show: isAdminOrManager },
    { title: "واگذاری فعال", value: stats.activeAssignments, icon: Handshake, color: "amber", href: "/dashboard/assets/assignments", show: isPrivileged },
    { title: "دپارتمان‌ها", value: stats.totalDepartments, icon: Building, color: "purple", href: "/dashboard/departments", show: isAdminOrManager },
  ].filter(s => s.show || statsLoading);

  const quickActions = [
    isPrivileged && { title: "دارایی جدید", href: "/dashboard/assets", icon: Boxes, color: "from-blue-500 to-blue-600" },
    isPrivileged && { title: "واگذاری جدید", href: "/dashboard/assets/assignments", icon: Handshake, color: "from-green-500 to-green-600" },
    role === "ADMIN" && { title: "کاربر جدید", href: "/dashboard/users", icon: Users, color: "from-purple-500 to-purple-600" },
    { title: "گفتگو با AI", href: "/dashboard/chat", icon: MessageSquare, color: "from-violet-500 to-purple-600" },
  ].filter(Boolean) as Array<{ title: string; href: string; icon: any; color: string }>;

  const cols = statCards.length >= 4 ? "grid-cols-4" : statCards.length === 3 ? "grid-cols-3" : statCards.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="flex gap-4 h-[calc(100vh-88px)]" dir="rtl">

      {/* ── CENTER ── */}
      <div className="flex flex-col flex-1 min-w-0 gap-4">

        {/* Stat row — only render once me has loaded */}
        {statCards.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className={`grid gap-3 ${cols}`}>
            {statCards.map(s => (
              <Link key={s.title} href={s.href}
                className="group flex flex-col gap-1 hover:shadow-md p-3 transition-all card-theme quick-action-card">
                <div className="flex justify-between items-center">
                  <s.icon className={`w-4 h-4 ${statColor[s.color]}`} />
                  <ArrowUpRight className="opacity-0 group-hover:opacity-100 w-3 h-3 text-theme-muted transition-opacity" />
                </div>
                <div className={`text-xl font-bold ${statColor[s.color]}`}>
                  {statsLoading ? <span className="block rounded w-10 h-6 skeleton" /> : s.value.toLocaleString("fa-IR")}
                </div>
                <div className="text-theme-muted text-xs">{s.title}</div>
              </Link>
            ))}
          </motion.div>
        )}

        {/* Mini chat */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.07 }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden card-theme">
          <div className="flex justify-between items-center px-4 py-3 border-theme border-b">
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
                  <span dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
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

          <div className="px-4 pb-4 pt-2">
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

      {/* ── RIGHT PANEL ── */}
      <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.12 }}
        className="hidden lg:flex flex-col gap-4 w-64 overflow-y-auto">

        {/* Persian Calendar */}
        <PersianCalendar />

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="p-4 card-theme">
            <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">اقدامات سریع</h3>
            <div className="space-y-2">
              {quickActions.map(qa => (
                <Link key={qa.title} href={qa.href}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-theme-secondary border border-theme hover:bg-theme-hover transition-all quick-action-card">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br ${qa.color} shrink-0`}>
                    <qa.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-medium text-theme-primary text-sm">{qa.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Personal TODO */}
        {token && <TodoWidget token={token} />}

        {/* Recent conversations */}
        <div className="p-4 card-theme">
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
          <div className="p-4 card-theme">
            <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">دسترسی سریع</h3>
            <div className="space-y-1">
              {[
                { icon: Brain, label: "حافظه AI", href: "/dashboard/chat", color: "text-purple-500" },
                { icon: BarChart3, label: "گزارش‌ها", href: "/dashboard/reports", color: "text-blue-500" },
                { icon: Boxes, label: "دارایی‌ها", href: "/dashboard/assets", color: "text-green-500" },
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
