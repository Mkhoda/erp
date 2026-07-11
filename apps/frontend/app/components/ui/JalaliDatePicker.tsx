"use client";
import React from "react";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function toJalali(gy0: number, gm: number, gd: number) {
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

function jalaliToGregorian(jy0: number, jm: number, jd: number): string {
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
  return `${gy}-${String(gm).padStart(2,"0")}-${String(gd).padStart(2,"0")}`;
}

const jMonthLen = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jy % 4 === 3 ? 30 : 29);

const faD = (n: number) => n.toLocaleString("fa-IR");
const faY = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });

interface Props {
  value: string;           // Gregorian YYYY-MM-DD (or ISO datetime or "")
  onChange: (val: string) => void; // returns Gregorian YYYY-MM-DD or ""
  className?: string;
  disabled?: boolean;
}

export default function JalaliDatePicker({ value, onChange, className = "input-theme", disabled }: Props) {
  const parsed = React.useMemo(() => {
    if (!value) return null;
    try {
      const d = value.includes("T") ? new Date(value) : new Date(value + "T00:00:00Z");
      if (isNaN(d.getTime())) return null;
      return toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    } catch { return null; }
  }, [value]);

  const jy = parsed?.jy ?? 0;
  const jm = parsed?.jm ?? 0;
  const jd = parsed?.jd ?? 0;

  const nowJy = React.useMemo(() => {
    const n = new Date();
    return toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate()).jy;
  }, []);

  function update(ny: number, nm: number, nd: number) {
    if (!ny || !nm || !nd) { onChange(""); return; }
    const maxD = jMonthLen(ny, nm);
    onChange(jalaliToGregorian(ny, nm, Math.min(nd, maxD)));
  }

  const yearList = Array.from({ length: 46 }, (_, i) => nowJy - 30 + i);
  const dayCount = jy && jm ? jMonthLen(jy, jm) : 31;
  const sel = `${className} text-sm`;

  return (
    <div className="flex gap-1" dir="ltr">
      <select
        className={sel}
        value={jy || ""}
        disabled={disabled}
        onChange={e => update(+e.target.value, jm, jd)}
      >
        <option value="">سال</option>
        {yearList.map(y => <option key={y} value={y}>{faY(y)}</option>)}
      </select>
      <select
        className={sel}
        value={jm || ""}
        disabled={disabled}
        onChange={e => update(jy, +e.target.value, jd)}
      >
        <option value="">ماه</option>
        {J_MONTHS.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
      </select>
      <select
        className={sel}
        value={jd || ""}
        disabled={disabled}
        onChange={e => update(jy, jm, +e.target.value)}
      >
        <option value="">روز</option>
        {Array.from({ length: dayCount }, (_, i) => i+1).map(d => (
          <option key={d} value={d}>{faD(d)}</option>
        ))}
      </select>
    </div>
  );
}
