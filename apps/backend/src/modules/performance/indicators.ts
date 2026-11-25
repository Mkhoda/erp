// Catalog of performance-score indicators. The admin panel is generated from it, so adding an
// entry here plus its evaluation in performance.service.ts is all a new indicator needs.
//   score   — 0..100, averaged by `weight` into the base score (null = no data, weight redistributed)
//   bonus   — adds `points` per unit, at most `cap`
//   penalty — subtracts `points` per unit, at most `cap`
export type IndicatorKind = 'score' | 'bonus' | 'penalty';
export type IndicatorParam = { key: string; label: string; min: number; max: number; step?: number; unit: string; default: number };
export type IndicatorDef = {
  key: string; kind: IndicatorKind; group: string; label: string; description: string;
  unit?: string; // bonus/penalty: what one unit is
  overlaps?: string[]; // indicators measuring the same thing (the panel warns when both are on)
  enabled: boolean; weight?: number; points?: number; cap?: number; params?: IndicatorParam[];
};

const p = (key: string, label: string, unit: string, def: number, min: number, max: number, step = 1): IndicatorParam => ({ key, label, unit, default: def, min, max, step });

export const INDICATORS: IndicatorDef[] = [
  // ── base score ──
  { key: 'report', kind: 'score', group: 'گزارش کار', label: 'ثبت گزارش روزانه', description: 'روزهایی که گزارش کار به‌موقع ثبت شده، نسبت به روزهای الزامی. ثبت با تأخیر بخشی از امتیاز را می‌گیرد.', enabled: true, weight: 25, params: [p('lateCredit', 'ارزش گزارش با تأخیر', '٪', 50, 0, 100)] },
  { key: 'coverage', kind: 'score', group: 'گزارش کار', label: 'پوشش زمان کار', description: 'زمان ثبت‌شده در «عملکرد من» نسبت به کارکرد حضور. رسیدن به درصد هدف یعنی امتیاز کامل.', enabled: true, weight: 10, params: [p('target', 'درصد هدف', '٪', 100, 10, 100)] },
  { key: 'taskDeadline', kind: 'score', group: 'وظایف', label: 'انجام به‌موقع وظایف مهلت‌دار', description: 'وظایفی که تا مهلتشان انجام شده‌اند، نسبت به وظایف سررسیدشده (شخصی، واگذارشده و عمومیِ مهلت‌دار).', enabled: true, weight: 10, params: [p('lateCredit', 'ارزش انجام با تأخیر', '٪', 50, 0, 100)] },
  { key: 'punctuality', kind: 'score', group: 'حضور', label: 'وقت‌شناسی', description: 'روزهای حضور بدون تاخیر و تعجیل، نسبت به کل روزهای حضور. کارکنان ساعتی محاسبه نمی‌شوند.', enabled: true, weight: 25, params: [p('tolerance', 'تاخیر یا تعجیل قابل چشم‌پوشی در روز', 'دقیقه', 0, 0, 120)] },
  { key: 'attendance', kind: 'score', group: 'حضور', label: 'حضور بدون غیبت', description: 'روزهای کاری بدون غیبت، نسبت به کل روزهای کاری. مرخصی، ماموریت و دورکاری غیبت نیست.', enabled: true, weight: 20 },
  { key: 'workHours', kind: 'score', group: 'حضور', label: 'تکمیل ساعت موظفی', description: 'سهمی از ساعت موظفی که بدون کسری کارکرد پر شده است. کارکنان ساعتی محاسبه نمی‌شوند.', enabled: true, weight: 10, overlaps: ['deficitHours'] },
  { key: 'tickets', kind: 'score', group: 'تیکت', label: 'پاسخگویی تیمی تیکت', description: 'تیکت‌های کارتابل دپارتمان‌های فرد که در مهلت SLA پاسخ و حل شده‌اند. تأخیر برای همه‌ی کسانی که به آن کارتابل دسترسی دارند حساب می‌شود.', enabled: true, weight: 20 },
  { key: 'ticketResolve', kind: 'score', group: 'تیکت', label: 'حل به‌موقع تیکت‌های شخصی', description: 'تیکت‌های ارجاع‌شده به خود فرد که تا مهلت حل شده‌اند، نسبت به تیکت‌های حل‌شده یا از مهلت گذشته.', enabled: false, weight: 10, overlaps: ['overdueTicket'] },
  { key: 'ticketFirstResponse', kind: 'score', group: 'تیکت', label: 'پاسخ اول به‌موقع', description: 'تیکت‌های ارجاع‌شده به خود فرد که پاسخ اولشان در مهلت SLA دپارتمان بوده است.', enabled: false, weight: 10 },

  // ── bonuses ──
  { key: 'perfectReport', kind: 'bonus', group: 'گزارش کار', label: 'گزارش کامل و به‌موقع', description: 'همه‌ی گزارش‌های الزامی بازه به‌موقع ثبت شده باشد.', unit: 'بازه', enabled: true, points: 2, cap: 2, params: [p('minDays', 'حداقل روز الزامی', 'روز', 5, 1, 60)] },
  { key: 'perfectPunctual', kind: 'bonus', group: 'حضور', label: 'حضور بدون تاخیر و تعجیل', description: 'در کل بازه هیچ تاخیر، تعجیل و غیبتی نباشد.', unit: 'بازه', enabled: true, points: 2, cap: 2, params: [p('minDays', 'حداقل روز حضور', 'روز', 5, 1, 60)] },
  { key: 'earlyTask', kind: 'bonus', group: 'وظایف', label: 'انجام زودتر از مهلت', description: 'هر وظیفه‌ی مهلت‌دار که حداقل چند روز زودتر از مهلت انجام شده باشد.', unit: 'وظیفه', enabled: true, points: 1, cap: 5, params: [p('days', 'حداقل روز زودتر', 'روز', 1, 1, 30)] },
  { key: 'resolvedTicket', kind: 'bonus', group: 'تیکت', label: 'تیکت حل‌شده', description: 'هر تیکتی که به فرد ارجاع شده و در بازه حل شده است.', unit: 'تیکت', enabled: false, points: 0.5, cap: 5 },
  { key: 'overtime', kind: 'bonus', group: 'حضور', label: 'اضافه‌کار', description: 'هر ساعت اضافه‌کار عادی. توجه: پاداش به اضافه‌کار می‌تواند ماندنِ بی‌هدف را تشویق کند.', unit: 'ساعت', enabled: false, points: 0.2, cap: 5 },
  { key: 'holidayWork', kind: 'bonus', group: 'حضور', label: 'تعطیل‌کاری', description: 'هر ساعت کار در روز تعطیل یا آخر هفته.', unit: 'ساعت', enabled: false, points: 0.3, cap: 5 },

  // ── penalties ──
  { key: 'missingReport', kind: 'penalty', group: 'گزارش کار', label: 'گزارش ثبت‌نشده', description: 'هر روز الزامی که گزارش آن ثبت نشده و مهلتش گذشته است.', unit: 'روز', enabled: false, points: 1, cap: 15, overlaps: ['report'] },
  { key: 'lateReport', kind: 'penalty', group: 'گزارش کار', label: 'گزارش با تأخیر', description: 'هر گزارشی که با تأخیر ثبت شده است.', unit: 'روز', enabled: false, points: 0.5, cap: 10, overlaps: ['report'] },
  { key: 'shortReport', kind: 'penalty', group: 'گزارش کار', label: 'گزارش بیش از حد کوتاه', description: 'هر گزارش که متن آن از حداقل تعیین‌شده کوتاه‌تر باشد.', unit: 'گزارش', enabled: false, points: 0.5, cap: 5, params: [p('minChars', 'حداقل طول متن', 'کاراکتر', 30, 5, 1000, 5)] },
  { key: 'lowCoverage', kind: 'penalty', group: 'گزارش کار', label: 'روز با ثبت زمان ناکافی', description: 'هر روزی که زمان ثبت‌شده از درصد تعیین‌شده‌ی کارکرد همان روز کمتر باشد (امروز حساب نمی‌شود).', unit: 'روز', enabled: false, points: 0.5, cap: 10, overlaps: ['coverage'], params: [p('threshold', 'حداقل پوشش روز', '٪', 50, 5, 100)] },
  { key: 'overdueTask', kind: 'penalty', group: 'وظایف', label: 'وظیفه‌ی معوق', description: 'هر وظیفه‌ی مهلت‌دار که مهلتش گذشته و هنوز انجام نشده است.', unit: 'وظیفه', enabled: false, points: 2, cap: 10, overlaps: ['taskDeadline'] },
  { key: 'absence', kind: 'penalty', group: 'حضور', label: 'غیبت', description: 'هر روز غیبت.', unit: 'روز', enabled: false, points: 2, cap: 15, overlaps: ['attendance'] },
  { key: 'delayHours', kind: 'penalty', group: 'حضور', label: 'مجموع تاخیر', description: 'هر ساعت تاخیر، پس از کسر سهمیه‌ی مجاز بازه. کارکنان ساعتی محاسبه نمی‌شوند.', unit: 'ساعت', enabled: false, points: 1, cap: 10, overlaps: ['punctuality'], params: [p('free', 'سهمیه‌ی مجاز در بازه', 'دقیقه', 60, 0, 3000, 10)] },
  { key: 'earlyLeaveHours', kind: 'penalty', group: 'حضور', label: 'مجموع تعجیل', description: 'هر ساعت خروج زودهنگام، پس از کسر سهمیه‌ی مجاز بازه. کارکنان ساعتی محاسبه نمی‌شوند.', unit: 'ساعت', enabled: false, points: 1, cap: 10, overlaps: ['punctuality'], params: [p('free', 'سهمیه‌ی مجاز در بازه', 'دقیقه', 60, 0, 3000, 10)] },
  { key: 'deficitHours', kind: 'penalty', group: 'حضور', label: 'کسری کارکرد', description: 'هر ساعت کسری کارکرد که با مرخصی جبران نشده است.', unit: 'ساعت', enabled: false, points: 1, cap: 10, overlaps: ['workHours'] },
  { key: 'incomplete', kind: 'penalty', group: 'حضور', label: 'تردد ناقص', description: 'هر روز با ورود یا خروج ثبت‌نشده (امروز حساب نمی‌شود).', unit: 'روز', enabled: true, points: 0.5, cap: 5 },
  { key: 'corrections', kind: 'penalty', group: 'حضور', label: 'درخواست اصلاح تردد', description: 'هر درخواست اصلاح ورود یا خروج، بیشتر از سهمیه‌ی مجاز. درخواست مرخصی، ماموریت و دورکاری حساب نمی‌شود.', unit: 'درخواست', enabled: false, points: 0.5, cap: 5, params: [p('free', 'تعداد مجاز در بازه', 'درخواست', 3, 0, 100)] },
  { key: 'overdueTicket', kind: 'penalty', group: 'تیکت', label: 'تیکت معوق شخصی', description: 'هر تیکت بازِ ارجاع‌شده به فرد که از مهلتش گذشته است.', unit: 'تیکت', enabled: true, points: 1, cap: 10, overlaps: ['ticketResolve'] },
  { key: 'reopenedTicket', kind: 'penalty', group: 'تیکت', label: 'تیکت بازگشایی‌شده', description: 'هر بار که تیکتِ ارجاع‌شده به فرد پس از حل دوباره باز شده است.', unit: 'بار', enabled: false, points: 1, cap: 5 },
];

export type IndicatorConfig = { enabled: boolean; weight: number; points: number; cap: number; params: Record<string, number> };
export type ScoreConfig = {
  indicators: Record<string, IndicatorConfig>;
  general: { maxBonus: number; maxPenalty: number; minWorkingDays: number; excellent: number; good: number; fair: number };
};

const DEFAULT_GENERAL: ScoreConfig['general'] = { maxBonus: 10, maxPenalty: 30, minWorkingDays: 0, excellent: 90, good: 75, fair: 60 };
const num = (v: any, def: number, min: number, max: number) => {
  const n = v === '' || v == null ? NaN : +v;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : def;
};

/** A complete, in-range config from whatever is stored or submitted (unknown keys are dropped). */
export function normalizeConfig(raw: any, legacyWeights?: any): ScoreConfig {
  const indicators: ScoreConfig['indicators'] = {};
  for (const d of INDICATORS) {
    const r = raw?.indicators?.[d.key] ?? {};
    // Weights saved by the old five-component settings carry over until the panel is first saved.
    const legacy = !raw && d.kind === 'score' && legacyWeights?.[d.key] != null ? +legacyWeights[d.key] || 0 : null;
    indicators[d.key] = {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : legacy != null ? legacy > 0 : d.enabled,
      weight: num(r.weight, legacy || (d.weight ?? 0), 0, 100),
      points: num(r.points, d.points ?? 0, 0, 100),
      cap: num(r.cap, d.cap ?? 0, 0, 100),
      params: Object.fromEntries((d.params ?? []).map((x) => [x.key, num(r.params?.[x.key], x.default, x.min, x.max)])),
    };
  }
  const g = raw?.general ?? {};
  const excellent = num(g.excellent, DEFAULT_GENERAL.excellent, 0, 100);
  const good = Math.min(excellent, num(g.good, DEFAULT_GENERAL.good, 0, 100));
  return {
    indicators,
    general: {
      maxBonus: num(g.maxBonus, DEFAULT_GENERAL.maxBonus, 0, 100), maxPenalty: num(g.maxPenalty, DEFAULT_GENERAL.maxPenalty, 0, 100),
      minWorkingDays: Math.round(num(g.minWorkingDays, DEFAULT_GENERAL.minWorkingDays, 0, 366)),
      excellent, good, fair: Math.min(good, num(g.fair, DEFAULT_GENERAL.fair, 0, 100)),
    },
  };
}
