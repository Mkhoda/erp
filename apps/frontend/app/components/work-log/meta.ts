// Shared labels/formatters for the work-log pages (عملکرد من + گزارش عملکرد کاربران).

export const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
export const DOW_FA: Record<number, string> = { 6: "شنبه", 0: "یکشنبه", 1: "دوشنبه", 2: "سه‌شنبه", 3: "چهارشنبه", 4: "پنج‌شنبه", 5: "جمعه" };

export const STATUS_FA: Record<string, string> = { PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص", LEAVE: "مرخصی", SICK_LEAVE: "استعلاجی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل", COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته", OFF_DUTY: "استراحت (شیفت)" };

// Report state of a day (computed server-side, see WorkLogService.stateOf).
export const STATE_META: Record<string, { label: string; cls: string; dot: string }> = {
  SUBMITTED: { label: "ثبت شده", cls: "bg-green-500/15 text-green-700 dark:text-green-300", dot: "bg-green-500" },
  LATE: { label: "با تأخیر", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  MISSING: { label: "ثبت نشده", cls: "bg-red-500/15 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  PENDING: { label: "در انتظار ثبت", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  NOT_REQUIRED: { label: "الزامی نیست", cls: "bg-slate-400/15 text-slate-500", dot: "bg-slate-300 dark:bg-slate-600" },
};

export const toFa = (s: string) => s.replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
export const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
export const fmtMin = (m: number) => toFa(`${Math.floor((m || 0) / 60)}:${String((m || 0) % 60).padStart(2, "0")}`);
export const faTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }) : "—";
export const faDateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleString("fa-IR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }) : "";
// Work-date labels are UTC midnight of the Tehran day — format in UTC so the day never shifts.
export const faDate = (iso?: string | null) => iso ? new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso).toLocaleDateString("fa-IR", { timeZone: "UTC" }) : "";
