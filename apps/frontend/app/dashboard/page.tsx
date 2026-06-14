"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Send, Paperclip, Mic, ArrowLeft,
  Boxes, Users, Handshake, Building, BarChart3,
  MessageSquare, Brain, Workflow, Bot, Plus,
  Clock, Activity, CheckCircle, ChevronLeft,
  Lightbulb, ArrowUpRight, Zap,
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
};

const QUICK_PROMPTS = [
  { label: "دارایی‌های تخصیص‌نیافته", icon: Boxes },
  { label: "درخواست‌های مرخصی معلق", icon: Clock },
  { label: "گزارش ماهانه دارایی", icon: BarChart3 },
  { label: "آمار کلی سیستم", icon: Activity },
];

const QUICK_ACTIONS = [
  { title: "دارایی جدید", subtitle: "ثبت دارایی", href: "/dashboard/assets", icon: Boxes, color: "blue" },
  { title: "واگذاری جدید", subtitle: "تخصیص دارایی", href: "/dashboard/assets/assignments", icon: Handshake, color: "green" },
  { title: "کاربر جدید", subtitle: "افزودن کاربر", href: "/dashboard/users", icon: Users, color: "purple" },
  { title: "گفتگو با AI", subtitle: "چت هوشمند", href: "/dashboard/chat", icon: MessageSquare, color: "ai" },
];

const colorVariants: Record<string, { bg: string; icon: string; border: string }> = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/60",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-950/30",
    icon: "bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-400",
    border: "border-green-100 dark:border-green-900/60",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    icon: "bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400",
    border: "border-purple-100 dark:border-purple-900/60",
  },
  ai: {
    bg: "glass-ai",
    icon: "bg-ai-gradient text-white",
    border: "border-purple-200/60 dark:border-purple-800/40",
  },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  return "عصر بخیر";
}

export default function WorkspacePage() {
  const router = useRouter();

  const [me, setMe] = React.useState<any>(null);
  const [stats, setStats] = React.useState<Stats>({ totalAssets: 0, totalUsers: 0, activeAssignments: 0, totalDepartments: 0 });
  const [statsLoading, setStatsLoading] = React.useState(true);

  // Chat state
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "سلام! من دستیار هوشمند Arzesh هستم. می‌توانم اطلاعات دارایی‌ها، کاربران، گزارش‌ها و هر سوالی درباره سیستم را به شما بدهم. چطور می‌توانم کمک کنم؟",
    },
  ]);
  const [inputValue, setInputValue] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
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
    ]).then(([meData, assets, users, assignments, depts]) => {
      setMe(meData);
      const assetsArr = Array.isArray(assets) ? assets : [];
      const usersArr = Array.isArray(users) ? users : [];
      const assignArr = Array.isArray(assignments) ? assignments : [];
      const deptsArr = Array.isArray(depts) ? depts : [];
      setStats({
        totalAssets: assetsArr.length,
        totalUsers: usersArr.length,
        activeAssignments: assignArr.filter((a: any) => !a.returnedAt).length,
        totalDepartments: deptsArr.length,
      });
    }).catch(console.error).finally(() => setStatsLoading(false));
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content) return;

    setInputValue("");
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content }]);
    setIsTyping(true);

    // Placeholder AI response — replace with real streaming endpoint
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `قابلیت گفتگوی هوش مصنوعی در حال پیاده‌سازی است. برای چت کامل به صفحه «گفتگو با AI» بروید.`,
        },
      ]);
    }, 1400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const statCards = [
    { title: "کل دارایی‌ها", value: stats.totalAssets, icon: Boxes, color: "blue", href: "/dashboard/assets" },
    { title: "کاربران سیستم", value: stats.totalUsers, icon: Users, color: "green", href: "/dashboard/users" },
    { title: "واگذاری فعال", value: stats.activeAssignments, icon: Handshake, color: "amber", href: "/dashboard/assets/assignments" },
    { title: "دپارتمان‌ها", value: stats.totalDepartments, icon: Building, color: "purple", href: "/dashboard/departments" },
  ];

  const statColor: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-88px)]" dir="rtl">

      {/* ── CENTER: Chat Workspace ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-4"
        >
          <h1 className="font-bold text-theme-primary text-xl">
            {greeting()}، {me?.firstName || "کاربر"} 👋
          </h1>
          <p className="mt-0.5 text-theme-muted text-sm">
            {new Date().toLocaleDateString("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </motion.div>

        {/* Stat row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="gap-3 grid grid-cols-4 mb-4"
        >
          {statCards.map((s) => (
            <Link
              key={s.title}
              href={s.href}
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

        {/* Chat area */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex flex-col flex-1 min-h-0 overflow-hidden card-theme"
        >
          {/* Chat header */}
          <div className="flex justify-between items-center px-4 py-3 border-theme border-b">
            <div className="flex items-center gap-2.5">
              <div className="flex justify-center items-center bg-ai-gradient shadow rounded-lg w-7 h-7">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-theme-primary text-sm">دستیار هوشمند</div>
                <div className="flex items-center gap-1 text-green-500 text-xs">
                  <span className="inline-block bg-green-500 rounded-full w-1.5 h-1.5" />
                  آنلاین
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/chat"
              className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs hover:underline"
            >
              گفتگوی کامل
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 px-4 py-4 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex justify-center items-center bg-ai-gradient shadow mt-0.5 rounded-full w-7 h-7 shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[78%] ${msg.role === "user" ? "chat-bubble-user px-4 py-2.5 text-sm" : "chat-bubble-assistant px-4 py-2.5 text-sm"}`}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="flex justify-center items-center bg-theme-secondary mt-0.5 border border-theme rounded-full w-7 h-7 font-bold text-theme-secondary text-xs shrink-0">
                    {(me?.firstName?.[0] || "م").toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start gap-2.5">
                <div className="flex justify-center items-center bg-ai-gradient shadow rounded-full w-7 h-7 shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 chat-bubble-assistant">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => sendMessage(p.label)}
                className="flex items-center gap-1.5 bg-theme-secondary hover:bg-blue-50 dark:hover:bg-blue-950/30 px-3 py-1.5 border border-theme hover:border-blue-200 dark:hover:border-blue-800 rounded-full text-theme-secondary hover:text-blue-600 dark:hover:text-blue-400 text-xs whitespace-nowrap transition-all shrink-0"
              >
                <p.icon className="w-3 h-3" />
                {p.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 px-3 py-2 chat-input-container">
              <div className="flex gap-1">
                <button className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted transition-colors" title="پیوست">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted transition-colors" title="صوت">
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="بپرس، دستور بده، یا جستجو کن..."
                className="flex-1 bg-transparent outline-none text-theme-primary placeholder:text-theme-muted text-sm text-right"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim()}
                className="flex justify-center items-center bg-ai-gradient hover:opacity-90 disabled:opacity-40 shadow rounded-xl w-8 h-8 text-white transition-opacity disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="hidden lg:flex flex-col gap-4 w-72 overflow-y-auto"
      >
        {/* Quick Actions */}
        <div className="p-4 card-theme">
          <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">اقدامات سریع</h3>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((qa) => {
              const cv = colorVariants[qa.color] || colorVariants.blue;
              return (
                <Link
                  key={qa.title}
                  href={qa.href}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${cv.bg} ${cv.border} hover:shadow-sm transition-all quick-action-card`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${qa.color === "ai" ? "bg-ai-gradient" : cv.icon} shrink-0`}>
                    <qa.icon className={`w-4 h-4 ${qa.color === "ai" ? "text-white" : ""}`} />
                  </div>
                  <div>
                    <div className="font-medium text-theme-primary text-sm">{qa.title}</div>
                    <div className="text-theme-muted text-xs">{qa.subtitle}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="p-4 card-theme">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="font-bold text-theme-muted text-xs uppercase tracking-wider">پیشنهادات AI</h3>
          </div>
          <div className="space-y-2">
            {[
              "دارایی‌های منقضی را بررسی کن",
              "گزارش ماهانه دارایی بگیر",
              "درخواست‌های معلق را تأیید کن",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => inputRef.current?.focus()}
                className="flex items-center gap-2 bg-blue-50/60 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 px-3 py-2.5 border border-blue-100 dark:border-blue-900/40 rounded-xl w-full text-blue-600 dark:text-blue-400 text-sm text-right transition-all"
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* AI Platform shortcuts */}
        <div className="p-4 card-theme">
          <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">پلتفرم AI</h3>
          <div className="gap-2 grid grid-cols-2">
            {[
              { icon: MessageSquare, label: "چت", href: "/dashboard/chat", color: "text-blue-500" },
              { icon: Brain, label: "دانش", href: "/dashboard/knowledge", color: "text-purple-500" },
              { icon: Workflow, label: "گردش‌کار", href: "/dashboard/workflows", color: "text-green-500" },
              { icon: Bot, label: "عوامل", href: "/dashboard/agents", color: "text-amber-500" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex flex-col items-center gap-1.5 bg-theme-secondary hover:bg-theme-hover p-3 border border-theme rounded-xl transition-all quick-action-card"
              >
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="font-medium text-theme-secondary text-xs">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Team Activity — empty state */}
        <div className="p-4 card-theme">
          <h3 className="mb-3 font-bold text-theme-muted text-xs uppercase tracking-wider">فعالیت تیم</h3>
          <div className="flex flex-col justify-center items-center py-6 text-center">
            <Activity className="mb-2 w-8 h-8 text-theme-muted/40" />
            <p className="text-theme-muted text-xs">هنوز فعالیتی ثبت نشده است</p>
            <p className="mt-1 text-[10px] text-theme-muted/60">فعالیت‌های تیم اینجا نمایش داده می‌شوند</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
