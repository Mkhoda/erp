"use client";
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, Brain, MessageSquare,
  AlertCircle, Pin, Copy, RefreshCw, ChevronDown, Image as ImageIcon, FileText, Film, Music, UploadCloud, ArrowDown, Square,
} from "lucide-react";
import { getSystemName, pageTitle } from "../../../lib/branding";
import { readError } from "../../../lib/http";
import { API, Att, Caps, FilePolicy, Message, Provider, authHeaders, readSSE } from "./lib";
import { Markdown } from "./components/Markdown";
import { AttachmentGrid } from "./components/Media";
import { Thinking, TypingDots } from "./components/Thinking";
import { Composer, useUploads } from "./components/Composer";

type Convo  = { id: string; title: string | null; provider: string; model: string | null; updatedAt: string; messages: Array<{ content: string; role: string }> };
type Memory = { id: string; content: string; isPinned: boolean; updatedAt: string };

const fa = (n: number) => n.toLocaleString("fa-IR");

function formatTs(iso?: string, latencyMs?: number | null) {
  const time = iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "";
  const secs = latencyMs ? `${fa(+(latencyMs / 1000).toFixed(1))} ثانیه` : "";
  return [time, secs].filter(Boolean).join(" · ");
}

function groupByDate(convos: Convo[]): Array<{ label: string; items: Convo[] }> {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const map = new Map<string, Convo[]>();
  for (const c of convos) {
    const d = new Date(c.updatedAt).toDateString();
    const label = d === today ? "امروز" : d === yesterday ? "دیروز" : new Date(c.updatedAt).toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(c);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

const CAP_BADGES: Array<{ key: keyof Caps; label: string; Icon: any }> = [
  { key: "image", label: "تصویر", Icon: ImageIcon },
  { key: "file", label: "سند", Icon: FileText },
  { key: "audio", label: "صوت", Icon: Music },
  { key: "video", label: "ویدیو", Icon: Film },
  { key: "reasoning", label: "تفکر", Icon: Brain },
];

function CapBadges({ caps, compact }: { caps?: Caps; compact?: boolean }) {
  if (!caps) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {CAP_BADGES.filter(b => caps[b.key]).map(b => (
        <span key={b.key} title={b.label} className="inline-flex items-center gap-0.5 text-[10px] text-theme-muted bg-theme-hover rounded px-1 py-0.5">
          <b.Icon className="w-2.5 h-2.5" />{!compact && b.label}
        </span>
      ))}
    </span>
  );
}

function ModelPicker({ providers, value, onChange }: { providers: Provider[]; value: Provider | null; onChange: (p: Provider) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f);
  }, []);
  if (!value) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-theme-hover transition-colors max-w-[300px]">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
        <span className="text-sm font-medium text-theme-primary truncate" dir="ltr">{value.model || value.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
            className="absolute z-30 top-full mt-1 start-0 w-[320px] max-h-[60vh] overflow-y-auto bg-theme-card border border-theme rounded-xl shadow-xl p-1">
            {providers.map(p => (
              <button key={p.id} onClick={() => { onChange(p); setOpen(false); }}
                className={`w-full text-start px-3 py-2 rounded-lg hover:bg-theme-hover transition-colors ${p.id === value.id ? "bg-theme-hover" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-theme-primary truncate flex-1" dir="ltr">{p.model || p.name}</span>
                  {p.id === value.id && <Check className="w-3.5 h-3.5 text-blue-500" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-theme-muted">{p.name}</span>
                  <CapBadges caps={p.capabilities} />
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();

  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = React.useState<Provider | null>(null);
  const [convos, setConvos] = React.useState<Convo[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [safeMode, setSafeMode] = React.useState(true);
  const [reasoning, setReasoning] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [memoryOpen, setMemoryOpen] = React.useState(false);
  const [memories, setMemories] = React.useState<Memory[]>([]);
  const [memInput, setMemInput] = React.useState("");
  const [editMemId, setEditMemId] = React.useState<string | null>(null);
  const [editMemVal, setEditMemVal] = React.useState("");
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameVal, setRenameVal] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [quota, setQuota] = React.useState<any>(null);
  const [policy, setPolicy] = React.useState<FilePolicy | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const providersRef = React.useRef<Provider[]>([]);
  React.useEffect(() => { providersRef.current = providers; }, [providers]);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickRef = React.useRef(true);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const dragDepth = React.useRef(0);

  const caps = selectedProvider?.capabilities;
  const uploads = useUploads(policy, caps);

  React.useEffect(() => { document.title = pageTitle("گفتگو با AI"); if (window.innerWidth < 768) setSidebarOpen(false); }, []);
  React.useEffect(() => { try { setReasoning(localStorage.getItem("chat.reasoning") === "1"); } catch { /* */ } }, []);
  const toggleReasoning = () => setReasoning(v => { try { localStorage.setItem("chat.reasoning", v ? "0" : "1"); } catch { /* */ } return !v; });

  const h  = () => authHeaders();
  const hj = () => ({ "Content-Type": "application/json", ...authHeaders() });

  const refreshQuota = (pid?: string) => {
    if (!pid) return;
    fetch(`${API}/quota/me/${pid}`, { headers: h() }).then(r => (r.ok ? r.json() : null)).then(d => setQuota(d)).catch(() => {});
  };

  React.useEffect(() => {
    const startId = searchParams.get("id");
    Promise.all([
      fetch(`${API}/ai-settings/providers/active`, { headers: h() }).then(r => (r.ok ? r.json() : [])),
      fetch(`${API}/chat-history/conversations`, { headers: h() }).then(r => (r.ok ? r.json() : [])),
      fetch(`${API}/chat-history/memory`, { headers: h() }).then(r => (r.ok ? r.json() : [])),
      fetch(`${API}/chat-history/files/policy`, { headers: h() }).then(r => (r.ok ? r.json() : null)),
    ]).then(([provs, convList, mems, pol]) => {
      setProviders(provs); providersRef.current = provs;
      if (provs.length > 0) setSelectedProvider(provs[0]);
      setConvos(convList); setMemories(mems); if (pol?.policy) setPolicy(pol.policy);
      if (startId) loadConvo(startId);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { refreshQuota(selectedProvider?.id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedProvider?.id]);

  // ── scrolling: follow the stream only while the reader is at the bottom ──
  const onScroll = () => {
    const el = scrollRef.current; if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = near; setAtBottom(near);
  };
  const scrollDown = (smooth = true) => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  React.useEffect(() => { if (stickRef.current) scrollDown(!streaming); }, [messages, streaming]);

  const loadConvo = async (id: string) => {
    if (streaming) return;
    if (window.innerWidth < 768) setSidebarOpen(false);
    setActiveId(id); stickRef.current = true;
    const res = await fetch(`${API}/chat-history/conversations/${id}`, { headers: h() });
    if (!res.ok) return;
    const data = await res.json();
    const msgs: Message[] = data.messages.map((m: any) => ({
      id: m.id, role: m.role, content: m.content, reasoning: m.reasoning, latencyMs: m.latencyMs, createdAt: m.createdAt,
      stopped: m.stopped, completionTokens: m.completionTokens, attachments: m.attachments || [],
      error: m.role === "assistant" && String(m.content).startsWith("⚠️"),
    }));
    const convProvider = providersRef.current.find(p => p.id === data.provider);
    if (convProvider) setSelectedProvider(convProvider);
    setMessages(msgs);
    requestAnimationFrame(() => scrollDown(false));
  };

  const newConvo = async (): Promise<string | null> => {
    if (!selectedProvider || streaming) return null;
    const res = await fetch(`${API}/chat-history/conversations`, { method: "POST", headers: hj(), body: JSON.stringify({ provider: selectedProvider.id, model: selectedProvider.model }) });
    if (!res.ok) return null;
    const c = await res.json();
    setConvos(prev => [{ ...c, messages: [] }, ...prev]);
    setActiveId(c.id); setMessages([]); uploads.clear();
    inputRef.current?.focus();
    return c.id;
  };

  // ── sending / streaming ──
  const run = async (opts: { regenerate?: boolean } = {}) => {
    const content = input.trim();
    const atts: Att[] = opts.regenerate ? [] : uploads.ready;
    if (streaming || !selectedProvider) return;
    if (!opts.regenerate && !content && !atts.length) return;
    const convId = activeId || await newConvo();
    if (!convId) return;

    const nowIso = new Date().toISOString();
    const tmpUser = `tmp-u-${Date.now()}`, live = `live-${Date.now()}`;
    if (!opts.regenerate) {
      setMessages(prev => [...prev, { id: tmpUser, role: "user", content, createdAt: nowIso, attachments: atts }]);
      setInput(""); if (inputRef.current) inputRef.current.style.height = "auto";
      uploads.clear();
    } else {
      setMessages(prev => { const i = [...prev].reverse().findIndex(m => m.role === "assistant"); return i < 0 ? prev : prev.filter((_, k) => k !== prev.length - 1 - i); });
    }
    setMessages(prev => [...prev, { id: live, role: "assistant", content: "", reasoning: "", streaming: true, createdAt: nowIso }]);
    stickRef.current = true; setStreaming(true);

    const ctl = new AbortController(); abortRef.current = ctl;
    const patchLive = (fn: (m: Message) => Message) => setMessages(prev => prev.map(m => (m.id === live ? fn(m) : m)));
    const t0 = Date.now(); let thinkStart = 0;
    let finished = false;
    try {
      const res = await fetch(`${API}/chat-history/conversations/${convId}/stream`, {
        method: "POST", headers: hj(), signal: ctl.signal,
        body: JSON.stringify({ content, attachmentIds: atts.map(a => a.id), safeMode, providerId: selectedProvider.id, regenerate: !!opts.regenerate, reasoning: reasoning && !!caps?.reasoning }),
      });
      if (!res.ok) {
        const msg = await readError(res, "خطا در ارسال پیام");
        setMessages(prev => prev.filter(m => m.id !== live).concat({ id: `err-${Date.now()}`, role: "assistant", content: `⚠️ ${msg}`, error: true, createdAt: nowIso }));
        return;
      }
      await readSSE(res, (ev, d) => {
        if (ev === "start" && d.userMessage) setMessages(prev => prev.map(m => (m.id === tmpUser ? { ...d.userMessage, attachments: d.userMessage.attachments || [] } : m)));
        else if (ev === "reasoning") { if (!thinkStart) thinkStart = Date.now(); patchLive(m => ({ ...m, reasoning: (m.reasoning || "") + d.t, thinkingMs: Date.now() - thinkStart })); }
        else if (ev === "delta") patchLive(m => ({ ...m, content: m.content + d.t, thinkingMs: thinkStart && !m.content ? Date.now() - thinkStart : m.thinkingMs }));
        else if (ev === "done" || ev === "error") {
          finished = true;
          patchLive(m => ({
            ...m, id: d.messageId || m.id, streaming: false, stopped: !!d.stopped, error: ev === "error",
            content: ev === "error" ? (d.content || `⚠️ ${d.message || "خطا"}`) : (m.content || d.content || ""),
            latencyMs: d.latencyMs ?? Date.now() - t0, completionTokens: d.usage?.completionTokens ?? null,
          }));
          setConvos(prev => prev.map(c => (c.id === convId
            ? { ...c, updatedAt: new Date().toISOString(), title: d.title || c.title || content.slice(0, 50) || atts[0]?.name || null, messages: [{ content: d.content || "", role: "assistant" }] }
            : c)).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
        }
      });
      if (!finished) patchLive(m => ({ ...m, streaming: false, stopped: true }));
    } catch (e: any) {
      if (e?.name === "AbortError") patchLive(m => ({ ...m, streaming: false, stopped: true, content: m.content }));
      else patchLive(m => ({ ...m, streaming: false, error: true, content: m.content || "⚠️ ارتباط با سرور قطع شد." }));
    } finally {
      abortRef.current = null; setStreaming(false); refreshQuota(selectedProvider.id);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };
  const stop = () => abortRef.current?.abort();

  const copyMsg = async (m: Message) => {
    try { await navigator.clipboard.writeText(m.content); setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1500); } catch { /* */ }
  };

  const deleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("این مکالمه (به همراه فایل‌های آن) حذف شود؟")) return;
    await fetch(`${API}/chat-history/conversations/${id}`, { method: "DELETE", headers: h() });
    setConvos(prev => prev.filter(c => c.id !== id));
    if (activeId === id) { setActiveId(null); setMessages([]); }
  };

  const addMemory = async () => {
    if (!memInput.trim()) return;
    const res = await fetch(`${API}/chat-history/memory`, { method: "POST", headers: hj(), body: JSON.stringify({ content: memInput.trim() }) });
    if (res.ok) { const m = await res.json(); setMemories(prev => [m, ...prev]); setMemInput(""); }
  };
  const saveMemory = async (id: string) => {
    const res = await fetch(`${API}/chat-history/memory/${id}`, { method: "PATCH", headers: hj(), body: JSON.stringify({ content: editMemVal }) });
    if (res.ok) { setMemories(prev => prev.map(m => (m.id === id ? { ...m, content: editMemVal } : m))); setEditMemId(null); }
  };
  const deleteMemory = async (id: string) => {
    await fetch(`${API}/chat-history/memory/${id}`, { method: "DELETE", headers: h() });
    setMemories(prev => prev.filter(m => m.id !== id));
  };
  const renameConvo = async (id: string) => {
    const res = await fetch(`${API}/chat-history/conversations/${id}/rename`, { method: "PATCH", headers: hj(), body: JSON.stringify({ title: renameVal }) });
    if (res.ok) { setConvos(prev => prev.map(c => (c.id === id ? { ...c, title: renameVal } : c))); setRenameId(null); }
  };

  // ── drag & drop over the whole conversation area ──
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
  const dragProps = {
    onDragEnter: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragging(true); },
    onDragOver: (e: React.DragEvent) => { if (hasFiles(e)) e.preventDefault(); },
    onDragLeave: (e: React.DragEvent) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); },
    onDrop: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current = 0; setDragging(false); uploads.addFiles(Array.from(e.dataTransfer.files)); },
  };

  const activeConvo = convos.find(c => c.id === activeId);
  const grouped = groupByDate(convos);
  const lastAssistantId = [...messages].reverse().find(m => m.role === "assistant")?.id;
  const quickPrompts = [
    "خلاصه‌ای از این سند/تصویر بده", "یک گزارش کاری کوتاه برایم بنویس", "این جدول را تحلیل کن", "متن را ویرایش و روان‌تر کن",
  ];

  return (
    <div className="flex h-[calc(100vh-88px)] overflow-hidden bg-theme-card border border-theme rounded-xl relative" dir="rtl">
      {/* ── Conversation sidebar ── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 272, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="flex flex-col border-l border-theme bg-theme-secondary/70 overflow-hidden shrink-0 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-2xl">
            <div className="flex items-center gap-2 p-3 border-b border-theme">
              <button onClick={newConvo} disabled={!selectedProvider || streaming}
                className="flex flex-1 items-center justify-center gap-2 bg-ai-gradient hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-40 px-3 py-2.5 rounded-xl text-white text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" /> گفتگوی جدید
              </button>
              <button onClick={() => setMemoryOpen(!memoryOpen)} title="حافظه شخصی"
                className={`p-2 rounded-xl border transition-colors ${memoryOpen ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400 text-blue-500" : "border-theme text-theme-muted hover:text-theme-primary"}`}>
                <Brain className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 border-b border-theme">
              <button onClick={() => setSafeMode(!safeMode)} className="cursor-pointer" aria-label="حالت ایمن">
                <div className={`relative w-8 h-4 rounded-full transition-colors ${safeMode ? "bg-green-500" : "bg-theme-muted/30"}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${safeMode ? "right-0.5" : "left-0.5"}`} />
                </div>
              </button>
              <span className="text-xs text-theme-muted">حالت ایمن (پاسخ‌های محتاطانه‌تر)</span>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {loading && <div className="space-y-2 p-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-9 rounded-xl bg-theme-hover animate-pulse" />)}</div>}
              {!loading && convos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageSquare className="w-7 h-7 text-theme-muted/30 mb-2" />
                  <p className="text-theme-muted text-xs">هنوز گفتگویی ندارید</p>
                </div>
              )}
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <div className="px-3 pt-3 pb-1 text-theme-muted text-[10px] font-semibold">{label}</div>
                  {items.map(c => (
                    <div key={c.id} onClick={() => loadConvo(c.id)}
                      className={`group relative flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-all mx-2 rounded-xl mb-0.5 border ${activeId === c.id ? "bg-blue-500/10 border-blue-500/30 shadow-sm" : "border-transparent hover:bg-theme-hover/70"}`}>
                      <MessageSquare className="w-3.5 h-3.5 text-theme-muted mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {renameId === c.id ? (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)} onKeyDown={e => e.key === "Enter" && renameConvo(c.id)}
                              className="flex-1 bg-transparent border-b border-blue-500 text-xs outline-none text-theme-primary" />
                            <button onClick={() => renameConvo(c.id)} className="text-green-500"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setRenameId(null)} className="text-red-400"><X className="w-3 h-3" /></button>
                          </div>
                        ) : <div className="text-theme-secondary text-xs font-medium truncate">{c.title || "گفتگوی جدید"}</div>}
                        <div className="text-theme-muted text-[10px] truncate mt-0.5">{c.messages[0]?.content?.substring(0, 45) || "..."}</div>
                      </div>
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setRenameId(c.id); setRenameVal(c.title || ""); }} className="p-1 rounded text-theme-muted hover:text-theme-primary"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={e => deleteConvo(c.id, e)} className="p-1 rounded text-theme-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
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
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative bg-gradient-to-b from-theme-card to-theme-secondary/30" {...dragProps}>
        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-theme shrink-0 bg-theme-card/80 backdrop-blur">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted transition-colors" aria-label="نوار کناری">
            {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <ModelPicker providers={providers} value={selectedProvider} onChange={p => { if (!streaming) setSelectedProvider(p); }} />
          <CapBadges caps={caps} compact />
          <div className="flex-1 min-w-0 text-center text-xs text-theme-muted truncate px-2 hidden md:block">{activeConvo?.title || ""}</div>
          <div className="flex items-center gap-2 text-xs text-theme-muted shrink-0 ms-auto">
            {quota && quota.monthlyLimit > 0 && (
              <div className="hidden md:flex items-center gap-2 bg-theme-hover px-2.5 py-1.5 rounded-lg">
                <div>
                  <div className="text-[10px] text-theme-muted leading-tight">{fa(quota.usedTokens)} / {fa(quota.monthlyLimit)}</div>
                  <div className="bg-theme-card rounded-full w-20 h-1 mt-0.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${quota.usagePercent >= 90 ? "bg-red-500" : quota.usagePercent >= 70 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, quota.usagePercent)}%` }} />
                  </div>
                </div>
                <span className={`font-bold text-xs ${quota.usagePercent >= 90 ? "text-red-500" : quota.usagePercent >= 70 ? "text-yellow-500" : "text-green-600"}`}>{fa(quota.usagePercent)}٪</span>
              </div>
            )}
            {memories.length > 0 && (
              <button onClick={() => setMemoryOpen(!memoryOpen)} className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${memoryOpen ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20" : "hover:bg-theme-hover"}`}>
                <Brain className="w-3.5 h-3.5" /><span className="hidden sm:inline">{fa(memories.length)} حافظه</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {memoryOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-b border-theme bg-blue-50/30 dark:bg-blue-900/10 shrink-0">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-theme-primary text-sm">حافظه شخصی</span>
                  <span className="text-theme-muted text-xs">— اطلاعاتی که AI در تمام گفتگوها به یاد می‌آورد</span>
                </div>
                <div className="flex gap-2 mb-3">
                  <input value={memInput} onChange={e => setMemInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addMemory()}
                    placeholder="افزودن حافظه (مثلاً: من مدیر مالی شرکت هستم)" className="flex-1 input-theme text-sm py-1.5 px-3" />
                  <button onClick={addMemory} className="btn-primary text-xs px-3 py-1.5">افزودن</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {memories.length === 0 && <p className="text-theme-muted text-xs col-span-2 text-center py-2">AI پس از هر چند مکالمه به‌صورت خودکار حافظه‌ها را استخراج می‌کند.</p>}
                  {memories.map(m => (
                    <div key={m.id} className={`flex items-start gap-2 rounded-lg px-3 py-2 border ${m.isPinned ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-white dark:bg-white/5 border-theme"}`}>
                      {m.isPinned && <Pin className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />}
                      {editMemId === m.id ? (
                        <>
                          <input autoFocus value={editMemVal} onChange={e => setEditMemVal(e.target.value)} className="flex-1 bg-transparent outline-none text-xs text-theme-primary border-b border-blue-500" />
                          <button onClick={() => saveMemory(m.id)} className="text-green-500"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditMemId(null)} className="text-red-400"><X className="w-3 h-3" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-xs text-theme-secondary">{m.content}</span>
                          {!m.isPinned && (
                            <>
                              <button onClick={() => { setEditMemId(m.id); setEditMemVal(m.content); }} className="text-theme-muted hover:text-theme-primary shrink-0"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => deleteMemory(m.id)} className="text-theme-muted hover:text-red-500 shrink-0"><Trash2 className="w-3 h-3" /></button>
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
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
          {(!activeId || messages.length === 0) && !streaming ? (
            <div className="flex flex-col items-center justify-center min-h-full text-center px-4 py-10">
              <div className="relative mb-5"><div className="absolute inset-0 bg-ai-gradient blur-2xl opacity-40 rounded-full" /><div className="relative w-20 h-20 bg-ai-gradient rounded-3xl flex items-center justify-center shadow-xl"><Sparkles className="w-10 h-10 text-white" /></div></div>
              <h2 className="text-2xl font-bold text-ai-gradient mb-2">دستیار هوشمند {getSystemName()}</h2>
              <p className="text-theme-muted text-sm max-w-md mb-6">
                {providers.length === 0 ? "هیچ مدل AI فعالی تنظیم نشده." : "سؤال بپرسید، تصویر یا سند (PDF، Word، Excel)، صدا و ویدیو بفرستید تا دستیار آن را بررسی کند."}
              </p>
              {providers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-start text-sm text-theme-secondary bg-theme-card hover:bg-blue-500/5 border border-theme hover:border-blue-500/40 rounded-2xl px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md">{q}</button>
                  ))}
                </div>
              )}
              {memories.length > 0 && <p className="text-blue-500 text-xs mt-5 flex items-center gap-1"><Brain className="w-3 h-3" /> {fa(memories.length)} حافظه فعال است</p>}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6">
              {messages.map(msg => {
                const isUser = msg.role === "user";
                if (isUser) return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="max-w-[88%] sm:max-w-[75%]">
                      {!!msg.attachments?.length && <div className="flex justify-start"><AttachmentGrid atts={msg.attachments} /></div>}
                      {msg.content && (
                        <div className="bg-gradient-to-br from-blue-500/15 to-purple-500/10 border border-blue-500/20 rounded-3xl rounded-tr-lg px-5 py-3 text-[15px] leading-7 text-theme-primary shadow-sm whitespace-pre-wrap break-words" dir="auto">{msg.content}</div>
                      )}
                      <div className="text-[10px] text-theme-muted/70 mt-1 px-1">{formatTs(msg.createdAt)}</div>
                    </div>
                  </motion.div>
                );
                const waiting = msg.streaming && !msg.content && !msg.reasoning;
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 group/msg">
                    <div className="w-8 h-8 bg-ai-gradient rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 mt-0.5"><Sparkles className="w-4 h-4 text-white" /></div>
                    <div className="min-w-0 flex-1">
                      {(msg.reasoning || (msg.streaming && reasoning && caps?.reasoning)) && <Thinking text={msg.reasoning || ""} active={!!msg.streaming && !msg.content} ms={msg.thinkingMs} />}
                      {waiting && <TypingDots />}
                      {msg.error
                        ? <div className="flex items-start gap-2 rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-1 shrink-0" /><span>{msg.content.replace(/^⚠️\s*/, "")}</span></div>
                        : msg.content && (
                          <div className="text-theme-primary" dir="auto">
                            <Markdown text={msg.content} />
                            {msg.streaming && <span className="inline-block w-2 h-4 bg-blue-500/70 align-middle ms-0.5 animate-pulse rounded-sm" />}
                          </div>
                        )}
                      {msg.stopped && <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"><Square className="w-2.5 h-2.5 fill-current" /> پاسخ متوقف شد</div>}
                      {!msg.streaming && (
                        <div className="flex items-center gap-1 mt-1.5 text-theme-muted">
                          <span className="text-[10px] me-2">{formatTs(msg.createdAt, msg.latencyMs)}{msg.completionTokens ? ` · ${fa(msg.completionTokens)} توکن` : ""}</span>
                          {!msg.error && msg.content && (
                            <button onClick={() => copyMsg(msg)} className="p-1 rounded-md hover:bg-theme-hover hover:text-theme-primary transition-colors" title="کپی">
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {msg.id === lastAssistantId && !streaming && (
                            <button onClick={() => run({ regenerate: true })} className="p-1 rounded-md hover:bg-theme-hover hover:text-theme-primary transition-colors" title="تولید دوباره"><RefreshCw className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <AnimatePresence>
          {!atBottom && messages.length > 0 && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => { stickRef.current = true; scrollDown(); }}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-theme-card border border-theme shadow-lg flex items-center justify-center text-theme-secondary hover:text-theme-primary" aria-label="رفتن به آخر">
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {providers.length > 0 && (
          <Composer value={input} onChange={setInput} onSend={() => run()} onStop={stop} streaming={streaming} uploads={uploads}
            policy={policy} caps={caps} reasoning={reasoning} onToggleReasoning={toggleReasoning} inputRef={inputRef} />
        )}
        <div className="text-center text-[10px] text-theme-muted/60 pb-2 px-4">هوش مصنوعی ممکن است اشتباه کند؛ اطلاعات مهم را بررسی کنید.</div>

        <AnimatePresence>
          {dragging && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-blue-500/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500/60 rounded-xl flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="w-12 h-12 text-blue-500 mb-2" />
              <div className="text-blue-600 dark:text-blue-300 font-semibold">فایل را اینجا رها کنید</div>
              <div className="text-xs text-theme-muted mt-1">تصویر، PDF، Word، Excel، متن، صدا یا ویدیو</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-theme-muted text-sm">در حال بارگذاری...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}
