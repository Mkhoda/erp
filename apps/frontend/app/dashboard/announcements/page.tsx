"use client";
import React from "react";
import { Megaphone, Loader2, Pin, AlertCircle, Info, AlertTriangle, Bell, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const PRIORITY_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string; border: string }> = {
  CRITICAL: { label: "بحرانی", icon: AlertCircle,   cls: "bg-red-50 text-red-700 dark:bg-red-950/30",     border: "border-red-400" },
  HIGH:     { label: "مهم",    icon: AlertTriangle,  cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/30", border: "border-orange-400" },
  NORMAL:   { label: "عادی",   icon: Bell,           cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/30",   border: "border-blue-300" },
  LOW:      { label: "کم",     icon: Info,           cls: "bg-slate-50 text-slate-600 dark:bg-slate-800",   border: "border-slate-300" },
  INFO:     { label: "اطلاعات",icon: Info,           cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30",   border: "border-cyan-300" },
};

const TYPE_FA: Record<string, string> = { BANNER: "بنر", POPUP: "پاپ‌آپ", NOTIFICATION: "اعلان" };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });

export default function AnnouncementsBoard() {
  React.useEffect(() => { document.title = "اطلاعیه‌ها | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };

  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API}/notifications/announcements/active`, { headers: h as any })
      .then(r => {
        if (!r.ok) { setError(true); return []; }
        return r.json();
      })
      .then(data => {
        setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const pinned = rows.filter(r => r.isPinned || r.isSticky);
  const regular = rows.filter(r => !r.isPinned && !r.isSticky);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">اطلاعیه‌ها</h1>
          <p className="text-sm text-theme-muted">اطلاعیه‌های سازمانی مخصوص شما</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12 text-red-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">خطا در دریافت اطلاعیه‌ها</p>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-16 text-theme-muted">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-25" />
          <p className="font-medium">اطلاعیه‌ای برای نمایش وجود ندارد</p>
          <p className="text-sm mt-1">اطلاعیه‌های جدید سازمانی اینجا نمایش داده می‌شوند</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Pinned / sticky */}
          {pinned.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-theme-muted">
                <Pin className="w-3.5 h-3.5" />
                <span>سنجاق شده</span>
              </div>
              {pinned.map(ann => <AnnCard key={ann.id} ann={ann} />)}
              {regular.length > 0 && <hr className="border-theme mt-4" />}
            </div>
          )}

          {/* Regular */}
          {regular.length > 0 && (
            <div className="space-y-3">
              {regular.map(ann => <AnnCard key={ann.id} ann={ann} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AnnCard({ ann }: { ann: any }) {
  const cfg = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.NORMAL;
  const Icon = cfg.icon;

  return (
    <div className={`bg-theme-card border-r-4 border border-theme rounded-xl p-4 ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.cls}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-theme-primary">{ann.title}</h3>
            {(ann.isPinned || ann.isSticky) && (
              <Pin className="w-3 h-3 text-theme-muted" />
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.cls}`}>
              {cfg.label}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-theme-secondary border border-theme text-theme-muted">
              {TYPE_FA[ann.type] ?? ann.type}
            </span>
          </div>
          <p className="text-sm text-theme-secondary leading-relaxed whitespace-pre-wrap">{ann.body}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-theme-muted flex-wrap">
            {ann.publishAt && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {fmtDate(ann.publishAt)}
              </span>
            )}
            {ann.expireAt && (
              <span>انقضا: {fmtDate(ann.expireAt)}</span>
            )}
            {ann.author && (
              <span>توسط: {ann.author.firstName} {ann.author.lastName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
