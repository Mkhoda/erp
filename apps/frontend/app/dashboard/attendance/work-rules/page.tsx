"use client";
import React from "react";
import { Clock, Save, Loader2, SlidersHorizontal, CalendarDays, Timer } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const inputCls = "w-full bg-theme-primary border border-theme rounded-lg px-3 py-2 text-theme-primary text-sm focus:outline-none focus:border-blue-500";
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const hrs = (m: number) => (m ? `≈ ${faNum(Math.round((m / 60) * 10) / 10)} ساعت` : "");

// JS getDay() order, Persian week starting Saturday.
const WEEK = [
  { d: 6, name: "شنبه" }, { d: 0, name: "یکشنبه" }, { d: 1, name: "دوشنبه" },
  { d: 2, name: "سه‌شنبه" }, { d: 3, name: "چهارشنبه" }, { d: 4, name: "پنج‌شنبه" }, { d: 5, name: "جمعه" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-theme-muted mb-1 block">{label} {hint && <span className="text-[11px] text-blue-500">{hint}</span>}</span>
      {children}
    </label>
  );
}
function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-blue-500" /><h2 className="font-semibold text-theme-primary">{title}</h2></div>
      {children}
    </div>
  );
}

export default function WorkRulesPage() {
  React.useEffect(() => { document.title = "قوانین کارکرد | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [form, setForm] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`${API}/attendance/work-schedule`, { headers: h }).then(r => r.ok ? r.json() : null).then(setForm).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleDay = (d: number) => setForm((f: any) => {
    const cur: number[] = f.workDays || [];
    return { ...f, workDays: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] };
  });

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/attendance/work-schedule`, { method: "PUT", headers: h, body: JSON.stringify(form) });
      if (res.ok) setMsg("ذخیره شد — کارکرد همه‌ی کاربران در حال بازمحاسبه است");
      else setMsg("خطا در ذخیره");
    } finally { setSaving(false); setTimeout(() => setMsg(null), 6000); }
  }

  if (loading || !form) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><SlidersHorizontal className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">قوانین کارکرد (پیش‌فرض سازمان)</h1>
          <p className="text-sm text-theme-muted">این مقادیر برای همه اعمال می‌شود مگر اینکه برای کاربر خاص override شود.</p>
        </div>
      </div>

      <Section title="ساعت کاری" icon={Clock}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="ساعت شروع"><input type="time" className={inputCls} value={form.startTime || ""} onChange={e => set("startTime", e.target.value)} /></Field>
          <Field label="ساعت پایان"><input type="time" className={inputCls} value={form.endTime || ""} onChange={e => set("endTime", e.target.value)} /></Field>
          <Field label="ساعت کاری روزانه (دقیقه)" hint={hrs(form.dailyMinutes)}><input type="number" className={inputCls} value={form.dailyMinutes ?? ""} onChange={e => set("dailyMinutes", +e.target.value)} /></Field>
          <Field label="ناهار / استراحت (دقیقه)"><input type="number" className={inputCls} value={form.lunchMinutes ?? ""} onChange={e => set("lunchMinutes", +e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="شناوری و ارفاق" icon={Timer}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="ارفاق ورود (دقیقه)" hint="تاخیر تا این مقدار نادیده گرفته می‌شود"><input type="number" className={inputCls} value={form.graceMinutes ?? ""} onChange={e => set("graceMinutes", +e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm text-theme-primary mt-6">
            <input type="checkbox" checked={!!form.flexEnabled} onChange={e => set("flexEnabled", e.target.checked)} /> شناوری فعال (ورود/خروج آزاد)
          </label>
          {form.flexEnabled && <>
            <Field label="بازه ورود مجاز — از"><input type="time" className={inputCls} value={form.flexInStart || ""} onChange={e => set("flexInStart", e.target.value)} /></Field>
            <Field label="بازه ورود مجاز — تا"><input type="time" className={inputCls} value={form.flexInEnd || ""} onChange={e => set("flexInEnd", e.target.value)} /></Field>
          </>}
        </div>
      </Section>

      <Section title="روزهای کاری" icon={CalendarDays}>
        <div className="flex flex-wrap gap-2">
          {WEEK.map(w => {
            const on = (form.workDays || []).includes(w.d);
            return (
              <button key={w.d} type="button" onClick={() => toggleDay(w.d)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${on ? "bg-blue-600 text-white border-blue-600" : "bg-theme-primary text-theme-secondary border-theme"}`}>
                {w.name}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-theme-muted mt-2">روزهای انتخاب‌نشده «آخر هفته» محسوب می‌شوند.</p>
      </Section>

      <Section title="مرخصی" icon={CalendarDays}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="مرخصی استحقاقی سالانه (روز)"><input type="number" className={inputCls} value={form.annualLeaveDays ?? ""} onChange={e => set("annualLeaveDays", +e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="اضافه‌کار" icon={SlidersHorizontal}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="حداقل آستانه (دقیقه)" hint="کمتر از این، اضافه‌کار حساب نمی‌شود"><input type="number" className={inputCls} value={form.otMinThreshold ?? ""} onChange={e => set("otMinThreshold", +e.target.value)} /></Field>
          <Field label="گرد کردن (دقیقه)"><input type="number" className={inputCls} value={form.otRounding ?? ""} onChange={e => set("otRounding", +e.target.value)} /></Field>
          <Field label="حداکثر روزانه (دقیقه)" hint={hrs(form.otMaxDaily)}><input type="number" className={inputCls} value={form.otMaxDaily ?? ""} onChange={e => set("otMaxDaily", +e.target.value)} /></Field>
          <Field label="حداکثر ماهانه (دقیقه)" hint={hrs(form.otMaxMonthly)}><input type="number" className={inputCls} value={form.otMaxMonthly ?? ""} onChange={e => set("otMaxMonthly", +e.target.value)} /></Field>
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-theme-muted">{msg}</span>}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره و بازمحاسبه
        </button>
      </div>
    </div>
  );
}
