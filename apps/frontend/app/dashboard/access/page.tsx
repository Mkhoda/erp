"use client";
import React from 'react';
import { Plus, Trash2, RefreshCw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Dept = { id: string; name: string };
type KnownPage = { page: string; label: string };
type PermRow = { id: string; page: string; role: string; canRead: boolean; canWrite: boolean; department: { id: string; name: string } };

const ROLES = ['*', 'ADMIN', 'MANAGER', 'EXPERT', 'USER'] as const;
const ROLE_LABELS: Record<string, string> = { '*': 'همه نقش‌ها', ADMIN: 'مدیر ارشد', MANAGER: 'مدیر', EXPERT: 'کارشناس', USER: 'کاربر' };

export default function AccessPage() {
  React.useEffect(() => { document.title = 'دسترسی صفحات | Arzesh ERP'; }, []);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authH = { Authorization: `Bearer ${token}` };

  const [pages, setPages] = React.useState<KnownPage[]>([]);
  const [perms, setPerms] = React.useState<PermRow[]>([]);
  const [depts, setDepts] = React.useState<Dept[]>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [addTarget, setAddTarget] = React.useState<string | null>(null);
  const [newDept, setNewDept] = React.useState('');
  const [newRole, setNewRole] = React.useState('*');
  const [newRead, setNewRead] = React.useState(true);
  const [newWrite, setNewWrite] = React.useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, allRes, dRes] = await Promise.all([
        fetch(`${API}/permissions/pages`, { headers: authH }),
        fetch(`${API}/permissions/all`, { headers: authH }),
        fetch(`${API}/departments`, { headers: authH }),
      ]);
      if (pRes.ok) setPages(await pRes.json());
      if (allRes.ok) setPerms(await allRes.json());
      if (dRes.ok) setDepts(await dRes.json());
    } finally { setLoading(false); }
  }
  React.useEffect(() => { loadAll(); }, []);

  async function syncDefaults() {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/permissions/sync-defaults`, { method: 'POST', headers: authH });
      if (r.ok) { const d = await r.json(); alert(`${d.created} ردیف پیش‌فرض ایجاد شد`); await loadAll(); }
    } finally { setSyncing(false); }
  }

  async function removeRow(row: PermRow) {
    if (!confirm(`حذف دسترسی "${row.page}" برای "${row.department.name}"؟`)) return;
    await fetch(`${API}/permissions/${row.department.id}/${encodeURIComponent(row.page)}/${encodeURIComponent(row.role)}`, { method: 'DELETE', headers: authH });
    await loadAll();
  }

  async function toggleFlag(row: PermRow, field: 'canRead' | 'canWrite') {
    await fetch(`${API}/permissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authH },
      body: JSON.stringify({ departmentId: row.department.id, page: row.page, role: row.role, canRead: field === 'canRead' ? !row.canRead : row.canRead, canWrite: field === 'canWrite' ? !row.canWrite : row.canWrite }),
    });
    await loadAll();
  }

  async function addRule(page: string) {
    if (!newDept) return alert('یک بخش انتخاب کنید');
    await fetch(`${API}/permissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authH },
      body: JSON.stringify({ departmentId: newDept, page, role: newRole, canRead: newRead, canWrite: newWrite }),
    });
    setAddTarget(null); await loadAll();
  }

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`w-9 h-5 rounded-full transition-colors relative ${on ? 'bg-emerald-500' : 'bg-theme-secondary border border-theme'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'right-0.5' : 'right-[calc(100%-18px)]'}`} />
    </button>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl w-10 h-10">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">مدیریت دسترسی صفحات</h1>
                <p className="text-theme-muted text-sm">بخش + نقش ← صفحه</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={loadAll} disabled={loading} className="btn-theme-secondary text-sm gap-1.5 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تازه‌سازی
              </button>
              <button onClick={syncDefaults} disabled={syncing} className="btn-theme-primary text-sm gap-1.5 disabled:opacity-50">
                <ShieldCheck className="w-4 h-4" /> {syncing ? '...' : 'اعمال پیش‌فرض'}
              </button>
            </div>
          </div>
          <p className="mt-3 text-theme-muted text-xs">«اعمال پیش‌فرض» برای هر صفحه × هر بخش یک ردیف canRead=true ایجاد می‌کند. ADMIN همیشه دسترسی کامل دارد.</p>
        </div>
      </div>

      {loading && <div className="py-8 text-center text-theme-muted">در حال بارگیری...</div>}

      <div className="space-y-2">
        {pages.map(({ page, label }) => {
          const rows = perms.filter(p => p.page === page);
          const open = !!expanded[page];
          return (
            <div key={page} className="card-theme overflow-hidden">
              <button
                onClick={() => setExpanded(s => ({ ...s, [page]: !s[page] }))}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-theme-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-theme-primary text-sm">{label}</span>
                  <code className="bg-theme-secondary px-2 py-0.5 rounded text-xs font-mono text-theme-muted">{page}</code>
                  <span className="badge-theme text-xs">{rows.length} قانون</span>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-theme border-t">
                    {rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="table-theme">
                          <thead><tr><th>بخش</th><th>نقش</th><th className="text-center">خواندن</th><th className="text-center">نوشتن</th><th /></tr></thead>
                          <tbody>
                            {rows.map(row => (
                              <tr key={row.id}>
                                <td>
                                  <span className="inline-flex items-center bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 text-xs">
                                    {row.department.name}
                                  </span>
                                </td>
                                <td>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.role === '*' ? 'bg-theme-secondary text-theme-muted border-theme border' : 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 border text-purple-700 dark:text-purple-300'}`}>
                                    {ROLE_LABELS[row.role] ?? row.role}
                                  </span>
                                </td>
                                <td className="text-center"><Toggle on={row.canRead} onClick={() => toggleFlag(row, 'canRead')} /></td>
                                <td className="text-center"><Toggle on={row.canWrite} onClick={() => toggleFlag(row, 'canWrite')} /></td>
                                <td className="text-left">
                                  <button onClick={() => removeRow(row)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rows.length === 0 && <div className="px-5 py-3 text-theme-muted text-sm">هیچ قانونی تعریف نشده</div>}

                    {addTarget === page ? (
                      <div className="flex flex-wrap gap-3 items-end px-5 py-3 bg-blue-50/30 dark:bg-blue-950/20 border-theme border-t">
                        <div>
                          <label className="block mb-1 text-xs text-theme-muted">بخش *</label>
                          <select value={newDept} onChange={e => setNewDept(e.target.value)} className="select-theme text-xs py-1.5">
                            <option value="">انتخاب بخش...</option>
                            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block mb-1 text-xs text-theme-muted">نقش</label>
                          <select value={newRole} onChange={e => setNewRole(e.target.value)} className="select-theme text-xs py-1.5">
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        </div>
                        <label className="flex items-center gap-1.5 text-sm text-theme-secondary cursor-pointer">
                          <input type="checkbox" checked={newRead} onChange={e => setNewRead(e.target.checked)} className="rounded" /> خواندن
                        </label>
                        <label className="flex items-center gap-1.5 text-sm text-theme-secondary cursor-pointer">
                          <input type="checkbox" checked={newWrite} onChange={e => setNewWrite(e.target.checked)} className="rounded" /> نوشتن
                        </label>
                        <button onClick={() => addRule(page)} className="btn-theme-primary text-xs py-1.5">ذخیره</button>
                        <button onClick={() => setAddTarget(null)} className="btn-theme-secondary text-xs py-1.5">لغو</button>
                      </div>
                    ) : (
                      <div className="px-5 py-3 border-theme border-t">
                        <button onClick={() => { setAddTarget(page); setNewDept(''); setNewRole('*'); setNewRead(true); setNewWrite(false); }}
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                          <Plus className="w-4 h-4" /> افزودن قانون
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
