"use client";
import React from "react";
import { Clock, Pencil, Info as InfoIcon, ListChecks } from "lucide-react";
import Modal from "../ui/Modal";
import TimeSelect from "../ui/TimeSelect";

const STATUS_FA: Record<string, string> = {
  PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص",
  LEAVE: "مرخصی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل",
  COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته",
};

const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => toFa(`${Math.floor(Math.abs(m || 0) / 60)}:${String(Math.abs(m || 0) % 60).padStart(2, "0")}`);
const faTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hour12: false }) : "—");
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone: "UTC" });

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
  ov?: { inTime: string; outTime: string; status: string; reason: string; leaveHours: string };
  setOv?: React.Dispatch<React.SetStateAction<{ inTime: string; outTime: string; status: string; reason: string; leaveHours: string }>>;
  onSaveOverride?: () => void;
  ovSaving?: boolean;
};

export default function DayDetailModal({ open, onClose, detail, allowOverride, ov, setOv, onSaveOverride, ovSaving }: Props) {
  const [tab, setTab] = React.useState<"summary" | "punches" | "edit">("summary");
  React.useEffect(() => { if (open) setTab("summary"); }, [open, detail?.row?.id]);

  const row = detail?.row;
  const note = row ? conversionNote(row) : null;

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

          {tab === "summary" && (
            <div>
              {note && (
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-3">
                  <ListChecks className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {note}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="وضعیت" value={STATUS_FA[row.status] || row.status} />
                <Info label="کارکرد" value={fmtMin(row.workedMinutes)} />
                <Info label="اضافه‌کار" value={fmtMin(row.overtimeMinutes)} />
                <Info label="تعطیل‌کاری" value={fmtMin(row.holidayOvertimeMinutes)} />
                <Info label="تاخیر" value={fmtMin(row.delayMinutes)} />
                <Info label="تعجیل" value={fmtMin(row.earlyLeaveMinutes)} />
                <Info label="کسری" value={fmtMin(row.deficitMinutes)} cls={row.deficitMinutes ? "text-orange-600" : undefined} />
                <Info label="شب‌کاری" value={fmtMin(row.nightMinutes)} />
                {row.leaveMinutes > 0 && (
                  <Info label="مرخصی" value={`${fmtMin(row.leaveMinutes)}${row.autoConvertedLeave ? " (خودکار)" : ""}`} cls="text-blue-600" />
                )}
              </div>
            </div>
          )}

          {tab === "punches" && (
            <div>
              <div className="text-sm font-medium text-theme-secondary mb-2 flex items-center gap-1">
                <Clock className="w-4 h-4" /> پانچ‌های خام ({faNum(detail.punches?.length || 0)})
              </div>
              <div className="space-y-1">
                {(detail.punches || []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-theme-secondary/30 rounded-lg px-3 py-1.5">
                    <span dir="ltr" className="text-theme-primary">{faTime(p.punchAt)}</span>
                    <span className="text-theme-muted text-xs">دستگاه {p.deviceCode || "—"} · کد {p.rType ?? "—"}</span>
                  </div>
                ))}
                {(!detail.punches || detail.punches.length === 0) && <div className="text-theme-muted text-sm">پانچی ثبت نشده</div>}
              </div>
              {detail.override && (
                <div className="mt-3 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-2">
                  اصلاح دستی توسط {detail.override.createdBy?.firstName} {detail.override.createdBy?.lastName}: {detail.override.reason}
                </div>
              )}
            </div>
          )}

          {tab === "edit" && allowOverride && ov && setOv && (
            <div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">ورود</label>
                  <TimeSelect value={ov.inTime} onChange={v => setOv(s => ({ ...s, inTime: v }))} />
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">خروج</label>
                  <TimeSelect value={ov.outTime} onChange={v => setOv(s => ({ ...s, outTime: v }))} />
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">وضعیت (اختیاری)</label>
                  <select value={ov.status} onChange={e => setOv(s => ({ ...s, status: e.target.value }))} className="input-theme text-sm">
                    <option value="">— خودکار —</option>
                    {["PRESENT", "LEAVE", "MISSION", "REMOTE_WORK", "ABSENT"].map(s => <option key={s} value={s}>{STATUS_FA[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-theme-secondary text-xs">مرخصی ساعتی (ساعت)</label>
                  <input type="number" step="0.5" min="0" dir="ltr" value={ov.leaveHours} onChange={e => setOv(s => ({ ...s, leaveHours: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً 2" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block mb-1 text-theme-secondary text-xs">دلیل</label>
                  <input value={ov.reason} onChange={e => setOv(s => ({ ...s, reason: e.target.value }))} className="input-theme text-sm" placeholder="دلیل اصلاح" />
                </div>
              </div>
              <button onClick={onSaveOverride} disabled={ovSaving} className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
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

function Info({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-theme-secondary/30 rounded-lg px-3 py-1.5">
      <div className="text-[11px] text-theme-muted">{label}</div>
      <div className={`font-medium ${cls || "text-theme-primary"}`} dir="ltr">{value}</div>
    </div>
  );
}
