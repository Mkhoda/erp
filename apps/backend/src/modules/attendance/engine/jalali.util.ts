import moment from 'moment-jalaali';

// Iran is a fixed +03:30 offset (DST abolished in 2022). Attendance "work date"
// and minutes-of-day are computed in Tehran local time.
export const TEHRAN_OFFSET_MIN = 210;

export interface JalaliParts {
  jYear: number;
  jMonth: number; // 1-12
  jDay: number;
}

const J_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

export function jMonthName(jMonth: number): string {
  return J_MONTHS[(jMonth - 1) % 12] ?? '';
}

// Shift a UTC instant to Tehran wall-clock (still as a Date whose UTC fields
// read as Tehran local time). Use only for extracting date/time parts.
function toTehran(date: Date): Date {
  return new Date(date.getTime() + TEHRAN_OFFSET_MIN * 60_000);
}

// The Gregorian "work date" (UTC midnight) for the Tehran calendar day a punch
// falls on. AttendanceDay.gregDate uses this canonical form.
export function workDateOf(instant: Date): Date {
  const t = toTehran(instant);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

// Minutes elapsed since Tehran local midnight for the given instant (0..1439).
export function minutesOfDay(instant: Date): number {
  const t = toTehran(instant);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

// Jalali parts of a Gregorian work date (UTC midnight form).
export function toJalaliParts(gregDate: Date): JalaliParts {
  const m = moment(
    Date.UTC(gregDate.getUTCFullYear(), gregDate.getUTCMonth(), gregDate.getUTCDate()),
  );
  return { jYear: m.jYear(), jMonth: m.jMonth() + 1, jDay: m.jDate() };
}

// JS day-of-week (0=Sun..6=Sat) of a Gregorian work date, in Tehran terms.
export function dayOfWeek(gregDate: Date): number {
  return new Date(
    Date.UTC(gregDate.getUTCFullYear(), gregDate.getUTCMonth(), gregDate.getUTCDate()),
  ).getUTCDay();
}

// Gregorian [start, endExclusive) UTC-midnight range covering a Jalali month.
export function jalaliMonthRange(jYear: number, jMonth: number): { start: Date; endExcl: Date } {
  const startM = moment(`${jYear}/${jMonth}/1`, 'jYYYY/jM/jD').startOf('day');
  const endM = startM.clone().add(1, 'jMonth');
  const start = new Date(Date.UTC(startM.year(), startM.month(), startM.date()));
  const endExcl = new Date(Date.UTC(endM.year(), endM.month(), endM.date()));
  return { start, endExcl };
}

// "HH:mm" → minutes since midnight. Returns null on bad input.
export function parseHHmm(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return +m[1] * 60 + +m[2];
}

// Format a Gregorian work date as Jalali "jYYYY/jMM/jDD".
export function formatJalali(gregDate: Date): string {
  const { jYear, jMonth, jDay } = toJalaliParts(gregDate);
  return `${jYear}/${String(jMonth).padStart(2, '0')}/${String(jDay).padStart(2, '0')}`;
}

// Minutes → "H:MM" (e.g. 510 → "8:30").
export function minutesToHHMM(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${min < 0 ? '-' : ''}${h}:${String(m).padStart(2, '0')}`;
}
