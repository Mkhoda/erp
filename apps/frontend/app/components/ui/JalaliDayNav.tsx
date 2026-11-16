"use client";
// Single-day navigator: ‹ prev · [full Jalali date ▾ → calendar popover] · next › · امروز.
// Value/onChange are Gregorian work dates "YYYY-MM-DD"; days after `max` can't be picked.
import React from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarPanel, J_MONTHS, Popover, faN, jalaliToGregorian, navBtnCls, parseIso, shiftIso, triggerCls, weekdayOf } from "./jalali-calendar";

export default function JalaliDayNav({ value, onChange, min, max, today }: { value: string; onChange: (iso: string) => void; min?: string; max?: string; today?: string }) {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const j = parseIso(value);
  const prevDisabled = !!min && !!value && value <= min;
  const nextDisabled = !!max && !!value && value >= max;

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => value && !prevDisabled && onChange(shiftIso(value, -1))} disabled={prevDisabled} title="روز قبل" className={navBtnCls}><ChevronRight className="w-4 h-4" /></button>
      <button type="button" ref={btn} onClick={() => setOpen(o => !o)} className={triggerCls(open)}>
        <CalendarDays className="w-4 h-4 text-blue-500" />
        {j ? (
          <span className="text-theme-primary whitespace-nowrap">
            <span className="text-theme-muted">{weekdayOf(value)}</span> <span className="font-semibold">{faN(j.jd)} {J_MONTHS[j.jm - 1]}</span> <span className="text-theme-muted">{faN(j.jy)}</span>
          </span>
        ) : <span className="text-theme-muted">انتخاب روز</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <button type="button" onClick={() => value && !nextDisabled && onChange(shiftIso(value, 1))} disabled={nextDisabled} title="روز بعد" className={navBtnCls}><ChevronLeft className="w-4 h-4" /></button>
      {today && value !== today && (
        <button type="button" onClick={() => onChange(today)} className="h-9 px-3 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 transition-colors">امروز</button>
      )}
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)}>
        <CalendarPanel selected={j || { jy: 0, jm: 0, jd: 0 }} min={min} max={max} today={today}
          onPick={(jy, jm, jd) => { onChange(jalaliToGregorian(jy, jm, jd)); setOpen(false); }} />
      </Popover>
    </div>
  );
}
