"use client";
import React from 'react';
import { Plus, Pencil, Trash2, X, Layers, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Floor = { id: string; name: string; buildingId: string; description?: string; createdAt: string; building?: { id: string; name: string } };
type BuildingType = { id: string; name: string };

export default function FloorsPage() {
  React.useEffect(() => { document.title = 'طبقات | Arzesh ERP'; }, []);
  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Floor> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    setLoading(true);
    try {
      const [f, b] = await Promise.all([
        fetch(`${API}/floors`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/buildings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setFloors(Array.isArray(f) ? f : []);
      setBuildings(Array.isArray(b) ? b : []);
    } catch { setFloors([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing?.name?.trim() || !editing.buildingId) return;
    const m = editing.id ? 'PATCH' : 'POST';
    const u = editing.id ? `${API}/floors/${editing.id}` : `${API}/floors`;
    await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
    setOpen(false); setEditing(null); await load();
  }

  async function onDelete(id: string) {
    if (!confirm('آیا از حذف اطمینان دارید؟')) return;
    await fetch(`${API}/floors/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl w-10 h-10">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">طبقات</h1>
                <p className="text-theme-muted text-sm">{floors.length} طبقه</p>
              </div>
            </div>
            <button onClick={() => { setEditing({}); setOpen(true); }} className="btn-theme-primary text-sm gap-1.5">
              <Plus className="w-4 h-4" /> طبقه جدید
            </button>
          </div>
        </div>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr><th>نام طبقه</th><th>ساختمان</th><th>توضیحات</th><th>تاریخ ایجاد</th><th>اقدامات</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-theme-muted">در حال بارگیری...</td></tr>
              ) : floors.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-theme-muted">هیچ طبقه‌ای یافت نشد</td></tr>
              ) : floors.map(f => (
                <tr key={f.id}>
                  <td><div className="flex items-center gap-2"><Layers className="w-4 h-4 text-theme-muted" /><span className="font-medium text-theme-primary">{f.name}</span></div></td>
                  <td><div className="flex items-center gap-1.5 text-theme-secondary text-sm"><Building className="w-3.5 h-3.5 text-theme-muted" />{f.building?.name || '-'}</div></td>
                  <td><span className="text-theme-muted text-sm">{f.description || '-'}</span></td>
                  <td><span className="text-theme-muted text-sm">{new Date(f.createdAt).toLocaleDateString('fa-IR')}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(f); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5"><Pencil className="w-3 h-3" /> ویرایش</button>
                      <button onClick={() => onDelete(f.id)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-theme-primary shadow-2xl border border-theme rounded-2xl w-full max-w-md">
              <div className="flex justify-between items-center px-5 py-4 border-theme border-b">
                <h3 className="font-semibold text-theme-primary">{editing?.id ? 'ویرایش' : 'افزودن'} طبقه</h3>
                <button onClick={() => setOpen(false)} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">ساختمان *</label>
                  <select value={editing?.buildingId || ''} onChange={e => setEditing(s => ({ ...s, buildingId: e.target.value }))} required className="select-theme">
                    <option value="">انتخاب ساختمان...</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام طبقه *</label>
                  <input value={editing?.name || ''} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} required className="input-theme" placeholder="مثال: طبقه اول" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label>
                  <textarea value={editing?.description || ''} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} rows={2} className="input-theme resize-none" placeholder="توضیحات" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn-theme-secondary text-sm">انصراف</button>
                  <button type="submit" disabled={!editing?.name?.trim() || !editing?.buildingId} className="btn-theme-primary text-sm disabled:opacity-50">ذخیره</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
