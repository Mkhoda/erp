"use client";
import React from "react";
import Link from "next/link";
import { pageTitle } from "../../../../../lib/branding";
import { ArrowLeft, Loader2, Save, Fingerprint, Paperclip, AlertCircle, CheckCircle } from "lucide-react";
import SearchSelect from "../../../../components/ui/SearchSelect";
import JalaliDatePicker from "../../../../components/ui/JalaliDatePicker";
import TimeSelect from "../../../../components/ui/TimeSelect";
import { useToast } from "../../../../components/ui/Toast";
import { usePagePerms } from "../../../../../lib/permissions";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_FA: Record<string, string> = { PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص", LEAVE: "مرخصی", SICK_LEAVE: "استعلاجی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل", COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته", OFF_DUTY: "استراحت (شیفت)" };
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => { const h = Math.floor(Math.abs(m || 0) / 60); const mm = Math.abs(m || 0) % 60; return toFa(`${h}:${String(mm).padStart(2, "0")}`); };
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hour12: false }) : "—";
const toHHmm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hour12: false }) : "";
// Today's Tehran calendar date as Gregorian YYYY-MM-DD (what the API's parseWorkDate expects).
const todayTehran = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());

type Form = { inTime: string; outTime: string; clearCheckIn: boolean; clearCheckOut: boolean; status: string; leaveHours: string; isSickLeave: boolean; attachment: string; reason: string };
const EMPTY: Form = { inTime: "", outTime: "", clearCheckIn: false, clearCheckOut: false, status: "", leaveHours: "", isSickLeave: false, attachment: "", reason: "" };

// Manual entry of a day's check-in/check-out (and optional status/leave). Writes an
// AttendanceOverride (POST /attendance/manual-entry — same mechanics as the day-detail
// edit, but gated by the page's "ثبت" flag), so the engine recomputes the day immediately.
export default function NewAttendanceRecordPage() {
  React.useEffect(() => { document.title = pageTitle("ثبت دستی ورود و خروج"); }, []);
  const toast = useToast();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [users, setUsers] = React.useState<any[]>([]);
  const [userId, setUserId] = React.useState("");
  const [date, setDate] = React.useState(todayTehran);
  const [detail, setDetail] = React.useState<any>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [f, setF] = React.useState<Form>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  // Manual entry needs the records page's separate "ثبت" flag (POST /attendance/manual-entry).
  const perms = usePagePerms("/dashboard/attendance/records");

  // ?userId=&date= prefill (read after mount so server and client render the same first frame).
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("userId")) setUserId(q.get("userId")!);
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get("date") || "")) setDate(q.get("date")!);
  }, []);

  React.useEffect(() => {
    fetch(`${API}/users/brief`, { headers: h }).then(r => r.ok ? r.json() : []).then(u => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  // Load what the day currently looks like and prefill the form from it. The
  // latest override fully replaces any earlier one, so its status/leave are
  // carried into the form — saving only new times must not silently drop them.
  const loadDetail = React.useCallback(async () => {
    if (!userId || !date) { setDetail(null); setF(EMPTY); return; }
    setDetailLoading(true);
    try {
      const d = await fetch(`${API}/attendance/records/day?userId=${userId}&date=${date}`, { headers: h }).then(r => r.ok ? r.json() : null);
      setDetail(d);
      const o = d?.override;
      setF({
        ...EMPTY,
        inTime: toHHmm(d?.day?.firstCheckIn ?? null),
        outTime: toHHmm(d?.day?.lastCheckOut ?? null),
        status: o?.forceStatus || "",
        leaveHours: o?.leaveMinutes ? String(+(o.leaveMinutes / 60).toFixed(2)) : "",
        isSickLeave: !!o?.isSickLeave && !!o?.leaveMinutes,
        attachment: o?.attachment || "",
      });
    } finally { setDetailLoading(false); }
    // eslint-disable-next-line
  }, [userId, date]);
  React.useEffect(() => { loadDetail(); setError(""); }, [loadDetail]);

  async function onPickAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/attendance/me/requests/attachment`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) { const e2 = await res.json().catch(() => ({})); toast.error(e2.message || "خطا در آپلود عکس"); return; }
      const d = await res.json();
      setF(s => ({ ...s, attachment: d.url }));
    } catch { toast.error("خطا در آپلود عکس"); }
    finally { setUploading(false); }
  }

  async function save() {
    setError("");
    if (!userId) { setError("شخص را انتخاب کنید"); return; }
    if (!date) { setError("تاریخ را انتخاب کنید"); return; }
    const hasIn = !f.clearCheckIn && !!f.inTime, hasOut = !f.clearCheckOut && !!f.outTime;
    if (!hasIn && !hasOut && !f.clearCheckIn && !f.clearCheckOut && !f.status && !f.leaveHours) {
      setError("حداقل یکی از ساعت ورود، ساعت خروج، وضعیت یا مرخصی را وارد کنید"); return;
    }
    if (f.leaveHours && !(Number(f.leaveHours) > 0)) { setError("ساعت مرخصی نامعتبر است"); return; }
    const sick = f.isSickLeave || f.status === "SICK_LEAVE";
    if (sick && !f.attachment) { setError("برای مرخصی استعلاجی، بارگذاری تصویر برگه مرخصی (گواهی پزشک) الزامی است"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/attendance/manual-entry`, {
        method: "POST", headers: h,
        body: JSON.stringify({
          userId, date,
          inTime: f.clearCheckIn ? undefined : (f.inTime || undefined),
          outTime: f.clearCheckOut ? undefined : (f.outTime || undefined),
          clearCheckIn: f.clearCheckIn || undefined,
          clearCheckOut: f.clearCheckOut || undefined,
          forceStatus: f.status || undefined,
          leaveMinutes: f.leaveHours ? Math.round(Number(f.leaveHours) * 60) : undefined,
          isSickLeave: sick || undefined,
          attachment: sick ? f.attachment : undefined,
          reason: f.reason.trim() || "ثبت دستی توسط مدیر",
        }),
      });
      if (!res.ok) { const e2 = await res.json().catch(() => ({})); setError(e2.message || "ثبت رکورد ناموفق بود"); return; }
      toast.success("رکورد ثبت و کارکرد روز دوباره محاسبه شد");
      await loadDetail();
    } catch { setError("ثبت رکورد ناموفق بود"); }
    finally { setSaving(false); }
  }

  const personOptions = users.map((u: any) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}${u.attendanceCardNo ? ` (${u.attendanceCardNo})` : ""}`,
    search: `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`,
  }));
  const day = detail?.day;
  const punches: any[] = detail?.punches || [];
  const sickNeeded = f.isSickLeave || f.status === "SICK_LEAVE";

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Fingerprint className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">ثبت دستی ورود و خروج</h1>
            <p className="text-sm text-theme-muted">ثبت یا اصلاح ساعت ورود/خروج، وضعیت و مرخصی یک روز</p>
          </div>
        </div>
        <Link href="/dashboard/attendance/records" className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><ArrowLeft className="w-4 h-4" /> کارکرد روزانه</Link>
      </div>

      {perms && !perms.canCreate ? (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0" /> شما مجوز ثبت دستی ورود و خروج را ندارید. این دسترسی از صفحه «دسترسی صفحات» (گزینه‌ی «ثبت» برای کارکرد روزانه) داده می‌شود.
        </div>
      ) : (<>
      {/* Who + when */}
      <div className="bg-theme-card border border-theme rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-sm text-theme-secondary">شخص</span>
          <SearchSelect options={personOptions} value={userId} onChange={setUserId} searchKey="search" placeholder="جستجوی شخص (نام/موبایل/کارت)" />
        </div>
        <div className="space-y-1">
          <span className="text-sm text-theme-secondary">تاریخ</span>
          <JalaliDatePicker value={date} onChange={setDate} />
        </div>
      </div>

      {/* Current state of the selected day */}
      {userId && date && (
        <div className="bg-theme-card border border-theme rounded-xl p-4 text-sm">
          {detailLoading ? (
            <div className="flex items-center justify-center h-16"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="text-theme-muted">وضعیت فعلی: <span className="text-theme-primary font-medium">{day ? (STATUS_FA[day.status] || day.status) : "رکوردی ثبت نشده"}</span></span>
                {day && <>
                  <span className="text-theme-muted">ورود: <span className="text-theme-primary" dir="ltr">{faTime(day.firstCheckIn)}</span></span>
                  <span className="text-theme-muted">خروج: <span className="text-theme-primary" dir="ltr">{faTime(day.lastCheckOut)}</span></span>
                  <span className="text-theme-muted">کارکرد: <span className="text-theme-primary" dir="ltr">{fmtMin(day.workedMinutes)}</span></span>
                  {day.deficitMinutes > 0 && <span className="text-theme-muted">کسری: <span className="text-orange-600" dir="ltr">{fmtMin(day.deficitMinutes)}</span></span>}
                </>}
              </div>
              <div className="text-theme-muted">
                پانچ‌های دستگاه ({toFa(String(punches.length))}):{" "}
                {punches.length ? punches.map(p => <span key={p.id} className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-theme-secondary/50 text-theme-primary text-xs" dir="ltr">{faTime(p.punchAt)}</span>) : "—"}
              </div>
              {detail?.override && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>این روز قبلاً توسط {detail.override.createdBy ? `${detail.override.createdBy.firstName} ${detail.override.createdBy.lastName}` : "مدیر"} اصلاح شده ({detail.override.reason}). ثبت جدید جایگزین آن می‌شود؛ مقادیر قبلی در فرم پر شده‌اند.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Entry form */}
      <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-sm text-theme-secondary">ساعت ورود</span>
            <TimeSelect value={f.inTime} onChange={v => setF(s => ({ ...s, inTime: v }))} disabled={f.clearCheckIn} />
            <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer w-fit">
              <input type="checkbox" checked={f.clearCheckIn} onChange={e => setF(s => ({ ...s, clearCheckIn: e.target.checked }))} /> حذف ورود این روز
            </label>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-theme-secondary">ساعت خروج</span>
            <TimeSelect value={f.outTime} onChange={v => setF(s => ({ ...s, outTime: v }))} disabled={f.clearCheckOut} />
            <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer w-fit">
              <input type="checkbox" checked={f.clearCheckOut} onChange={e => setF(s => ({ ...s, clearCheckOut: e.target.checked }))} /> حذف خروج این روز
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-sm text-theme-secondary">وضعیت (اختیاری)</span>
            <select className="input-theme text-sm" value={f.status} onChange={e => setF(s => ({ ...s, status: e.target.value }))}>
              <option value="">محاسبه خودکار</option>
              {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-sm text-theme-secondary">مرخصی ساعتی (ساعت، اختیاری)</span>
            <input type="number" min={0} step={0.25} dir="ltr" className="input-theme text-sm" value={f.leaveHours} onChange={e => setF(s => ({ ...s, leaveHours: e.target.value }))} placeholder="مثلاً 1.5" />
            {f.leaveHours && (
              <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer w-fit">
                <input type="checkbox" checked={f.isSickLeave} onChange={e => setF(s => ({ ...s, isSickLeave: e.target.checked }))} /> استعلاجی
              </label>
            )}
          </div>
        </div>

        {sickNeeded && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme cursor-pointer text-theme-primary ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} تصویر گواهی پزشک
              <input type="file" accept="image/*" className="hidden" onChange={onPickAttachment} />
            </label>
            {f.attachment
              ? <a href={f.attachment} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> بارگذاری شد</a>
              : <span className="text-xs text-theme-muted">الزامی برای مرخصی استعلاجی</span>}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-theme-secondary">توضیحات / دلیل</span>
          <input className="input-theme text-sm" value={f.reason} onChange={e => setF(s => ({ ...s, reason: e.target.value }))} placeholder="مثلاً فراموشی ثبت کارت" />
        </label>

        <div className="flex items-center justify-end gap-2">
          <Link href="/dashboard/attendance/records" className="btn-theme-secondary text-sm">انصراف</Link>
          <button onClick={save} disabled={saving || uploading} className="btn-theme-primary text-sm flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ثبت رکورد
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
