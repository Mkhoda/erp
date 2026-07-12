"use client";
import React from "react";
import { io, Socket } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// Derive the socket URL from the API URL (strip /api suffix)
function getSocketUrl() {
  if (API.startsWith("http")) return API.replace(/\/api\/?$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3001";
}

function authHeader() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export type ChatUser = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: { id: string; name: string };
  isOnline?: boolean;
};

export type ChatAttachment = {
  id: string;
  type: string;
  url: string;
  name: string;
  size: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
};

export type ChatReaction = {
  messageId: string;
  userId: string;
  emoji: string;
  user: { id: string; firstName: string; lastName: string };
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; firstName: string; lastName: string };
  type: string;
  content?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedForAll: boolean;
  replyToId?: string;
  replyTo?: ChatMessage;
  attachments: ChatAttachment[];
  reactions: ChatReaction[];
  readBy: { userId: string; readAt: string }[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  type: string;
  name?: string;
  members: Array<{
    id: string;
    userId: string;
    user: ChatUser;
    isOnline?: boolean;
    lastReadAt?: string;
  }>;
  messages: ChatMessage[];
  unreadCount: number;
  updatedAt: string;
};

type MessagingState = {
  conversations: Conversation[];
  activeConvId: string | null;
  messages: Record<string, ChatMessage[]>;
  presence: Record<string, "ONLINE" | "OFFLINE">;
  typing: Record<string, string[]>;
  unreadTotal: number;
  isConnected: boolean;
  isWidgetOpen: boolean;
  users: ChatUser[];
  onlineCount: number;
  loadingMore: Record<string, boolean>;
  hasMore: Record<string, boolean>;
};

type MessagingActions = {
  openConversation: (userId: string) => Promise<void>;
  setActiveConv: (convId: string | null) => void;
  sendMessage: (convId: string, content: string, type?: string, replyToId?: string) => void;
  uploadFile: (convId: string, file: File) => Promise<void>;
  markRead: (convId: string) => void;
  deleteMessage: (messageId: string, forAll?: boolean) => void;
  editMessage: (messageId: string, content: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  loadMoreMessages: (convId: string) => Promise<void>;
  toggleWidget: () => void;
  openWidget: (convId?: string) => void;
  closeWidget: () => void;
  refreshConversations: () => Promise<void>;
  refreshUsers: () => Promise<void>;
};

type MessagingContextValue = MessagingState & MessagingActions;

const MessagingContext = React.createContext<MessagingContextValue | null>(null);

export function useMessaging() {
  const ctx = React.useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be used within MessagingProvider");
  return ctx;
}

export function useMessagingOptional() {
  return React.useContext(MessagingContext);
}

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const socketRef = React.useRef<Socket | null>(null);
  const myIdRef = React.useRef<string>("");
  const [state, setState] = React.useState<MessagingState>({
    conversations: [],
    activeConvId: null,
    messages: {},
    presence: {},
    typing: {},
    unreadTotal: 0,
    isConnected: false,
    isWidgetOpen: false,
    users: [],
    onlineCount: 0,
    loadingMore: {},
    hasMore: {},
  });

  const stateRef = React.useRef(state);
  stateRef.current = state;

  const patch = (partial: Partial<MessagingState>) =>
    setState((s) => ({ ...s, ...partial }));

  // ── Fetch helpers ──────────────────────────────────────────────

  const fetchConversations = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/messaging/conversations`, { headers: authHeader() });
      if (!r.ok) return;
      const convs: Conversation[] = await r.json();
      const total = convs.reduce((sum, c) => sum + c.unreadCount, 0);
      patch({ conversations: convs, unreadTotal: total });
    } catch {}
  }, []);

  const fetchUsers = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/messaging/users`, { headers: authHeader() });
      if (!r.ok) return;
      patch({ users: await r.json() });
    } catch {}
  }, []);

  const fetchMessages = React.useCallback(async (convId: string, cursor?: string) => {
    try {
      const url = `${API}/messaging/conversations/${convId}/messages${cursor ? `?cursor=${cursor}` : ""}`;
      const r = await fetch(url, { headers: authHeader() });
      if (!r.ok) return;
      const msgs: ChatMessage[] = await r.json();
      setState((s) => {
        const existing = cursor ? (s.messages[convId] ?? []) : [];
        const merged = cursor ? [...existing, ...msgs] : msgs;
        return {
          ...s,
          messages: { ...s.messages, [convId]: merged },
          hasMore: { ...s.hasMore, [convId]: msgs.length === 30 },
          loadingMore: { ...s.loadingMore, [convId]: false },
        };
      });
    } catch {
      setState((s) => ({ ...s, loadingMore: { ...s.loadingMore, [convId]: false } }));
    }
  }, []);

  // ── Initial data load (independent of socket) ────────────────

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      myIdRef.current = JSON.parse(atob(token.split(".")[1])).sub || "";
    } catch {}
    fetchConversations();
    fetchUsers();
  }, [fetchConversations, fetchUsers]);

  // ── Socket setup ───────────────────────────────────────────────

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(getSocketUrl(), {
      auth: { token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.3,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      patch({ isConnected: true });
      fetchConversations();
      fetchUsers();
    });

    socket.on("disconnect", () => patch({ isConnected: false }));

    socket.on("connected", (data: { userId: string; onlineCount: number }) => {
      patch({ onlineCount: data.onlineCount });
    });

    socket.on("message:new", (msg: ChatMessage) => {
      // Browser notification when window is hidden and message is from someone else
      if (
        msg.senderId !== myIdRef.current &&
        typeof document !== "undefined" &&
        document.hidden
      ) {
        if (Notification.permission === "granted") {
          new Notification(
            `${msg.sender.firstName} ${msg.sender.lastName}`.trim() || "پیام جدید",
            { body: msg.content ?? "فایل ضمیمه", icon: "/favicon.ico", tag: msg.conversationId },
          );
        } else if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
      setState((s) => {
        const existing = s.messages[msg.conversationId] ?? [];
        if (existing.some((m) => m.id === msg.id)) return s;
        // Remove optimistic placeholder when the real message echoes back from server
        const base =
          msg.senderId === myIdRef.current
            ? existing.filter((m) => !m.id.startsWith("_opt_"))
            : existing;
        const updatedConvs = s.conversations.map((c) => {
          if (c.id !== msg.conversationId) return c;
          const isActive = s.activeConvId === c.id && s.isWidgetOpen;
          return {
            ...c,
            messages: [msg],
            unreadCount: isActive ? 0 : c.unreadCount + 1,
            updatedAt: msg.createdAt,
          };
        });
        const total = updatedConvs.reduce((sum, c) => sum + c.unreadCount, 0);
        return {
          ...s,
          messages: { ...s.messages, [msg.conversationId]: [msg, ...base] },
          conversations: updatedConvs,
          unreadTotal: total,
        };
      });
    });

    socket.on("message:edited", (msg: ChatMessage) => {
      setState((s) => ({
        ...s,
        messages: {
          ...s.messages,
          [msg.conversationId]: (s.messages[msg.conversationId] ?? []).map((m) =>
            m.id === msg.id ? msg : m,
          ),
        },
      }));
    });

    socket.on("message:deleted", (data: { messageId: string; conversationId: string; forAll: boolean }) => {
      setState((s) => ({
        ...s,
        messages: {
          ...s.messages,
          [data.conversationId]: (s.messages[data.conversationId] ?? []).map((m) =>
            m.id === data.messageId ? { ...m, isDeleted: true, deletedForAll: data.forAll } : m,
          ),
        },
      }));
    });

    socket.on("typing:start", (data: { userId: string; conversationId: string }) => {
      setState((s) => {
        const current = s.typing[data.conversationId] ?? [];
        if (current.includes(data.userId)) return s;
        return { ...s, typing: { ...s.typing, [data.conversationId]: [...current, data.userId] } };
      });
    });

    socket.on("typing:stop", (data: { userId: string; conversationId: string }) => {
      setState((s) => ({
        ...s,
        typing: {
          ...s.typing,
          [data.conversationId]: (s.typing[data.conversationId] ?? []).filter((id) => id !== data.userId),
        },
      }));
    });

    socket.on("read:update", (data: { conversationId: string; userId: string }) => {
      setState((s) => ({
        ...s,
        conversations: s.conversations.map((c) =>
          c.id === data.conversationId
            ? { ...c, members: c.members.map((m) => m.userId === data.userId ? { ...m, lastReadAt: new Date().toISOString() } : m) }
            : c,
        ),
      }));
    });

    socket.on("reaction:update", (data: { messageId: string; conversationId: string; userId: string; emoji: string; added: boolean }) => {
      setState((s) => ({
        ...s,
        messages: {
          ...s.messages,
          [data.conversationId]: (s.messages[data.conversationId] ?? []).map((m) => {
            if (m.id !== data.messageId) return m;
            const reactions = data.added
              ? [...m.reactions, { messageId: data.messageId, userId: data.userId, emoji: data.emoji, user: { id: data.userId, firstName: "", lastName: "" } }]
              : m.reactions.filter((r) => !(r.userId === data.userId && r.emoji === data.emoji));
            return { ...m, reactions };
          }),
        },
      }));
    });

    socket.on("presence:update", (data: { userId: string; status: "ONLINE" | "OFFLINE" }) => {
      setState((s) => ({
        ...s,
        presence: { ...s.presence, [data.userId]: data.status },
        conversations: s.conversations.map((c) => ({
          ...c,
          members: c.members.map((m) =>
            m.userId === data.userId ? { ...m, isOnline: data.status === "ONLINE" } : m,
          ),
        })),
        users: s.users.map((u) => u.id === data.userId ? { ...u, isOnline: data.status === "ONLINE" } : u),
      }));
    });

    // Heartbeat every 30s
    const hb = setInterval(() => socket.emit("presence:heartbeat"), 30_000);

    return () => {
      clearInterval(hb);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchConversations, fetchUsers]);

  // ── Actions ────────────────────────────────────────────────────

  const openConversation = React.useCallback(async (userId: string) => {
    try {
      const r = await fetch(`${API}/messaging/conversations`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ userId }),
      });
      if (!r.ok) return;
      const conv: Conversation = await r.json();
      setState((s) => {
        const exists = s.conversations.some((c) => c.id === conv.id);
        return {
          ...s,
          conversations: exists ? s.conversations : [conv, ...s.conversations],
          activeConvId: conv.id,
          isWidgetOpen: true,
        };
      });
      await fetchMessages(conv.id);
    } catch {}
  }, [fetchMessages]);

  const setActiveConv = React.useCallback((convId: string | null) => {
    setState((s) => ({ ...s, activeConvId: convId }));
    if (convId && !stateRef.current.messages[convId]) {
      fetchMessages(convId);
    }
  }, [fetchMessages]);

  const sendMessage = React.useCallback(async (convId: string, content: string, type = "TEXT", replyToId?: string) => {
    // Typing events are not real messages — only emit via socket, skip optimistic UI and REST fallback
    const isMsg = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT"].includes(type);
    if (!isMsg || !content.trim()) {
      socketRef.current?.emit("message:send", { conversationId: convId, content, type, replyToId });
      return;
    }

    // Optimistic: show the message immediately before server confirms
    const tempId = `_opt_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: convId,
      senderId: myIdRef.current,
      sender: { id: myIdRef.current, firstName: "", lastName: "" },
      type,
      content,
      isEdited: false,
      isDeleted: false,
      deletedForAll: false,
      replyToId,
      attachments: [],
      reactions: [],
      readBy: [],
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      messages: { ...s.messages, [convId]: [optimistic, ...(s.messages[convId] ?? [])] },
    }));

    if (socketRef.current?.connected) {
      // Server will echo back message:new which removes the optimistic entry
      socketRef.current.emit("message:send", { conversationId: convId, content, type, replyToId });
    } else {
      // REST fallback: replace optimistic entry with real message on response
      try {
        const r = await fetch(`${API}/messaging/conversations/${convId}/messages`, {
          method: "POST",
          headers: authHeader(),
          body: JSON.stringify({ content, type, replyToId }),
        });
        if (r.ok) {
          const msg: ChatMessage = await r.json();
          setState((s) => {
            const existing = (s.messages[convId] ?? []).filter((m) => m.id !== tempId);
            return {
              ...s,
              messages: { ...s.messages, [convId]: [msg, ...existing] },
              conversations: s.conversations.map((c) =>
                c.id === convId ? { ...c, messages: [msg], updatedAt: msg.createdAt } : c,
              ),
            };
          });
        } else {
          setState((s) => ({
            ...s,
            messages: { ...s.messages, [convId]: (s.messages[convId] ?? []).filter((m) => m.id !== tempId) },
          }));
        }
      } catch {
        setState((s) => ({
          ...s,
          messages: { ...s.messages, [convId]: (s.messages[convId] ?? []).filter((m) => m.id !== tempId) },
        }));
      }
    }
  }, []);

  const uploadFile = React.useCallback(async (convId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("token") || "";
    const r = await fetch(`${API}/messaging/conversations/${convId}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!r.ok) throw new Error("آپلود فایل ناموفق بود");
    const msg: ChatMessage = await r.json();
    // Always update state — socket may not deliver the event when disconnected
    setState((s) => ({
      ...s,
      messages: { ...s.messages, [convId]: [msg, ...(s.messages[convId] ?? [])] },
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, messages: [msg], updatedAt: msg.createdAt } : c,
      ),
    }));
  }, []);

  const markRead = React.useCallback((convId: string) => {
    socketRef.current?.emit("message:read", { conversationId: convId });
    setState((s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, unreadCount: 0 } : c,
      ),
      unreadTotal: Math.max(0, s.unreadTotal - (s.conversations.find((c) => c.id === convId)?.unreadCount ?? 0)),
    }));
  }, []);

  const deleteMessage = React.useCallback((messageId: string, forAll = false) => {
    socketRef.current?.emit("message:delete", { messageId, forAll });
  }, []);

  const editMessage = React.useCallback((messageId: string, content: string) => {
    socketRef.current?.emit("message:edit", { messageId, content });
  }, []);

  const toggleReaction = React.useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit("reaction:toggle", { messageId, emoji });
  }, []);

  const loadMoreMessages = React.useCallback(async (convId: string) => {
    if (stateRef.current.loadingMore[convId] || !stateRef.current.hasMore[convId]) return;
    setState((s) => ({ ...s, loadingMore: { ...s.loadingMore, [convId]: true } }));
    const msgs = stateRef.current.messages[convId] ?? [];
    const oldest = msgs[msgs.length - 1];
    await fetchMessages(convId, oldest?.createdAt);
  }, [fetchMessages]);

  const toggleWidget = React.useCallback(() => {
    // Request notification permission on first interaction with the widget
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    setState((s) => ({ ...s, isWidgetOpen: !s.isWidgetOpen }));
  }, []);

  const openWidget = React.useCallback((convId?: string) => {
    setState((s) => ({
      ...s,
      isWidgetOpen: true,
      activeConvId: convId ?? s.activeConvId,
    }));
    if (convId && !stateRef.current.messages[convId]) {
      fetchMessages(convId);
    }
  }, [fetchMessages]);

  const closeWidget = React.useCallback(() => {
    setState((s) => ({ ...s, isWidgetOpen: false }));
  }, []);

  const refreshConversations = fetchConversations;
  const refreshUsers = fetchUsers;

  const value: MessagingContextValue = {
    ...state,
    openConversation,
    setActiveConv,
    sendMessage,
    uploadFile,
    markRead,
    deleteMessage,
    editMessage,
    toggleReaction,
    loadMoreMessages,
    toggleWidget,
    openWidget,
    closeWidget,
    refreshConversations,
    refreshUsers,
  };

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}
