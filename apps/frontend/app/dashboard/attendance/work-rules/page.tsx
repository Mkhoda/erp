"use client";
import React from "react";
import { pageTitle } from "../../../../lib/branding";
import {
  Save, Loader2, SlidersHorizontal, CalendarDays, Timer, Plus, Trash2, Users,
  CalendarRange, LayoutGrid, List, Settings, Activity, ChevronRight, ChevronLeft, X,
} from "lucide-react";
import Modal from "../../../components/ui/Modal";
import TimeSelect from "../../../components/ui/TimeSelect";
import AttendanceSettingsPage from "../settings/page";
import SyncMonitorPage from "../sync/page";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const inputCls = "w-full bg-theme-primary border border-theme rounded-lg px-3 py-2 text-theme-primary text-sm focus:outline-none focus:border-blue-500";
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const hrs = (m: number) => (m ? `≈ ${faNum(Math.round((m / 60) * 10) / 10)} ساعت` : "");

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
// JS getDay(): Sat=6 .. Fri=5. Persian week starts Saturday.
const WEEK = [
  { d: 6, name: "شنبه" }, { d: 0, name: "یکشنبه" }, { d: 1, name: "دوشنبه" },
  { d: 2, name: "سه‌شنبه" }, { d: 3, name: "چهارشنبه" }, { d: 4, name: "پنج‌شنبه" }, { d: 5, name: "جمعه" },
];
const FA_ORDER = [6, 0, 1, 2, 3, 4, 5];
const HOLIDAY_TYPES: Array<{ k: string; fa: string; color: string }> = [
  { k: "OFFICIAL", fa: "رسمی", color: "#ef4444" },
  { k: "COMPANY", fa: "شرکتی", color: "#a855f7" },
  { k: "CALENDAR", fa: "تقویمی", color: "#f97316" },
];
const TYPE_FA: Record<string, string> = { OFFICIAL: "رسمی", COMPANY: "شرکتی", CALENDAR: "تقویمی", HALF_DAY: "نیم‌روز" };
const NEW_DEFAULTS = {
  name: "", isDefault: false, dailyMinutes: 500, lunchMinutes: 0,
  checkInStart: "06:30", checkInEnd: "09:00", checkOutStart: "14:50", checkOutEnd: "17:20", workDays: [6, 0, 1, 2, 3],
  otMinThreshold: 30, otRounding: 15, otMaxDaily: 240, otMaxMonthly: 3600, annualLeaveDays: 26,
  deficitToLeaveEnabled: true, hourlyLeaveCapMinutes: 480, absentToLeaveEnabled: true,
};

// ── Jalali ↔ Gregorian (jdf algorithm) ─────────────────────────────────────
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
  return new Date(gy, gm - 1, gd);
}
const jMonthLen = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : jy % 4 === 3 ? 30 : 29);
const todayJ = () => { const t = new Date(); return toJalali(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
const ymdUTC = (iso: string) => { const d = new Date(iso); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
const ymdLocal = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (<label className="block"><span className="text-sm text-theme-muted mb-1 block">{label} {hint && <span className="text-[11px] text-blue-500">{hint}</span>}</span>{children}</label>);
}
function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (<div className="bg-theme-card border border-theme rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-theme-primary">{title}</h2></div>{children}</div>);
}

export default function WorkRulesPage() {
  React.useEffect(() => { document.title = pageTitle("قوانین و تقویم کاری"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [list, setList] = React.useState<any[]>([]);
  const [selId, setSelId] = React.useState<string>("");
  const [form, setForm] = React.useState<any>(null);
  const [holidays, setHolidays] = React.useState<any[]>([]);
  const [overrides, setOverrides] = React.useState<any[]>([]);
  const [tab, setTab] = React.useState<"calendar" | "settings" | "agenda">("calendar");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const tj = todayJ();
  const [vy, setVy] = React.useState(tj.jy);
  const [vm, setVm] = React.useState(tj.jm);

  const [dayModal, setDayModal] = React.useState<any>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [syncOpen, setSyncOpen] = React.useState(false);

  const group = list.find(g => g.id === selId);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [rows, hol, ov] = await Promise.all([
        fetch(`${API}/attendance/work-schedules`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/attendance/holidays`, { headers: h }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/attendance/schedule-overrides`, { headers: h }).then(r => r.ok ? r.json() : []),
      ]);
      setList(Array.isArray(rows) ? rows : []);
      setHolidays(Array.isArray(hol) ? hol : []);
      setOverrides(Array.isArray(ov) ? ov : []);
      setSelId(prev => prev || (rows[0]?.id ?? ""));
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { loadAll(); }, [loadAll]);
  React.useEffect(() => { if (group) setForm(group); }, [selId]); // eslint-disable-line

  const groupName = (id: string) => { const g = list.find(x => x.id === id); return g ? (g.isDefault ? "پیش‌فرض" : g.name) : id.slice(0, 6); };

  // ── Day status for the selected group ──
  function dayInfo(day: number) {
    const greg = jalaliToGregorian(vy, vm, day);
    const dow = greg.getDay();
    const gn = ymdLocal(greg);
    const inGroup = (ids?: string[]) => !ids?.length || (group && ids.includes(group.id));
    const holiday = holidays.find((x: any) => {
      if (!inGroup(x.scheduleIds)) return false;
      if (x.recurring) { const j = toJalali(greg.getFullYear(), greg.getMonth() + 1, greg.getDate()); return x.jMonth === j.jm && x.jDay === j.jd; }
      return gn >= ymdUTC(x.startDate) && gn <= ymdUTC(x.endDate);
    });
    const override = overrides.find((x: any) => inGroup(x.scheduleIds) && (!x.weekdays?.length || x.weekdays.includes(dow)) && gn >= ymdUTC(x.startDate) && gn <= ymdUTC(x.endDate));
    const isWeekend = !(group?.workDays || []).includes(dow);
    return { greg, dow, holiday, override, isWeekend };
  }

  // ── Schedule form save / group CRUD ──
  const setF = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => setForm((f: any) => { const cur: number[] = f.workDays || []; return { ...f, workDays: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] }; });
  async function saveSchedule() {
    if (selId === "new" && !form.name?.trim()) { setMsg("نام گروه را وارد کنید"); return; }
    setSaving(true); setMsg(null);
    try {
      const url = selId === "new" ? `${API}/attendance/work-schedules` : `${API}/attendance/work-schedules/${selId}`;
      const res = await fetch(url, { method: selId === "new" ? "POST" : "PUT", headers: h, body: JSON.stringify(form) });
      if (res.ok) { const saved = await res.json(); setMsg("ذخیره شد — در حال بازمحاسبه"); await loadAll(); setSelId(saved.id); setForm(saved); }
      else { const e = await res.json().catch(() => ({})); setMsg(e.message || "خطا در ذخیره"); }
    } finally { setSaving(false); setTimeout(() => setMsg(null), 6000); }
  }
  async function removeGroup() {
    if (!form?.id || form.isDefault) return;
    if (!confirm(`گروه «${form.name}» حذف شود؟ اعضای آن به برنامهٔ پیش‌فرض منتقل می‌شوند.`)) return;
    await fetch(`${API}/attendance/work-schedules/${form.id}`, { method: "DELETE", headers: h });
    setSelId(list[0]?.id || ""); await loadAll();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  const len = jMonthLen(vy, vm);
  const firstGreg = jalaliToGregorian(vy, vm, 1);
  const lead = FA_ORDER.indexOf(firstGreg.getDay());
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><SlidersHorizontal className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-theme-primary">قوانین و تقویم کاری</h1><p className="text-sm text-theme-muted">گروه‌ها، تعطیلات و تغییر ساعت‌کاری — همه در یک‌جا</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary text-sm hover:bg-theme-hover"><Settings className="w-4 h-4" /> تنظیمات حضور</button>
          <button onClick={() => setSyncOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary text-sm hover:bg-theme-hover"><Activity className="w-4 h-4" /> پایش همگام‌سازی</button>
        </div>
      </div>

      {/* Group buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {list.map(g => (
          <button key={g.id} onClick={() => setSelId(g.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selId === g.id ? "bg-blue-600 text-white border-blue-600" : "bg-theme-card text-theme-secondary border-theme hover:bg-theme-hover"}`}>
            {g.isDefault ? "پیش‌فرض سازمان" : g.name} <span className="opacity-70 text-xs">({faNum(g.userCount || 0)})</span>
          </button>
        ))}
        <button onClick={() => { setSelId("new"); setForm({ ...NEW_DEFAULTS }); setTab("settings"); }}
          className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-theme text-theme-muted hover:bg-theme-hover">+ گروه جدید</button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-theme-card border border-theme rounded-xl p-1 w-fit">
        {([["calendar", "تقویم", CalendarRange], ["settings", "تنظیمات گروه", LayoutGrid], ["agenda", "فهرست استثناها", List]] as const).map(([k, lbl, Ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === k ? "bg-blue-600 text-white" : "text-theme-muted hover:bg-theme-hover"}`}>
            <Ic className="w-4 h-4" /> {lbl}
          </button>
        ))}
      </div>

      {/* ── Calendar tab ── */}
      {tab === "calendar" && group && (
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (vm === 1) { setVm(12); setVy(y => y - 1); } else setVm(m => m - 1); }} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted"><ChevronRight className="w-4 h-4" /></button>
            <div className="text-center"><div className="font-bold text-theme-primary">{J_MONTHS[vm - 1]} {faDigits(String(vy))}</div><div className="text-[11px] text-theme-muted">{group.isDefault ? "پیش‌فرض سازمان" : group.name}</div></div>
            <button onClick={() => { if (vm === 12) { setVm(1); setVy(y => y + 1); } else setVm(m => m + 1); }} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted"><ChevronLeft className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">{WEEK.map(w => <div key={w.d} className="text-center text-[11px] font-medium text-theme-muted py-1">{w.name.slice(0, 1)}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const info = dayInfo(day);
              const isToday = vy === tj.jy && vm === tj.jm && day === tj.jd;
              let bg = "bg-theme-primary border-theme", label = "", dot = "";
              if (info.holiday) { const t = HOLIDAY_TYPES.find(x => x.k === info.holiday.type); dot = t?.color || "#ef4444"; label = TYPE_FA[info.holiday.type] || "تعطیل"; bg = "bg-red-500/5 border-red-500/30"; }
              else if (info.override?.isOff) { dot = "#94a3b8"; label = "تعطیل"; bg = "bg-slate-500/5 border-slate-400/30"; }
              else if (info.isWeekend) { bg = "bg-theme-secondary/40 border-theme"; label = "آخرهفته"; }
              else if (info.override) { dot = "#3b82f6"; label = "ساعت ویژه"; bg = "bg-blue-500/5 border-blue-500/30"; }
              return (
                <button key={i} onClick={() => openDay(day)}
                  className={`relative text-right rounded-lg border p-1.5 min-h-[58px] hover:ring-1 hover:ring-blue-400 transition-all ${bg} ${isToday ? "ring-2 ring-blue-500" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? "text-blue-600" : "text-theme-primary"}`}>{faNum(day)}</span>
                    {dot && <span className="w-2 h-2 rounded-full" style={{ background: dot }} />}
                  </div>
                  {label && <div className="text-[9px] text-theme-muted mt-1 leading-tight truncate">{label}</div>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-theme-muted">
            {HOLIDAY_TYPES.map(t => <span key={t.k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: t.color }} /> {t.fa}</span>)}
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> ساعت ویژه</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> تعطیل گروه</span>
            <span className="opacity-70">— روی هر روز کلیک کنید تا تعطیلی یا تغییر ساعت ثبت شود</span>
          </div>
        </div>
      )}

      {/* ── Settings (schedule) tab ── */}
      {tab === "settings" && form && (
        <>
          <Section title="مشخصات گروه" icon={Users}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="نام گروه"><input className={inputCls} value={form.isDefault ? "پیش‌فرض سازمان" : (form.name || "")} disabled={form.isDefault} onChange={e => setF("name", e.target.value)} placeholder="مثلاً امریه" /></Field>
            </div>
          </Section>
          <Section title="بازه‌های ورود و خروج" icon={Timer}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="شروع بازه ورود"><TimeSelect className={inputCls} value={form.checkInStart || ""} onChange={v => setF("checkInStart", v)} /></Field>
              <Field label="پایان بازه ورود" hint="ورود بعد از این = تاخیر"><TimeSelect className={inputCls} value={form.checkInEnd || ""} onChange={v => setF("checkInEnd", v)} /></Field>
              <Field label="شروع بازه خروج" hint="خروج قبل از این = تعجیل"><TimeSelect className={inputCls} value={form.checkOutStart || ""} onChange={v => setF("checkOutStart", v)} /></Field>
              <Field label="پایان بازه خروج" hint="کار بعد از این = اضافه‌کار"><TimeSelect className={inputCls} value={form.checkOutEnd || ""} onChange={v => setF("checkOutEnd", v)} /></Field>
              <Field label="ساعت کار مورد نیاز (دقیقه)" hint={hrs(form.dailyMinutes)}><input type="number" className={inputCls} value={form.dailyMinutes ?? ""} onChange={e => setF("dailyMinutes", +e.target.value)} /></Field>
              <Field label="کسر ناهار/استراحت (دقیقه)"><input type="number" className={inputCls} value={form.lunchMinutes ?? ""} onChange={e => setF("lunchMinutes", +e.target.value)} /></Field>
            </div>
          </Section>
          <Section title="روزهای کاری" icon={CalendarDays}>
            <div className="flex flex-wrap gap-2">
              {WEEK.map(w => { const on = (form.workDays || []).includes(w.d); return (
                <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${on ? "bg-blue-600 text-white border-blue-600" : "bg-theme-primary text-theme-secondary border-theme"}`}>{w.name}</button>
              ); })}
            </div>
          </Section>
          <Section title="مرخصی و اضافه‌کار" icon={SlidersHorizontal}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="مرخصی استحقاقی سالانه (روز)"><input type="number" className={inputCls} value={form.annualLeaveDays ?? ""} onChange={e => setF("annualLeaveDays", +e.target.value)} /></Field>
              <Field label="حداقل آستانه اضافه‌کار (دقیقه)"><input type="number" className={inputCls} value={form.otMinThreshold ?? ""} onChange={e => setF("otMinThreshold", +e.target.value)} /></Field>
              <Field label="گرد کردن اضافه‌کار (دقیقه)"><input type="number" className={inputCls} value={form.otRounding ?? ""} onChange={e => setF("otRounding", +e.target.value)} /></Field>
              <Field label="حداکثر اضافه‌کار روزانه (۰=نامحدود)" hint={hrs(form.otMaxDaily)}><input type="number" className={inputCls} value={form.otMaxDaily ?? ""} onChange={e => setF("otMaxDaily", +e.target.value)} /></Field>
              <Field label="حداکثر اضافه‌کار ماهانه (۰=نامحدود)" hint={hrs(form.otMaxMonthly)}><input type="number" className={inputCls} value={form.otMaxMonthly ?? ""} onChange={e => setF("otMaxMonthly", +e.target.value)} /></Field>
            </div>
          </Section>
          <Section title="تبدیل خودکار کسری و غیبت به مرخصی" icon={SlidersHorizontal}>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-theme-primary">
                <input type="checkbox" checked={!!form.deficitToLeaveEnabled} onChange={e => setF("deficitToLeaveEnabled", e.target.checked)} />
                کسری کارکرد روزانه به‌صورت خودکار از مرخصی ساعتی کسر شود
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="سقف ماهانه مرخصی ساعتی خودکار (دقیقه)" hint={hrs(form.hourlyLeaveCapMinutes) + " — پس از عبور از این سقف، کسری آن روز به یک روز مرخصی روزانه تبدیل می‌شود"}>
                  <input type="number" className={inputCls} disabled={!form.deficitToLeaveEnabled} value={form.hourlyLeaveCapMinutes ?? ""} onChange={e => setF("hourlyLeaveCapMinutes", +e.target.value)} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-theme-primary">
                <input type="checkbox" checked={!!form.absentToLeaveEnabled} onChange={e => setF("absentToLeaveEnabled", e.target.checked)} />
                روزهای غیبت به‌صورت خودکار به مرخصی روزانه تبدیل شوند (در صورت کافی بودن مانده مرخصی)
              </label>
            </div>
          </Section>
          <div className="flex items-center justify-between gap-3">
            <div>{form.id && !form.isDefault && <button onClick={removeGroup} className="flex items-center gap-1 px-3 py-2 rounded-lg text-red-600 hover:bg-red-500/10 text-sm"><Trash2 className="w-4 h-4" /> حذف گروه</button>}</div>
            <div className="flex items-center gap-3">
              {msg && <span className="text-sm text-theme-muted">{msg}</span>}
              <button onClick={saveSchedule} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selId === "new" ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />} {selId === "new" ? "ایجاد گروه" : "ذخیره و بازمحاسبه"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Agenda tab ── */}
      {tab === "agenda" && (
        <AgendaTab group={group} holidays={holidays} overrides={overrides} groupName={groupName}
          onEdit={(kind, record) => setDayModal({ dateStr: isoToJStr(record.startDate), editKind: kind, editRecord: record, holiday: kind === "holiday" ? record : null, override: kind === "override" ? record : null })}
          onDelete={async (kind, id) => {
            await fetch(`${API}/attendance/${kind === "holiday" ? "holidays" : "schedule-overrides"}/${id}`, { method: "DELETE", headers: h });
            await loadAll();
          }} />
      )}

      {/* ── Day-action modal ── */}
      <DayActionModal open={!!dayModal} ctx={dayModal} group={group} onClose={() => setDayModal(null)} onSaved={async () => { setDayModal(null); await loadAll(); }} authHeaders={h} />

      {/* ── Settings & sync as modals ── */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="تنظیمات حضور و غیاب" size="lg">
        {settingsOpen && <div className="-m-4"><AttendanceSettingsPage /></div>}
      </Modal>
      <Modal open={syncOpen} onClose={() => setSyncOpen(false)} title="پایش همگام‌سازی" size="lg">
        {syncOpen && <div className="-m-4"><SyncMonitorPage /></div>}
      </Modal>
    </div>
  );

  function openDay(day: number) {
    const info = dayInfo(day);
    setDayModal({ dateStr: `${vy}/${vm}/${day}`, holiday: info.holiday || null, override: info.override || null });
  }
}

// ISO (UTC-midnight) → Jalali "jy/jm/jd" string for the date inputs.
const isoToJStr = (iso: string) => { const d = new Date(iso); const j = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); return `${j.jy}/${j.jm}/${j.jd}`; };
const faDigits = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);

// ── Agenda (list of holidays + overrides) ──────────────────────────────────
function AgendaTab({ group, holidays, overrides, groupName, onDelete, onEdit }: any) {
  const faD = (iso: string) => new Date(iso).toLocaleDateString("fa-IR", { timeZone: "UTC" });
  const forGroup = (ids?: string[]) => !ids?.length || (group && ids.includes(group.id));
  const hol = holidays.filter((x: any) => forGroup(x.scheduleIds));
  const ov = overrides.filter((x: any) => forGroup(x.scheduleIds));
  const dayName = (d: number) => WEEK.find(w => w.d === d)?.name || d;
  return (
    <div className="space-y-4">
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-theme text-sm font-medium text-theme-primary">تعطیلات {group ? `(${group.isDefault ? "پیش‌فرض" : group.name})` : ""}</div>
        <table className="w-full text-sm text-center">
          <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30"><th className="py-2 px-2 font-medium">عنوان</th><th className="px-2 font-medium">نوع</th><th className="px-2 font-medium">از</th><th className="px-2 font-medium">تا</th><th className="px-2 font-medium">گروه‌ها</th><th className="px-2 font-medium">حذف</th></tr></thead>
          <tbody>
            {hol.length === 0 ? <tr><td colSpan={6} className="py-6 text-theme-muted">موردی نیست</td></tr> : hol.map((r: any) => (
              <tr key={r.id} className="border-b border-theme/40">
                <td className="py-1.5 px-2 text-theme-primary">{r.title}</td>
                <td className="px-2 text-theme-muted">{TYPE_FA[r.type] || r.type}</td>
                <td className="px-2 text-theme-primary" dir="ltr">{faD(r.startDate)}</td>
                <td className="px-2 text-theme-primary" dir="ltr">{faD(r.endDate)}</td>
                <td className="px-2 text-theme-muted text-xs">{(!r.scheduleIds?.length) ? "همه" : r.scheduleIds.map(groupName).join("، ")}</td>
                <td className="px-2"><div className="flex items-center justify-center gap-1"><button onClick={() => onEdit("holiday", r)} className="px-2 py-1 rounded text-blue-600 hover:bg-blue-500/10 text-xs">ویرایش</button><button onClick={() => onDelete("holiday", r.id)} className="inline-flex w-7 h-7 items-center justify-center rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-theme text-sm font-medium text-theme-primary">تغییرات ساعت کاری</div>
        <table className="w-full text-sm text-center">
          <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30"><th className="py-2 px-2 font-medium">عنوان</th><th className="px-2 font-medium">روزها</th><th className="px-2 font-medium">بازه</th><th className="px-2 font-medium">تنظیم</th><th className="px-2 font-medium">گروه‌ها</th><th className="px-2 font-medium">حذف</th></tr></thead>
          <tbody>
            {ov.length === 0 ? <tr><td colSpan={6} className="py-6 text-theme-muted">موردی نیست</td></tr> : ov.map((r: any) => (
              <tr key={r.id} className="border-b border-theme/40">
                <td className="py-1.5 px-2 text-theme-primary">{r.title || "—"}</td>
                <td className="px-2 text-theme-muted text-xs">{(!r.weekdays?.length) ? "همه" : r.weekdays.map(dayName).join("، ")}</td>
                <td className="px-2 text-theme-muted text-xs" dir="ltr">{faD(r.startDate)} — {faD(r.endDate)}</td>
                <td className="px-2 text-theme-muted text-xs">{r.isOff ? "تعطیل" : [r.checkInEnd && `ورود تا ${r.checkInEnd}`, r.checkOutEnd && `خروج تا ${r.checkOutEnd}`, r.dailyMinutes != null && `موظف ${r.dailyMinutes}`].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2 text-theme-muted text-xs">{(!r.scheduleIds?.length) ? "همه" : r.scheduleIds.map(groupName).join("، ")}</td>
                <td className="px-2"><div className="flex items-center justify-center gap-1"><button onClick={() => onEdit("override", r)} className="px-2 py-1 rounded text-blue-600 hover:bg-blue-500/10 text-xs">ویرایش</button><button onClick={() => onDelete("override", r.id)} className="inline-flex w-7 h-7 items-center justify-center rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Jalali three-select date picker ─────────────────────────────────────────
function JalaliDateSelect({ value, onChange, label, allowEmpty = false }: {
  value: string; onChange: (v: string) => void; label: string; allowEmpty?: boolean;
}) {
  const { jy: ty } = todayJ();
  const parts = value ? value.split("/").map(Number) : [0, 0, 0];
  const jy = parts[0] || 0, jm = parts[1] || 0, jd = parts[2] || 0;
  const years = Array.from({ length: 8 }, (_, i) => ty - 5 + i);
  const toFaN = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
  function upd(ny: number, nm: number, nd: number) {
    if (allowEmpty && !ny) { onChange(""); return; }
    if (!ny || !nm || !nd) return;
    onChange(`${ny}/${nm}/${Math.min(nd, jMonthLen(ny, nm))}`);
  }
  return (
    <Field label={label}>
      <div className="flex gap-1" dir="ltr">
        <select value={jy || ""} onChange={e => upd(+e.target.value || 0, jm, jd || 1)} className={inputCls + " px-1 text-center"}>
          {allowEmpty && <option value="">—</option>}
          {years.map(y => <option key={y} value={y}>{toFaN(y)}</option>)}
        </select>
        <select value={jm || ""} onChange={e => upd(jy, +e.target.value, jd || 1)} className={inputCls + " px-1 text-center"} disabled={allowEmpty && !jy}>
          {!jm && <option value="">{allowEmpty ? "ماه" : "—"}</option>}
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{J_MONTHS[m - 1]}</option>)}
        </select>
        <select value={jd || ""} onChange={e => upd(jy, jm, +e.target.value)} className={inputCls + " px-1 text-center"} disabled={allowEmpty && !jm}>
          {!jd && <option value="">{allowEmpty ? "روز" : "—"}</option>}
          {Array.from({ length: jy && jm ? jMonthLen(jy, jm) : 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{toFaN(d)}</option>)}
        </select>
      </div>
    </Field>
  );
}

// ── Day action modal: view/edit existing + create holiday or hours override ──
function DayActionModal({ open, ctx, group, onClose, onSaved, authHeaders }: any) {
  const [mode, setMode] = React.useState<"holiday" | "override">("holiday");
  const [editId, setEditId] = React.useState<string | null>(null);
  const [allGroups, setAllGroups] = React.useState(false);
  const [startStr, setStartStr] = React.useState("");
  const [endStr, setEndStr] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // holiday fields
  const [hTitle, setHTitle] = React.useState("");
  const [hType, setHType] = React.useState("OFFICIAL");
  const [recurring, setRecurring] = React.useState(false);
  // override fields
  const [isOff, setIsOff] = React.useState(false);
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [ov, setOv] = React.useState<any>({ checkInStart: "", checkInEnd: "", checkOutStart: "", checkOutEnd: "", dailyMinutes: "" });

  const resetCreate = React.useCallback(() => {
    setEditId(null); setMode("holiday"); setAllGroups(false); setStartStr(ctx?.dateStr || ""); setEndStr("");
    setHTitle(""); setHType("OFFICIAL"); setRecurring(false);
    setIsOff(false); setWeekdays([]); setOv({ checkInStart: "", checkInEnd: "", checkOutStart: "", checkOutEnd: "", dailyMinutes: "" });
  }, [ctx]);
  React.useEffect(() => {
    if (!open) return;
    if (ctx?.editKind) startEdit(ctx.editKind, ctx.editRecord); else resetCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!ctx) return null;
  const scheduleIds = allGroups || !group ? [] : [group.id];

  function startEdit(kind: "holiday" | "override", r: any) {
    setEditId(r.id); setMode(kind); setAllGroups(!r.scheduleIds?.length);
    setStartStr(isoToJStr(r.startDate)); setEndStr(isoToJStr(r.endDate));
    if (kind === "holiday") { setHTitle(r.title || ""); setHType(r.type); setRecurring(!!r.recurring); }
    else { setIsOff(!!r.isOff); setWeekdays(r.weekdays || []); setOv({ checkInStart: r.checkInStart || "", checkInEnd: r.checkInEnd || "", checkOutStart: r.checkOutStart || "", checkOutEnd: r.checkOutEnd || "", dailyMinutes: r.dailyMinutes ?? "" }); }
  }
  async function del(kind: "holiday" | "override", id: string) {
    if (!confirm("حذف شود؟")) return;
    await fetch(`${API}/attendance/${kind === "holiday" ? "holidays" : "schedule-overrides"}/${id}`, { method: "DELETE", headers: authHeaders });
    await onSaved();
  }

  async function save() {
    setSaving(true);
    try {
      const start = startStr || ctx.dateStr;
      if (mode === "holiday") {
        const body = JSON.stringify({ title: hTitle || (TYPE_FA[hType] + " " + start), type: hType, startDate: start, endDate: endStr || start, recurring, scheduleIds });
        await fetch(`${API}/attendance/holidays${editId ? "/" + editId : ""}`, { method: editId ? "PATCH" : "POST", headers: authHeaders, body });
      } else {
        const body = JSON.stringify({ startDate: start, endDate: endStr || start, weekdays, isOff, scheduleIds, ...ov });
        await fetch(`${API}/attendance/schedule-overrides${editId ? "/" + editId : ""}`, { method: editId ? "PUT" : "POST", headers: authHeaders, body });
      }
      await onSaved();
    } finally { setSaving(false); }
  }

  const existing: Array<{ kind: "holiday" | "override"; r: any; label: string }> = [
    ...(ctx.holiday ? [{ kind: "holiday" as const, r: ctx.holiday, label: `تعطیلی ${TYPE_FA[ctx.holiday.type] || ""}: ${ctx.holiday.title || ""}` }] : []),
    ...(ctx.override ? [{ kind: "override" as const, r: ctx.override, label: ctx.override.isOff ? "تعطیلِ ساعتی" : "ساعت کاری ویژه" }] : []),
  ];

  return (
    <Modal open={open} onClose={onClose} title={`${editId ? "ویرایش" : "ثبت"} برای ${faDigits(ctx.dateStr)}`} size="md"
      footer={<><button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>{editId && <button onClick={resetCreate} className="btn-theme-secondary text-sm">مورد جدید</button>}<button onClick={save} disabled={saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : editId ? "ذخیره تغییر" : "ثبت"}</button></>}>
      <div className="space-y-3">
        {existing.length > 0 && (
          <div className="border border-theme rounded-lg divide-y divide-theme">
            {existing.map((it, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className={`text-theme-secondary ${editId === it.r.id ? "font-bold text-blue-600" : ""}`}>{it.label}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(it.kind, it.r)} className="px-2 py-1 rounded text-blue-600 hover:bg-blue-500/10 text-xs">ویرایش</button>
                  <button onClick={() => del(it.kind, it.r.id)} className="inline-flex w-6 h-6 items-center justify-center rounded text-red-600 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 bg-theme-secondary p-1 rounded-lg w-fit">
          {([["holiday", "تعطیلی"], ["override", "تغییر ساعت کاری"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded-md text-sm ${mode === k ? "bg-blue-600 text-white" : "text-theme-muted"}`}>{l}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <JalaliDateSelect label="از تاریخ" value={startStr} onChange={setStartStr} />
          <JalaliDateSelect label="تا تاریخ (اختیاری — بازه)" value={endStr} onChange={setEndStr} allowEmpty />
        </div>
        <label className="flex items-center gap-2 text-sm text-theme-primary"><input type="checkbox" checked={allGroups} onChange={e => setAllGroups(e.target.checked)} /> برای همهٔ گروه‌ها</label>
        {!allGroups && group && <p className="text-[11px] text-theme-muted">اعمال برای گروه: <b>{group.isDefault ? "پیش‌فرض" : group.name}</b></p>}

        {mode === "holiday" ? (
          <>
            <Field label="عنوان"><input className={inputCls} value={hTitle} onChange={e => setHTitle(e.target.value)} placeholder="مثلاً عید" /></Field>
            <div>
              <span className="text-sm text-theme-muted mb-1 block">نوع تعطیلی</span>
              <div className="flex gap-2">
                {HOLIDAY_TYPES.map(t => (
                  <button key={t.k} type="button" onClick={() => setHType(t.k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${hType === t.k ? "border-blue-500 bg-blue-500/10 text-theme-primary" : "border-theme text-theme-muted"}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: t.color }} /> {t.fa}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-theme-primary"><input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /> تکرار هرساله</label>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-theme-primary"><input type="checkbox" checked={isOff} onChange={e => setIsOff(e.target.checked)} /> این روز(ها) تعطیل/غیرکاری باشد</label>
            {!isOff && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="شروع ورود"><TimeSelect className={inputCls} value={ov.checkInStart} onChange={v => setOv((s: any) => ({ ...s, checkInStart: v }))} /></Field>
                <Field label="پایان ورود"><TimeSelect className={inputCls} value={ov.checkInEnd} onChange={v => setOv((s: any) => ({ ...s, checkInEnd: v }))} /></Field>
                <Field label="شروع خروج"><TimeSelect className={inputCls} value={ov.checkOutStart} onChange={v => setOv((s: any) => ({ ...s, checkOutStart: v }))} /></Field>
                <Field label="پایان خروج"><TimeSelect className={inputCls} value={ov.checkOutEnd} onChange={v => setOv((s: any) => ({ ...s, checkOutEnd: v }))} /></Field>
                <Field label="ساعت موظف (دقیقه)"><input type="number" className={inputCls} value={ov.dailyMinutes} onChange={e => setOv((s: any) => ({ ...s, dailyMinutes: e.target.value }))} /></Field>
              </div>
            )}
            <div>
              <span className="text-sm text-theme-muted mb-1 block">فقط این روزهای هفته (اختیاری — برای بازه)</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEK.map(w => { const on = weekdays.includes(w.d); return (
                  <button key={w.d} type="button" onClick={() => setWeekdays(s => s.includes(w.d) ? s.filter(x => x !== w.d) : [...s, w.d])} className={`px-2.5 py-1 rounded-lg text-xs border ${on ? "bg-blue-600 text-white border-blue-600" : "bg-theme-primary text-theme-secondary border-theme"}`}>{w.name}</button>
                ); })}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
