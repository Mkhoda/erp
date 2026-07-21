"use client";
import React from "react";
import { Megaphone } from "lucide-react";
import Modal from "../ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Ann = {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  isSticky: boolean;
  showOnce: boolean;
  showUntilAck: boolean;
};

/**
 * Global POPUP-announcement modal — mounted once in the dashboard layout so it
 * shows on the user's first entry into the dashboard each session. The backend
 * (`/announcements/popups`) only returns announcements the user hasn't seen yet
 * (or hasn't acknowledged, for showUntilAck ones), so once acked/seen it won't
 * resurface — the announcement itself stays visible in "اطلاعیه‌ها".
 */
export default function AnnouncementPopupHost() {
  const [popups, setPopups] = React.useState<Ann[]>([]);
  const [popupIdx, setPopupIdx] = React.useState(0);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/popups`, { headers: { Authorization: `Bearer ${token}` } as any })
      .then(r => (r.ok ? r.json() : []))
      .then(data => setPopups(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const markSeen = (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/${id}/seen`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };

  const acknowledge = (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/${id}/ack`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };

  const closePopup = (ann: Ann) => {
    markSeen(ann.id);
    setPopupIdx(i => i + 1);
  };

  const ackPopup = (ann: Ann) => {
    acknowledge(ann.id);
    markSeen(ann.id);
    setPopupIdx(i => i + 1);
  };

  const currentPopup = popups[popupIdx];
  if (!currentPopup) return null;

  return (
    <Modal
      open
      onClose={() => closePopup(currentPopup)}
      title={currentPopup.title}
      size="sm"
      footer={
        currentPopup.showUntilAck ? (
          <button onClick={() => ackPopup(currentPopup)} className="btn-theme-primary text-sm">تایید می‌کنم</button>
        ) : (
          <button onClick={() => closePopup(currentPopup)} className="btn-theme-primary text-sm">بستن</button>
        )
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4 text-indigo-500" />
        </div>
        <p className="text-sm text-theme-secondary leading-relaxed whitespace-pre-wrap">{currentPopup.body}</p>
      </div>
    </Modal>
  );
}
