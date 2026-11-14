"use client";
import React from "react";
import {
  ExternalLink,
  Biohazard,
  Siren,
  MapPinned,
  TrendingUp,
  CalendarDays,
  Globe,
  Newspaper,
  Microscope,
} from "lucide-react";
import { pageTitle } from "../../../lib/branding";

// The biosecurity dashboard is served over plain HTTP, so it can't be embedded in this
// HTTPS app (browsers block mixed content) — it opens in a new tab instead, like World Monitor.
const DASHBOARD_URL = "http://ai.arzesh.net:8095";

const SECTIONS = [
  { icon: Siren,        label: "شاخص‌های هشدار",   desc: "موضوع‌های پرخطر ۷ روز اخیر" },
  { icon: MapPinned,    label: "نقشه شدت رویدادها", desc: "ایران و همسایگان" },
  { icon: TrendingUp,   label: "روند ۳۰ روزه",      desc: "گزارش‌های مهم ایران و جهان" },
  { icon: CalendarDays, label: "تقویم حرارتی",      desc: "خانواده‌های خطر" },
  { icon: Globe,        label: "تقاطع ایران و جهان", desc: "۷ روز اخیر" },
  { icon: Newspaper,    label: "اخبار روز",          desc: "به تفکیک موضوع" },
  { icon: Microscope,   label: "پژوهش‌ها",           desc: "مهم‌ترین پژوهش‌ها" },
];

export default function BiosecurityPage() {
  React.useEffect(() => { document.title = pageTitle("پایش امنیت زیستی"); }, []);
  return (
    <div
      dir="rtl"
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "radial-gradient(ellipse at 50% 10%, #0b2a26 0%, #06150f 60%, #020806 100%)",
        minHeight: "calc(100vh - 6rem)",
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#34d399 1px, transparent 1px), linear-gradient(90deg, #34d399 1px, transparent 1px)",
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
          maxWidth: "100%",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.03) 50%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6">
        {/* Icon + pulse */}
        <div className="relative mb-8">
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(16,185,129,0.15)", animationDuration: "2.5s" }}
          />
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: "radial-gradient(circle at 35% 35%, #0f9f74, #064e3b)",
              boxShadow: "0 0 0 1px rgba(52,211,153,0.15), 0 0 40px rgba(16,185,129,0.3)",
            }}
          >
            <Biohazard className="w-11 h-11 text-emerald-200" />
          </div>
        </div>

        <h1
          className="text-3xl sm:text-4xl font-bold text-white mb-3 text-center"
          style={{ textShadow: "0 0 40px rgba(52,211,153,0.35)" }}
        >
          پایش امنیت زیستی
        </h1>
        <p className="text-emerald-300/60 text-sm tracking-widest uppercase mb-2">Biosecurity Monitor</p>
        <p className="text-white/40 text-sm text-center max-w-md leading-relaxed mb-10">
          شاخص‌های هشدار، نقشه شدت رویدادها، روندها و مهم‌ترین اخبار و پژوهش‌های امنیت زیستی ایران و جهان
          — به‌روزرسانی هر ۵ دقیقه
        </p>

        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white text-base transition-all duration-200 hover:-translate-y-px"
          style={{
            background: "linear-gradient(135deg, #059669, #047857)",
            boxShadow: "0 0 0 1px rgba(52,211,153,0.2), 0 8px 32px rgba(5,150,105,0.4)",
          }}
        >
          <Biohazard className="w-5 h-5" />
          باز کردن داشبورد امنیت زیستی
          <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
        </a>

        <p className="mt-4 text-white/20 text-xs">در تب جدید مرورگر باز می‌شود</p>

        <div className="flex items-center gap-4 my-12 w-full max-w-2xl">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-white/20 text-xs">بخش‌های داشبورد</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
          {SECTIONS.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Icon className="w-5 h-5 text-emerald-400/80" />
              <span className="text-white/70 text-xs font-medium">{label}</span>
              <span className="text-white/25 text-[10px]">{desc}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 text-white/15 text-xs text-center max-w-md">
          این داشبورد روی سرور ai.arzesh.net اجرا می‌شود و چون از HTTPS پشتیبانی نمی‌کند، نمایش داخل سامانه امکان‌پذیر نیست.
        </p>
      </div>
    </div>
  );
}
