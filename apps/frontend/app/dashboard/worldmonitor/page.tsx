"use client";
import {
  ExternalLink,
  Globe,
  Zap,
  Shield,
  CloudRain,
  Flame,
  Droplets,
  TrendingDown,
  Radio,
  Crosshair,
  Mountain,
  AlertTriangle,
} from "lucide-react";

const MONITOR_URL =
  "https://www.worldmonitor.app/dashboard?lat=31.3324&lon=50.6483&zoom=3.89&view=global&timeRange=7d&layers=conflicts%2Cbases%2Chotspots%2Cnuclear%2Csanctions%2Cweather%2Ceconomic%2Cwaterways%2Coutages%2Cmilitary%2Cnatural%2Cfires";

const LAYERS = [
  { icon: Crosshair,     label: "مناطق درگیری",     desc: "تعارضات فعال" },
  { icon: Shield,        label: "پایگاه‌های نظامی",  desc: "استقرار نیرو" },
  { icon: AlertTriangle, label: "نقاط بحرانی",       desc: "هاتسپات‌ها" },
  { icon: Zap,           label: "انرژی هسته‌ای",     desc: "تأسیسات و تحریم" },
  { icon: CloudRain,     label: "آب و هوا",           desc: "رویدادهای جوی" },
  { icon: TrendingDown,  label: "اقتصاد",             desc: "شاخص‌های کلان" },
  { icon: Droplets,      label: "آبراه‌ها",           desc: "مسیرهای دریایی" },
  { icon: Radio,         label: "قطعی‌ها",            desc: "اینترنت و برق" },
  { icon: Flame,         label: "آتش‌سوزی",           desc: "حریق فعال" },
  { icon: Mountain,      label: "بلایای طبیعی",       desc: "زلزله، سیل و..." },
];

export default function WorldMonitorPage() {
  return (
    <div
      dir="rtl"
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "radial-gradient(ellipse at 50% 10%, #0e1e3a 0%, #070d1a 60%, #030608 100%)",
        minHeight: "calc(100vh - 6rem)",
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#4a9eff 1px, transparent 1px), linear-gradient(90deg, #4a9eff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(30,100,220,0.12) 0%, rgba(30,100,220,0.03) 50%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6">
        {/* Globe icon + pulse */}
        <div className="relative mb-8">
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(59,130,246,0.15)", animationDuration: "2.5s" }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 35% 35%, #1e5fc0, #0a2a6e)",
              boxShadow: "0 0 0 1px rgba(100,160,255,0.15), 0 0 40px rgba(30,100,220,0.3)",
            }}
          >
            <Globe className="w-11 h-11 text-blue-300" />
          </div>
        </div>

        {/* Title */}
        <h1
          className="text-3xl sm:text-4xl font-bold text-white mb-3 text-center"
          style={{ textShadow: "0 0 40px rgba(100,160,255,0.4)" }}
        >
          پایش وضعیت جهانی
        </h1>
        <p className="text-blue-300/60 text-sm tracking-widest uppercase mb-2">
          World Monitor
        </p>
        <p className="text-white/40 text-sm text-center max-w-md leading-relaxed mb-10">
          نقشه تعاملی از رویدادهای امنیتی، نظامی، اقتصادی و طبیعی سراسر جهان
          به‌صورت لحظه‌ای
        </p>

        {/* CTA */}
        <a
          href={MONITOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white text-base transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #1d4ed8, #1e40af)",
            boxShadow: "0 0 0 1px rgba(100,160,255,0.2), 0 8px 32px rgba(29,78,216,0.4)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 1px rgba(100,160,255,0.3), 0 12px 40px rgba(29,78,216,0.6)";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 0 0 1px rgba(100,160,255,0.2), 0 8px 32px rgba(29,78,216,0.4)";
            (e.currentTarget as HTMLElement).style.transform = "";
          }}
        >
          <Globe className="w-5 h-5" />
          باز کردن World Monitor
          <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
        </a>

        <p className="mt-4 text-white/20 text-xs">در تب جدید مرورگر باز می‌شود</p>

        {/* Divider */}
        <div className="flex items-center gap-4 my-12 w-full max-w-2xl">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-white/20 text-xs">لایه‌های اطلاعاتی</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Layers grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full max-w-2xl">
          {LAYERS.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Icon className="w-5 h-5 text-blue-400/80" />
              <span className="text-white/70 text-xs font-medium">{label}</span>
              <span className="text-white/25 text-[10px]">{desc}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 text-white/15 text-xs text-center">
          این صفحه توسط worldmonitor.app ارائه می‌شود و به دلیل سیاست امنیتی آن سایت، نمایش داخلی امکان‌پذیر نیست.
        </p>
      </div>
    </div>
  );
}
