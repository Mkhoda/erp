import { BadRequestException } from '@nestjs/common';
import { parseWorkDate } from '../scope.util';
import { jalaliMonthRange, toJalaliParts, workDateOf } from './jalali.util';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_REPORT_DAYS = 366;

/**
 * Period of a management report: an explicit `from`/`to` (work dates, inclusive, max a year) or
 * a Jalali month (`jYear`/`jMonth`, default the current one). Bounds are work-date labels.
 */
export function resolveReportRange(q: any): { start: Date; endExcl: Date; days: number } {
  let start: Date, endExcl: Date;
  if (q?.from || q?.to) {
    const today = workDateOf(new Date());
    let to = q.to ? parseWorkDate(q.to) : today;
    let from = q.from ? parseWorkDate(q.from) : to;
    if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new BadRequestException('بازه‌ی تاریخ نامعتبر است');
    if (from > to) [from, to] = [to, from];
    start = from;
    endExcl = new Date(to.getTime() + DAY_MS);
  } else {
    const t = toJalaliParts(workDateOf(new Date()));
    const jMonth = +q?.jMonth || t.jMonth;
    if (jMonth < 1 || jMonth > 12) throw new BadRequestException('ماه نامعتبر است');
    ({ start, endExcl } = jalaliMonthRange(+q?.jYear || t.jYear, jMonth));
  }
  const days = Math.round((endExcl.getTime() - start.getTime()) / DAY_MS);
  if (days > MAX_REPORT_DAYS) throw new BadRequestException(`بازه‌ی تاریخ حداکثر ${MAX_REPORT_DAYS} روز است`);
  return { start, endExcl, days };
}
