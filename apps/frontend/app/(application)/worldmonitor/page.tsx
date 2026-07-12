"use client";
import React from "react";
import { ExternalLink, Globe, AlertTriangle, RefreshCw } from "lucide-react";

const MONITOR_URL =
  "https://www.worldmonitor.app/dashboard?lat=31.3324&lon=50.6483&zoom=3.89&view=global&timeRange=7d&layers=conflicts%2Cbases%2Chotspots%2Cnuclear%2Csanctions%2Cweather%2Ceconomic%2Cwaterways%2Coutages%2Cmilitary%2Cnatural%2Cfires";

export default function WorldMonitorPage() {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "blocked">("loading");
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    document.title = "پایش جهانی | Arzesh ERP";

    // If iframe doesn't fire onLoad within 8s it's likely blocked
    timerRef.current = setTimeout(() => {
      if (status === "loading") setStatus("blocked");
    }, 8000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleLoad() {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Even after onLoad fires the content might be an error page due to X-Frame-Options;
    // we can't inspect cross-origin content so we optimistically mark as loaded.
    setStatus("loaded");
  }

  function handleError() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("blocked");
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0d1117]">
      {/* Slim header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-white/10 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-white text-sm font-medium">پایش وضعیت جهانی</span>
          <span className="text-white/30 text-xs hidden sm:inline">· worldmonitor.app</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "loading" && (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <RefreshCw className="w-3 h-3 animate-spin" />
              در حال بارگذاری...
            </span>
          )}
          <a
            href={MONITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            باز در تب جدید
          </a>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 relative">
        {/* Iframe */}
        {status !== "blocked" && (
          <iframe
            ref={iframeRef}
            src={MONITOR_URL}
            onLoad={handleLoad}
            onError={handleError}
            className="absolute inset-0 w-full h-full border-0"
            title="World Monitor"
            allow="geolocation; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        )}

        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#0d1117] pointer-events-none">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
              <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
              <Globe className="absolute inset-0 m-auto w-7 h-7 text-blue-400" />
            </div>
            <p className="text-white/50 text-sm">در حال اتصال به World Monitor...</p>
          </div>
        )}

        {/* Blocked fallback */}
        {status === "blocked" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-400" />
            </div>
            <div className="text-center max-w-md">
              <h2 className="text-white text-lg font-semibold mb-2">نمایش مستقیم امکان‌پذیر نیست</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                سایت World Monitor اجازه نمایش درون فریم را نمی‌دهد (X-Frame-Options). برای مشاهده روی دکمه زیر کلیک کنید تا در تب جدید باز شود.
              </p>
            </div>
            <a
              href={MONITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              <Globe className="w-4 h-4" />
              باز کردن World Monitor
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
            <p className="text-white/20 text-xs">
              {MONITOR_URL.slice(0, 60)}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
