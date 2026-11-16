"use client";
// Form-field date picker: a field showing «۱۸ آبان ۱۴۰۵» that opens the shared Jalali calendar
// (click the calendar title to jump by month / year). Value in/out: Gregorian "YYYY-MM-DD"
// (an ISO datetime is accepted as input), "" when empty.
import React from "react";
import { CalendarDays, X } from "lucide-react";
import { CalendarPanel, J_MONTHS, Popover, faN, jalaliToGregorian, parseIso } from "./jalali-calendar";

interface Props {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  /** show a ✕ that clears the value (default true) */
  clearable?: boolean;
}

export default function JalaliDatePicker({ value, onChange, className = "input-theme", disabled, min, max, placeholder = "انتخاب تاریخ", clearable = true }: Props) {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const j = parseIso(value);

  return (
    <div className="relative w-full min-w-0">
      <button type="button" ref={btn} disabled={disabled} onClick={() => setOpen(o => !o)}
        className={`${className} text-sm flex items-center gap-2 text-right cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${open ? "!border-blue-500 ring-2 ring-blue-500/20" : ""} ${clearable && j && !disabled ? "pl-8" : ""}`}>
        <CalendarDays className="w-4 h-4 shrink-0 text-blue-500" />
        {j
          ? <span className="truncate text-theme-primary">{faN(j.jd)} {J_MONTHS[j.jm - 1]} {faN(j.jy)}</span>
          : <span className="truncate text-theme-muted">{placeholder}</span>}
      </button>
      {clearable && j && !disabled && (
        <button type="button" onClick={() => onChange("")} title="پاک کردن" aria-label="پاک کردن"
          className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-theme-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <Popover anchor={btn} open={open} onClose={() => setOpen(false)}>
        <CalendarPanel selected={j || { jy: 0, jm: 0, jd: 0 }} min={min} max={max}
          onPick={(jy, jm, jd) => { onChange(jalaliToGregorian(jy, jm, jd)); setOpen(false); }} />
      </Popover>
    </div>
  );
}
