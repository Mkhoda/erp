"use client";
import React from "react";

interface Props {
  value: string;          // "HH:MM" or ""
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function TimeSelect({ value, onChange, disabled, className = "input-theme text-sm" }: Props) {
  const parts = value ? value.split(":") : [];
  const h = parts[0] !== undefined && parts[0] !== "" ? +parts[0] : -1;
  const m = parts[1] !== undefined && parts[1] !== "" ? +parts[1] : -1;

  function set(newH: number, newM: number) {
    if (newH < 0) { onChange(""); return; }
    onChange(`${String(newH).padStart(2, "0")}:${String(newM >= 0 ? newM : 0).padStart(2, "0")}`);
  }

  return (
    <div className="flex gap-1 items-center" dir="ltr">
      <select
        className={`${className} flex-1`}
        value={h >= 0 ? h : ""}
        disabled={disabled}
        onChange={e => set(e.target.value !== "" ? +e.target.value : -1, m)}
      >
        <option value="">ساعت</option>
        {Array.from({ length: 24 }, (_, i) => i).map(i => (
          <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
        ))}
      </select>
      <span className="text-theme-muted font-bold">:</span>
      <select
        className={`${className} flex-1`}
        value={m >= 0 ? m : ""}
        disabled={disabled}
        onChange={e => set(h, e.target.value !== "" ? +e.target.value : -1)}
      >
        <option value="">دقیقه</option>
        {Array.from({ length: 60 }, (_, i) => i).map(i => (
          <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
        ))}
      </select>
    </div>
  );
}
