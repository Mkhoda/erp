"use client";
import React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowLeft, Megaphone } from "lucide-react";
import Modal from "../ui/Modal";
import { API, Ann, AttachmentList, PRIORITY_CONFIG, markAnnouncementSeen, useActiveAnnouncements } from "./shared";

const dismissedKey = (id: string) => `ann-banner-dismissed:${id}`;
const isDismissed = (id: string) => { try { return !!localStorage.getItem(dismissedKey(id)); } catch { return false; } };

// Notification-type announcements older than this don't pop up as a card any more
// (they're still listed in "اطلاعیه‌ها" and in the bell).
const CARD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Surfaces published announcements across the dashboard, according to their type:
 *  - BANNER       → banner strip at the top of the page content
 *  - NOTIFICATION → notification card in the corner (until the user closes it)
 *  - POPUP        → modal, once (or until acknowledged when showUntilAck)
 * New announcements arrive live over the socket.
 */
export default function AnnouncementCenter() {
  const list = useActiveAnnouncements();
  const [closed, setClosed] = React.useState<Set<string>>(new Set());
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  const close = (id: string) => setClosed(prev => new Set(prev).add(id));

  const banners = list.filter(a => a.type === "BANNER" && !closed.has(a.id) && (a.isSticky || !isDismissed(a.id)));

  const cards = list.filter(a => {
    if (a.type !== "NOTIFICATION" || a.seen || closed.has(a.id)) return false;
    const ts = new Date(a.publishAt || a.createdAt || Date.now()).getTime();
    return Date.now() - ts < CARD_MAX_AGE_MS;
  }).slice(0, 3);

  const popups = list.filter(a => a.type === "POPUP" && !closed.has(a.id) && (a.showUntilAck ? !a.acked : !a.seen));
  const popup = popups[0];

  const dismissBanner = (id: string) => {
    try { localStorage.setItem(dismissedKey(id), "1"); } catch {}
    markAnnouncementSeen(id);
    close(id);
  };

  const closeCard = (id: string) => { markAnnouncementSeen(id); close(id); };

  const closePopup = (ann: Ann, ack: boolean) => {
    if (ack) {
      const token = localStorage.getItem("token");
      if (token) fetch(`${API}/notifications/announcements/${ann.id}/ack`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    markAnnouncementSeen(ann.id);
    close(ann.id);
  };

  return (
    <>
      {/* ── Banners ── */}
      {banners.length > 0 && (
        <div className="space-y-2 mb-4" dir="rtl">
          {banners.map(ann => {
            const cfg = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.NORMAL;
            const Icon = cfg.icon;
            return (
              <div key={ann.id} className={`flex items-start gap-3 border-r-4 border rounded-xl px-4 py-3 ${cfg.cls} ${cfg.border}`}>
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{ann.title}</div>
                  <p className="text-xs mt-0.5 leading-relaxed opacity-90 whitespace-pre-wrap line-clamp-3">{ann.body}</p>
                  <AttachmentList items={ann.attachments} compact />
                </div>
                <Link href="/dashboard/announcements"
                  className="shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/60 dark:bg-black/20 hover:bg-white/90 dark:hover:bg-black/40 transition-colors">
                  جزئیات <ArrowLeft className="w-3 h-3" />
                </Link>
                {!ann.isSticky && (
                  <button onClick={() => dismissBanner(ann.id)} className="shrink-0 opacity-60 hover:opacity-100 mt-0.5" title="بستن">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Notification cards (top-left, clear of the RTL sidebar and the bottom-left chat widget) ── */}
      {mounted && createPortal(
        <div className="fixed top-20 left-4 z-[9980] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none" dir="rtl">
          <AnimatePresence>
            {cards.map(ann => {
              const cfg = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.NORMAL;
              const Icon = cfg.icon;
              return (
                <motion.div key={ann.id}
                  initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                  className={`pointer-events-auto bg-theme-card border border-theme border-r-4 ${cfg.border} rounded-xl shadow-xl p-3`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-theme-muted mb-0.5">
                        <Megaphone className="w-3 h-3" /> اطلاعیه جدید
                      </div>
                      <div className="font-semibold text-sm text-theme-primary truncate">{ann.title}</div>
                      <p className="text-xs text-theme-secondary mt-0.5 leading-relaxed line-clamp-3 whitespace-pre-wrap">{ann.body}</p>
                      <AttachmentList items={ann.attachments} compact />
                      <Link href="/dashboard/announcements" onClick={() => closeCard(ann.id)}
                        className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        مشاهده <ArrowLeft className="w-3 h-3" />
                      </Link>
                    </div>
                    <button onClick={() => closeCard(ann.id)} className="text-theme-muted hover:text-theme-primary shrink-0" title="بستن">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}

      {/* ── Popup ── */}
      {popup && (
        <Modal
          open
          onClose={() => closePopup(popup, false)}
          title={popup.title}
          size="md"
          footer={
            popup.showUntilAck ? (
              <button onClick={() => closePopup(popup, true)} className="btn-theme-primary text-sm">تایید می‌کنم</button>
            ) : (
              <button onClick={() => closePopup(popup, false)} className="btn-theme-primary text-sm">بستن</button>
            )
          }
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-theme-secondary leading-relaxed whitespace-pre-wrap">{popup.body}</p>
              <AttachmentList items={popup.attachments} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
