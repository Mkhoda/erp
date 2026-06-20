import moment from 'moment-jalaali';
import { RawPunchRow } from './source-provider.interface';

// Fixed UTC offsets (minutes) for known device time zones. Iran abolished DST
// in 2022, so a constant +03:30 is correct. Extend as new devices are added.
const TZ_OFFSET_MIN: Record<string, number> = {
  'Asia/Tehran': 210,
  UTC: 0,
};

function parseTime(rTime?: string | null): { h: number; m: number; s: number } | null {
  if (!rTime) return null;
  const t = rTime.trim();
  // "HH:mm:ss" | "HH:mm" | "HHmmss" | "HHmm"
  let mm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (mm) return { h: +mm[1], m: +mm[2], s: +(mm[3] || 0) };
  mm = t.match(/^(\d{2})(\d{2})(\d{2})?$/);
  if (mm) return { h: +mm[1], m: +mm[2], s: +(mm[3] || 0) };
  return null;
}

// Parse a Gregorian date string in common device formats → {y,mo,d} (mo is 1-12).
function parseGregDate(s?: string | null): { y: number; mo: number; d: number } | null {
  if (!s) return null;
  const v = s.trim().split(/[ T]/)[0]; // drop any time portion
  let mm = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (mm) return { y: +mm[1], mo: +mm[2], d: +mm[3] };
  mm = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (mm) return { y: +mm[1], mo: +mm[2], d: +mm[3] };
  return null;
}

// Parse a Jalali date string → Gregorian {y,mo,d} via moment-jalaali.
function parseJalaliDate(s?: string | null): { y: number; mo: number; d: number } | null {
  if (!s) return null;
  const v = s.trim().split(/[ T]/)[0];
  const mm = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/) || v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!mm) return null;
  const jy = +mm[1];
  if (jy < 1200 || jy > 1700) return null; // not a Jalali year
  const g = moment(`${mm[1]}/${mm[2]}/${mm[3]}`, 'jYYYY/jM/jD');
  if (!g.isValid()) return null;
  return { y: g.year(), mo: g.month() + 1, d: g.date() };
}

/**
 * Best-effort normalization of a device punch into an absolute UTC instant.
 * Prefers the Gregorian mDate column; falls back to the Jalali sDate column.
 * Raw column values are always preserved upstream — this is only the indexable
 * `punchAt` timestamp used for calculations.
 */
export function normalizePunchAt(row: RawPunchRow, timeZone: string): Date {
  const time = parseTime(row.rTime) ?? { h: 0, m: 0, s: 0 };
  const date = parseGregDate(row.mDate) ?? parseJalaliDate(row.sDate);
  const offsetMin = TZ_OFFSET_MIN[timeZone] ?? 0;

  if (!date) {
    // Unparseable date — fall back to import time so the record is never lost.
    return new Date();
  }
  // Compose wall-clock instant in the device's zone, then shift to UTC.
  const utcMs = Date.UTC(date.y, date.mo - 1, date.d, time.h, time.m, time.s);
  return new Date(utcMs - offsetMin * 60_000);
}

// Direction inference from the raw RType column when no device hint exists.
// Even codes / "0" / "in" → IN; odd / "1" / "out" → OUT. UNKNOWN otherwise.
export function inferDirection(rType?: string | null): 'IN' | 'OUT' | 'UNKNOWN' {
  if (rType == null) return 'UNKNOWN';
  const t = String(rType).trim().toLowerCase();
  if (['in', 'i', 'enter', '0'].includes(t)) return 'IN';
  if (['out', 'o', 'exit', '1'].includes(t)) return 'OUT';
  const n = Number(t);
  if (!Number.isNaN(n)) return n % 2 === 0 ? 'IN' : 'OUT';
  return 'UNKNOWN';
}
