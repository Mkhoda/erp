"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Send, Plus, Trash2, Edit2, Check, X,
  ChevronLeft, ChevronRight, Brain,
  MessageSquare, Loader2, AlertCircle,
  Paperclip, Image as ImageIcon, Pin,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Provider = { id: string; name: string; type: string; model: string | null };
type Message  = { id: string; role: "user" | "assistant"; content: string; latencyMs?: number; createdAt?: string; error?: boolean; attachment?: { name: string; type: string; url?: string } };
type Convo    = { id: string; title: string | null; provider: string; model: string | null; updatedAt: string; messages: Array<{ content: string; role: string }> };
type Memory   = { id: string; content: string; isPinned: boolean; updatedAt: string };

function renderMd(text: string) {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-slate-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto my-2 font-mono whitespace-pre">$2</pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/20 dark:bg-white/10 rounded px-1 text-[0.8em] font-mono">$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-3 mb-1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ms-4 list-disc my-0.5">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ms-4 list-decimal my-0.5">$2</li>')
    .replace(/\n/g, '<br/>');
}

function formatTs(iso?: string, latencyMs?: number) {
  const time = iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "";
  const secs = latencyMs ? `${(latencyMs / 1000).toFixed(1)} ثانیه` : "";
  return [time, secs].filter(Boolean).join(" · ");
}

function groupByDate(convos: Convo[]): Array<{ label: string; items: Convo[] }> {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const map = new Map<string, Convo[]>();
  for (const c of convos) {
    const d = new Date(c.updatedAt).toDateString();
    const label = d === today ? "امروز" : d === yesterday ? "دیروز"
      : new Date(c.updatedAt).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(c);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function ChatPage() {
  const searchParams = useSearchParams();

  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(null);
  const [convos, setConvos] = React.useState<Convo[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [safeMode, setSafeMode] = React.useState(true);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [memoryOpen, setMemoryOpen] = React.useState(false);
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [memInput, setMemInput] = React.useState("");
  const [editMemId, setEditMemId] = React.useState<string | null>(null);
  const [editMemVal, setEditMemVal] = React.useState("");
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [attachment, setAttachment] = React.useState<{ file: File; preview?: string } | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { document.title = "گفتگو با AI | Arzesh"; }, []);

  const h    = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });
  const hj   = () => ({ "Content-Type": "application/json", ...h() });

  React.useEffect(() => {
    const startId = searchParams.get("id");
    Promise.all([
      fetch(`${API}/ai-settings/providers/active`, { headers: h() }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/chat-history/conversations`, { headers: h() }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/chat-history/memory`, { headers: h() }).then(r => r.ok ? r.json() : []),
    ]).then(([provs, convList, mems]) => {
      setProviders(provs);
      if (provs.length > 0) setSelectedProvider(provs[0]);
      setConvos(convList);
      setMemories(mems);
      if (startId) loadConvo(startId);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  const loadConvo = async (id: string) => {
    setActiveId(id);
    const res = await fetch(`${API}/chat-history/conversations/${id}`, { headers: h() });
    if (!res.ok) return;
    const data = await res.json();
    const msgs: Message[] = data.messages.map((m: any) => ({
      id: m.id, role: m.role, content: m.content, latencyMs: m.latencyMs,
      createdAt: m.createdAt,
    }));
    if (data.summary) {
      msgs.unshift({ id: "__summary__", role: "assistant", content: `📝 **خلاصه مکالمات قبلی:**\n\n${data.summary}` });
    }
    setMessages(msgs);
  };

  const newConvo = async () => {
    if (!selectedProvider) return;
    const res = await fetch(`${API}/chat-history/conversations`, {
      method: "POST", headers: hj(),
      body: JSON.stringify({ provider: selectedProvider.type, model: selectedProvider.model }),
    });
    if (!res.ok) return;
    const c = await res.json();
    setConvos(prev => [{ ...c, messages: [] }, ...prev]);
    setActiveId(c.id);
    setMessages([]);
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    const content = input.trim();
    if ((!content && !attachment) || sending || !activeId) return;
    setInput("");

    let fullContent = content;
    let attachInfo: Message["attachment"] | undefined;

    if (attachment) {
      attachInfo = { name: attachment.file.name, type: attachment.file.type, url: attachment.preview };
      fullContent = content ? `${content}\n\n[پیوست: ${attachment.file.name}]` : `[پیوست: ${attachment.file.name}]`;
      setAttachment(null);
    }

    const userMsg: Message = {
      id: Date.now().toString(), role: "user",
      content: content || `📎 ${attachInfo?.name}`,
      createdAt: new Date().toISOString(),
      attachment: attachInfo,
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`${API}/chat-history/conversations/${activeId}/send`, {
        method: "POST", headers: hj(),
        body: JSON.stringify({ content: fullContent, safeMode }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: data.messageId || (Date.now() + 1).toString(),
        role: "assistant", content: data.content || "پاسخی دریافت نشد.",
        latencyMs: data.latencyMs, createdAt: new Date().toISOString(),
        error: !data.success,
      }]);
      setConvos(prev => prev.map(c => c.id === activeId
        ? { ...c, updatedAt: new Date().toISOString(), title: c.title || content.substring(0, 50) || attachInfo?.name, messages: [{ content: data.content, role: "assistant" }] }
        : c
      ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "خطا در اتصال.", error: true, createdAt: new Date().toISOString() }]);
    } finally { setSending(false); }
  };

  const deleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("این مکالمه حذف شود؟")) return;
    await fetch(`${API}/chat-history/conversations/${id}`, { method: "DELETE", headers: h() });
    setConvos(prev => prev.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setAttachment({ file, preview: ev.target?.result as string });
      reader.readAsDataURL(file);
    } else {
      setAttachment({ file });
    }
    e.target.value = "";
  };

  const addMemory = async () => {
    if (!memInput.trim()) return;
    const res = await fetch(`${API}/chat-history/memory`, { method: "POST", headers: hj(), body: JSON.stringify({ content: memInput.trim() }) });
    if (res.ok) { const m = await res.json(); setMemories(prev => [m, ...prev]); setMemInput(""); }
  };

  const saveMemory = async (id: string) => {
    const res = await fetch(`${API}/chat-history/memory/${id}`, { method: "PATCH", headers: hj(), body: JSON.stringify({ content: editMemVal }) });
    if (res.ok) { setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editMemVal } : m)); setEditMemId(null); }
  };

  const deleteMemory = async (id: string) => {
    await fetch(`${API}/chat-history/memory/${id}`, { method: "DELETE", headers: h() });
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const renameConvo = async (id: string) => {
    const res = await fetch(`${API}/chat-history/conversations/${id}/rename`, { method: "PATCH", headers: hj(), body: JSON.stringify({ title: renameVal }) });
    if (res.ok) { setConvos(prev => prev.map(c => c.id === id ? { ...c, title: renameVal } : c)); setRenameId(null); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const activeConvo = convos.find(c => c.id === activeId);
  const grouped = groupByDate(convos);

  return (
    <div className="flex h-[calc(100vh-88px)] overflow-hidden bg-theme-base" dir="rtl">

      {/* ── Conversation sidebar ── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }} animate={{ width: 268, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col border-l border-theme bg-theme-secondary overflow-hidden shrink-0"
          >
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-theme">
              <button onClick={newConvo} disabled={!selectedProvider}
                className="flex flex-1 items-center gap-2 bg-ai-gradient hover:opacity-90 disabled:opacity-40 px-3 py-2 rounded-xl text-white text-sm font-medium transition-opacity">
                <Plus className="w-4 h-4" /> گفتگوی جدید
              </button>
              <button onClick={() => setMemoryOpen(!memoryOpen)} title="حافظه شخصی"
                className={`p-2 rounded-xl border transition-colors ${memoryOpen ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-500" : "border-theme text-theme-muted hover:text-theme-primary"}`}>
                <Brain className="w-4 h-4" />
              </button>
            </div>

            {/* Provider selector */}
            {providers.length > 0 && (
              <div className="px-3 py-2 border-b border-theme">
                <select value={selectedProvider?.type || ""}
                  onChange={e => setSelectedProvider(providers.find(p => p.type === e.target.value) || null)}
                  className="w-full bg-transparent text-theme-secondary text-xs outline-none border border-theme rounded-lg px-2 py-1.5">
                  {providers.map(p => <option key={p.type} value={p.type}>{p.name} — {p.model || p.type}</option>)}
                </select>
              </div>
            )}

            {/* Safe mode */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-theme">
              <div onClick={() => setSafeMode(!safeMode)} className="cursor-pointer">
                <div className={`relative w-8 h-4 rounded-full transition-colors ${safeMode ? "bg-green-500" : "bg-theme-muted/30"}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${safeMode ? "right-0.5" : "left-0.5"}`} />
                </div>
              </div>
              <span className="text-xs text-theme-muted">حالت ایمن</span>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto py-1">
              {loading && <div className="text-center text-theme-muted text-xs py-8">در حال بارگذاری...</div>}
              {!loading && convos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageSquare className="w-7 h-7 text-theme-muted/30 mb-2" />
                  <p className="text-theme-muted text-xs">هنوز گفتگویی ندارید</p>
                </div>
              )}
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <div className="px-3 pt-3 pb-1 text-theme-muted text-[10px] font-semibold uppercase tracking-wider">{label}</div>
                  {items.map(c => (
                    <div key={c.id} onClick={() => loadConvo(c.id)}
                      className={`group relative flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors mx-1 rounded-xl mb-0.5 ${activeId === c.id ? "bg-theme-hover" : "hover:bg-theme-hover/50"}`}>
                      <MessageSquare className="w-3.5 h-3.5 text-theme-muted mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {renameId === c.id ? (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && renameConvo(c.id)}
                              className="flex-1 bg-transparent border-b border-blue-500 text-xs outline-none text-theme-primary" />
                            <button onClick={() => renameConvo(c.id)} className="text-green-500"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setRenameId(null)} className="text-red-400"><X className="w-3 h-3" /></button>
                          </div>
                        ) : (
                          <div className="text-theme-secondary text-xs font-medium truncate">{c.title || "گفتگوی جدید"}</div>
                        )}
                        <div className="text-theme-muted text-[10px] truncate mt-0.5">{c.messages[0]?.content?.substring(0, 45) || "..."}</div>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setRenameId(c.id); setRenameVal(c.title || ""); }}
                          className="p-1 rounded text-theme-muted hover:text-theme-primary"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={e => deleteConvo(c.id, e)}
                          className="p-1 rounded text-theme-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-theme bg-theme-secondary shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors">
            {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-ai-gradient rounded-lg flex items-center justify-center shrink-0 shadow">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-theme-primary text-sm truncate">
                {activeConvo?.title || (activeId ? "گفتگوی جدید" : "دستیار هوشمند")}
              </div>
              {selectedProvider && (
                <div className="flex items-center gap-1 text-green-500 text-xs">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                  {selectedProvider.name} · {selectedProvider.model || selectedProvider.type}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-theme-muted shrink-0">
            {memories.length > 0 && (
              <button onClick={() => setMemoryOpen(!memoryOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${memoryOpen ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20" : "hover:bg-theme-hover"}`}>
                <Brain className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{memories.length} حافظه</span>
              </button>
            )}
          </div>
        </div>

        {/* Memory panel */}
        <AnimatePresence>
          {memoryOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              className="overflow-hidden border-b border-theme bg-blue-50/30 dark:bg-blue-900/10 shrink-0">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-theme-primary text-sm">حافظه شخصی</span>
                  <span className="text-theme-muted text-xs">— اطلاعاتی که AI در تمام گفتگوها به یاد می‌آورد</span>
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={memInput} onChange={e => setMemInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addMemory()}
                    placeholder="افزودن حافظه (مثلاً: من مدیر مالی شرکت هستم)"
                    className="flex-1 input-theme text-sm py-1.5 px-3" />
                  <button onClick={addMemory} className="btn-primary text-xs px-3 py-1.5">افزودن</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {memories.length === 0 && <p className="text-theme-muted text-xs col-span-2 text-center py-2">AI پس از هر چند مکالمه به‌صورت خودکار حافظه‌ها را استخراج می‌کند.</p>}
                  {memories.map(m => (
                    <div key={m.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 border ${m.isPinned ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-white dark:bg-white/5 border-theme"}`}>
                      {m.isPinned && <Pin className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />}
                      {editMemId === m.id ? (
                        <>
                          <input autoFocus value={editMemVal} onChange={e => setEditMemVal(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-xs text-theme-primary border-b border-blue-500" />
                          <button onClick={() => saveMemory(m.id)} className="text-green-500"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditMemId(null)} className="text-red-400"><X className="w-3 h-3" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-xs text-theme-secondary">{m.content}</span>
                          {!m.isPinned && (
                            <>
                              <button onClick={() => { setEditMemId(m.id); setEditMemVal(m.content); }}
                                className="text-theme-muted hover:text-theme-primary shrink-0"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => deleteMemory(m.id)}
                                className="text-theme-muted hover:text-red-500 shrink-0"><Trash2 className="w-3 h-3" /></button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {!activeId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-ai-gradient rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-theme-primary mb-2">دستیار هوشمند Arzesh</h2>
              <p className="text-theme-muted text-sm max-w-sm mb-6">
                {providers.length === 0 ? "هیچ مدل AI فعالی تنظیم نشده." : "یک گفتگوی جدید شروع کنید."}
              </p>
              {providers.length > 0 && (
                <button onClick={newConvo} className="btn-primary flex items-center gap-2">
                  <Plus className="w-4 h-4" /> شروع گفتگو
                </button>
              )}
            </div>
          )}

          {activeId && messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-10 h-10 text-theme-muted/30 mb-3" />
              <p className="text-theme-muted text-sm">پیام اول را بنویسید...</p>
              {memories.length > 0 && (
                <p className="text-blue-500 text-xs mt-2 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> {memories.length} حافظه فعال است
                </p>
              )}
            </div>
          )}

          {messages.map(msg => {
            const isUser = msg.role === "user";
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-3 ${isUser ? "justify-start" : "justify-end"}`}>

                {/* Avatar */}
                {isUser && (
                  <div className="w-7 h-7 bg-theme-secondary border border-theme rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-theme-secondary mb-1">
                    م
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[70%] ${isUser ? "chat-bubble-user rounded-2xl rounded-br-sm" : "chat-bubble-assistant rounded-2xl rounded-bl-sm"} ${msg.error ? "border border-red-300 dark:border-red-700" : ""}`}>
                  {msg.attachment?.url && (
                    <img src={msg.attachment.url} alt={msg.attachment.name}
                      className="rounded-lg max-w-full max-h-60 mb-2 object-contain" />
                  )}
                  {msg.attachment && !msg.attachment.url && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-black/10 dark:bg-white/10 rounded-lg">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="text-xs">{msg.attachment.name}</span>
                    </div>
                  )}
                  {msg.error && <AlertCircle className="inline w-3.5 h-3.5 text-red-500 me-1 mb-0.5" />}
                  <div className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                  <div className={`text-[10px] mt-1.5 ${isUser ? "text-white/60" : "text-theme-muted/60"}`}>
                    {formatTs(msg.createdAt, isUser ? undefined : msg.latencyMs)}
                  </div>
                </div>

                {/* AI avatar */}
                {!isUser && (
                  <div className="w-7 h-7 bg-ai-gradient rounded-full flex items-center justify-center shrink-0 shadow mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </motion.div>
            );
          })}

          {sending && (
            <div className="flex items-end gap-3 justify-end">
              <div className="chat-bubble-assistant rounded-2xl rounded-bl-sm flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
                <span className="text-xs text-theme-muted">در حال پاسخ...</span>
              </div>
              <div className="w-7 h-7 bg-ai-gradient rounded-full flex items-center justify-center shrink-0 shadow mb-1">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* File attachment preview */}
        {attachment && (
          <div className="px-4 pb-2 shrink-0">
            <div className="flex items-center gap-2 bg-theme-secondary border border-theme rounded-xl px-3 py-2 w-fit">
              {attachment.preview
                ? <img src={attachment.preview} alt="preview" className="h-10 w-10 object-cover rounded" />
                : <Paperclip className="w-4 h-4 text-blue-500" />
              }
              <span className="text-xs text-theme-secondary">{attachment.file.name}</span>
              <button onClick={() => setAttachment(null)} className="text-theme-muted hover:text-red-500 ml-1"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        {/* Input */}
        {activeId && (
          <div className="px-4 pb-4 pt-1 shrink-0">
            <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv" onChange={handleFile} />
            <div className="flex gap-2 items-end bg-theme-secondary border border-theme rounded-2xl px-3 py-2.5 shadow-sm focus-within:border-blue-500/40 transition-colors">
              <button onClick={() => fileRef.current?.click()}
                className="p-1.5 rounded-lg text-theme-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors shrink-0"
                title="پیوست فایل">
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="پیام بنویس... (Enter ارسال، Shift+Enter خط جدید)"
                rows={1}
                style={{ resize: "none" }}
                className="flex-1 bg-transparent outline-none text-theme-primary placeholder:text-theme-muted text-sm text-right leading-relaxed disabled:opacity-50 min-h-[24px] max-h-[120px]"
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
              <button onClick={sendMessage} disabled={(!input.trim() && !attachment) || sending}
                className="flex items-center justify-center w-9 h-9 bg-ai-gradient hover:opacity-90 disabled:opacity-40 rounded-xl text-white transition-opacity disabled:cursor-not-allowed shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-[10px] text-theme-muted">{messages.filter(m => !["__summary__"].includes(m.id)).length} پیام</span>
              {safeMode && <span className="text-[10px] text-green-500 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />حالت ایمن</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
