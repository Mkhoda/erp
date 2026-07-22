"use client";
import React from "react";
import { pageTitle } from "../../../../lib/branding";
import {
  ShieldCheck, Loader2, Plus, Trash2, Pencil, ChevronRight, ChevronLeft,
  CalendarRange, LayoutGrid, Users as UsersIcon,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const WEEK = [
  { d: 6, name: "شنبه" }, { d: 0, name: "یکشنبه" }, { d: 1, name: "دوشنبه" },
  { d: 2, name: "سه‌شنبه" }, { d: 3, name: "چهارشنبه" }, { d: 4, name: "پنج‌شنبه" }, { d: 5, name: "جمعه" },
];
const FA_ORDER = [6, 0, 1, 2, 3, 4, 5];
const TYPE_FA: Record<string, string> = { TWENTY_FOUR_TWENTY_FOUR: "۲۴ کار / ۲۴ استراحت", TWENTY_FOUR_FORTY_EIGHT: "۲۴ کار / ۴۸ استراحت" };
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const faDigits = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const hoursOf = (min: number) => Math.round(((min || 0) / 60) * 100) / 100;

// ── Jalali ↔ Gregorian (jdf algorithm) — copy-pasted per project convention ──
function toJalali(gy0: number, gm: number, gd: number) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number, gy: number;
  if (gy0 > 1600) { jy = 979; gy = gy0 - 1600; } else { jy = 0; gy = gy0 - 621; }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + gdm[gm - 1];
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}
function jalaliToGregorian(jy0: number, jm: number, jd: number) {
  let gy: number, jy: number;
  if (jy0 > 979) { gy = 1600; jy = jy0 - 979; } else { gy = 621; jy = jy0; }
  let days = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const sal = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  for (; gm <= 12; gm++) { if (gd <= sal[gm]) break; gd -= sal[gm]; }
  return new Date(Date.UTC(gy, gm - 1, gd));
}
const jMonthLen = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jy % 4 === 3 ? 30 : 29);
const todayJ = () => { const t = new Date(); return toJalali(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const isoDate = (jy: number, jm: number, jd: number) => {
  const g = jalaliToGregorian(jy, jm, jd);
  return `${g.getUTCFullYear()}-${String(g.getUTCMonth() + 1).padStart(2, "0")}-${String(g.getUTCDate()).padStart(2, "0")}`;
};

function JalaliDateSelect({ jy, jm, jd, onChange, yearsBack = 1, yearsFwd = 2 }:
  { jy: number; jm: number; jd: number; onChange: (jy: number, jm: number, jd: number) => void; yearsBack?: number; yearsFwd?: number }) {
  const { jy: ty } = todayJ();
  const years = Array.from({ length: yearsBack + yearsFwd + 1 }, (_, i) => ty - yearsBack + i);
  const upd = (ny: number, nm: number, nd: number) => { if (!ny || !nm || !nd) return; onChange(ny, nm, Math.min(nd, jMonthLen(ny, nm))); };
  return (
    <div className="flex gap-2" dir="ltr">
      <select value={jy || ""} onChange={e => upd(+e.target.value, jm, jd || 1)} className="input-theme text-sm text-center flex-1">
        {!jy && <option value="">سال</option>}
        {years.map(y => <option key={y} value={y}>{faDigits(String(y))}</option>)}
      </select>
      <select value={jm || ""} onChange={e => upd(jy, +e.target.value, jd || 1)} className="input-theme text-sm text-center flex-1">
        {!jm && <option value="">ماه</option>}
        {J_MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
      </select>
      <select value={jd || ""} onChange={e => upd(jy, jm, +e.target.value)} className="input-theme text-sm text-center flex-1">
        {!jd && <option value="">روز</option>}
        {Array.from({ length: jy && jm ? jMonthLen(jy, jm) : 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{faDigits(String(d))}</option>)}
      </select>
    </div>
  );
}

const TEMPLATE_DEFAULTS = { name: "", type: "TWENTY_FOUR_TWENTY_FOUR", dutyHours: 24, fullCreditHours: 23, absentBelowHours: 2, isActive: true };

export default function GuardShiftsPage() {
  React.useEffect(() => { document.title = pageTitle("شیفت‌های نگهبانی"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [tab, setTab] = React.useState<"templates" | "assignments" | "calendar">("templates");
  const [shifts, setShifts] = React.useState<any[]>([]);
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, u] = await Promise.all([
        fetch(`${API}/attendance/guard-shifts`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/attendance/guard-shifts/assignments`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []),
      ]);
      setShifts(Array.isArray(s) ? s : []);
      setAssignments(Array.isArray(a) ? a : []);
      setUsers(Array.isArray(u) ? u : []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const personOptions = users.map((u: any) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}${u.attendanceCardNo ? ` (${u.attendanceCardNo})` : ""}`,
    search: `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`,
  }));

  // ── Templates ──
  const [tplModal, setTplModal] = React.useState<any>(null); // { id?, ...form }
  const [tplSaving, setTplSaving] = React.useState(false);

  function openNewTemplate() { setTplModal({ ...TEMPLATE_DEFAULTS }); }
  function openEditTemplate(s: any) {
    setTplModal({ id: s.id, name: s.name, type: s.type, dutyHours: hoursOf(s.dutyMinutes), fullCreditHours: hoursOf(s.fullCreditMinutes), absentBelowHours: hoursOf(s.absentBelowMinutes), isActive: s.isActive });
  }
  async function saveTemplate() {
    setTplSaving(true);
    try {
      const body = JSON.stringify({
        name: tplModal.name, type: tplModal.type, isActive: tplModal.isActive,
        dutyMinutes: Math.round(Number(tplModal.dutyHours) * 60),
        fullCreditMinutes: Math.round(Number(tplModal.fullCreditHours) * 60),
        absentBelowMinutes: Math.round(Number(tplModal.absentBelowHours) * 60),
      });
      const url = tplModal.id ? `${API}/attendance/guard-shifts/${tplModal.id}` : `${API}/attendance/guard-shifts`;
      await fetch(url, { method: tplModal.id ? "PUT" : "POST", headers: h, body });
      setTplModal(null); await load();
    } finally { setTplSaving(false); }
  }
  async function removeTemplate(id: string) {
    if (!confirm("این قالب شیفت حذف شود؟ انتساب‌ها و تقویم مرتبط هم حذف می‌شوند.")) return;
    await fetch(`${API}/attendance/guard-shifts/${id}`, { method: "DELETE", headers: h });
    await load();
  }

  // ── Assignments ──
  const tj = todayJ();
  const [assignForm, setAssignForm] = React.useState<any>({ userId: "", shiftId: "", start: { jy: tj.jy, jm: tj.jm, jd: tj.jd }, hasEnd: false, end: { jy: tj.jy, jm: tj.jm, jd: tj.jd } });
  const [assignSaving, setAssignSaving] = React.useState(false);

  async function createAssignment() {
    if (!assignForm.userId || !assignForm.shiftId) { alert("کاربر و قالب شیفت را انتخاب کنید"); return; }
    setAssignSaving(true);
    try {
      const body = JSON.stringify({
        userId: assignForm.userId, shiftId: assignForm.shiftId,
        startDate: isoDate(assignForm.start.jy, assignForm.start.jm, assignForm.start.jd),
        endDate: assignForm.hasEnd ? isoDate(assignForm.end.jy, assignForm.end.jm, assignForm.end.jd) : undefined,
      });
      await fetch(`${API}/attendance/guard-shifts/assignments`, { method: "POST", headers: h, body });
      setAssignForm({ userId: "", shiftId: "", start: { jy: tj.jy, jm: tj.jm, jd: tj.jd }, hasEnd: false, end: { jy: tj.jy, jm: tj.jm, jd: tj.jd } });
      await load();
    } finally { setAssignSaving(false); }
  }
  async function removeAssignment(id: string) {
    if (!confirm("این انتساب حذف شود؟")) return;
    await fetch(`${API}/attendance/guard-shifts/assignments/${id}`, { method: "DELETE", headers: h });
    await load();
  }

  // ── Calendar ──
  const guardOptions = React.useMemo(() => {
    const ids = new Set(assignments.map((a: any) => a.userId));
    return personOptions.filter(p => ids.has(p.id));
  }, [assignments, personOptions]);
  const [guardUserId, setGuardUserId] = React.useState("");
  const [vy, setVy] = React.useState(tj.jy);
  const [vm, setVm] = React.useState(tj.jm);
  const [calDays, setCalDays] = React.useState<any[]>([]);
  const [calLoading, setCalLoading] = React.useState(false);
  const [calBusy, setCalBusy] = React.useState<string | null>(null);

  const loadCalendar = React.useCallback(async () => {
    if (!guardUserId) { setCalDays([]); return; }
    setCalLoading(true);
    try {
      const r = await fetch(`${API}/attendance/guard-shifts/calendar?userId=${guardUserId}&jYear=${vy}&jMonth=${vm}`, { headers: h }).then(x => x.ok ? x.json() : []);
      setCalDays(Array.isArray(r) ? r : []);
    } finally { setCalLoading(false); }
    // eslint-disable-next-line
  }, [guardUserId, vy, vm]);
  React.useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const markedSet = React.useMemo(() => new Set(calDays.map((d: any) => d.gregDate.slice(0, 10))), [calDays]);

  async function toggleDay(jd: number) {
    if (!guardUserId) return;
    const date = isoDate(vy, vm, jd);
    setCalBusy(date);
    try {
      if (markedSet.has(date)) {
        await fetch(`${API}/attendance/guard-shifts/calendar?userId=${guardUserId}&date=${date}`, { method: "DELETE", headers: h });
      } else {
        await fetch(`${API}/attendance/guard-shifts/calendar`, { method: "POST", headers: h, body: JSON.stringify({ userId: guardUserId, date }) });
      }
      await loadCalendar();
    } finally { setCalBusy(null); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  const len = jMonthLen(vy, vm);
  const firstGreg = jalaliToGregorian(vy, vm, 1);
  const lead = FA_ORDER.indexOf(firstGreg.getUTCDay());
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-white" /></div>
        <div><h1 className="text-xl font-bold text-theme-primary">شیفت‌های نگهبانی</h1><p className="text-sm text-theme-muted">شیفت‌های ۲۴ ساعته با استراحت متغیر (۲۴/۲۴ یا ۲۴/۴۸) — تقویم حضور به‌صورت دستی توسط سرپرست مشخص می‌شود</p></div>
      </div>

      <div className="flex items-center gap-1 bg-theme-card border border-theme rounded-xl p-1 w-fit">
        {([["templates", "قالب‌های شیفت", LayoutGrid], ["assignments", "انتساب نگهبان‌ها", UsersIcon], ["calendar", "تقویم حضور", CalendarRange]] as const).map(([k, lbl, Ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === k ? "bg-blue-600 text-white" : "text-theme-muted hover:bg-theme-hover"}`}>
            <Ic className="w-4 h-4" /> {lbl}
          </button>
        ))}
      </div>

      {/* ── Templates tab ── */}
      {tab === "templates" && (
        <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-theme-primary text-sm">قالب‌های شیفت</h2>
            <button onClick={openNewTemplate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs"><Plus className="w-3.5 h-3.5" /> قالب جدید</button>
          </div>
          {shifts.length === 0 ? <p className="text-theme-muted text-sm">هنوز قالب شیفتی تعریف نشده</p> : (
            <div className="space-y-2">
              {shifts.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between border border-theme rounded-lg px-3 py-2 text-sm">
                  <div>
                    <div className="text-theme-primary font-medium">{s.name} {!s.isActive && <span className="text-[10px] text-theme-muted">(غیرفعال)</span>}</div>
                    <div className="text-theme-muted text-xs mt-0.5">
                      {TYPE_FA[s.type] || s.type} · موظفی {faNum(hoursOf(s.dutyMinutes))} ساعت · آستانه‌ی کامل ≥ {faNum(hoursOf(s.fullCreditMinutes))} ساعت · آستانه‌ی غیبت &lt; {faNum(hoursOf(s.absentBelowMinutes))} ساعت
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditTemplate(s)} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-primary"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeTemplate(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Assignments tab ── */}
      {tab === "assignments" && (
        <div className="space-y-4">
          <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-theme-primary text-sm">انتساب جدید</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">نگهبان</label>
                <SearchSelect options={personOptions} value={assignForm.userId} onChange={v => setAssignForm((s: any) => ({ ...s, userId: v }))} searchKey="search" placeholder="جستجوی شخص" />
              </div>
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">قالب شیفت</label>
                <select value={assignForm.shiftId} onChange={e => setAssignForm((s: any) => ({ ...s, shiftId: e.target.value }))} className="input-theme text-sm">
                  <option value="">انتخاب کنید</option>
                  {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">از تاریخ</label>
                <JalaliDateSelect {...assignForm.start} onChange={(jy, jm, jd) => setAssignForm((s: any) => ({ ...s, start: { jy, jm, jd } }))} />
              </div>
              <div>
                <label className="flex items-center gap-2 mb-1 text-theme-secondary text-xs">
                  <input type="checkbox" checked={assignForm.hasEnd} onChange={e => setAssignForm((s: any) => ({ ...s, hasEnd: e.target.checked }))} /> تا تاریخ (اختیاری)
                </label>
                <JalaliDateSelect {...assignForm.end} onChange={(jy, jm, jd) => setAssignForm((s: any) => ({ ...s, end: { jy, jm, jd } }))} />
              </div>
            </div>
            <button onClick={createAssignment} disabled={assignSaving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
              {assignSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} ثبت انتساب
            </button>
          </div>

          <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-2">
            <h2 className="font-semibold text-theme-primary text-sm mb-1">انتساب‌های فعلی</h2>
            {assignments.length === 0 ? <p className="text-theme-muted text-sm">انتسابی ثبت نشده</p> : assignments.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between border border-theme rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="text-theme-primary font-medium">{a.user?.firstName} {a.user?.lastName}</span>
                  <span className="text-theme-muted text-xs mr-2">{a.shift?.name} · از {faDigits(new Date(a.startDate).toLocaleDateString("fa-IR", { timeZone: "UTC" }))}{a.endDate ? ` تا ${faDigits(new Date(a.endDate).toLocaleDateString("fa-IR", { timeZone: "UTC" }))}` : " (بدون پایان)"}</span>
                </div>
                <button onClick={() => removeAssignment(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Calendar tab ── */}
      {tab === "calendar" && (
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <div className="mb-3">
            <label className="block mb-1 text-theme-secondary text-xs">نگهبان</label>
            <SearchSelect options={guardOptions} value={guardUserId} onChange={setGuardUserId} searchKey="search" placeholder="یک نگهبان انتخاب کنید" className="max-w-xs" />
          </div>
          {!guardUserId ? (
            <p className="text-theme-muted text-sm">برای نمایش و تنظیم تقویم، ابتدا یک نگهبان انتخاب کنید.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => { if (vm === 1) { setVm(12); setVy(y => y - 1); } else setVm(m => m - 1); }} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted"><ChevronRight className="w-4 h-4" /></button>
                <div className="font-bold text-theme-primary">{J_MONTHS[vm - 1]} {faDigits(String(vy))}</div>
                <button onClick={() => { if (vm === 12) { setVm(1); setVy(y => y + 1); } else setVm(m => m + 1); }} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted"><ChevronLeft className="w-4 h-4" /></button>
              </div>
              {calLoading ? <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div> : (
                <>
                  <div className="grid grid-cols-7 mb-1">{WEEK.map(w => <div key={w.d} className="text-center text-[11px] font-medium text-theme-muted py-1">{w.name.slice(0, 1)}</div>)}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />;
                      const date = isoDate(vy, vm, day);
                      const onDuty = markedSet.has(date);
                      const isToday = vy === tj.jy && vm === tj.jm && day === tj.jd;
                      const busy = calBusy === date;
                      return (
                        <button key={i} disabled={busy} onClick={() => toggleDay(day)}
                          className={`relative text-center rounded-lg border p-2 min-h-[50px] flex flex-col items-center justify-center gap-0.5 hover:ring-1 hover:ring-blue-400 transition-all disabled:opacity-50
                            ${onDuty ? "bg-emerald-500/10 border-emerald-500/40" : "bg-theme-primary border-theme"} ${isToday ? "ring-2 ring-blue-500" : ""}`}>
                          <span className={`text-xs font-bold ${onDuty ? "text-emerald-600" : "text-theme-primary"}`}>{faNum(day)}</span>
                          {busy ? <Loader2 className="w-3 h-3 animate-spin text-theme-muted" /> : onDuty && <span className="text-[9px] text-emerald-600">شیفت</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-theme-muted">روی هر روز کلیک کنید تا آن روز به‌عنوان شروع شیفت (روشن) ثبت یا حذف شود. روزهای بدون علامت، استراحت محسوب می‌شوند.</p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Template modal ── */}
      <Modal open={!!tplModal} onClose={() => setTplModal(null)} title={tplModal?.id ? "ویرایش قالب شیفت" : "قالب شیفت جدید"} size="md"
        footer={<>
          <button onClick={() => setTplModal(null)} className="btn-theme-secondary text-sm">انصراف</button>
          <button onClick={saveTemplate} disabled={tplSaving} className="btn-theme-primary text-sm disabled:opacity-50">{tplSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}</button>
        </>}>
        {tplModal && (
          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-theme-secondary text-xs">نام</label>
              <input value={tplModal.name} onChange={e => setTplModal((s: any) => ({ ...s, name: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً نگهبانی ۲۴/۴۸" />
            </div>
            <div>
              <label className="block mb-1 text-theme-secondary text-xs">نوع چرخش (فقط جهت مرجع — اثری در محاسبه ندارد)</label>
              <select value={tplModal.type} onChange={e => setTplModal((s: any) => ({ ...s, type: e.target.value }))} className="input-theme text-sm">
                <option value="TWENTY_FOUR_TWENTY_FOUR">۲۴ کار / ۲۴ استراحت</option>
                <option value="TWENTY_FOUR_FORTY_EIGHT">۲۴ کار / ۴۸ استراحت</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">موظفی شیفت (ساعت)</label>
                <input type="number" step="0.5" min="1" dir="ltr" value={tplModal.dutyHours} onChange={e => setTplModal((s: any) => ({ ...s, dutyHours: e.target.value }))} className="input-theme text-sm" />
              </div>
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">آستانه‌ی حضور کامل (ساعت)</label>
                <input type="number" step="0.5" min="0" dir="ltr" value={tplModal.fullCreditHours} onChange={e => setTplModal((s: any) => ({ ...s, fullCreditHours: e.target.value }))} className="input-theme text-sm" />
              </div>
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">آستانه‌ی غیبت کامل (ساعت)</label>
                <input type="number" step="0.5" min="0" dir="ltr" value={tplModal.absentBelowHours} onChange={e => setTplModal((s: any) => ({ ...s, absentBelowHours: e.target.value }))} className="input-theme text-sm" />
              </div>
            </div>
            <p className="text-[11px] text-theme-muted">کارکرد ≥ آستانه‌ی کامل → بدون کسری. کمتر از آستانه‌ی غیبت → غیبت کامل. بین این دو → کسری متناسب.</p>
            <label className="flex items-center gap-2 text-sm text-theme-primary">
              <input type="checkbox" checked={tplModal.isActive} onChange={e => setTplModal((s: any) => ({ ...s, isActive: e.target.checked }))} /> فعال
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
