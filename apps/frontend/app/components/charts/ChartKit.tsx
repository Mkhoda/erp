"use client";
// Shared chart building blocks (management dashboard, work-log person dashboard, printable reports).
// Palette: the validated reference palette in fixed slot order, separate light/dark steps
// (light slots 3-5 are under 3:1 contrast, so every ChartCard offers a table view as relief).
import React from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Table2, BarChart3 } from "lucide-react";

export const toFa = (s: string) => s.replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
export const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
export const hrs = (min: number) => Math.round((min || 0) / 6) / 10; // minutes → hours, 1 decimal
export const fmtH = (min: number) => `${faNum(hrs(min))} ساعت`;
export const money = (n: number) => `${faNum(Math.round(n || 0))} تومان`;
export const pct = (a: number, b: number) => (b ? `${faNum(Math.round((a / b) * 100))}٪` : "—");
export const faDay = (iso: string) => toFa(new Date(iso + "T00:00:00Z").toLocaleDateString("en-US-u-ca-persian", { day: "numeric", timeZone: "UTC" }));

// ── Chart palette (validated reference palette, fixed slot order, light + dark steps) ──
export const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
export const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
export const INK = {
  light: { grid: "#e1e0d9", axis: "#c3c2b7", muted: "#898781", text: "#52514e", surface: "#fcfcfb" },
  dark: { grid: "#2c2c2a", axis: "#383835", muted: "#898781", text: "#c3c2b7", surface: "#1a1a19" },
};
export function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
export function useChartTheme() {
  const dark = useIsDark();
  return { series: dark ? SERIES_DARK : SERIES_LIGHT, ink: dark ? INK.dark : INK.light };
}

// ═════════════════════════════ Building blocks ═════════════════════════════

export function Tile({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon?: any }) {
  return (
    <div className="bg-theme-card border border-theme rounded-2xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-theme-muted">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-theme-primary">{value}</div>
      {sub && <div className="text-[11px] text-theme-muted mt-0.5">{sub}</div>}
    </div>
  );
}

// Every chart has a table view (relief for light-mode series below 3:1, and for exact values).
export function ChartCard({ title, subtitle, table, children, className = "" }: {
  title: string; subtitle?: string; className?: string;
  table: { head: string[]; rows: (string | number)[][] }; children: React.ReactNode;
}) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <div className={`bg-theme-card border border-theme rounded-xl p-3 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-semibold text-theme-primary">{title}</div>
          {subtitle && <div className="text-[11px] text-theme-muted">{subtitle}</div>}
        </div>
        <button onClick={() => setAsTable(v => !v)} title={asTable ? "نمایش نمودار" : "نمایش جدول"} className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-hover">
          {asTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
        </button>
      </div>
      {table.rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-theme-muted">داده‌ای وجود ندارد</div>
      ) : asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-theme-muted border-b border-theme">{table.head.map(h => <th key={h} className="text-right py-1.5 px-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => (
              <tr key={i} className="border-b border-theme/40">{r.map((c, j) => <td key={j} className="py-1.5 px-2 text-theme-secondary">{typeof c === "number" ? faNum(c) : c}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : children}
    </div>
  );
}

export function TooltipBox({ active, payload, label, fmt, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="bg-theme-card border border-theme rounded-lg shadow-lg px-3 py-2 text-xs">
      {label != null && <div className="text-theme-primary font-medium mb-1">{labelFmt ? labelFmt(label) : label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-theme-secondary">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}:</span><span className="text-theme-primary font-medium">{fmt ? fmt(p.value) : faNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Ranked single-series horizontal bars (one hue, no legend — the title names the measure).
export function HBars({ data, valueLabel, fmt, limit = 10 }: { data: { name: string; value: number }[]; valueLabel: string; fmt?: (v: number) => string; limit?: number }) {
  const { series, ink } = useChartTheme();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  if (sorted.length > limit) top.push({ name: "سایر", value: sorted.slice(limit).reduce((s, x) => s + x.value, 0) });
  const h = Math.max(120, top.length * 30 + 30);
  return (
    <div dir="ltr" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={ink.grid} />
          <XAxis type="number" reversed tick={{ fill: ink.muted, fontSize: 11 }} tickFormatter={v => faNum(v)} axisLine={{ stroke: ink.axis }} tickLine={false} />
          <YAxis type="category" dataKey="name" orientation="right" width={130} tick={{ fill: ink.text, fontSize: 11 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
          <Tooltip cursor={{ fill: ink.grid, opacity: 0.4 }} content={<TooltipBox fmt={fmt} />} />
          <Bar dataKey="value" name={valueLabel} fill={series[0]} radius={[4, 0, 0, 4]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Stacked daily bars: fixed slot order per series, legend always present (>= 2 series).
export function DailyStack({ data, series: defs, height = 240, xFormat = faDay }: { data: any[]; series: { key: string; label: string }[]; height?: number; xFormat?: (v: string) => string }) {
  const { series, ink } = useChartTheme();
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={ink.grid} />
          <XAxis dataKey="date" reversed tickFormatter={xFormat} tick={{ fill: ink.muted, fontSize: 10 }} axisLine={{ stroke: ink.axis }} tickLine={false} interval="preserveStartEnd" />
          <YAxis orientation="right" width={36} allowDecimals={false} tick={{ fill: ink.muted, fontSize: 10 }} tickFormatter={v => faNum(v)} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: ink.grid, opacity: 0.4 }} content={<TooltipBox labelFmt={(l: string) => (xFormat === faDay ? `روز ${faDay(l)}` : xFormat(l))} />} />
          <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
          {defs.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={series[i]} stroke={ink.surface} strokeWidth={1}
              radius={i === defs.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={22} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyLines({ data, series: defs, height = 240, xFormat = faDay }: { data: any[]; series: { key: string; label: string }[]; height?: number; xFormat?: (v: string) => string }) {
  const { series, ink } = useChartTheme();
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={ink.grid} />
          <XAxis dataKey="date" reversed tickFormatter={xFormat} tick={{ fill: ink.muted, fontSize: 10 }} axisLine={{ stroke: ink.axis }} tickLine={false} interval="preserveStartEnd" />
          <YAxis orientation="right" width={36} allowDecimals={false} tick={{ fill: ink.muted, fontSize: 10 }} tickFormatter={v => faNum(v)} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: ink.axis }} content={<TooltipBox labelFmt={(l: string) => (xFormat === faDay ? `روز ${faDay(l)}` : xFormat(l))} />} />
          {defs.length > 1 && <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />}
          {defs.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={series[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: ink.surface, strokeWidth: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
