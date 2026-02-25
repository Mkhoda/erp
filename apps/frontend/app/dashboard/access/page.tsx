"use client";
import React from 'react';
import { Plus, Trash2, RefreshCw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Dept = { id: string; name: string };
type KnownPage = { page: string; label: string };
type PermRow = {
  id: string;
  page: string;
  role: string;
  canRead: boolean;
  canWrite: boolean;
  department: { id: string; name: string };
};

const ROLES = ['*', 'ADMIN', 'MANAGER', 'EXPERT', 'USER'] as const;
const ROLE_LABELS: Record<string, string> = {
  '*': 'همه نقش‌ها',
  ADMIN: 'مدیر سیستم',
  MANAGER: 'مدیر',
  EXPERT: 'متخصص',
  USER: 'کاربر',
};

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

  // add-rule form state
  const [addTarget, setAddTarget] = React.useState<string | null>(null); // page slug
  const [newDept, setNewDept] = React.useState('');
  const [newRole, setNewRole] = React.useState('*');
  const [newRead, setNewRead] = React.useState(true);
  const [newWrite, setNewWrite] = React.useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, allRes, dRes] = await Promise.all([
        fetch(`${API}/permissions/pages`, { headers: authH }),
        fetch(`${API}/permissions/all`,   { headers: authH }),
        fetch(`${API}/departments`,        { headers: authH }),
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
    if (!confirm(`حذف دسترسی "${row.page}" برای بخش "${row.department.name}" (نقش: ${ROLE_LABELS[row.role] ?? row.role})?`)) return;
    const encodedPage = encodeURIComponent(row.page.replace(/\//g, '_'));
    await fetch(`${API}/permissions/${row.department.id}/${encodeURIComponent(row.page)}/${encodeURIComponent(row.role)}`, {
      method: 'DELETE', headers: authH,
    });
    await loadAll();
  }

  async function toggleFlag(row: PermRow, field: 'canRead' | 'canWrite') {
    await fetch(`${API}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH },
      body: JSON.stringify({ departmentId: row.department.id, page: row.page, role: row.role, canRead: field === 'canRead' ? !row.canRead : row.canRead, canWrite: field === 'canWrite' ? !row.canWrite : row.canWrite }),
    });
    await loadAll();
  }

  async function addRule(page: string) {
    if (!newDept) return alert('یک بخش انتخاب کنید');
    await fetch(`${API}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authH },
      body: JSON.stringify({ departmentId: newDept, page, role: newRole, canRead: newRead, canWrite: newWrite }),
    });
    setAddTarget(null);
    await loadAll();
  }

  const rowsFor = (page: string) => perms.filter(p => p.page === page);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-gray-100 text-xl">مدیریت دسترسی صفحات</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">بخش + نقش ← صفحه</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadAll} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تازه‌سازی
            </button>
            <button onClick={syncDefaults} disabled={syncing} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
              <ShieldCheck className="w-4 h-4" /> {syncing ? '...' : 'اعمال پیش‌فرض برای همه'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-gray-500 dark:text-gray-400 text-xs">
          «اعمال پیش‌فرض» برای هر صفحه × هر بخش یک ردیف canRead=true (نقش: همه) ایجاد می‌کند — ردیف‌های موجود تغییر نمی‌کنند.
          مدیر سیستم (ADMIN) همیشه به تمام صفحات دسترسی دارد و نیازی به تنظیم جداگانه ندارد.
        </p>
      </div>

      {/* Page list */}
      {loading && <div className="text-center text-gray-400 py-8">در حال بارگیری...</div>}
      {!loading && pages.map(({ page, label }) => {
        const rows = rowsFor(page);
        const open = !!expanded[page];
        return (
          <div key={page} className="bg-white/70 dark:bg-gray-900/70 border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm">
            {/* Page row header */}
            <button
              onClick={() => setExpanded(s => ({ ...s, [page]: !s[page] }))}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
                <span className="font-mono text-gray-400 text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{page}</span>
                <span className="text-xs text-gray-500">{rows.length} قانون</span>
              </div>
              {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {open && (
              <div className="border-t border-gray-200/50 dark:border-gray-700/50">
                {rows.length === 0 && (
                  <div className="px-5 py-3 text-gray-400 text-sm">هیچ قانونی تعریف نشده</div>
                )}
                {rows.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="px-5 py-2 text-right font-medium text-gray-500 text-xs">بخش</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500 text-xs">نقش</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500 text-xs">خواندن</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-500 text-xs">نوشتن</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {rows.map(row => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded">
                              {row.department.name}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${row.role === '*' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'}`}>
                              {ROLE_LABELS[row.role] ?? row.role}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => toggleFlag(row, 'canRead')} className={`w-8 h-5 rounded-full transition-colors ${row.canRead ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                              <span className={`block w-3 h-3 rounded-full bg-white shadow mx-0.5 transition-transform ${row.canRead ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => toggleFlag(row, 'canWrite')} className={`w-8 h-5 rounded-full transition-colors ${row.canWrite ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                              <span className={`block w-3 h-3 rounded-full bg-white shadow mx-0.5 transition-transform ${row.canWrite ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button onClick={() => removeRow(row)} className="text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add rule section */}
                {addTarget === page ? (
                  <div className="flex flex-wrap gap-2 items-end px-5 py-3 bg-indigo-50/50 dark:bg-indigo-950/30 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">بخش *</label>
                      <select value={newDept} onChange={e => setNewDept(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-900">
                        <option value="">انتخاب بخش...</option>
                        {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">نقش</label>
                      <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-900">
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={newRead} onChange={e => setNewRead(e.target.checked)} className="rounded" />
                      خواندن
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={newWrite} onChange={e => setNewWrite(e.target.checked)} className="rounded" />
                      نوشتن
                    </label>
                    <button onClick={() => addRule(page)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm">ذخیره</button>
                    <button onClick={() => setAddTarget(null)} className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">لغو</button>
                  </div>
                ) : (
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => { setAddTarget(page); setNewDept(''); setNewRole('*'); setNewRead(true); setNewWrite(false); }} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                      <Plus className="w-4 h-4" /> افزودن قانون دسترسی
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
