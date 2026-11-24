"use client";
// Date range for report pages: quick presets + from/to calendars. Values are Gregorian work
// dates "YYYY-MM-DD"; both empty = no range (only with `allowAll`).
import React from "react";
import JalaliDatePicker from "./JalaliDatePicker";
import { jalaliToGregorian, jMonthLen, localTodayIso, parseIso, shiftIso } from "./jalali-calendar";

export type DateRange = { from: string; to: string };

export function presetRange(k: string): DateRange {
  const today = localTodayIso(), j = parseIso(today)!;
  if (k === "today") return { from: today, to: today };
  if (k === "7d") return { from: shiftIso(today, -6), to: today };
  if (k === "30d") return { from: shiftIso(today, -29), to: today };
  if (k === "month") return { from: jalaliToGregorian(j.jy, j.jm, 1), to: today };
  if (k === "prev") {
    const y = j.jm === 1 ? j.jy - 1 : j.jy, m = j.jm === 1 ? 12 : j.jm - 1;
    return { from: jalaliToGregorian(y, m, 1), to: jalaliToGregorian(y, m, jMonthLen(y, m)) };
  }
  if (k === "year") return { from: jalaliToGregorian(j.jy, 1, 1), to: today };
  return { from: "", to: "" };
}

const PRESETS = [["today", "امروز"], ["7d", "۷ روز"], ["30d", "۳۰ روز"], ["month", "ماه جاری"], ["prev", "ماه قبل"], ["year", "امسال"]] as const;

export default function DateRangeFilter({ value, onChange, allowAll = false }: { value: DateRange; onChange: (r: DateRange) => void; allowAll?: boolean }) {
  const today = localTodayIso();
  const same = (r: DateRange) => r.from === value.from && r.to === value.to;
  // Picking one end past the other moves both, so the range never inverts; an open end is filled in.
  const setFrom = (v: string) => {
    if (!v) { if (allowAll) onChange({ from: "", to: "" }); return; }
    onChange({ from: v, to: !value.to || v > value.to ? (v > today ? v : value.to ? v : today) : value.to });
  };
  const setTo = (v: string) => {
    if (!v) { if (allowAll) onChange({ from: "", to: "" }); return; }
    onChange({ from: !value.from || v < value.from ? v : value.from, to: v });
  };
  const presets = [...(allowAll ? [["all", "همه"] as const] : []), ...PRESETS];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap bg-theme-secondary border border-theme p-0.5 rounded-lg text-xs">
        {presets.map(([k, l]) => (
          <button type="button" key={k} onClick={() => onChange(presetRange(k))} className={`px-2.5 py-1 rounded-md ${same(presetRange(k)) ? "bg-theme-card shadow text-theme-primary font-medium" : "text-theme-muted hover:text-theme-primary"}`}>{l}</button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-theme-muted">
        <span>از</span><div className="w-40"><JalaliDatePicker value={value.from} onChange={setFrom} max={today} clearable={allowAll} /></div>
        <span>تا</span><div className="w-40"><JalaliDatePicker value={value.to} onChange={setTo} max={today} clearable={allowAll} /></div>
      </div>
    </div>
  );
}
