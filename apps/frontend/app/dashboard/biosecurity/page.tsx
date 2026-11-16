"use client";
import React from "react";
import { Biohazard, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { pageTitle } from "../../../lib/branding";

// Served over HTTPS (and without X-Frame-Options/CSP frame-ancestors), so it embeds directly.
const DASHBOARD_URL = "https://f.arzeshinstitute.ir/";

export default function BiosecurityPage() {
  React.useEffect(() => { document.title = pageTitle("پایش امنیت زیستی"); }, []);
  const [loading, setLoading] = React.useState(true);
  const [key, setKey] = React.useState(0);
  const reload = () => { setLoading(true); setKey(k => k + 1); };

  return (
    <div dir="rtl" className="flex flex-col gap-3" style={{ height: "calc(100vh - 6rem)" }}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center"><Biohazard className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">پایش امنیت زیستی</h1>
            <p className="text-sm text-theme-muted">شاخص‌های هشدار، نقشه رویدادها، روندها، اخبار و پژوهش‌ها</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} title="بارگذاری مجدد" className="p-2 rounded-lg bg-theme-card border border-theme text-theme-primary hover:bg-theme-hover">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-theme-card border border-theme text-sm text-theme-primary hover:bg-theme-hover">
            <ExternalLink className="w-4 h-4" /> تب جدید
          </a>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-theme bg-theme-card">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-theme-muted text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> در حال بارگذاری…
          </div>
        )}
        <iframe
          key={key}
          src={DASHBOARD_URL}
          title="پایش امنیت زیستی"
          onLoad={() => setLoading(false)}
          className="absolute inset-0 w-full h-full border-0"
          referrerPolicy="no-referrer"
          allow="fullscreen; clipboard-write"
        />
      </div>
    </div>
  );
}
