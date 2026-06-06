"use client";
import React from 'react';
import { Plus, Trash2, X, Handshake } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Row = { id: string; assetId: string; userId?: string; departmentId?: string; assignedAt: string; returnedAt?: string; asset?: any; user?: any; department?: any };

export default function AssignmentsPage() {
  React.useEffect(() => { document.title = 'واگذاری دارایی | Arzesh ERP'; }, []);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Row> | null>(null);
  const [assets, setAssets] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepts] = React.useState<any[]>([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    try { const r = await fetch(`${API}/asset-assignments`, { headers: { Authorization: `Bearer ${token}` } }); setRows(await r.json()); } catch { setRows([]); }
  }

  async function loadLookups() {
    const [a, u, d] = await Promise.all([
      fetch(`${API}/assets?take=100`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ]);
    setAssets(Array.isArray(a) ? a : a?.data || []);
    setUsers(Array.isArray(u) ? u : []);
    setDepts(Array.isArray(d) ? d : []);
  }

  React.useEffect(() => { load(); loadLookups(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    await fetch(`${API}/asset-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
    setOpen(false); setEditing(null); await load();
  }

  async function onReturn(id: string) {
    if (!confirm('بازگشت دارایی؟')) return;
    await fetch(`${API}/asset-assignments/${id}/return`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  async function onDelete(id: string) {
    if (!confirm('حذف واگذاری؟')) return;
    await fetch(`${API}/asset-assignments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl w-10 h-10">
                <Handshake className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">واگذاری دارایی</h1>
                <p className="text-theme-muted text-sm">{rows.length} واگذاری</p>
              </div>
            </div>
            <button onClick={() => { setEditing({}); setOpen(true); }} className="btn-theme-primary text-sm gap-1.5">
              <Plus className="w-4 h-4" /> واگذاری جدید
            </button>
          </div>
        </div>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th>دارایی</th>
                <th>تحویل‌گیرنده</th>
                <th>تاریخ واگذاری</th>
                <th>وضعیت</th>
                <th>اقدامات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-theme-muted">هیچ واگذاری‌ای ثبت نشده</td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td><span className="font-medium text-theme-primary">{r.asset?.name || r.assetId}</span></td>
                  <td><span className="text-theme-secondary text-sm">{r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() : r.department?.name || '-'}</span></td>
                  <td><span className="text-theme-secondary text-sm">{new Date(r.assignedAt).toLocaleDateString('fa-IR')}</span></td>
                  <td>
                    {r.returnedAt ? (
                      <span className="inline-flex items-center gap-1 bg-theme-secondary border border-theme px-2 py-0.5 rounded-full text-theme-muted text-xs">پایان یافته</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 text-xs">فعال</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {!r.returnedAt && (
                        <button onClick={() => onReturn(r.id)} className="btn-theme-secondary text-xs py-1 px-2.5">بازگشت</button>
                      )}
                      <button onClick={() => onDelete(r.id)} className="btn-theme-danger text-xs py-1 px-2.5">
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
                <h3 className="font-semibold text-theme-primary">واگذاری جدید</h3>
                <button onClick={() => setOpen(false)} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-sm">دارایی *</label>
                  <select value={editing?.assetId || ''} onChange={e => setEditing(s => ({ ...s, assetId: e.target.value }))} required className="select-theme">
                    <option value="">انتخاب دارایی...</option>
                    {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.barcode})</option>)}
                  </select>
                </div>
                <div className="gap-3 grid grid-cols-2">
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-secondary text-sm">کاربر</label>
                    <select value={editing?.userId || ''} onChange={e => setEditing(s => ({ ...s, userId: e.target.value, departmentId: '' }))} className="select-theme text-sm">
                      <option value="">بدون کاربر</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بخش</label>
                    <select value={editing?.departmentId || ''} onChange={e => setEditing(s => ({ ...s, departmentId: e.target.value, userId: '' }))} className="select-theme text-sm">
                      <option value="">بدون بخش</option>
                      {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn-theme-secondary text-sm">انصراف</button>
                  <button type="submit" className="btn-theme-primary text-sm">ثبت واگذاری</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
