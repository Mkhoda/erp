"use client";
import React from 'react';
import { Plus, Pencil, Trash2, X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Item = { id: string; name: string; codePrefix?: string; description?: string };

export default function AssetCategoriesPage() {
  React.useEffect(() => { document.title = 'دسته‌بندی دارایی | Arzesh ERP'; }, []);
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Item> | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    try { const r = await fetch(`${API}/asset-categories`, { headers: { Authorization: `Bearer ${token}` } }); setItems(await r.json()); } catch { setItems([]); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    const m = editing.id ? 'PATCH' : 'POST';
    const u = editing.id ? `${API}/asset-categories/${editing.id}` : `${API}/asset-categories`;
    await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
    setOpen(false); setEditing(null); await load();
  }

  async function onDelete(id: string) {
    if (!confirm('حذف شود؟')) return;
    await fetch(`${API}/asset-categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl w-10 h-10">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">دسته‌بندی دارایی</h1>
                <p className="text-theme-muted text-sm">{items.length} دسته‌بندی</p>
              </div>
            </div>
            <button onClick={() => { setEditing({ name: '' }); setOpen(true); }} className="btn-theme-primary text-sm gap-1.5">
              <Plus className="w-4 h-4" /> افزودن
            </button>
          </div>
        </div>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th>نام</th>
                <th>پیشوند کد</th>
                <th>توضیحات</th>
                <th>اقدامات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-theme-muted">هیچ دسته‌بندی ثبت نشده</td></tr>
              ) : items.map(it => (
                <tr key={it.id}>
                  <td><span className="font-medium text-theme-primary">{it.name}</span></td>
                  <td><code className="bg-theme-secondary px-2 py-0.5 rounded text-xs font-mono text-theme-secondary">{it.codePrefix || '-'}</code></td>
                  <td><span className="text-theme-muted text-sm">{it.description || '-'}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(it); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5">
                        <Pencil className="w-3 h-3" /> ویرایش
                      </button>
                      <button onClick={() => onDelete(it.id)} className="btn-theme-danger text-xs py-1 px-2.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
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
                <h3 className="font-semibold text-theme-primary">{editing?.id ? 'ویرایش' : 'افزودن'} دسته‌بندی</h3>
                <button onClick={() => setOpen(false)} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام *</label>
                  <input value={editing?.name || ''} onChange={e => setEditing(s => s ? { ...s, name: e.target.value } : s)} required className="input-theme" placeholder="نام دسته‌بندی" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">پیشوند کد</label>
                  <input value={editing?.codePrefix || ''} onChange={e => setEditing(s => s ? { ...s, codePrefix: e.target.value } : s)} className="input-theme font-mono" placeholder="مثال: COMP" dir="ltr" />
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
