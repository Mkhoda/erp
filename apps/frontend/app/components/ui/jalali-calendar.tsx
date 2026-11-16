"use client";
// Shared core of every Jalali date control (JalaliDatePicker, JalaliDayNav, JalaliMonthNav,
// JalaliPeriodPicker): jdf conversion helpers, an anchored popover, and the calendar panel with
// three drill levels (days → months → years; click the title to zoom out).
// All dates crossing component boundaries are Gregorian "YYYY-MM-DD" strings (what the API takes).
import React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const WEEK = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // Saturday-first

// jdf conversion (same algorithm as work-rules/page.tsx)
export function toJalali(gy0: number, gm: number, gd: number) {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy: number, gy: number;
  if (gy0 > 1600) { jy = 979; gy = gy0 - 1600; } else { jy = 0; gy = gy0 - 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365*gy + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) - 80 + gd + gdm[gm-1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}
export function jalaliToGregorian(jy0: number, jm: number, jd: number): string {
  let gy: number, jy: number;
  if (jy0 > 979) { gy = 1600; jy = jy0 - 979; } else { gy = 621; jy = jy0; }
  let days = 365*jy + Math.floor(jy/33)*8 + Math.floor(((jy%33)+3)/4) + 78 + jd + (jm < 7 ? (jm-1)*31 : (jm-7)*30+186);
  gy += 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days-1) / 365); days = (days-1) % 365; }
  let gd = days + 1;
  const sal = [0,31,(gy%4===0&&gy%100!==0)||gy%400===0?29:28,31,30,31,30,31,31,30,31,30,31];
  let gm = 1;
  for (; gm <= 12; gm++) { if (gd <= sal[gm]) break; gd -= sal[gm]; }
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}
export const jMonthLen = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jy % 4 === 3 ? 30 : 29);
/** Accepts "YYYY-MM-DD" or a full ISO datetime; returns null for empty/invalid. */
export function parseIso(v?: string | null) {
  if (!v) return null;
  const d = v.includes("T") ? new Date(v) : new Date(v.slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
export const shiftIso = (iso: string, days: number) => new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
export const localTodayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
export const faN = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
export const weekdayOf = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("fa-IR", { weekday: "long", timeZone: "UTC" });
const colOf = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 1) % 7; // Sun=0 → Saturday-first column
const monthStart = (jy: number, jm: number) => jalaliToGregorian(jy, jm, 1);
const monthEnd = (jy: number, jm: number) => jalaliToGregorian(jy, jm, jMonthLen(jy, jm));

/* ------------------------------------------------------------------ popover */

/** Fixed-position popover anchored under (or, if no room, above) `anchor`; closes on outside
 *  click and Escape (Escape is swallowed so an enclosing Modal stays open). */
export function Popover({ anchor, open, onClose, children, width = 288 }: {
  anchor: React.RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  const panel = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = anchor.current?.getBoundingClientRect(); if (!r) return;
      const h = panel.current?.offsetHeight || 340;
      const vw = window.innerWidth, vh = window.innerHeight;
      const top = r.bottom + 6 + h > vh - 8 && r.top - 6 - h > 8 ? r.top - 6 - h : r.bottom + 6;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), vw - width - 8);
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(place); // re-place once the real height is known
    const out = (e: MouseEvent) => { const t = e.target as Node; if (!anchor.current?.contains(t) && !panel.current?.contains(t)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={panel} dir="rtl" style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, zIndex: 10000 }}
      className="rounded-2xl border border-theme bg-theme-primary shadow-2xl p-3">
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------ calendar panel */

type Level = "day" | "month" | "year";
export type JSel = { jy: number; jm: number; jd: number }; // 0 = not selected / "whole"

/**
 * depth   — finest unit the user picks: "day" (calendar) or "month" (month grid).
 * whole   — period mode: footer offers «کل ماه» / «کل سال» / «همه» (picks with jd/jm/jy = 0).
 * onPick  — (jy, jm, jd); jd is 0 for a month pick, jm too for a whole-year pick.
 */
export function CalendarPanel({ selected, onPick, depth = "day", min, max, today, whole = false, footer }: {
  selected: JSel; onPick: (jy: number, jm: number, jd: number) => void; depth?: "day" | "month";
  min?: string; max?: string; today?: string; whole?: boolean; footer?: React.ReactNode;
}) {
  const todayIso = today || localTodayIso();
  const tj = parseIso(todayIso)!;
  const [level, setLevel] = React.useState<Level>(depth === "month" ? "month" : selected.jy && !selected.jm && whole ? "month" : "day");
  const [vy, setVy] = React.useState(selected.jy || tj.jy);
  const [vm, setVm] = React.useState(selected.jm || (selected.jy && selected.jy !== tj.jy ? 1 : tj.jm));
  const decade = Math.floor(vy / 12) * 12; // year view shows 12 years

  const outDay = (iso: string) => (!!max && iso > max) || (!!min && iso < min);
  const outMonth = (y: number, m: number) => (!!max && monthStart(y, m) > max) || (!!min && monthEnd(y, m) < min);
  const outYear = (y: number) => (!!max && monthStart(y, 1) > max) || (!!min && monthEnd(y, 12) < min);

  const step = (dir: 1 | -1) => {
    if (level === "day") { let m = vm + dir, y = vy; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } setVm(m); setVy(y); }
    else if (level === "month") setVy(vy + dir);
    else setVy(vy + 12 * dir);
  };
  const stepDisabled = (dir: 1 | -1) => {
    if (level === "day") { let m = vm + dir, y = vy; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } return outMonth(y, m); }
    if (level === "month") return outYear(vy + dir);
    return dir === 1 ? outYear(decade + 12) : outYear(decade - 1);
  };
  const title = level === "day" ? `${J_MONTHS[vm - 1]} ${faN(vy)}` : level === "month" ? `سال ${faN(vy)}` : `${faN(decade)} – ${faN(decade + 11)}`;
  const zoomOut = () => setLevel(level === "day" ? "month" : "year");

  const cell = (active: boolean, disabled: boolean, isToday: boolean, extra = "") =>
    `rounded-lg text-sm transition-colors ${
      active ? "bg-blue-600 text-white font-semibold"
      : disabled ? "text-theme-muted opacity-30 cursor-not-allowed"
      : isToday ? "ring-1 ring-blue-500 text-blue-600 dark:text-blue-400 font-semibold hover:bg-theme-hover"
      : `${extra || "text-theme-primary"} hover:bg-theme-hover`
    }`;

  let body: React.ReactNode;
  if (level === "day") {
    const first = monthStart(vy, vm), lead = colOf(first);
    const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: jMonthLen(vy, vm) }, (_, i) => shiftIso(first, i))];
    body = (
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK.map(w => <div key={w} className={`text-[11px] pb-1 ${w === "ج" ? "text-red-500" : "text-theme-muted"}`}>{w}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const d = i - lead + 1, dis = outDay(iso);
          const act = selected.jy === vy && selected.jm === vm && selected.jd === d;
          return <button type="button" key={iso} disabled={dis} onClick={() => onPick(vy, vm, d)}
            className={`h-8 ${cell(act, dis, iso === todayIso, colOf(iso) === 6 ? "text-red-500" : "")}`}>{faN(d)}</button>;
        })}
      </div>
    );
  } else if (level === "month") {
    body = (
      <div className="grid grid-cols-3 gap-1.5">
        {J_MONTHS.map((name, i) => {
          const m = i + 1, dis = outMonth(vy, m);
          const act = selected.jy === vy && selected.jm === m && (depth === "month" || !selected.jd);
          return <button type="button" key={m} disabled={dis}
            onClick={() => { if (depth === "month") onPick(vy, m, 0); else { setVm(m); setLevel("day"); } }}
            className={`h-10 ${cell(act, dis, tj.jy === vy && tj.jm === m)}`}>{name}</button>;
        })}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => decade + i).map(y => {
          const dis = outYear(y);
          return <button type="button" key={y} disabled={dis} onClick={() => { setVy(y); setLevel("month"); }}
            className={`h-10 ${cell(selected.jy === y && !selected.jm && whole, dis, tj.jy === y, selected.jy === y ? "text-blue-600 dark:text-blue-400 font-semibold" : "")}`}>{faN(y)}</button>;
        })}
      </div>
    );
  }

  const wholeBtn = whole && (
    level === "day" ? { label: `کل ${J_MONTHS[vm - 1]} ${faN(vy)}`, pick: () => onPick(vy, vm, 0), dis: outMonth(vy, vm) }
    : level === "month" ? { label: `کل سال ${faN(vy)}`, pick: () => onPick(vy, 0, 0), dis: outYear(vy) }
    : { label: "همه سال‌ها", pick: () => onPick(0, 0, 0), dis: false });
  const todayBtn = !outDay(todayIso) && (depth === "month"
    ? { label: "ماه جاری", pick: () => onPick(tj.jy, tj.jm, 0) }
    : { label: "امروز", pick: () => onPick(tj.jy, tj.jm, tj.jd) });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => step(-1)} disabled={stepDisabled(-1)} title="قبلی" className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-hover disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        <button type="button" onClick={zoomOut} disabled={level === "year"} title={level === "year" ? undefined : "انتخاب ماه / سال"}
          className="px-2 py-1 rounded-lg text-sm font-semibold text-theme-primary hover:bg-theme-hover disabled:hover:bg-transparent disabled:cursor-default">{title}</button>
        <button type="button" onClick={() => step(1)} disabled={stepDisabled(1)} title="بعدی" className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-hover disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
      </div>
      {body}
      {(wholeBtn || todayBtn || footer) && (
        <div className="mt-2 pt-2 border-t border-theme flex items-center justify-between gap-2 text-xs">
          {todayBtn ? <button type="button" onClick={todayBtn.pick} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{todayBtn.label}</button> : <span />}
          {footer}
          {wholeBtn && <button type="button" onClick={wholeBtn.pick} disabled={wholeBtn.dis} className="px-2 py-1 rounded-lg font-medium text-theme-secondary bg-theme-secondary hover:bg-theme-hover disabled:opacity-40">{wholeBtn.label}</button>}
        </div>
      )}
    </div>
  );
}

/** Shared look for the trigger buttons. */
export const triggerCls = (open: boolean, extra = "") =>
  `h-9 flex items-center gap-2 px-3 rounded-xl border bg-theme-card text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${open ? "border-blue-500 ring-2 ring-blue-500/20" : "border-theme hover:bg-theme-hover"} ${extra}`;
export const navBtnCls = "w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border border-theme bg-theme-card text-theme-primary hover:bg-theme-hover disabled:opacity-35 disabled:cursor-not-allowed transition-colors";
