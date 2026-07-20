"use client";
import React from "react";
import Link from "next/link";
import { X, AlertCircle, AlertTriangle, Bell, Info, Megaphone } from "lucide-react";
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

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; cls: string; border: string }> = {
  CRITICAL: { icon: AlertCircle,   cls: "bg-red-50 text-red-700 dark:bg-red-950/30",           border: "border-red-400" },
  HIGH:     { icon: AlertTriangle, cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/30",  border: "border-orange-400" },
  NORMAL:   { icon: Bell,          cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/30",         border: "border-blue-300" },
  LOW:      { icon: Info,          cls: "bg-slate-50 text-slate-600 dark:bg-slate-800",         border: "border-slate-300" },
  INFO:     { icon: Info,          cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30",         border: "border-cyan-300" },
};

const dismissedKey = (id: string) => `ann-banner-dismissed:${id}`;

export default function AnnouncementHost() {
  const [banners, setBanners] = React.useState<Ann[]>([]);
  const [popups, setPopups] = React.useState<Ann[]>([]);
  const [popupIdx, setPopupIdx] = React.useState(0);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    fetch(`${API}/notifications/announcements/active`, { headers: h as any })
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        const list: Ann[] = Array.isArray(data) ? data : [];
        const bannerList = list.filter(a => a.type === "BANNER" && !localStorage.getItem(dismissedKey(a.id)));
        setBanners(bannerList);
      })
      .catch(() => {});

    fetch(`${API}/notifications/announcements/popups`, { headers: h as any })
      .then(r => (r.ok ? r.json() : []))
      .then(data => setPopups(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const dismissBanner = (id: string) => {
    localStorage.setItem(dismissedKey(id), "1");
    setBanners(prev => prev.filter(a => a.id !== id));
  };

  const markSeen = (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/${id}/seen`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const acknowledge = (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/${id}/ack`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
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

  return (
    <>
      {banners.length > 0 && (
        <div className="space-y-2 mb-4">
          {banners.map(ann => {
            const cfg = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.NORMAL;
            const Icon = cfg.icon;
            return (
              <div key={ann.id} className={`flex items-start gap-3 border-r-4 border rounded-xl px-4 py-3 ${cfg.cls} ${cfg.border}`}>
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{ann.title}</div>
                  <p className="text-xs mt-0.5 leading-relaxed opacity-90">{ann.body}</p>
                </div>
                <Link href="/dashboard/announcements" className="text-xs underline shrink-0 mt-0.5">جزئیات</Link>
                {!ann.isSticky && (
                  <button onClick={() => dismissBanner(ann.id)} className="shrink-0 opacity-60 hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {currentPopup && (
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
      )}
    </>
  );
}
