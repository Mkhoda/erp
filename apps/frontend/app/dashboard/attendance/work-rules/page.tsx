"use client";
import React from "react";
import { Clock, Save, Loader2, SlidersHorizontal, CalendarDays, Timer, Plus, Trash2, Users } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const inputCls = "w-full bg-theme-primary border border-theme rounded-lg px-3 py-2 text-theme-primary text-sm focus:outline-none focus:border-blue-500";
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const hrs = (m: number) => (m ? `≈ ${faNum(Math.round((m / 60) * 10) / 10)} ساعت` : "");

const WEEK = [
  { d: 6, name: "شنبه" }, { d: 0, name: "یکشنبه" }, { d: 1, name: "دوشنبه" },
  { d: 2, name: "سه‌شنبه" }, { d: 3, name: "چهارشنبه" }, { d: 4, name: "پنج‌شنبه" }, { d: 5, name: "جمعه" },
];
const NEW_DEFAULTS = {
  name: "", isDefault: false, dailyMinutes: 500, lunchMinutes: 0,
  checkInStart: "06:30", checkInEnd: "09:00", checkOutStart: "14:50", checkOutEnd: "17:20", workDays: [6, 0, 1, 2, 3],
  otMinThreshold: 30, otRounding: 15, otMaxDaily: 240, otMaxMonthly: 3600, annualLeaveDays: 26,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (<label className="block"><span className="text-sm text-theme-muted mb-1 block">{label} {hint && <span className="text-[11px] text-blue-500">{hint}</span>}</span>{children}</label>);
}
function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (<div className="bg-theme-card border border-theme rounded-xl p-5"><div className="flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-theme-primary">{title}</h2></div>{children}</div>);
}

export default function WorkRulesPage() {
  React.useEffect(() => { document.title = "قوانین کارکرد | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [list, setList] = React.useState<any[]>([]);
  const [selId, setSelId] = React.useState<string>("");      // "" = none, "new" = creating
  const [form, setForm] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetch(`${API}/attendance/work-schedules`, { headers: h }).then(r => r.ok ? r.json() : []);
      setList(Array.isArray(rows) ? rows : []);
      if (rows.length && !selId) { setSelId(rows[0].id); setForm(rows[0]); }
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { load(); }, [load]);

  function selectSchedule(id: string) {
    if (id === "new") { setSelId("new"); setForm({ ...NEW_DEFAULTS }); return; }
    const s = list.find(x => x.id === id);
    if (s) { setSelId(id); setForm(s); }
  }
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => setForm((f: any) => { const cur: number[] = f.workDays || []; return { ...f, workDays: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] }; });

  async function save() {
    if (selId === "new" && !form.name?.trim()) { setMsg("نام گروه را وارد کنید"); return; }
    setSaving(true); setMsg(null);
    try {
      const url = selId === "new" ? `${API}/attendance/work-schedules` : `${API}/attendance/work-schedules/${selId}`;
      const res = await fetch(url, { method: selId === "new" ? "POST" : "PUT", headers: h, body: JSON.stringify(form) });
      if (res.ok) { const saved = await res.json(); setMsg("ذخیره شد — کارکرد اعضای این گروه در حال بازمحاسبه است"); await load(); setSelId(saved.id); setForm(saved); }
      else { const e = await res.json().catch(() => ({})); setMsg(e.message || "خطا در ذخیره"); }
    } finally { setSaving(false); setTimeout(() => setMsg(null), 6000); }
  }
  async function remove() {
    if (!form?.id || form.isDefault) return;
    if (!confirm(`گروه «${form.name}» حذف شود؟ اعضای آن به برنامه‌ی پیش‌فرض منتقل می‌شوند.`)) return;
    await fetch(`${API}/attendance/work-schedules/${form.id}`, { method: "DELETE", headers: h });
    setSelId(""); setForm(null); await load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><SlidersHorizontal className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-theme-primary">قوانین کارکرد و گروه‌ها</h1><p className="text-sm text-theme-muted">برنامه‌ی پیش‌فرض سازمان + گروه‌های خاص (مثل امریه)</p></div>
        </div>
        <div className="flex items-center gap-2">
          <select className={inputCls + " w-auto"} value={selId} onChange={e => selectSchedule(e.target.value)}>
            {list.map(s => <option key={s.id} value={s.id}>{s.isDefault ? "پیش‌فرض سازمان" : s.name} ({faNum(s.userCount || 0)} نفر)</option>)}
            <option value="new">+ گروه جدید</option>
          </select>
        </div>
      </div>

      {form && (
        <>
          <Section title="مشخصات گروه" icon={Users}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="نام گروه">
                <input className={inputCls} value={form.isDefault ? "پیش‌فرض سازمان" : (form.name || "")} disabled={form.isDefault} onChange={e => set("name", e.target.value)} placeholder="مثلاً امریه" />
              </Field>
            </div>
          </Section>

          <Section title="بازه‌های ورود و خروج" icon={Timer}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="شروع بازه ورود"><input type="time" className={inputCls} value={form.checkInStart || ""} onChange={e => set("checkInStart", e.target.value)} /></Field>
              <Field label="پایان بازه ورود" hint="ورود بعد از این = تاخیر"><input type="time" className={inputCls} value={form.checkInEnd || ""} onChange={e => set("checkInEnd", e.target.value)} /></Field>
              <Field label="شروع بازه خروج" hint="خروج قبل از این = تعجیل"><input type="time" className={inputCls} value={form.checkOutStart || ""} onChange={e => set("checkOutStart", e.target.value)} /></Field>
              <Field label="پایان بازه خروج"><input type="time" className={inputCls} value={form.checkOutEnd || ""} onChange={e => set("checkOutEnd", e.target.value)} /></Field>
              <Field label="ساعت کار مورد نیاز (دقیقه)" hint={hrs(form.dailyMinutes)}><input type="number" className={inputCls} value={form.dailyMinutes ?? ""} onChange={e => set("dailyMinutes", +e.target.value)} /></Field>
              <Field label="کسر ناهار/استراحت (دقیقه)"><input type="number" className={inputCls} value={form.lunchMinutes ?? ""} onChange={e => set("lunchMinutes", +e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="روزهای کاری" icon={CalendarDays}>
            <div className="flex flex-wrap gap-2">
              {WEEK.map(w => { const on = (form.workDays || []).includes(w.d); return (
                <button key={w.d} type="button" onClick={() => toggleDay(w.d)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${on ? "bg-blue-600 text-white border-blue-600" : "bg-theme-primary text-theme-secondary border-theme"}`}>{w.name}</button>
              ); })}
            </div>
          </Section>

          <Section title="مرخصی" icon={CalendarDays}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="مرخصی استحقاقی سالانه (روز)"><input type="number" className={inputCls} value={form.annualLeaveDays ?? ""} onChange={e => set("annualLeaveDays", +e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="اضافه‌کار" icon={SlidersHorizontal}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="حداقل آستانه (دقیقه)"><input type="number" className={inputCls} value={form.otMinThreshold ?? ""} onChange={e => set("otMinThreshold", +e.target.value)} /></Field>
              <Field label="گرد کردن (دقیقه)"><input type="number" className={inputCls} value={form.otRounding ?? ""} onChange={e => set("otRounding", +e.target.value)} /></Field>
              <Field label="حداکثر روزانه (دقیقه)" hint={hrs(form.otMaxDaily)}><input type="number" className={inputCls} value={form.otMaxDaily ?? ""} onChange={e => set("otMaxDaily", +e.target.value)} /></Field>
              <Field label="حداکثر ماهانه (دقیقه)" hint={hrs(form.otMaxMonthly)}><input type="number" className={inputCls} value={form.otMaxMonthly ?? ""} onChange={e => set("otMaxMonthly", +e.target.value)} /></Field>
            </div>
          </Section>

          <div className="flex items-center justify-between gap-3">
            <div>{form.id && !form.isDefault && <button onClick={remove} className="flex items-center gap-1 px-3 py-2 rounded-lg text-red-600 hover:bg-red-500/10 text-sm"><Trash2 className="w-4 h-4" /> حذف گروه</button>}</div>
            <div className="flex items-center gap-3">
              {msg && <span className="text-sm text-theme-muted">{msg}</span>}
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selId === "new" ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />} {selId === "new" ? "ایجاد گروه" : "ذخیره و بازمحاسبه"}
              </button>
            </div>
          </div>
        </>
      )}

      <OverridesManager groups={list} />
    </div>
  );
}

// ── Per-group / per-weekday schedule overrides within a date range ──────────
function OverridesManager({ groups }: { groups: any[] }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const blank = { title: "", scheduleIds: [] as string[], weekdays: [] as number[], startDate: "", endDate: "", isOff: false, checkInStart: "", checkInEnd: "", checkOutStart: "", checkOutEnd: "", dailyMinutes: "", lunchMinutes: "" };
  const [rows, setRows] = React.useState<any[]>([]);
  const [form, setForm] = React.useState<any>({ ...blank });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const groupName = (id: string) => groups.find(g => g.id === id)?.name || (groups.find(g => g.id === id)?.isDefault ? "پیش‌فرض" : id.slice(0, 6));
  const dayName = (d: number) => WEEK.find(w => w.d === d)?.name || d;
  const load = React.useCallback(async () => {
    setRows(await fetch(`${API}/attendance/schedule-overrides`, { headers: h }).then(r => r.ok ? r.json() : []).catch(() => []));
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggle = (k: "scheduleIds" | "weekdays", v: any) => setForm((f: any) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x: any) => x !== v) : [...f[k], v] }));

  async function add() {
    if (!form.startDate) { setMsg("تاریخ شروع الزامی است"); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/attendance/schedule-overrides`, { method: "POST", headers: h, body: JSON.stringify(form) });
      if (res.ok) { setForm({ ...blank }); setMsg("ثبت شد — روزهای متاثر در حال بازمحاسبه است"); await load(); }
      else setMsg("خطا در ثبت");
    } finally { setSaving(false); setTimeout(() => setMsg(null), 6000); }
  }
  async function del(id: string) {
    if (!confirm("حذف این بازه؟")) return;
    await fetch(`${API}/attendance/schedule-overrides/${id}`, { method: "DELETE", headers: h });
    await load();
  }

  return (
    <Section title="استثناهای روز (ساعت کاری متفاوت برای روز/گروه خاص)" icon={CalendarDays}>
      <p className="text-[11px] text-theme-muted mb-3">برای روزهای خاصِ هفته در یک بازهٔ تاریخی و گروه‌های انتخابی، ساعت ورود/خروج و ساعت موظف را تغییر می‌دهد. فیلدهای خالی از برنامهٔ پایه ارث می‌برند.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="عنوان (اختیاری)"><input className={inputCls} value={form.title} onChange={e => set("title", e.target.value)} placeholder="مثلاً پنجشنبه‌های تابستان" /></Field>
        <div />
        <Field label="تاریخ شروع (شمسی)"><input dir="ltr" className={inputCls} value={form.startDate} onChange={e => set("startDate", e.target.value)} placeholder="1404/04/01" /></Field>
        <Field label="تاریخ پایان (اختیاری)"><input dir="ltr" className={inputCls} value={form.endDate} onChange={e => set("endDate", e.target.value)} placeholder="1404/06/31" /></Field>
      </div>

      <div className="mt-3">
        <span className="text-sm text-theme-muted mb-1 block">گروه‌ها <span className="text-[11px] text-theme-muted">(خالی = همه)</span></span>
        <div className="flex flex-wrap gap-1.5">
          {groups.map(g => { const on = form.scheduleIds.includes(g.id); return (
            <button key={g.id} type="button" onClick={() => toggle("scheduleIds", g.id)} className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${on ? "bg-blue-500 text-white border-blue-500" : "bg-theme-primary text-theme-secondary border-theme"}`}>{g.isDefault ? "پیش‌فرض" : g.name}</button>
          ); })}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-sm text-theme-muted mb-1 block">روزهای هفته <span className="text-[11px] text-theme-muted">(خالی = همهٔ روزهای بازه)</span></span>
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map(w => { const on = form.weekdays.includes(w.d); return (
            <button key={w.d} type="button" onClick={() => toggle("weekdays", w.d)} className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${on ? "bg-blue-600 text-white border-blue-600" : "bg-theme-primary text-theme-secondary border-theme"}`}>{w.name}</button>
          ); })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-theme-primary mt-3">
        <input type="checkbox" checked={form.isOff} onChange={e => set("isOff", e.target.checked)} /> این روز تعطیل/غیرکاری باشد
      </label>

      {!form.isOff && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <Field label="شروع ورود"><input type="time" className={inputCls} value={form.checkInStart} onChange={e => set("checkInStart", e.target.value)} /></Field>
          <Field label="پایان ورود"><input type="time" className={inputCls} value={form.checkInEnd} onChange={e => set("checkInEnd", e.target.value)} /></Field>
          <Field label="شروع خروج"><input type="time" className={inputCls} value={form.checkOutStart} onChange={e => set("checkOutStart", e.target.value)} /></Field>
          <Field label="پایان خروج"><input type="time" className={inputCls} value={form.checkOutEnd} onChange={e => set("checkOutEnd", e.target.value)} /></Field>
          <Field label="ساعت موظف (دقیقه)"><input type="number" className={inputCls} value={form.dailyMinutes} onChange={e => set("dailyMinutes", e.target.value)} /></Field>
          <Field label="کسر ناهار (دقیقه)"><input type="number" className={inputCls} value={form.lunchMinutes} onChange={e => set("lunchMinutes", e.target.value)} /></Field>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-3">
        {msg && <span className="text-sm text-theme-muted">{msg}</span>}
        <button onClick={add} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} افزودن استثنا
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto border border-theme rounded-lg">
          <table className="w-full text-sm text-center">
            <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30">
              <th className="py-2 px-2 font-medium">عنوان</th><th className="px-2 font-medium">گروه‌ها</th><th className="px-2 font-medium">روزها</th><th className="px-2 font-medium">بازه</th><th className="px-2 font-medium">تنظیمات</th><th className="px-2 font-medium">حذف</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-theme/40">
                  <td className="py-1.5 px-2 text-theme-primary">{r.title || "—"}</td>
                  <td className="px-2 text-theme-muted text-xs">{(!r.scheduleIds?.length) ? "همه" : r.scheduleIds.map(groupName).join("، ")}</td>
                  <td className="px-2 text-theme-muted text-xs">{(!r.weekdays?.length) ? "همه" : r.weekdays.map(dayName).join("، ")}</td>
                  <td className="px-2 text-theme-muted text-xs" dir="ltr">{new Date(r.startDate).toLocaleDateString("fa-IR", { timeZone: "UTC" })} — {new Date(r.endDate).toLocaleDateString("fa-IR", { timeZone: "UTC" })}</td>
                  <td className="px-2 text-theme-muted text-xs">{r.isOff ? "تعطیل" : [r.checkInEnd && `ورود تا ${r.checkInEnd}`, r.checkOutEnd && `خروج تا ${r.checkOutEnd}`, r.dailyMinutes != null && `موظف ${r.dailyMinutes}`].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-2"><button onClick={() => del(r.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
