"use client";
import React from 'react';
import { Plus, Pencil, Trash2, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Item = { id: string; name: string; description?: string };

export default function AssetTypesPage() {
  React.useEffect(() => { document.title = 'انواع دارایی | Arzesh ERP'; }, []);
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Item> | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    try { const r = await fetch(`${API}/asset-types`, { headers: { Authorization: `Bearer ${token}` } }); setItems(await r.json()); } catch { setItems([]); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    const m = editing.id ? 'PATCH' : 'POST';
    const u = editing.id ? `${API}/asset-types/${editing.id}` : `${API}/asset-types`;
    await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
    setOpen(false); setEditing(null); await load();
  }

  async function onDelete(id: string) {
    if (!confirm('حذف شود؟')) return;
    await fetch(`${API}/asset-types/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl w-10 h-10">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">انواع دارایی</h1>
                <p className="text-theme-muted text-sm">{items.length} نوع تعریف شده</p>
              </div>
            </div>
            <button onClick={() => { setEditing({ name: '' }); setOpen(true); }} className="btn-theme-primary text-sm gap-1.5">
              <Plus className="w-4 h-4" /> افزودن
            </button>
          </div>
        </div>
      </div>

      <div className="gap-4 grid sm:grid-cols-2 lg:grid-cols-3">
        {items.map(it => (
          <div key={it.id} className="card-theme">
            <div className="card-theme-body">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-theme-primary">{it.name}</div>
                  <div className="mt-1 text-theme-muted text-xs">{it.description || '-'}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setEditing(it); setOpen(true); }} className="btn-theme-secondary text-xs flex-1 justify-center py-1.5">
                  <Pencil className="w-3 h-3" /> ویرایش
                </button>
                <button onClick={() => onDelete(it.id)} className="btn-theme-danger text-xs py-1.5 px-3">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-3 py-16 text-center text-theme-muted">هیچ نوع دارایی‌ای ثبت نشده</div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) { setOpen(false); } }}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-theme-primary shadow-2xl border border-theme rounded-2xl w-full max-w-md">
              <div className="flex justify-between items-center px-5 py-4 border-theme border-b">
                <h3 className="font-semibold text-theme-primary">{editing?.id ? 'ویرایش' : 'افزودن'} نوع دارایی</h3>
                <button onClick={() => setOpen(false)} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام *</label>
                  <input value={editing?.name || ''} onChange={e => setEditing(s => s ? { ...s, name: e.target.value } : s)} required className="input-theme" placeholder="نام نوع دارایی" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label>
                  <input value={editing?.description || ''} onChange={e => setEditing(s => s ? { ...s, description: e.target.value } : s)} className="input-theme" placeholder="توضیحات" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn-theme-secondary text-sm">انصراف</button>
                  <button type="submit" className="btn-theme-primary text-sm">ذخیره</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
