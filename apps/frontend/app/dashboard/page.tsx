"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Send, ArrowLeft,
  Boxes, Users, Handshake, Building, BarChart3,
  MessageSquare, Plus, Activity, ArrowUpRight,
  Loader2, AlertCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Stats = {
  totalAssets: number;
  totalUsers: number;
  activeAssignments: number;
  totalDepartments: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
};

type Provider = { id: string; name: string; type: string; model: string | null };

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
  const [provider, setProvider] = React.useState<Provider | null>(null);

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { document.title = "فضای کاری | Arzesh AI"; }, []);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/auth/me`, { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/assets`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/asset-assignments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/ai-settings/providers/active`, { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([meData, assets, users, assignments, depts, providers]) => {
      setMe(meData);
      setStats({
        totalAssets: Array.isArray(assets) ? assets.length : 0,
        totalUsers: Array.isArray(users) ? users.length : 0,
        activeAssignments: Array.isArray(assignments) ? assignments.filter((a: any) => !a.returnedAt).length : 0,
        totalDepartments: Array.isArray(depts) ? depts.length : 0,
      });
      if (Array.isArray(providers) && providers.length > 0) {
        setProvider(providers[0]);
        setMessages([{ id: "welcome", role: "assistant", content: `سلام! می‌توانم با **${providers[0].name}** به شما کمک کنم. چه می‌خواهید؟` }]);
      } else {
        setMessages([{ id: "welcome", role: "assistant", content: "هیچ مدل هوش مصنوعی فعالی پیکربندی نشده است. از منوی تنظیمات یک مدل فعال کنید." }]);
      }
    }).catch(console.error).finally(() => setStatsLoading(false));
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || sending) return;
    if (!provider) { window.location.href = "/dashboard/ai-settings"; return; }

    setInputValue("");
    const newMessages = [...messages, { id: Date.now().toString(), role: "user" as const, content }];
    setMessages(newMessages);
    setSending(true);

    try {
      const token = localStorage.getItem("token");
      const history = newMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API}/ai-settings/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ providerType: provider.type, messages: history, safeMode: true }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || "پاسخی دریافت نشد.",
        error: !data.success,
      }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "خطا در اتصال به سرور.", error: true }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
  };

  const role = me?.role;
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";

  const statCards = [
    { title: "کل دارایی‌ها", value: stats.totalAssets, icon: Boxes, color: "blue", href: "/dashboard/assets" },
    { title: "کاربران سیستم", value: stats.totalUsers, icon: Users, color: "green", href: "/dashboard/users" },
    { title: "واگذاری فعال", value: stats.activeAssignments, icon: Handshake, color: "amber", href: "/dashboard/assets/assignments" },
    { title: "دپارتمان‌ها", value: stats.totalDepartments, icon: Building, color: "purple", href: "/dashboard/departments" },
  ].filter(s => isAdminOrManager || (s.href !== "/dashboard/users" && s.href !== "/dashboard/departments"));

  // Role-aware quick actions
  const quickActions = [
    isAdminOrManager && { title: "دارایی جدید", href: "/dashboard/assets", icon: Boxes, color: "from-blue-500 to-blue-600" },
    isAdminOrManager && { title: "واگذاری جدید", href: "/dashboard/assets/assignments", icon: Handshake, color: "from-green-500 to-green-600" },
    role === "ADMIN" && { title: "کاربر جدید", href: "/dashboard/users", icon: Users, color: "from-purple-500 to-purple-600" },
    { title: "گفتگو با AI", href: "/dashboard/chat", icon: MessageSquare, color: "from-violet-500 to-purple-600" },
  ].filter(Boolean) as Array<{ title: string; href: string; icon: any; color: string }>;

  return (
    <div className="flex gap-4 h-[calc(100vh-88px)]" dir="rtl">

      {/* ── CENTER ── */}
      <div className="flex flex-col flex-1 min-w-0 gap-4">

        {/* Stat row */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className={`grid gap-3 ${statCards.length === 4 ? "grid-cols-4" : statCards.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {statCards.map(s => (
            <Link key={s.title} href={s.href}
              className="group flex flex-col gap-1 hover:shadow-md p-3 transition-all card-theme quick-action-card"
            >
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

        {/* Mini chat */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.07 }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden card-theme"
        >
          {/* Chat header */}
          <div className="flex justify-between items-center px-4 py-3 border-theme border-b">
            <div className="flex items-center gap-2.5">
              <div className="flex justify-center items-center bg-ai-gradient shadow rounded-lg w-7 h-7">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-theme-primary text-sm">
                  {provider ? provider.name : "دستیار هوشمند"}
                </div>
                {provider && (
                  <div className="flex items-center gap-1 text-green-500 text-xs">
                    <span className="inline-block bg-green-500 rounded-full w-1.5 h-1.5" />
                    {provider.model || provider.type}
                  </div>
                )}
              </div>
            </div>
            <Link href="/dashboard/chat" className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs hover:underline">
              چت کامل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Messages */}
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
                  {/* Simple markdown bold support */}
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
                <div className="flex justify-center items-center bg-ai-gradient shadow rounded-full w-7 h-7 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex items-center gap-2 px-4 py-3 chat-bubble-assistant">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span className="text-xs text-theme-muted">در حال پاسخ...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 chat-input-container">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !provider}
                placeholder={!provider ? "مدل AI پیکربندی نشده..." : "پیام بنویس..."}
                className="flex-1 bg-transparent outline-none text-theme-primary placeholder:text-theme-muted text-sm text-right disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || sending || !provider}
                className="flex justify-center items-center bg-ai-gradient hover:opacity-90 disabled:opacity-40 shadow rounded-xl w-8 h-8 text-white transition-opacity disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.12 }}
        className="hidden lg:flex flex-col gap-4 w-64 overflow-y-auto"
      >
        {/* Quick Actions */}
        <div className="p-4 card-theme">
          <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">اقدامات سریع</h3>
          <div className="space-y-2">
            {quickActions.map(qa => (
              <Link key={qa.title} href={qa.href}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-theme-secondary border border-theme hover:bg-theme-hover transition-all quick-action-card"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br ${qa.color} shrink-0`}>
                  <qa.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-medium text-theme-primary text-sm">{qa.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Chat history shortcut */}
        <div className="p-4 card-theme">
          <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">دسترسی سریع</h3>
          <div className="space-y-2">
            {[
              { icon: MessageSquare, label: "چت کامل", href: "/dashboard/chat", color: "text-blue-500" },
              isAdminOrManager && { icon: BarChart3, label: "گزارش‌ها", href: "/dashboard/reports", color: "text-purple-500" },
              isAdminOrManager && { icon: Boxes, label: "دارایی‌ها", href: "/dashboard/assets", color: "text-green-500" },
            ].filter(Boolean).map((item: any) => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 hover:bg-theme-hover px-3 py-2 rounded-xl transition-colors"
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-theme-secondary text-sm">{item.label}</span>
                <ArrowUpRight className="w-3 h-3 text-theme-muted me-auto" />
              </Link>
            ))}
          </div>
        </div>

        {/* Team Activity */}
        <div className="p-4 card-theme">
          <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">فعالیت اخیر</h3>
          <div className="flex flex-col justify-center items-center py-6 text-center">
            <Activity className="mb-2 w-8 h-8 text-theme-muted/40" />
            <p className="text-theme-muted text-xs">فعالیتی ثبت نشده</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
