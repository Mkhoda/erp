"use client";
import React from "react";
import Link from "next/link";
import { X, AlertCircle, AlertTriangle, Bell, Info, ArrowLeft } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Ann = {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  isSticky: boolean;
};

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; cls: string; border: string }> = {
  CRITICAL: { icon: AlertCircle,   cls: "bg-red-50 text-red-700 dark:bg-red-950/30",           border: "border-red-400" },
  HIGH:     { icon: AlertTriangle, cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/30",  border: "border-orange-400" },
  NORMAL:   { icon: Bell,          cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/30",         border: "border-blue-300" },
  LOW:      { icon: Info,          cls: "bg-slate-50 text-slate-600 dark:bg-slate-800",         border: "border-slate-300" },
  INFO:     { icon: Info,          cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30",         border: "border-cyan-300" },
};

const dismissedKey = (id: string) => `ann-banner-dismissed:${id}`;

/** BANNER-type announcements, shown on the dashboard home page below the greeting card. */
export default function AnnouncementBanner() {
  const [banners, setBanners] = React.useState<Ann[]>([]);

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/notifications/announcements/active`, { headers: { Authorization: `Bearer ${token}` } as any })
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        const list: Ann[] = Array.isArray(data) ? data : [];
        setBanners(list.filter(a => a.type === "BANNER" && !localStorage.getItem(dismissedKey(a.id))));
      })
      .catch(() => {});
  }, []);

  const dismiss = (id: string) => {
    localStorage.setItem(dismissedKey(id), "1");
    setBanners(prev => prev.filter(a => a.id !== id));
  };

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2">
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
            <Link href="/dashboard/announcements"
              className="shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/60 dark:bg-black/20 hover:bg-white/90 dark:hover:bg-black/40 transition-colors">
              جزئیات <ArrowLeft className="w-3 h-3" />
            </Link>
            {!ann.isSticky && (
              <button onClick={() => dismiss(ann.id)} className="shrink-0 opacity-60 hover:opacity-100 mt-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
