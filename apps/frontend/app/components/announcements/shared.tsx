"use client";
import React from "react";
import { AlertCircle, AlertTriangle, Bell, Info, Paperclip, FileText, Download } from "lucide-react";

export const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export type AnnAttachment = { url: string; name: string; size?: number; mimeType?: string };

export type Ann = {
  id: string;
  title: string;
  body: string;
  type: "BANNER" | "POPUP" | "NOTIFICATION" | string;
  priority: string;
  isSticky: boolean;
  isPinned?: boolean;
  showOnce?: boolean;
  showUntilAck?: boolean;
  attachments?: AnnAttachment[];
  publishAt?: string | null;
  createdAt?: string;
  seen?: boolean;
  acked?: boolean;
};

export const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; cls: string; border: string; label: string }> = {
  CRITICAL: { label: "بحرانی", icon: AlertCircle,   cls: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",          border: "border-red-400" },
  HIGH:     { label: "مهم",    icon: AlertTriangle, cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300", border: "border-orange-400" },
  NORMAL:   { label: "عادی",   icon: Bell,          cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",        border: "border-blue-300" },
  LOW:      { label: "کم",     icon: Info,          cls: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300",       border: "border-slate-300" },
  INFO:     { label: "اطلاعات", icon: Info,         cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300",        border: "border-cyan-300" },
};

const isImage = (a: AnnAttachment) =>
  (a.mimeType || "").startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp)$/i.test(a.url);

export const fmtSize = (n?: number) => {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/** Image thumbnails + downloadable file chips for an announcement's attachments. */
export function AttachmentList({ items, compact = false }: { items?: AnnAttachment[]; compact?: boolean }) {
  if (!items || items.length === 0) return null;
  const images = items.filter(isImage);
  const files = items.filter(a => !isImage(a));

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {items.map(a => (
          <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
            className="inline-flex items-center gap-1 max-w-[180px] px-2 py-0.5 rounded-md bg-white/60 dark:bg-black/20 hover:bg-white/90 dark:hover:bg-black/40 text-[11px] transition-colors">
            <Paperclip className="w-3 h-3 shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name}>
              <img src={a.url} alt={a.name} className="h-24 max-w-[200px] object-cover rounded-lg border border-theme hover:opacity-90" />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" download={a.name}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme bg-theme-secondary hover:bg-theme-hover text-xs text-theme-secondary transition-colors">
              <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="truncate max-w-[220px]">{a.name}</span>
              {a.size ? <span className="text-theme-muted" dir="ltr">{fmtSize(a.size)}</span> : null}
              <Download className="w-3 h-3 text-theme-muted shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function markAnnouncementSeen(id: string) {
  const token = localStorage.getItem("token");
  if (!token) return;
  fetch(`${API}/notifications/announcements/${id}/seen`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

/**
 * Active announcements for the current user, kept live: re-fetched on mount and
 * merged with announcements pushed over the socket (`announcement:new` DOM event
 * dispatched by MessagingProvider).
 */
export function useActiveAnnouncements() {
  const [list, setList] = React.useState<Ann[]>([]);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/active`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(data => setList(Array.isArray(data) ? data : []))
      .catch(() => {});

    const onLive = (e: Event) => {
      const ann = (e as CustomEvent).detail as Ann;
      if (!ann?.id) return;
      setList(prev => [{ ...ann, seen: false, acked: false, createdAt: new Date().toISOString() }, ...prev.filter(a => a.id !== ann.id)]);
    };
    window.addEventListener("announcement:new", onLive);
    return () => window.removeEventListener("announcement:new", onLive);
  }, []);

  return list;
}
