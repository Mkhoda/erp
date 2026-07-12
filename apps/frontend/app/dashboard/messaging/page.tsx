"use client";
import React from "react";
import Link from "next/link";
import {
  Search, Send, Paperclip, ArrowRight, Check, CheckCheck,
  MoreHorizontal, Trash2, Pencil, X, Users, MessageSquare,
  Smile, Download, Shield, Share2, Play, Music, ExternalLink,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMessaging, type Conversation, type ChatMessage } from "../../../lib/messaging";
import { useToast } from "../../components/ui/Toast";
import MediaViewer from "../../components/messaging/MediaViewer";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥"];

function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || "کاربر";
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "امروز";
  if (d.toDateString() === yesterday.toDateString()) return "دیروز";
  return d.toLocaleDateString("fa-IR");
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "همین الان";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} دقیقه پیش`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ساعت پیش`;
  return new Date(iso).toLocaleDateString("fa-IR");
}

// ── Avatar ─────────────────────────────────────────────────────────

function Avatar({ name, online, size = 10 }: { name: string; online?: boolean; size?: number }) {
  const s = `w-${size} h-${size}`;
  return (
    <div className={`relative shrink-0 ${s}`}>
      <div className={`${s} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm`}>
        {name[0] ?? "؟"}
      </div>
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-theme-base ${online ? "bg-green-400" : "bg-slate-400"}`} />
      )}
    </div>
  );
}

// ── Date separator ────────────────────────────────────────────────

function DateSep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 border-t border-theme" />
      <span className="text-xs text-theme-muted px-2">{label}</span>
      <div className="flex-1 border-t border-theme" />
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMe,
  onReply,
  onDelete,
  onEdit,
  onReact,
  onForward,
  onView,
}: {
  msg: ChatMessage;
  isMe: boolean;
  onReply: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReact: (emoji: string) => void;
  onForward: () => void;
  onView: (url: string, type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT", name: string) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setMenuOpen(false); setShowEmoji(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const reactionMap = msg.reactions.reduce(
    (acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div ref={ref} className={`flex ${isMe ? "flex-row" : "flex-row-reverse"} items-end gap-2 group`}>
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white text-xs shrink-0 mb-1">
          {fullName(msg.sender)[0]}
        </div>
      )}

      <div className="max-w-[65%] relative">
        {/* Reply quote */}
        {msg.replyTo && !msg.replyTo.isDeleted && (
          <div className="text-xs px-3 py-1.5 rounded-t-xl bg-theme-hover border-r-2 border-blue-500 mb-0.5 text-theme-muted">
            <span className="font-medium text-theme-primary">{fullName(msg.replyTo.sender)}: </span>
            {msg.replyTo.content?.slice(0, 60)}
          </div>
        )}

        <div
          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isMe
              ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-br-md"
              : "bg-theme-card border border-theme text-theme-primary rounded-bl-md"
          } ${msg.isDeleted ? "opacity-50" : ""}`}
        >
          {msg.isDeleted ? (
            <span className="italic text-sm opacity-70">پیام حذف شد</span>
          ) : msg.attachments.length > 0 ? (
            <div className="space-y-1">
              {msg.attachments.map((att) => (
                <div key={att.id}>
                  {att.type === "IMAGE" ? (
                    <button
                      onClick={() => onView(att.url, "IMAGE", att.name)}
                      className="block w-full text-left"
                    >
                      <img
                        src={att.url}
                        alt={att.name}
                        className="max-w-full max-h-48 rounded-xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                      />
                    </button>
                  ) : att.type === "VIDEO" ? (
                    <button
                      onClick={() => onView(att.url, "VIDEO", att.name)}
                      className="relative block w-full group cursor-pointer"
                    >
                      <video src={att.url} className="max-w-full max-h-48 rounded-xl pointer-events-none" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl group-hover:bg-black/40 transition-colors">
                        <Play className="w-10 h-10 text-white drop-shadow" />
                      </div>
                    </button>
                  ) : att.type === "AUDIO" ? (
                    <button
                      onClick={() => onView(att.url, "AUDIO", att.name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl w-full ${isMe ? "bg-white/10 hover:bg-white/20" : "bg-theme-hover hover:bg-theme-card"} transition-colors`}
                    >
                      <Music className="w-4 h-4 shrink-0 opacity-60" />
                      <span className="text-xs truncate flex-1">{att.name}</span>
                    </button>
                  ) : (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isMe ? "bg-white/10" : "bg-theme-hover"}`}>
                      <Paperclip className="w-4 h-4 shrink-0 opacity-60" />
                      <span className="text-xs truncate flex-1">{att.name}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => onView(att.url, "DOCUMENT", att.name)}
                          className={`p-1 rounded opacity-60 hover:opacity-100 transition-opacity ${isMe ? "hover:bg-white/10" : "hover:bg-theme-card"}`}
                          title="مشاهده"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={att.url}
                          download={att.name}
                          onClick={(e) => e.stopPropagation()}
                          className={`p-1 rounded opacity-60 hover:opacity-100 transition-opacity ${isMe ? "hover:bg-white/10" : "hover:bg-theme-card"}`}
                          title="دانلود"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          )}

          {/* Meta: time + edited + read */}
          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? "text-blue-200" : "text-theme-muted"}`}>
            {msg.isEdited && <span>ویرایش‌شده ·</span>}
            <span>{timeStr(msg.createdAt)}</span>
            {isMe && (msg.readBy.length > 0 ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionMap).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-start" : "justify-end"}`}>
            {Object.entries(reactionMap).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="text-xs bg-theme-hover hover:bg-theme-card border border-theme rounded-full px-2 py-0.5 transition-colors"
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Emoji picker (hover) */}
        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`absolute ${isMe ? "right-0" : "left-0"} -top-10 flex gap-1 bg-theme-card border border-theme rounded-full px-2 py-1 shadow-lg z-10`}
            >
              {EMOJI_LIST.map((e) => (
                <button key={e} onClick={() => { onReact(e); setShowEmoji(false); }} className="text-base hover:scale-125 transition-transform">
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action row (visible on hover) */}
        {!msg.isDeleted && (
          <div className={`absolute top-0 ${isMe ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"} hidden group-hover:flex items-center gap-1`}>
            <button onClick={() => setShowEmoji((v) => !v)} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors">
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button onClick={onReply} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors text-sm">↩</button>
            <button onClick={onForward} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors" title="ارسال مجدد">
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {isMe && (
              <>
                <button onClick={onEdit} className="p-1 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function MessagingPage() {
  const ctx = useMessaging();
  const toast = useToast();
  const [myId, setMyId] = React.useState<string | null>(null);
  const [myRole, setMyRole] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [userSearch, setUserSearch] = React.useState("");
  const [tab, setTab] = React.useState<"chats" | "users">("chats");
  const [input, setInput] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editInput, setEditInput] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [uploadProgress, setUploadProgress] = React.useState(false);
  const [mediaView, setMediaView] = React.useState<{ url: string; type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; name: string } | null>(null);
  const [forwardMsg, setForwardMsg] = React.useState<ChatMessage | null>(null);
  const [forwardTargets, setForwardTargets] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const payload = JSON.parse(atob(token.split(".")[1]));
      setMyId(payload.sub);
      setMyRole(payload.role);
    } catch {}
  }, []);

  const { conversations, activeConvId, messages, typing, presence, isConnected, users, loadingMore, hasMore } = ctx;

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;
  const activeMessages = activeConvId ? (messages[activeConvId] ?? []) : [];
  const activeTyping = activeConvId ? (typing[activeConvId] ?? []).filter((id) => id !== myId) : [];

  // Open conversation + fetch messages
  const openConv = React.useCallback(async (convId: string) => {
    ctx.setActiveConv(convId);
    ctx.markRead(convId);
  }, [ctx]);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  // Infinite scroll
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current || !activeConvId) return;
    if (scrollRef.current.scrollTop === 0 && hasMore[activeConvId] && !loadingMore[activeConvId]) {
      ctx.loadMoreMessages(activeConvId);
    }
  }, [activeConvId, hasMore, loadingMore, ctx]);

  function send() {
    if (!activeConvId) return;
    const content = input.trim();
    if (!content) return;
    ctx.sendMessage(activeConvId, content, "TEXT", replyTo?.id);
    setInput("");
    setReplyTo(null);
  }

  function saveEdit() {
    if (!editingId || !editInput.trim()) return;
    ctx.editMessage(editingId, editInput.trim());
    setEditingId(null);
    setEditInput("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeConvId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(true);
    try {
      await ctx.uploadFile(activeConvId, file);
    } catch {
      toast.error("آپلود فایل ناموفق بود");
    } finally {
      setUploadProgress(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendForward() {
    if (!forwardMsg || forwardTargets.size === 0) return;
    const content = forwardMsg.content ?? forwardMsg.attachments[0]?.name ?? "فایل ضمیمه";
    const type = forwardMsg.attachments.length > 0 ? forwardMsg.attachments[0].type as "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" : "TEXT";
    const count = forwardTargets.size;
    for (const convId of forwardTargets) {
      await ctx.sendMessage(convId, content, type);
    }
    setForwardMsg(null);
    setForwardTargets(new Set());
    toast.success(`پیام به ${count} گفتگو ارسال شد`);
  }

  // Group messages by date
  const sorted = [...activeMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const grouped: Array<{ date: string; msgs: ChatMessage[] }> = [];
  sorted.forEach((msg) => {
    const d = dateLabel(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== d) grouped.push({ date: d, msgs: [msg] });
    else last.msgs.push(msg);
  });

  const filteredConvs = conversations.filter((c) => {
    if (!search) return true;
    const other = c.members.find((m) => m.userId !== myId);
    return other ? fullName(other.user).includes(search) : false;
  });

  const filteredUsers = users.filter((u) =>
    !userSearch ||
    fullName(u).includes(userSearch) ||
    (u.department?.name ?? "").includes(userSearch),
  );

  return (
    <>
    <div className="flex h-[calc(100vh-var(--header-h,64px)-2rem)] overflow-hidden rounded-2xl border border-theme shadow-sm" dir="rtl">
      {/* ── Left panel: conversations + users ─────────────────────── */}
      <div className="w-72 lg:w-80 flex flex-col border-l border-theme bg-theme-card shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
          <h2 className="font-bold text-theme-primary text-sm">پیام‌رسانی</h2>
          <div className="flex items-center gap-1.5">
            {!isConnected && (
              <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">قطع</span>
            )}
            {myRole === "ADMIN" && (
              <Link href="/dashboard/messaging/admin" className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary transition-colors" title="تنظیمات مدیر">
                <Shield className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-theme">
          {(["chats", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-theme-muted hover:text-theme-secondary"
              }`}
            >
              {t === "chats" ? (
                <span className="flex items-center justify-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />گفتگوها</span>
              ) : (
                <span className="flex items-center justify-center gap-1.5"><Users className="w-3.5 h-3.5" />کاربران</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-theme">
          <div className="flex items-center gap-2 bg-theme-hover rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-theme-muted shrink-0" />
            <input
              value={tab === "chats" ? search : userSearch}
              onChange={(e) => tab === "chats" ? setSearch(e.target.value) : setUserSearch(e.target.value)}
              placeholder="جستجو..."
              className="flex-1 bg-transparent text-theme-primary text-xs outline-none placeholder-theme-muted"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {tab === "chats" && (
            <>
              {filteredConvs.length === 0 && (
                <div className="text-center text-theme-muted text-xs py-10">
                  {search ? "گفتگویی یافت نشد" : "هنوز گفتگویی ندارید"}
                </div>
              )}
              {filteredConvs.map((conv) => {
                const other = conv.members.find((m) => m.userId !== myId) ?? conv.members[0];
                const last = conv.messages[0];
                const isActive = activeConvId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConv(conv.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-right ${
                      isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-theme-hover"
                    }`}
                  >
                    <Avatar name={fullName(other?.user ?? { firstName: "؟", lastName: "" })} online={other?.isOnline} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-theme-primary text-xs truncate">
                          {fullName(other?.user ?? { firstName: "گروه", lastName: "" })}
                        </span>
                        {last && <span className="text-theme-muted text-[10px] shrink-0">{relTime(last.createdAt)}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-theme-muted text-[11px] truncate">
                          {last?.isDeleted ? "پیام حذف شد" : (last?.content ?? last?.attachments?.[0]?.name ?? "")}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
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
              {filteredUsers.length === 0 && (
                <div className="text-center text-theme-muted text-xs py-10">
                  {userSearch ? "کاربری یافت نشد" : "در حال بارگذاری..."}
                </div>
              )}
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { ctx.openConversation(u.id); setTab("chats"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-theme-hover transition-colors text-right"
                >
                  <Avatar name={fullName(u)} online={u.isOnline} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-theme-primary text-xs truncate">{fullName(u)}</div>
                    <div className="text-theme-muted text-[11px] truncate">
                      {u.department?.name ?? u.role ?? ""}
                    </div>
                  </div>
                  {u.isOnline && <span className="text-[10px] text-green-500 shrink-0">آنلاین</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right panel: active conversation ─────────────────────── */}
      <div className="flex-1 flex flex-col bg-theme-base min-w-0">
        {!activeConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-theme-muted gap-4">
            <MessageSquare className="w-16 h-16 opacity-20" />
            <div className="text-center">
              <p className="font-medium text-theme-secondary">یک گفتگو انتخاب کنید</p>
              <p className="text-sm mt-1 opacity-70">یا با کاربری جدید گفتگو شروع کنید</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-theme bg-theme-card flex items-center gap-3">
              {(() => {
                const other = activeConv.members.find((m) => m.userId !== myId) ?? activeConv.members[0];
                return (
                  <>
                    <Avatar name={fullName(other?.user ?? { firstName: "؟", lastName: "" })} online={other?.isOnline} size={10} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-theme-primary text-sm truncate">
                        {fullName(other?.user ?? { firstName: "گفتگو", lastName: "" })}
                      </div>
                      <div className="text-xs text-theme-muted">
                        {activeTyping.length > 0
                          ? "در حال تایپ..."
                          : other?.isOnline
                          ? "آنلاین"
                          : "آفلاین"}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
            >
              {loadingMore[activeConvId!] && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {grouped.map(({ date, msgs }) => (
                <React.Fragment key={date}>
                  <DateSep label={date} />
                  {msgs.map((msg) => {
                    const isMe = msg.senderId === myId;
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMe={isMe}
                        onReply={() => setReplyTo(msg)}
                        onDelete={() => ctx.deleteMessage(msg.id, true)}
                        onEdit={() => { setEditingId(msg.id); setEditInput(msg.content ?? ""); }}
                        onReact={(emoji) => ctx.toggleReaction(msg.id, emoji)}
                        onForward={() => { setForwardMsg(msg); setForwardTargets(new Set()); }}
                        onView={(url, type, name) => setMediaView({ url, type, name })}
                      />
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Typing indicator */}
              {activeTyping.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                    {activeConv.members.find((m) => m.userId === activeTyping[0])?.user?.firstName?.[0] ?? "؟"}
                  </div>
                  <div className="bg-theme-card border border-theme rounded-2xl rounded-bl-md px-4 py-2.5 flex gap-1 items-center">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-2 h-2 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
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
                >
                  <div className="mx-4 mb-2 px-4 py-2 bg-theme-hover rounded-xl flex items-center justify-between gap-3">
                    <div className="text-xs text-theme-muted truncate">
                      <span className="font-semibold text-theme-primary">{fullName(replyTo.sender)}: </span>
                      {replyTo.content?.slice(0, 60)}
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-theme-muted hover:text-theme-primary shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Edit bar */}
            <AnimatePresence>
              {editingId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="mx-4 mb-2 flex items-center gap-2">
                    <input
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") { setEditingId(null); setEditInput(""); } }}
                      className="flex-1 input-theme text-sm"
                      placeholder="ویرایش پیام..."
                      autoFocus
                      dir="auto"
                    />
                    <button onClick={saveEdit} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">ذخیره</button>
                    <button onClick={() => { setEditingId(null); setEditInput(""); }} className="px-3 py-1.5 bg-theme-hover text-theme-secondary text-xs rounded-lg hover:bg-theme-card">لغو</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="p-2.5 rounded-xl hover:bg-theme-hover text-theme-muted hover:text-theme-secondary transition-colors shrink-0"
                title="آپلود فایل"
              >
                {uploadProgress ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="پیام خود را بنویسید..."
                className="flex-1 input-theme text-sm"
                dir="auto"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>

      {/* Media Viewer overlay */}
      <AnimatePresence>
        {mediaView && (
          <MediaViewer
            url={mediaView.url}
            type={mediaView.type}
            name={mediaView.name}
            onClose={() => setMediaView(null)}
          />
        )}
      </AnimatePresence>

      {/* Forward Modal */}
      <AnimatePresence>
        {forwardMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setForwardMsg(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-theme-card border border-theme rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
                <h3 className="font-semibold text-theme-primary text-sm">ارسال مجدد</h3>
                <button onClick={() => setForwardMsg(null)} className="text-theme-muted hover:text-theme-primary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-2 border-b border-theme bg-theme-hover/50">
                <p className="text-xs text-theme-muted truncate">
                  {forwardMsg.content ?? forwardMsg.attachments[0]?.name ?? "فایل ضمیمه"}
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {conversations.map((conv) => {
                  const other = conv.members.find((m) => m.userId !== myId) ?? conv.members[0];
                  const name = fullName(other?.user ?? { firstName: "گفتگو", lastName: "" });
                  const checked = forwardTargets.has(conv.id);
                  return (
                    <button
                      key={conv.id}
                      onClick={() =>
                        setForwardTargets((s) => {
                          const ns = new Set(s);
                          if (ns.has(conv.id)) ns.delete(conv.id);
                          else ns.add(conv.id);
                          return ns;
                        })
                      }
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${checked ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-theme-hover"}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-theme-muted"}`}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <Avatar name={name} size={8} />
                      <span className="text-sm text-theme-primary truncate">{name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-theme flex gap-2">
                <button
                  onClick={sendForward}
                  disabled={forwardTargets.size === 0}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl transition-colors font-medium"
                >
                  {forwardTargets.size > 0 ? `ارسال به ${forwardTargets.size} گفتگو` : "انتخاب کنید..."}
                </button>
                <button
                  onClick={() => { setForwardMsg(null); setForwardTargets(new Set()); }}
                  className="px-4 py-2 bg-theme-hover hover:bg-theme-card text-theme-secondary text-sm rounded-xl transition-colors"
                >
                  لغو
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
