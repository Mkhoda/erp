"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Plus, Search, MessageSquare, Trash2,
  ChevronDown, Copy, ThumbsUp, ThumbsDown, Shield, ShieldOff,
  AlertCircle, Loader2, Bot,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  providerType?: string;
  latencyMs?: number;
  error?: boolean;
};

type Provider = {
  id: string;
  name: string;
  type: string;
  model: string | null;
  isActive: boolean;
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-emerald-500",
  anthropic: "bg-orange-500",
  gemini: "bg-blue-500",
  deepseek: "bg-indigo-500",
  agnes: "bg-violet-500",
  custom: "bg-gray-500",
};

const SUGGESTIONS = [
  "دارایی‌های تخصیص‌نیافته را نشان بده",
  "کاربران فعال این ماه چه کسانی هستند؟",
  "گزارش کاملی از دارایی‌های ساختمان مرکزی بده",
  "آخرین واگذاری‌ها را لیست کن",
];

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-60" />
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`(.*?)`/g, "<code class='bg-black/10 dark:bg-white/10 px-1 rounded text-xs font-mono'>$1</code>") }} />
            </div>
          );
        }
        if (line.startsWith("# ")) return <h3 key={i} className="font-bold text-base mt-2">{line.slice(2)}</h3>;
        if (line.startsWith("## ")) return <h4 key={i} className="font-semibold mt-2">{line.slice(3)}</h4>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`(.*?)`/g, "<code class='bg-black/10 dark:bg-white/10 px-1 rounded text-xs font-mono'>$1</code>") }} />
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  React.useEffect(() => { document.title = "گفتگو با AI | Arzesh AI"; }, []);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [me, setMe] = React.useState<any>(null);
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = React.useState<string>("");
  const [providerOpen, setProviderOpen] = React.useState(false);
  const [safeMode, setSafeMode] = React.useState(true);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [conversations, setConversations] = React.useState<Array<{ id: string; title: string; messages: Message[] }>>([
    { id: "1", title: "گفتگوی جدید", messages: [] },
  ]);
  const [activeConvId, setActiveConvId] = React.useState("1");
  const [convQuery, setConvQuery] = React.useState("");

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Load me + active providers
  React.useEffect(() => {
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(setMe).catch(() => {});
    fetch(`${API}/ai-settings/providers/active`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((data: Provider[]) => {
        setProviders(Array.isArray(data) ? data : []);
        if (data.length > 0 && !selectedProvider) setSelectedProvider(data[0].type);
      }).catch(() => {});
  }, [token]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const currentProvider = providers.find(p => p.type === selectedProvider);
  const initial = (me?.firstName?.[0] || "م").toUpperCase();

  const welcomeMessage: Message = {
    id: "welcome",
    role: "assistant",
    content: `سلام! من **دستیار هوشمند Arzesh AI** هستم 🤖\n\n${
      providers.length === 0
        ? "⚠️ هیچ مدل هوش مصنوعی فعالی پیکربندی نشده است.\n\nلطفاً از تنظیمات هوش مصنوعی یک مدل فعال کنید."
        : `می‌توانم با **${providers.length} مدل** به شما کمک کنم:\n${providers.map(p => `- ${p.name} (${p.model || p.type})`).join("\n")}\n\n**چه کمکی می‌توانم بکنم؟**`
    }`,
    timestamp: new Date(),
  };

  const displayMessages = messages.length === 0 ? [welcomeMessage] : messages;

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    if (!selectedProvider) {
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    // Update conversation title from first message
    if (messages.length === 0) {
      setConversations(cs => cs.map(c => c.id === activeConvId ? { ...c, title: content.slice(0, 40) } : c));
    }

    try {
      const historyForApi = newMessages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API}/ai-settings/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ providerType: selectedProvider, messages: historyForApi, safeMode }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || "پاسخی دریافت نشد.",
        timestamp: new Date(),
        model: data.model || selectedProvider,
        providerType: data.providerType,
        latencyMs: data.latencyMs,
        error: !data.success,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setConversations(cs => cs.map(c => c.id === activeConvId ? { ...c, messages: [...newMessages, assistantMsg] } : c));
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ خطا در ارتباط با سرور: ${err.message}`,
        timestamp: new Date(),
        error: true,
      }]);
    } finally {
      setSending(false);
    }
  }

  function newConversation() {
    const id = Date.now().toString();
    setConversations(cs => [...cs, { id, title: "گفتگوی جدید", messages: [] }]);
    setActiveConvId(id);
    setMessages([]);
  }

  function switchConversation(id: string) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    setActiveConvId(id);
    setMessages(conv.messages);
  }

  function deleteConversation(id: string) {
    if (conversations.length === 1) return;
    setConversations(cs => cs.filter(c => c.id !== id));
    if (activeConvId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      switchConversation(remaining[0].id);
    }
  }

  function copyMessage(content: string) {
    navigator.clipboard.writeText(content).catch(() => {});
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const filteredConvs = conversations.filter(c => c.title.includes(convQuery));

  return (
    <div className="flex h-[calc(100vh-88px)] gap-0 rounded-2xl overflow-hidden border border-theme bg-theme-card" dir="rtl">

      {/* ── Sidebar ── */}
      <div className="w-64 shrink-0 border-l border-theme flex flex-col bg-theme-secondary">
        <div className="p-3 border-b border-theme">
          <button onClick={newConversation} className="w-full flex items-center gap-2 btn-theme-primary py-2.5 px-3 text-sm justify-center rounded-xl">
            <Plus className="w-4 h-4" />
            گفتگوی جدید
          </button>
        </div>
        <div className="px-3 py-2 border-b border-theme">
          <div className="flex items-center gap-2 bg-theme-card border border-theme rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-theme-muted shrink-0" />
            <input value={convQuery} onChange={e => setConvQuery(e.target.value)} placeholder="جستجو..." className="flex-1 bg-transparent text-sm text-theme-primary placeholder:text-theme-muted outline-none text-right" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filteredConvs.map(conv => (
            <button key={conv.id} onClick={() => switchConversation(conv.id)}
              className={`w-full text-right px-3 py-2.5 flex items-start gap-2.5 hover:bg-theme-hover transition-colors group ${conv.id === activeConvId ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${conv.id === activeConvId ? "bg-blue-100 dark:bg-blue-900/60" : "bg-theme-hover"}`}>
                <MessageSquare className={`w-3.5 h-3.5 ${conv.id === activeConvId ? "text-blue-600 dark:text-blue-400" : "text-theme-muted"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${conv.id === activeConvId ? "text-blue-700 dark:text-blue-300" : "text-theme-primary"}`}>{conv.title}</div>
                <div className="text-xs text-theme-muted mt-0.5">{conv.messages.length} پیام</div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/30 hover:text-red-500 text-theme-muted transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        {/* Safe mode + model info at bottom */}
        <div className="p-3 border-t border-theme space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={safeMode} onChange={e => setSafeMode(e.target.checked)} className="rounded accent-blue-600" />
            <span className="text-xs text-theme-secondary flex items-center gap-1">
              {safeMode ? <Shield className="w-3.5 h-3.5 text-green-500" /> : <ShieldOff className="w-3.5 h-3.5 text-amber-500" />}
              حالت ایمن
            </span>
          </label>
          <div className="text-[10px] text-theme-muted">
            {safeMode ? "محتوای مضر فیلتر می‌شود" : "بدون فیلتر محتوا"}
          </div>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-theme">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ai-gradient flex items-center justify-center shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-theme-primary text-sm">دستیار هوشمند Arzesh AI</div>
              <div className="text-xs text-theme-muted">
                {providers.length === 0 ? "مدل فعالی وجود ندارد" : `${providers.length} مدل در دسترس`}
              </div>
            </div>
          </div>

          {/* Model selector */}
          {providers.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setProviderOpen(v => !v)}
                className="flex items-center gap-2 bg-theme-secondary border border-theme hover:bg-theme-hover px-3 py-1.5 rounded-xl text-sm text-theme-secondary transition-colors"
              >
                {currentProvider && (
                  <span className={`w-2 h-2 rounded-full ${PROVIDER_COLORS[currentProvider.type] || "bg-gray-500"}`} />
                )}
                <span className="font-medium">{currentProvider?.name || "انتخاب مدل"}</span>
                {currentProvider?.model && <span className="text-theme-muted text-xs font-mono hidden sm:inline">{currentProvider.model}</span>}
                <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${providerOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {providerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 top-full mt-1 w-64 bg-theme-card border border-theme rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-1">
                      {providers.map(p => (
                        <button key={p.type} onClick={() => { setSelectedProvider(p.type); setProviderOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right transition-colors hover:bg-theme-hover ${selectedProvider === p.type ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${PROVIDER_COLORS[p.type] || "bg-gray-500"}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${selectedProvider === p.type ? "text-blue-700 dark:text-blue-300" : "text-theme-primary"}`}>{p.name}</div>
                            {p.model && <div className="text-[11px] text-theme-muted font-mono truncate">{p.model}</div>}
                          </div>
                          {selectedProvider === p.type && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {providerOpen && <div className="fixed inset-0 z-40" onClick={() => setProviderOpen(false)} />}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <AnimatePresence initial={false}>
            {displayMessages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.role === "assistant" ? (
                  <div className="w-8 h-8 rounded-full bg-ai-gradient flex items-center justify-center shrink-0 shadow mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-theme-secondary border border-theme flex items-center justify-center shrink-0 text-xs font-bold text-theme-secondary mt-0.5">
                    {initial}
                  </div>
                )}

                <div className="max-w-[72%] space-y-1 group">
                  <div className={`${msg.role === "user" ? "chat-bubble-user" : msg.error ? "chat-bubble-assistant border border-red-200 dark:border-red-800" : "chat-bubble-assistant"} px-4 py-3`}>
                    {msg.error && <AlertCircle className="w-3.5 h-3.5 text-red-500 mb-1.5" />}
                    {msg.role === "assistant"
                      ? <MarkdownText content={msg.content} />
                      : <p className="text-sm leading-relaxed">{msg.content}</p>
                    }
                  </div>

                  {/* Message meta */}
                  {msg.role === "assistant" && msg.id !== "welcome" && (
                    <div className="flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => copyMessage(msg.content)} className="p-1 rounded hover:bg-theme-hover text-theme-muted" title="کپی">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-theme-hover text-theme-muted" title="مفید بود"><ThumbsUp className="w-3 h-3" /></button>
                      <button className="p-1 rounded hover:bg-theme-hover text-theme-muted" title="مفید نبود"><ThumbsDown className="w-3 h-3" /></button>
                      {msg.model && (
                        <span className="text-[10px] text-theme-muted font-mono mr-auto">{msg.model} {msg.latencyMs ? `· ${msg.latencyMs}ms` : ""}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {sending && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-ai-gradient flex items-center justify-center shrink-0 shadow">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="chat-bubble-assistant px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span className="text-sm text-theme-muted">در حال فکر کردن...</span>
              </div>
            </motion.div>
          )}

          {/* Suggestion chips */}
          {messages.length === 0 && providers.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center pt-4">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="px-3 py-2 text-sm rounded-xl bg-theme-secondary border border-theme text-theme-secondary hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:border-blue-800 dark:hover:text-blue-400 transition-all"
                >{s}</button>
              ))}
            </div>
          )}

          {/* No provider warning */}
          {providers.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                <Bot className="w-7 h-7 text-amber-500" />
              </div>
              <p className="text-theme-secondary text-sm">هیچ مدل هوش مصنوعی فعالی پیکربندی نشده</p>
              <p className="text-theme-muted text-xs">از منوی تنظیمات هوش مصنوعی یک مدل فعال کنید</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-5 pt-2">
          {!selectedProvider && providers.length > 0 && (
            <p className="text-center text-xs text-amber-500 mb-2">یک مدل انتخاب کنید</p>
          )}
          <div className={`chat-input-container flex items-end gap-3 px-4 py-3 ${!selectedProvider ? "opacity-60" : ""}`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={handleKey}
              disabled={!selectedProvider || sending}
              placeholder={!selectedProvider ? "ابتدا یک مدل انتخاب کنید..." : "پیام بنویس... (Enter برای ارسال، Shift+Enter برای خط جدید)"}
              rows={1}
              className="flex-1 bg-transparent text-sm text-theme-primary placeholder:text-theme-muted outline-none text-right resize-none max-h-40 overflow-y-auto leading-6 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending || !selectedProvider}
              className="w-9 h-9 rounded-xl bg-ai-gradient flex items-center justify-center text-white shadow-md shadow-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
