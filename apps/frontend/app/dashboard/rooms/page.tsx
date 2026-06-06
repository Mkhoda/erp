"use client";
import React from 'react';
import { Plus, Pencil, Trash2, X, Home, Building, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Room = { id: string; name: string; buildingId: string; floorId?: string; description?: string; capacity?: number; createdAt: string; building?: { id: string; name: string }; floor?: { id: string; name: string } };
type BuildingType = { id: string; name: string };
type Floor = { id: string; name: string; buildingId: string };

export default function RoomsPage() {
  React.useEffect(() => { document.title = 'اتاق‌ها | Arzesh ERP'; }, []);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Room> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    setLoading(true);
    try {
      const [r, b, f] = await Promise.all([
        fetch(`${API}/rooms`, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
        fetch(`${API}/buildings`, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
        fetch(`${API}/floors`, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setBuildings(Array.isArray(b) ? b : []);
      setFloors(Array.isArray(f) ? f : []);
    } catch { setRooms([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  const filteredFloors = floors.filter(f => f.buildingId === editing?.buildingId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing?.name?.trim() || !editing.buildingId) return;
    const m = editing.id ? 'PATCH' : 'POST';
    const u = editing.id ? `${API}/rooms/${editing.id}` : `${API}/rooms`;
    await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
    setOpen(false); setEditing(null); await load();
  }

  async function onDelete(id: string) {
    if (!confirm('آیا از حذف اطمینان دارید؟')) return;
    await fetch(`${API}/rooms/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl w-10 h-10">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">اتاق‌ها</h1>
                <p className="text-theme-muted text-sm">{rooms.length} اتاق</p>
              </div>
            </div>
            <button onClick={() => { setEditing({}); setOpen(true); }} className="btn-theme-primary text-sm gap-1.5">
              <Plus className="w-4 h-4" /> اتاق جدید
            </button>
          </div>
        </div>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr><th>نام اتاق</th><th>ساختمان</th><th>طبقه</th><th>ظرفیت</th><th>توضیحات</th><th>اقدامات</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-theme-muted">در حال بارگیری...</td></tr>
              ) : rooms.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-theme-muted">هیچ اتاقی یافت نشد</td></tr>
              ) : rooms.map(r => (
                <tr key={r.id}>
                  <td><div className="flex items-center gap-2"><Home className="w-4 h-4 text-theme-muted" /><span className="font-medium text-theme-primary">{r.name}</span></div></td>
                  <td><div className="flex items-center gap-1.5 text-theme-secondary text-sm"><Building className="w-3.5 h-3.5 text-theme-muted" />{r.building?.name || '-'}</div></td>
                  <td><div className="flex items-center gap-1.5 text-theme-secondary text-sm"><Layers className="w-3.5 h-3.5 text-theme-muted" />{r.floor?.name || '-'}</div></td>
                  <td><span className="text-theme-secondary text-sm">{r.capacity || '-'}</span></td>
                  <td><span className="text-theme-muted text-sm">{r.description || '-'}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(r); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5"><Pencil className="w-3 h-3" /> ویرایش</button>
                      <button onClick={() => onDelete(r.id)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
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
              className="bg-theme-primary shadow-2xl border border-theme rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center px-5 py-4 border-theme border-b">
                <h3 className="font-semibold text-theme-primary">{editing?.id ? 'ویرایش' : 'افزودن'} اتاق</h3>
                <button onClick={() => setOpen(false)} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">ساختمان *</label>
                  <select value={editing?.buildingId || ''} onChange={e => setEditing(s => ({ ...s, buildingId: e.target.value, floorId: '' }))} required className="select-theme">
                    <option value="">انتخاب ساختمان...</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">طبقه</label>
                  <select value={editing?.floorId || ''} onChange={e => setEditing(s => ({ ...s, floorId: e.target.value }))} disabled={!editing?.buildingId} className="select-theme disabled:opacity-50">
                    <option value="">انتخاب طبقه (اختیاری)</option>
                    {filteredFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام اتاق *</label>
                  <input value={editing?.name || ''} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} required className="input-theme" placeholder="نام اتاق" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">ظرفیت</label>
                  <input type="number" min="1" value={editing?.capacity || ''} onChange={e => setEditing(s => ({ ...s, capacity: e.target.value ? parseInt(e.target.value) : undefined }))} className="input-theme" placeholder="تعداد نفر" />
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
