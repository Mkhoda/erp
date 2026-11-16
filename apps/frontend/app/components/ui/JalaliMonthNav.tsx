"use client";
// Month navigator: ‹ prev · [آبان ۱۴۰۵ ▾ → month grid popover (title → year grid)] · next ›.
// Same look as JalaliDayNav, for pages that work per Jalali month.
import React from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarPanel, J_MONTHS, Popover, faN, jalaliToGregorian, jMonthLen, navBtnCls, triggerCls } from "./jalali-calendar";

export default function JalaliMonthNav({ jYear, jMonth, onChange, min, max, arrows = true }: {
  jYear: number; jMonth: number; onChange: (jYear: number, jMonth: number) => void;
  /** Gregorian bounds "YYYY-MM-DD" — months entirely outside are disabled */
  min?: string; max?: string; arrows?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const move = (dir: 1 | -1) => { let m = jMonth + dir, y = jYear; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } return { y, m }; };
  const out = (y: number, m: number) => (!!max && jalaliToGregorian(y, m, 1) > max) || (!!min && jalaliToGregorian(y, m, jMonthLen(y, m)) < min);
  const prev = move(-1), next = move(1);

  return (
    <div className="flex items-center gap-1.5">
      {arrows && <button type="button" onClick={() => onChange(prev.y, prev.m)} disabled={out(prev.y, prev.m)} title="ماه قبل" className={navBtnCls}><ChevronRight className="w-4 h-4" /></button>}
      <button type="button" ref={btn} onClick={() => setOpen(o => !o)} className={triggerCls(open)}>
        <CalendarDays className="w-4 h-4 text-blue-500" />
        <span className="text-theme-primary whitespace-nowrap"><span className="font-semibold">{J_MONTHS[jMonth - 1]}</span> <span className="text-theme-muted">{faN(jYear)}</span></span>
        <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {arrows && <button type="button" onClick={() => onChange(next.y, next.m)} disabled={out(next.y, next.m)} title="ماه بعد" className={navBtnCls}><ChevronLeft className="w-4 h-4" /></button>}
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)}>
        <CalendarPanel depth="month" selected={{ jy: jYear, jm: jMonth, jd: 0 }} min={min} max={max}
          onPick={(y, m) => { onChange(y, m); setOpen(false); }} />
      </Popover>
    </div>
  );
}
