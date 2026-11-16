"use client";
// Year / month / day filter in one control (0 = "all" at that level), replacing the old
// «همه سال‌ها / همه ماه‌ها / همه روزها» select trio. Shows «۲۵ آبان ۱۴۰۵», «آبان ۱۴۰۵»,
// «سال ۱۴۰۵» or «همه تاریخ‌ها»; the popover calendar has «کل ماه» / «کل سال» / «همه سال‌ها».
import React from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { CalendarPanel, J_MONTHS, Popover, faN, triggerCls } from "./jalali-calendar";

export type JPeriod = { jYear: number; jMonth: number; jDay: number };

export const periodLabel = ({ jYear, jMonth, jDay }: JPeriod) =>
  !jYear ? "همه تاریخ‌ها"
  : !jMonth ? `سال ${faN(jYear)}`
  : !jDay ? `${J_MONTHS[jMonth - 1]} ${faN(jYear)}`
  : `${faN(jDay)} ${J_MONTHS[jMonth - 1]} ${faN(jYear)}`;

export default function JalaliPeriodPicker({ value, onChange, max, clearable = true, className = "" }: {
  value: JPeriod; onChange: (p: JPeriod) => void; max?: string; clearable?: boolean; className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const set = !!value.jYear;

  return (
    <div className={`relative ${className}`}>
      <button type="button" ref={btn} onClick={() => setOpen(o => !o)} className={triggerCls(open, `w-full ${clearable && set ? "pl-8" : ""}`)}>
        <CalendarDays className="w-4 h-4 shrink-0 text-blue-500" />
        <span className={`flex-1 text-right whitespace-nowrap ${set ? "text-theme-primary font-medium" : "text-theme-muted"}`}>{periodLabel(value)}</span>
        {!(clearable && set) && <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {clearable && set && (
        <button type="button" onClick={() => onChange({ jYear: 0, jMonth: 0, jDay: 0 })} title="پاک کردن فیلتر" aria-label="پاک کردن فیلتر"
          className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)}>
        <CalendarPanel whole max={max} selected={{ jy: value.jYear, jm: value.jMonth, jd: value.jDay }}
          onPick={(jy, jm, jd) => { onChange({ jYear: jy, jMonth: jm, jDay: jd }); setOpen(false); }} />
      </Popover>
    </div>
  );
}
