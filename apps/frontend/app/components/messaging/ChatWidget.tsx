"use client";
import React from "react";
import Link from "next/link";
import {
  MessageCircle, X, Minus, Maximize2, Send, ArrowRight,
  Paperclip, Smile, Users, Search, Check, CheckCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMessagingOptional, type Conversation, type ChatMessage } from "../../../lib/messaging";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || "کاربر";
}

function timeStr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "همین الان";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} دقیقه پیش`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ساعت پیش`;
  return new Date(iso).toLocaleDateString("fa-IR");
}

// ── Conversation List ──────────────────────────────────────────────

function ConvList({
  convs,
  onSelect,
  onClose,
}: {
  convs: Conversation[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ctx = useMessagingOptional()!;
  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<"chats" | "users">("chats");

  const myId = convs[0]?.members?.find(() => true)?.userId; // rough; we'll filter properly

  const filtered = tab === "chats"
    ? convs.filter((c) => {
        if (!search) return true;
        const other = c.members.find((m) => m.userId !== myId);
        if (!other) return false;
        return fullName(other.user).includes(search);
      })
    : ctx.users.filter((u) =>
        !search ||
        fullName(u).includes(search) ||
        (u.department?.name || "").includes(search),
      );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="font-bold text-white text-sm">پیام‌رسانی</span>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/messaging"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            title="باز کردن پنجره کامل"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(["chats", "users"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t ? "text-white border-b-2 border-blue-400" : "text-white/50 hover:text-white/80"
            }`}
          >
            {t === "chats" ? "گفتگوها" : "کاربران"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-white/50 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو..."
            className="flex-1 bg-transparent text-white text-xs placeholder-white/40 outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {tab === "chats" && (
          <>
            {filtered.length === 0 && (
              <div className="text-center text-white/40 text-xs py-8">گفتگویی یافت نشد</div>
            )}
            {filtered.map((conv) => {
              const other = conv.members.find((m) => m.userId !== myId) ?? conv.members[0];
              const last = conv.messages[0];
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/10 transition-colors text-right"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                      {fullName(other?.user ?? { firstName: "؟", lastName: "" })[0]}
                    </div>
                    {other?.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-white text-xs truncate">
                        {fullName(other?.user ?? { firstName: "گروه", lastName: "" })}
                      </span>
                      {last && <span className="text-white/40 text-[10px] shrink-0">{relTime(last.createdAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-white/50 text-[11px] truncate">
                        {last?.isDeleted ? "پیام حذف شد" : last?.content ?? last?.attachments?.[0]?.name ?? ""}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
        {tab === "users" && (
          <>
            {ctx.users.length === 0 && (
              <div className="text-center text-white/40 text-xs py-8">بارگذاری...</div>
            )}
            {(filtered as typeof ctx.users).map((u) => (
              <button
                key={u.id}
                onClick={() => ctx.openConversation(u.id)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white text-xs">
                    {fullName(u)[0]}
                  </div>
                  {u.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="font-medium text-white text-xs truncate">{fullName(u)}</div>
                  <div className="text-white/40 text-[10px] truncate">
                    {u.department?.name ?? u.role ?? ""}
                  </div>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Chat View ──────────────────────────────────────────────────────

function ChatView({
  conv,
  messages,
  myId,
  typing,
  onBack,
  onClose,
}: {
  conv: Conversation;
  messages: ChatMessage[];
  myId: string;
  typing: string[];
  onBack: () => void;
  onClose: () => void;
}) {
  const ctx = useMessagingOptional()!;
  const [input, setInput] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = React.useState<string | null>(null); // messageId
  const fileRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const other = conv.members.find((m) => m.userId !== myId) ?? conv.members[0];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
    ctx.markRead(conv.id);
  }, [conv.id]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleInput(v: string) {
    setInput(v);
    ctx.sendMessage(conv.id, "", "typing_start");
    socketEmitTyping(true);
  }

  function socketEmitTyping(start: boolean) {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (start) {
      typingTimer.current = setTimeout(() => socketEmitTyping(false), 3000);
    }
  }

  function send() {
    const content = input.trim();
    if (!content) return;
    ctx.sendMessage(conv.id, content, "TEXT", replyTo?.id);
    setInput("");
    setReplyTo(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await ctx.uploadFile(conv.id, file);
    } catch {}
    if (fileRef.current) fileRef.current.value = "";
  }

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/70">
          <ArrowRight className="w-4 h-4" />
        </button>
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
            {fullName(other?.user ?? { firstName: "؟", lastName: "" })[0]}
          </div>
          {other?.isOnline && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-slate-900" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-xs font-semibold truncate">
            {fullName(other?.user ?? { firstName: "گفتگو", lastName: "" })}
          </div>
          <div className="text-white/40 text-[10px]">{other?.isOnline ? "آنلاین" : "آفلاین"}</div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/70">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {sorted.map((msg) => {
          const isMe = msg.senderId === myId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-start" : "justify-end"} group`}>
              <div className="max-w-[75%]">
                {/* Reply quote */}
                {msg.replyTo && !msg.replyTo.isDeleted && (
                  <div className={`text-[10px] px-2 py-1 rounded-t-lg mb-0.5 border-r-2 border-blue-400 ${isMe ? "bg-white/5 text-white/50 mr-0" : "bg-black/20 text-white/50"}`}>
                    <span className="font-medium">{fullName(msg.replyTo.sender)}: </span>
                    {msg.replyTo.content?.slice(0, 40)}
                  </div>
                )}

                <div
                  className={`relative px-3 py-2 rounded-2xl text-xs ${
                    isMe
                      ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm"
                      : "bg-white/15 text-white rounded-bl-sm"
                  } ${msg.isDeleted ? "opacity-50 italic" : ""}`}
                  onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)}
                >
                  {msg.isDeleted ? (
                    <span className="text-white/50">پیام حذف شد</span>
                  ) : msg.attachments.length > 0 ? (
                    <div>
                      {msg.attachments[0].type === "IMAGE" ? (
                        <img src={msg.attachments[0].url} alt={msg.attachments[0].name} className="max-w-full rounded-lg max-h-32 object-cover" />
                      ) : (
                        <a href={msg.attachments[0].url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline">
                          <Paperclip className="w-3 h-3 shrink-0" />
                          <span className="truncate">{msg.attachments[0].name}</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}

                  {/* Time + status */}
                  <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMe ? "text-blue-200" : "text-white/40"}`} style={{ fontSize: 9 }}>
                    {msg.isEdited && <span>ویرایش‌شده</span>}
                    <span>{timeStr(msg.createdAt)}</span>
                    {isMe && (msg.readBy.length > 0 ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                  </div>
                </div>

                {/* Reactions */}
                {msg.reactions.length > 0 && (
                  <div className={`flex flex-wrap gap-0.5 mt-0.5 ${isMe ? "justify-start" : "justify-end"}`}>
                    {Object.entries(
                      msg.reactions.reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] ?? 0) + 1 }), {} as Record<string, number>)
                    ).map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); ctx.toggleReaction(msg.id, emoji); }}
                        className="text-[11px] bg-white/10 hover:bg-white/20 rounded-full px-1.5 py-0.5 transition-colors"
                      >
                        {emoji} {count}
                      </button>
                    ))}
                  </div>
                )}

                {/* Emoji picker on click */}
                <AnimatePresence>
                  {showEmoji === msg.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 4 }}
                      className={`flex gap-1 bg-slate-800/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg mt-1 ${isMe ? "justify-start" : "justify-end"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {EMOJI_LIST.map((e) => (
                        <button key={e} onClick={() => { ctx.toggleReaction(msg.id, e); setShowEmoji(null); }} className="text-sm hover:scale-125 transition-transform">
                          {e}
                        </button>
                      ))}
                      <button onClick={() => setReplyTo(msg)} className="text-white/50 hover:text-white text-[10px] px-1">↩</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing.length > 0 && (
          <div className="flex justify-end">
            <div className="bg-white/10 rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
              {[0, 150, 300].map((d) => (
                <span key={d} className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-1 px-3 py-1.5 bg-white/10 rounded-xl flex items-center justify-between gap-2">
              <div className="text-[11px] text-white/60 truncate">
                <span className="font-medium text-white/80">{fullName(replyTo.sender)}: </span>
                {replyTo.content?.slice(0, 50)}
              </div>
              <button onClick={() => setReplyTo(null)} className="text-white/40 hover:text-white shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        <input
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="پیام..."
          className="flex-1 bg-white/10 text-white placeholder-white/30 text-xs px-3 py-2 rounded-xl outline-none focus:bg-white/15 transition-colors"
          dir="auto"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────

export default function ChatWidget() {
  const ctx = useMessagingOptional();
  const [myId, setMyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const payload = JSON.parse(atob(token.split(".")[1]));
      setMyId(payload.sub || null);
    } catch {}
  }, []);

  if (!ctx || !myId) return null;

  const { conversations, activeConvId, messages, isWidgetOpen, unreadTotal, typing, onlineCount } = ctx;
  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;
  const activeMessages = activeConvId ? (messages[activeConvId] ?? []) : [];
  const activeTyping = activeConvId ? (typing[activeConvId] ?? []).filter((id) => id !== myId) : [];

  return (
    <>
      {/* Floating toggle button */}
      <div className="fixed bottom-6 left-6 z-[9990] flex flex-col items-center gap-2">
        <AnimatePresence>
          {onlineCount > 0 && !isWidgetOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-slate-800/90 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full shadow flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              {onlineCount} آنلاین
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={ctx.toggleWidget}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-13 h-13 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-900/40 flex items-center justify-center"
          style={{ width: 52, height: 52 }}
        >
          <motion.div
            animate={{ rotate: isWidgetOpen ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isWidgetOpen ? (
              <Minus className="w-5 h-5 text-white" />
            ) : (
              <MessageCircle className="w-5 h-5 text-white" />
            )}
          </motion.div>
          {unreadTotal > 0 && !isWidgetOpen && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg"
            >
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* Panel */}
      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-[88px] left-6 z-[9989] w-80 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: "rgba(15, 23, 42, 0.96)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.1)",
              height: 480,
            }}
          >
            {activeConv ? (
              <ChatView
                conv={activeConv}
                messages={activeMessages}
                myId={myId}
                typing={activeTyping}
                onBack={() => ctx.setActiveConv(null)}
                onClose={ctx.closeWidget}
              />
            ) : (
              <ConvList
                convs={conversations}
                onSelect={(id) => {
                  ctx.setActiveConv(id);
                  ctx.markRead(id);
                }}
                onClose={ctx.closeWidget}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
