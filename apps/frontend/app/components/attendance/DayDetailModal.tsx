"use client";
import React from "react";
import { Clock, Pencil, Info as InfoIcon, ListChecks, HelpCircle, AlertTriangle, ArrowLeft, Upload, X, Loader2 } from "lucide-react";
import Modal from "../ui/Modal";
import TimeSelect from "../ui/TimeSelect";

// Short explanation shown on hover for each computed/calculated field — these
// numbers come out of calc.service.ts's formulas, not raw input, so a "?"
// next to them tells the reader what's actually behind the number.
const FIELD_HELP: Record<string, string> = {
  worked: "مجموع دقایق حضور واقعی بین ورود و خروج، منهای زمان ناهار/استراحت گروه.",
  overtime: "دقایق کار بیشتر از ساعت مورد نیاز یا بعد از پایان بازه‌ی خروج — تا سقف روزانه/ماهانه‌ی گروه.",
  holidayOvertime: "کارکرد در روز تعطیل/آخر هفته — با ضریب پرداخت متفاوت از اضافه‌کار عادی، بنابراین جدا محاسبه می‌شود.",
  delay: "دقایق ورود بعد از پایان بازه‌ی مجاز ورود گروه.",
  earlyLeave: "دقایق خروج قبل از شروع بازه‌ی مجاز خروج گروه.",
  deficit: "کمبود کارکرد نسبت به ساعت کاری مورد نیاز پس از کسر مرخصی. اگر تنظیمات گروه فعال باشد، به‌صورت خودکار از مانده مرخصی سالانه کسر می‌شود.",
  night: "دقایق کارکرد هم‌پوشان با بازه‌ی ۲۲:۰۰ تا ۰۶:۰۰.",
  leave: "دقایق مرخصی این روز — یا دستی ثبت شده، یا به‌صورت خودکار از کسری/غیبت تبدیل شده.",
  sickLeave: "دقایق مرخصی استعلاجی این روز — از موجودی جداگانه‌ی مرخصی استعلاجی کسر می‌شود، نه مرخصی استحقاقی.",
};

const STATUS_FA: Record<string, string> = {
  PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص",
  LEAVE: "مرخصی", SICK_LEAVE: "استعلاجی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل",
  COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته", OFF_DUTY: "استراحت (شیفت)",
};

const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => toFa(`${Math.floor(Math.abs(m || 0) / 60)}:${String(Math.abs(m || 0) % 60).padStart(2, "0")}`);
const faTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hour12: false }) : "—");
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone: "UTC" });
// A root-relative /uploads/... path needs the site origin prefixed, not the API base (.../api has no static mount there).
const attachmentUrl = (raw: string) => raw.startsWith("http") ? raw : `${typeof window !== "undefined" ? window.location.origin : ""}${raw}`;

// Explains WHY a day ended up as leave / hourly-leave when it was auto-converted
// from a deficit or an absence (see calc.service.ts's conversion rules), instead
// of just showing the raw numbers with no context.
function conversionNote(row: any): string | null {
  if (!row?.autoConvertedLeave) return null;
  if (row.status === "LEAVE" && !row.firstCheckIn) {
    return "این روز غیبت بود؛ چون مانده مرخصی سالانه کافی بود، به‌صورت خودکار به مرخصی روزانه تبدیل شد.";
  }
  if (row.status === "LEAVE") {
    return "کسری کارکرد این روز از سقف ماهانه مرخصی ساعتی بیشتر بود؛ به‌صورت خودکار به یک روز کامل مرخصی تبدیل شد.";
  }
  return `بخشی از کسری کارکرد این روز (${fmtMin(row.leaveMinutes)}) به‌صورت خودکار از مرخصی ساعتی کسر شد.`;
}

export type DayDetail = { row: any; punches?: any[]; override?: any };

type Props = {
  open: boolean;
  onClose: () => void;
  detail: DayDetail | null;
  // Admin-only "اصلاح ساعت ورود/خروج" tab — omit for self-service (read-only) use.
  allowOverride?: boolean;
  ov?: { inTime: string; outTime: string; status: string; reason: string; leaveHours: string; clearCheckIn: boolean; clearCheckOut: boolean; isSickLeave: boolean; attachment: string };
  setOv?: React.Dispatch<React.SetStateAction<{ inTime: string; outTime: string; status: string; reason: string; leaveHours: string; clearCheckIn: boolean; clearCheckOut: boolean; isSickLeave: boolean; attachment: string }>>;
  onSaveOverride?: () => void;
  ovSaving?: boolean;
  // Doctor's-note upload for the "استعلاجی" checkbox above — same requirement as employee self-service.
  ovUploading?: boolean;
  onPickOvAttachment?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Self-service (employee) path: open the parent's request modal pre-set to
  // this kind instead of editing directly. Ignored when allowOverride is set.
  onRequestKind?: (kind: "LEAVE" | "MISSION") => void;
};

export default function DayDetailModal({ open, onClose, detail, allowOverride, ov, setOv, onSaveOverride, ovSaving, ovUploading, onPickOvAttachment, onRequestKind }: Props) {
  const [tab, setTab] = React.useState<"summary" | "punches" | "edit">("summary");
  React.useEffect(() => { if (open) setTab("summary"); }, [open, detail?.row?.id]);

  const row = detail?.row;
  const note = row ? conversionNote(row) : null;
  const punches = detail?.punches || [];
  // Server flags a day INCOMPLETE for >2 punches until an override "pins"
  // both sides (calc.service.ts's ambiguousPunches) — once pinned, status
  // moves off INCOMPLETE, so this only nags while genuinely unresolved.
  const needsClassification = punches.length > 2 && row?.status === "INCOMPLETE";
  // Pair sequential punches into in/out segments (same first/last-punch
  // alternation assumption the backend uses); an odd count leaves the last
  // segment open (no matching out punch yet).
  const segments: Array<{ in: any; out: any | null }> = [];
  for (let i = 0; i < punches.length; i += 2) segments.push({ in: punches[i], out: punches[i + 1] || null });

  function adminClassify(status: "LEAVE" | "MISSION") {
    setOv?.(s => ({ ...s, status }));
    setTab("edit");
  }

  const tabs = [
    { id: "summary" as const, label: "خلاصه", icon: InfoIcon },
    { id: "punches" as const, label: "پانچ‌های خام", icon: Clock },
    ...(allowOverride ? [{ id: "edit" as const, label: "اصلاح", icon: Pencil }] : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? `${row.user ? `${row.user.firstName} ${row.user.lastName} — ` : ""}${faDate(row.gregDate)}` : "جزئیات روز"}
      size="md"
      footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}
    >
      {!detail ? null : (
        <div>
          <div className="flex gap-1 bg-theme-secondary border border-theme p-1 rounded-xl w-fit mb-4">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? "bg-theme-card text-theme-primary shadow-sm" : "text-theme-muted hover:text-theme-secondary"}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {needsClassification && (
            <div className="flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2.5 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>این روز چند بار ورود/خروج ثبت شده — تا وقتی تعیین تکلیف نشود «ناقص» می‌ماند و کسری/مرخصی برایش حساب نمی‌شود. این بازه‌ها مرخصی بوده یا ماموریت؟</p>
                <div className="flex gap-2 mt-2">
                  {allowOverride ? (
                    <>
                      <button onClick={() => adminClassify("LEAVE")} className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[11px]">ثبت به‌عنوان مرخصی</button>
                      <button onClick={() => adminClassify("MISSION")} className="px-2.5 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[11px]">ثبت به‌عنوان ماموریت</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => onRequestKind?.("LEAVE")} className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[11px]">درخواست مرخصی</button>
                      <button onClick={() => onRequestKind?.("MISSION")} className="px-2.5 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[11px]">درخواست ماموریت</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "summary" && (
            <div>
              {note && (
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-3">
                  <ListChecks className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {note}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="وضعیت" value={STATUS_FA[row.status] || row.status} />
                <Info label="کارکرد" value={fmtMin(row.workedMinutes)} help={FIELD_HELP.worked} />
                <Info label="اضافه‌کار" value={fmtMin(row.overtimeMinutes)} help={FIELD_HELP.overtime} />
                <Info label="تعطیل‌کاری" value={fmtMin(row.holidayOvertimeMinutes)} help={FIELD_HELP.holidayOvertime} />
                <Info label="تاخیر" value={fmtMin(row.delayMinutes)} help={FIELD_HELP.delay} />
                <Info label="تعجیل" value={fmtMin(row.earlyLeaveMinutes)} help={FIELD_HELP.earlyLeave} />
                <Info label="کسری" value={fmtMin(row.deficitMinutes)} cls={row.deficitMinutes ? "text-orange-600" : undefined} help={FIELD_HELP.deficit} />
                <Info label="شب‌کاری" value={fmtMin(row.nightMinutes)} help={FIELD_HELP.night} />
                {row.leaveMinutes > 0 && (
                  <Info label="مرخصی" value={`${fmtMin(row.leaveMinutes)}${row.autoConvertedLeave ? " (خودکار)" : ""}`} cls="text-blue-600" help={FIELD_HELP.leave} />
                )}
                {row.sickLeaveMinutes > 0 && (
                  <Info label="استعلاجی" value={fmtMin(row.sickLeaveMinutes)} cls="text-rose-600" help={FIELD_HELP.sickLeave} />
                )}
              </div>
            </div>
          )}

          {tab === "punches" && (
            <div>
              <div className="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" /> بازه‌های ورود و خروج ({faNum(punches.length)} پانچ)
              </div>
              <div className="space-y-1.5">
                {segments.map((seg, i) => (
                  <div key={seg.in.id} className="flex items-center justify-between text-sm bg-theme-secondary/30 rounded-lg px-3 py-2">
                    <span className="text-theme-muted text-xs shrink-0">بازه {faNum(i + 1)}</span>
                    <span dir="ltr" className="text-theme-primary font-medium flex items-center gap-1.5">
                      {faTime(seg.in.punchAt)}
                      <ArrowLeft className="w-3 h-3 text-theme-muted" />
                      {seg.out ? faTime(seg.out.punchAt) : <span className="text-orange-500 text-xs">بدون خروج</span>}
                    </span>
                    <span className="text-theme-muted text-[11px] shrink-0">
                      {seg.out ? `دستگاه ${seg.out.deviceCode || seg.in.deviceCode || "—"}` : `دستگاه ${seg.in.deviceCode || "—"}`}
                    </span>
                  </div>
                ))}
                {segments.length === 0 && <div className="text-theme-muted text-sm">پانچی ثبت نشده</div>}
              </div>
              {detail.override && (
                <div className="mt-3 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                  اصلاح دستی توسط {detail.override.createdBy?.firstName} {detail.override.createdBy?.lastName}: {detail.override.reason}
                </div>
              )}
              {detail.override?.attachment && (
                <div className="mt-3">
                  <div className="text-xs text-theme-muted mb-1">مدرک پیوست‌شده</div>
                  <a href={attachmentUrl(detail.override.attachment)} target="_blank" rel="noopener noreferrer">
                    <img src={attachmentUrl(detail.override.attachment)} alt="مدرک پیوست‌شده" className="max-h-48 rounded-lg border border-theme hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}
            </div>
          )}

          {tab === "edit" && allowOverride && ov && setOv && (
            <div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">ورود</label>
                  {ov.clearCheckIn ? (
                    <div className="input-theme text-sm text-theme-muted flex items-center justify-center">حذف می‌شود</div>
                  ) : (
                    <TimeSelect value={ov.inTime} onChange={v => setOv(s => ({ ...s, inTime: v }))} />
                  )}
                  <label className="mt-1 flex items-center gap-1.5 text-[11px] text-red-500 cursor-pointer">
                    <input type="checkbox" checked={ov.clearCheckIn} onChange={e => setOv(s => ({ ...s, clearCheckIn: e.target.checked }))} />
                    حذف رکورد ورود
                  </label>
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">خروج</label>
                  {ov.clearCheckOut ? (
                    <div className="input-theme text-sm text-theme-muted flex items-center justify-center">حذف می‌شود</div>
                  ) : (
                    <TimeSelect value={ov.outTime} onChange={v => setOv(s => ({ ...s, outTime: v }))} />
                  )}
                  <label className="mt-1 flex items-center gap-1.5 text-[11px] text-red-500 cursor-pointer">
                    <input type="checkbox" checked={ov.clearCheckOut} onChange={e => setOv(s => ({ ...s, clearCheckOut: e.target.checked }))} />
                    حذف رکورد خروج
                  </label>
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">وضعیت (اختیاری)</label>
                  <select value={ov.status} onChange={e => setOv(s => ({ ...s, status: e.target.value }))} className="input-theme text-sm">
                    <option value="">— خودکار —</option>
                    {["PRESENT", "LEAVE", "SICK_LEAVE", "MISSION", "REMOTE_WORK", "ABSENT"].map(s => <option key={s} value={s}>{STATUS_FA[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">مرخصی ساعتی (ساعت)</label>
                  <input type="number" step="0.5" min="0" dir="ltr" value={ov.leaveHours} onChange={e => setOv(s => ({ ...s, leaveHours: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً 2" />
                  <label className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 cursor-pointer">
                    <input type="checkbox" checked={ov.isSickLeave} onChange={e => setOv(s => ({ ...s, isSickLeave: e.target.checked }))} />
                    استعلاجی (از موجودی جدا کسر شود)
                  </label>
                </div>
                {ov.isSickLeave && (
                  <div className="sm:col-span-2">
                    <label className="block mb-1 text-theme-secondary text-xs">
                      برگه مرخصی / گواهی پزشک <span className="text-red-500">* الزامی</span>
                    </label>
                    {ov.attachment ? (
                      <div className="flex items-start gap-2">
                        <a href={attachmentUrl(ov.attachment)} target="_blank" rel="noopener noreferrer">
                          <img src={attachmentUrl(ov.attachment)} alt="برگه مرخصی" className="h-24 rounded-lg border border-theme object-cover" />
                        </a>
                        <button type="button" onClick={() => setOv(s => ({ ...s, attachment: "" }))} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
                          <X className="w-3 h-3" /> حذف و انتخاب دوباره
                        </button>
                      </div>
                    ) : (
                      <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-xl px-4 py-4 text-sm text-theme-muted ${ovUploading ? "opacity-60" : "cursor-pointer hover:bg-theme-hover"}`}>
                        {ovUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {ovUploading ? "در حال بارگذاری..." : "انتخاب تصویر برگه مرخصی (JPG/PNG تا ۱۰ مگابایت)"}
                        <input type="file" accept="image/*" className="hidden" disabled={ovUploading} onChange={onPickOvAttachment} />
                      </label>
                    )}
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block mb-1 text-theme-secondary text-xs">دلیل</label>
                  <input value={ov.reason} onChange={e => setOv(s => ({ ...s, reason: e.target.value }))} className="input-theme text-sm" placeholder="دلیل اصلاح" />
                </div>
              </div>
              <button onClick={onSaveOverride} disabled={ovSaving || (ov.isSickLeave && !ov.attachment)} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
                <Pencil className="w-4 h-4" /> ذخیره اصلاح
              </button>
              <p className="mt-1 text-[11px] text-theme-muted">این اصلاح ثبت می‌شود و در پایش مجدد از بین نمی‌رود.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value, cls, help }: { label: string; value: string; cls?: string; help?: string }) {
  return (
    <div className="bg-theme-secondary/30 rounded-lg px-3 py-1.5">
      <div className="text-[11px] text-theme-muted flex items-center gap-1">
        {label}
        {help && <span title={help}><HelpCircle className="w-3 h-3 text-theme-muted/70 cursor-help" /></span>}
      </div>
      <div className={`font-medium ${cls || "text-theme-primary"}`} dir="ltr">{value}</div>
    </div>
  );
}
