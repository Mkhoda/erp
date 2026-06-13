"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Paperclip, Mic, Plus, Search,
  MessageSquare, Trash2, MoreHorizontal, Copy, ThumbsUp, ThumbsDown,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type Conversation = {
  id: string;
  title: string;
  preview: string;
  time: string;
  active?: boolean;
};

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "1", title: "دارایی‌های تخصیص‌نیافته", preview: "لیست دارایی‌هایی که...", time: "همین الان", active: true },
  { id: "2", title: "گزارش ماهانه فروردین", preview: "خلاصه آماری دارایی‌ها...", time: "دیروز" },
  { id: "3", title: "کاربران جدید این هفته", preview: "در این هفته ۳ کاربر...", time: "۲ روز پیش" },
  { id: "4", title: "راهنمای ثبت دارایی", preview: "برای ثبت یک دارایی جدید...", time: "۱ هفته پیش" },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content: `سلام! من **دستیار هوشمند Arzesh** هستم 🤖

می‌توانم در موارد زیر کمک کنم:
- 📦 مدیریت و جستجوی دارایی‌ها
- 👥 اطلاعات کاربران و دپارتمان‌ها
- 📊 تهیه گزارش و آمار
- ⚡ اجرای اقدامات سریع در سیستم

**چه کمکی می‌توانم بکنم؟**`,
    timestamp: new Date(),
  },
];

const SUGGESTIONS = [
  "دارایی‌های تخصیص‌نیافته را نشان بده",
  "کاربران فعال این ماه چه کسانی هستند؟",
  "یک گزارش کامل از دارایی‌های ساختمان مرکزی بده",
  "آخرین واگذاری‌ها را لیست کن",
];

function MarkdownText({ content }: { content: string }) {
  // Minimal markdown: bold, line breaks, bullet lists
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const [conversations] = React.useState(MOCK_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = React.useState("1");
  const [messages, setMessages] = React.useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [me, setMe] = React.useState<any>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { document.title = "گفتگو با AI | Arzesh AI"; }, []);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setMe)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;

    setInput("");
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: "user", content, timestamp: new Date() },
    ]);
    setIsTyping(true);

    // Placeholder — swap with real SSE streaming
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `پاسخ به: **"${content}"**\n\nاتصال به موتور هوش مصنوعی در حال پیاده‌سازی است. این پیام یک پاسخ آزمایشی است.\n\nبرای فعال کردن AI واقعی، کلید API را در تنظیمات مدیریتی وارد کنید.`,
          timestamp: new Date(),
        },
      ]);
    }, 1500);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const initial = (me?.firstName?.[0] || "م").toUpperCase();

  return (
    <div className="flex h-[calc(100vh-88px)] gap-0 rounded-2xl overflow-hidden border border-theme bg-theme-card" dir="rtl">

      {/* ── Conversation sidebar ── */}
      <div className="w-64 shrink-0 border-l border-theme flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-theme">
          <button
            className="w-full flex items-center gap-2 btn-theme-primary py-2.5 px-3 text-sm justify-center rounded-xl"
            onClick={() => setMessages(INITIAL_MESSAGES)}
          >
            <Plus className="w-4 h-4" />
            گفتگوی جدید
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-theme">
          <div className="flex items-center gap-2 bg-theme-secondary border border-theme rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-theme-muted shrink-0" />
            <input
              placeholder="جستجو..."
              className="flex-1 bg-transparent text-sm text-theme-primary placeholder:text-theme-muted outline-none text-right"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-1">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              className={`w-full text-right px-3 py-2.5 flex items-start gap-2.5 hover:bg-theme-hover transition-colors group ${
                conv.id === activeConvId ? "bg-blue-50 dark:bg-blue-950/30" : ""
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                conv.id === activeConvId ? "bg-blue-100 dark:bg-blue-900/60" : "bg-theme-secondary"
              }`}>
                <MessageSquare className={`w-3.5 h-3.5 ${conv.id === activeConvId ? "text-blue-600 dark:text-blue-400" : "text-theme-muted"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${conv.id === activeConvId ? "text-blue-700 dark:text-blue-300" : "text-theme-primary"}`}>
                  {conv.title}
                </div>
                <div className="text-xs text-theme-muted truncate mt-0.5">{conv.preview}</div>
                <div className="text-[10px] text-theme-muted mt-0.5">{conv.time}</div>
              </div>
              <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-theme-hover text-theme-muted transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ai-gradient flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-theme-primary text-sm">دستیار هوشمند Arzesh</div>
              <div className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                آنلاین
              </div>
            </div>
          </div>
          <button className="p-2 rounded-xl hover:bg-theme-hover text-theme-muted transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                {msg.role === "assistant" ? (
                  <div className="w-8 h-8 rounded-full bg-ai-gradient flex items-center justify-center shrink-0 shadow mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-theme-secondary border border-theme flex items-center justify-center shrink-0 text-xs font-bold text-theme-secondary mt-0.5">
                    {initial}
                  </div>
                )}

                {/* Bubble */}
                <div className="max-w-[72%] space-y-1">
                  <div className={msg.role === "user" ? "chat-bubble-user px-4 py-3" : "chat-bubble-assistant px-4 py-3"}>
                    {msg.role === "assistant"
                      ? <MarkdownText content={msg.content} />
                      : <p className="text-sm leading-relaxed">{msg.content}</p>
                    }
                  </div>

                  {/* Message actions */}
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 px-1 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100">
                      <button className="p-1 rounded hover:bg-theme-hover text-theme-muted" title="کپی">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-theme-hover text-theme-muted" title="مفید بود">
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-theme-hover text-theme-muted" title="مفید نبود">
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 items-start"
            >
              <div className="w-8 h-8 rounded-full bg-ai-gradient flex items-center justify-center shrink-0 shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="chat-bubble-assistant px-4 py-3 flex items-center gap-1.5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </motion.div>
          )}

          {/* Suggestion chips — shown only at start */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 justify-center pt-4">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-2 text-sm rounded-xl bg-theme-secondary border border-theme text-theme-secondary hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:border-blue-800 dark:hover:text-blue-400 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-5 pt-2">
          <div className="chat-input-container flex items-end gap-3 px-4 py-3">
            <div className="flex gap-1 pb-0.5">
              <button className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors">
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={handleKey}
              placeholder="پیام بنویس... (Enter برای ارسال، Shift+Enter برای خط جدید)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-theme-primary placeholder:text-theme-muted outline-none text-right resize-none max-h-40 overflow-y-auto leading-6"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className="w-9 h-9 rounded-xl bg-ai-gradient flex items-center justify-center text-white shadow-md shadow-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-[10px] text-theme-muted mt-2">
            Arzesh AI می‌تواند اشتباه کند. اطلاعات مهم را تأیید کنید.
          </p>
        </div>
      </div>
    </div>
  );
}
