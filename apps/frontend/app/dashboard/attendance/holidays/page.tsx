"use client";
import React from "react";
import { Loader2, CalendarOff, Plus, Trash2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const TYPE_FA: Record<string, string> = { OFFICIAL: "تعطیل رسمی", COMPANY: "تعطیل شرکت", HALF_DAY: "نیم‌روز" };
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone: "UTC" });

export default function HolidaysPage() {
  React.useEffect(() => { document.title = "تعطیلات | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ title: "", type: "OFFICIAL", startDate: "", endDate: "", recurring: false, note: "" });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setRows(await fetch(`${API}/attendance/holidays`, { headers: h }).then(r => r.ok ? r.json() : [])); }
    finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function add() {
    if (!form.title || !form.startDate) { setMsg("عنوان و تاریخ شروع الزامی است"); return; }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/attendance/holidays`, { method: "POST", headers: h, body: JSON.stringify(form) });
      if (res.ok) { setForm({ title: "", type: "OFFICIAL", startDate: "", endDate: "", recurring: false, note: "" }); setMsg("ثبت شد — روزهای متاثر در حال بازمحاسبه است"); await load(); }
      else setMsg("خطا در ثبت");
    } finally { setSaving(false); setTimeout(() => setMsg(null), 6000); }
  }
  async function del(id: string) {
    if (!confirm("حذف این تعطیلی؟")) return;
    await fetch(`${API}/attendance/holidays/${id}`, { method: "DELETE", headers: h });
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><CalendarOff className="w-5 h-5 text-white" /></div>
        <div><h1 className="text-xl font-bold text-theme-primary">تعطیلات</h1><p className="text-sm text-theme-muted">روزهای تعطیل در محاسبه‌ی حضور لحاظ می‌شوند</p></div>
      </div>

      {/* Add form */}
      <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div><label className="block mb-1 text-theme-secondary text-xs">عنوان</label><input value={form.title} onChange={e => setForm(s => ({ ...s, title: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً عید نوروز" /></div>
          <div><label className="block mb-1 text-theme-secondary text-xs">نوع</label>
            <select value={form.type} onChange={e => setForm(s => ({ ...s, type: e.target.value }))} className="input-theme text-sm">
              {Object.entries(TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="block mb-1 text-theme-secondary text-xs">تاریخ شروع (شمسی)</label><input dir="ltr" value={form.startDate} onChange={e => setForm(s => ({ ...s, startDate: e.target.value }))} className="input-theme text-sm" placeholder="1404/01/01" /></div>
          <div><label className="block mb-1 text-theme-secondary text-xs">تاریخ پایان (اختیاری)</label><input dir="ltr" value={form.endDate} onChange={e => setForm(s => ({ ...s, endDate: e.target.value }))} className="input-theme text-sm" placeholder="1404/01/13" /></div>
          <div><label className="block mb-1 text-theme-secondary text-xs">یادداشت</label><input value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} className="input-theme text-sm" /></div>
          <label className="flex items-center gap-2 text-sm text-theme-primary mt-6">
            <input type="checkbox" checked={form.recurring} onChange={e => setForm(s => ({ ...s, recurring: e.target.checked }))} /> تکرار هرساله
          </label>
        </div>
        <div className="flex items-center justify-end gap-3">
          {msg && <span className="text-sm text-theme-muted">{msg}</span>}
          <button onClick={add} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} افزودن تعطیلی
          </button>
        </div>
        <p className="text-[11px] text-theme-muted">تاریخ را شمسی وارد کنید (مثلاً 1404/01/01). برای تعطیلیِ یک‌روزه، تاریخ پایان را خالی بگذارید.</p>
      </div>

      {/* List */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30">
                <th className="py-2 px-2 font-medium">عنوان</th><th className="px-2 font-medium">نوع</th><th className="px-2 font-medium">از</th><th className="px-2 font-medium">تا</th><th className="px-2 font-medium">تکرار</th><th className="px-2 font-medium">حذف</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={6} className="py-8 text-theme-muted">تعطیلی ثبت نشده</td></tr> : rows.map(r => (
                  <tr key={r.id} className="border-b border-theme/40">
                    <td className="py-1.5 px-2 text-theme-primary">{r.title}</td>
                    <td className="px-2 text-theme-muted">{TYPE_FA[r.type] || r.type}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faDate(r.startDate)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faDate(r.endDate)}</td>
                    <td className="px-2 text-theme-muted">{r.recurring ? "بله" : "—"}</td>
                    <td className="px-2"><button onClick={() => del(r.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
