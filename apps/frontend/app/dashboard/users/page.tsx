"use client";
import React from 'react';
import { List, LayoutGrid, Plus, Pencil, Trash2, X, Users as UsersIcon, Search, Upload, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type User = {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'EXPERT';
  departmentId?: string | null;
  department?: { id: string; name: string };
  userDepartments?: Array<{ departmentId: string; department?: { id: string; name: string } }>;
};

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  MANAGER: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  EXPERT: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  USER: 'bg-theme-secondary text-theme-secondary border-theme',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدیر ارشد',
  MANAGER: 'مدیر',
  EXPERT: 'کارشناس',
  USER: 'کاربر',
};

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-amber-500 to-amber-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
];

export default function UsersPage() {
  React.useEffect(() => { document.title = 'مدیریت کاربران | Arzesh ERP'; }, []);

  const [users, setUsers] = React.useState<User[]>([]);
  const [view, setView] = React.useState<'list' | 'grid'>('list');
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  const [deptSearch, setDeptSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<'ALL' | 'ADMIN' | 'MANAGER' | 'USER' | 'EXPERT'>('ALL');
  const [departmentFilter, setDepartmentFilter] = React.useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    try {
      const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); }
  }

  async function loadDeps() {
    try {
      const r = await fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } });
      setDepartments(await r.json());
    } catch { setDepartments([]); }
  }

  React.useEffect(() => { load(); loadDeps(); }, []);

  const filtered = users.filter(u => {
    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const matchesQ = name.includes(query.toLowerCase()) ||
      (u.phone || '').includes(query) ||
      (u.email || '').toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesDept = !departmentFilter ||
      u.department?.id === departmentFilter ||
      u.userDepartments?.some(x => x.departmentId === departmentFilter);
    return matchesQ && matchesRole && matchesDept;
  });

  function onAdd() { setEditing({ firstName: '', lastName: '', phone: '', email: '', role: 'USER', departmentIds: [] }); setOpen(true); }
  function onEdit(u: User) {
    const deptIds = Array.isArray(u.userDepartments) ? u.userDepartments.map(x => x.departmentId) : [];
    setEditing({ ...u, departmentIds: deptIds });
    setOpen(true);
  }
  async function onDelete(id: string) {
    if (!confirm('آیا مطمئن هستید؟')) return;
    await fetch(`${API}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const method = editing.id ? 'PATCH' : 'POST';
    const url = editing.id ? `${API}/users/${editing.id}` : `${API}/users`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
    setOpen(false); setEditing(null); await load();
  }

  const avatarColor = (u: User) => AVATAR_COLORS[(u.firstName?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20 rounded-xl w-10 h-10">
                <UsersIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">مدیریت کاربران</h1>
                <p className="text-theme-muted text-sm">{users.length} کاربر در سیستم</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              <div className="flex bg-theme-secondary p-1 rounded-xl border border-theme">
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'list' ? 'bg-theme-card shadow text-theme-primary' : 'text-theme-muted hover:text-theme-secondary'}`}
                >
                  <List className="w-3.5 h-3.5" /> فهرست
                </button>
                <button
                  onClick={() => setView('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === 'grid' ? 'bg-theme-card shadow text-theme-primary' : 'text-theme-muted hover:text-theme-secondary'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> کارت
                </button>
              </div>
              <button onClick={() => setBulkOpen(true)} className="btn-theme-secondary text-xs gap-1.5">
                <Upload className="w-3.5 h-3.5" /> وارد دسته‌ای
              </button>
              <button onClick={onAdd} className="btn-theme-primary text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" /> افزودن کاربر
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-theme">
        <div className="card-theme-body py-3">
          <div className="gap-3 grid grid-cols-1 md:grid-cols-3">
            <div className="relative">
              <Search className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
              <input
                type="text"
                placeholder="جستجو نام، موبایل..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="input-theme pr-10 text-sm"
              />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="select-theme text-sm">
              <option value="ALL">همه نقش‌ها</option>
              <option value="ADMIN">مدیر ارشد</option>
              <option value="MANAGER">مدیر</option>
              <option value="EXPERT">کارشناس</option>
              <option value="USER">کاربر</option>
            </select>
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="select-theme text-sm">
              <option value="">همه دپارتمان‌ها</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <p className="mt-2 text-theme-muted text-xs">{filtered.length} کاربر یافت شد</p>
        </div>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <div className="table-theme-container">
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>موبایل</th>
                  <th>نقش</th>
                  <th>دپارتمان</th>
                  <th>اقدامات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-theme-muted">کاربری یافت نشد</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(u)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                          {(u.firstName?.[0] || u.phone?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-theme-primary text-sm">{u.firstName} {u.lastName}</div>
                          {u.email && <div className="text-theme-muted text-xs">{u.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-theme-secondary text-sm" dir="ltr">
                        {u.phone ? <><Phone className="w-3 h-3 text-theme-muted" />{u.phone}</> : <span className="text-theme-muted">-</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.userDepartments?.length ? u.userDepartments.map(x => (
                          <span key={x.departmentId} className="inline-flex items-center bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs">
                            {x.department?.name || x.departmentId}
                          </span>
                        )) : <span className="text-theme-muted text-sm">-</span>}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => onEdit(u)} className="inline-flex items-center gap-1 btn-theme-secondary text-xs py-1 px-2.5">
                          <Pencil className="w-3 h-3" /> ویرایش
                        </button>
                        <button onClick={() => onDelete(u.id)} className="btn-theme-danger text-xs py-1 px-2.5">
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
      ) : (
        <div className="gap-4 grid sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(u => (
            <div key={u.id} className="card-theme group cursor-default">
              <div className="card-theme-body">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColor(u)} flex items-center justify-center text-white font-semibold shrink-0`}>
                      {(u.firstName?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-theme-primary text-sm">{u.firstName} {u.lastName}</div>
                      {u.phone && <div className="text-theme-muted text-xs" dir="ltr">{u.phone}</div>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {u.userDepartments?.length ? u.userDepartments.map(x => (
                    <span key={x.departmentId} className="inline-flex items-center bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs">
                      {x.department?.name || x.departmentId}
                    </span>
                  )) : <span className="text-theme-muted text-xs">دپارتمان تعیین نشده</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(u)} className="btn-theme-secondary flex-1 justify-center text-xs py-1.5">
                    <Pencil className="w-3 h-3" /> ویرایش
                  </button>
                  <button onClick={() => onDelete(u.id)} className="btn-theme-danger py-1.5 px-3">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-theme-muted">کاربری یافت نشد</div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) { setOpen(false); setEditing(null); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-theme-primary shadow-2xl border border-theme rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center px-6 py-4 border-theme border-b">
                <h3 className="font-semibold text-theme-primary">
                  {editing?.id ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}
                </h3>
                <button onClick={() => { setOpen(false); setEditing(null); }} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={onSubmit} className="px-6 py-4 space-y-4">
                <div className="gap-3 grid grid-cols-2">
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نام</label>
                    <input value={editing?.firstName || ''} onChange={e => setEditing((s: any) => ({ ...s, firstName: e.target.value }))} required className="input-theme text-sm" placeholder="نام" />
                  </div>
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نام خانوادگی</label>
                    <input value={editing?.lastName || ''} onChange={e => setEditing((s: any) => ({ ...s, lastName: e.target.value }))} required className="input-theme text-sm" placeholder="نام خانوادگی" />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-xs">شماره موبایل</label>
                  <input type="tel" dir="ltr" value={editing?.phone || ''} onChange={e => setEditing((s: any) => ({ ...s, phone: e.target.value }))} className="input-theme text-sm text-right" placeholder="09123456789" />
                </div>
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-xs">ایمیل (اختیاری)</label>
                  <input type="email" dir="ltr" value={editing?.email || ''} onChange={e => setEditing((s: any) => ({ ...s, email: e.target.value }))} className="input-theme text-sm" placeholder="email@example.com" />
                </div>
                {!editing?.id && (
                  <div>
                    <label className="block mb-1.5 font-medium text-theme-secondary text-xs">رمز عبور</label>
                    <input type="password" value={editing?.password || ''} onChange={e => setEditing((s: any) => ({ ...s, password: e.target.value }))} required className="input-theme text-sm" placeholder="رمز عبور" />
                  </div>
                )}
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نقش</label>
                  <select value={editing?.role || 'USER'} onChange={e => setEditing((s: any) => ({ ...s, role: e.target.value }))} className="select-theme text-sm">
                    <option value="USER">کاربر</option>
                    <option value="EXPERT">کارشناس</option>
                    <option value="MANAGER">مدیر</option>
                    <option value="ADMIN">مدیر ارشد</option>
                  </select>
                </div>
                {/* Departments */}
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-xs">دپارتمان‌ها</label>
                  <div className="bg-theme-secondary border border-theme rounded-xl p-3">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(editing?.departmentIds || []).map((id: string) => {
                        const d = departments.find(x => x.id === id);
                        if (!d) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs">
                            {d.name}
                            <button type="button" onClick={() => setEditing((s: any) => ({ ...s, departmentIds: s.departmentIds.filter((x: string) => x !== id) }))}>
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <input placeholder="جستجوی دپارتمان..." value={deptSearch} onChange={e => setDeptSearch(e.target.value)} className="input-theme text-xs mb-2" />
                    <div className="border border-theme rounded-lg max-h-28 overflow-auto">
                      {departments.filter(d => d.name.includes(deptSearch)).map(d => (
                        <label key={d.id} className="flex items-center gap-2 hover:bg-theme-hover px-3 py-1.5 text-xs cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={(editing?.departmentIds || []).includes(d.id)}
                            onChange={() => setEditing((s: any) => {
                              const arr = [...(s.departmentIds || [])];
                              const idx = arr.indexOf(d.id);
                              if (idx >= 0) arr.splice(idx, 1); else arr.push(d.id);
                              return { ...s, departmentIds: arr };
                            })}
                            className="rounded text-blue-600"
                          />
                          <span className="text-theme-secondary">{d.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button>
                  <button type="submit" className="btn-theme-primary text-sm">ذخیره</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Import Modal */}
      {bulkOpen && (
        <BulkImportModal
          onClose={() => setBulkOpen(false)}
          onImported={async () => { setBulkOpen(false); await load(); }}
          departments={departments}
        />
      )}
    </div>
  );
}

function BulkImportModal({ onClose, onImported, departments }: { onClose: () => void; onImported: () => void; departments: Array<{ id: string; name: string }> }) {
  const [text, setText] = React.useState('');
  const [preview, setPreview] = React.useState<Array<Record<string, string>> | null>(null);
  const [headers, setHeaders] = React.useState<string[] | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [fileName, setFileName] = React.useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  function parseCSV(src: string) {
    const lines = src.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const parseLine = (line: string) => {
      const cols: string[] = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === delim && !inQ) { cols.push(cur); cur = ''; }
        else cur += c;
      }
      cols.push(cur);
      return cols.map(c => c.trim());
    };
    const h = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => { const c = parseLine(line); const o: Record<string, string> = {}; h.forEach((k, i) => { o[k] = c[i] ?? ''; }); return o; });
    return { headers: h, rows };
  }

  function process(src: string) {
    setText(src);
    const { headers: h, rows } = parseCSV(src);
    setHeaders(h); setPreview(rows);
    if (h.length && !Object.keys(mapping).length) {
      const map: Record<string, string> = {};
      for (const hdr of h) {
        const l = hdr.toLowerCase();
        if (!map.phone && (l === 'phone' || l.includes('phone') || l.includes('تلفن') || l.includes('موبایل'))) map.phone = hdr;
        if (!map.firstName && (l.includes('first') || l === 'نام')) map.firstName = hdr;
        if (!map.lastName && (l.includes('last') || l.includes('خانوادگی'))) map.lastName = hdr;
        if (!map.role && (l === 'role' || l.includes('نقش'))) map.role = hdr;
        if (!map.departmentId && (l.includes('department') || l.includes('دپارتمان'))) map.departmentId = hdr;
        if (!map.password && l.includes('pass')) map.password = hdr;
        if (!map.email && l.includes('email')) map.email = hdr;
      }
      setMapping(map);
    }
  }

  async function importNow() {
    if (!preview?.length) return alert('هیچ داده‌ای وجود ندارد');
    const users = preview.map(r => ({
      phone: mapping.phone ? r[mapping.phone] : (r.phone || r.Phone),
      email: mapping.email ? r[mapping.email] : r.email,
      firstName: mapping.firstName ? r[mapping.firstName] : (r.firstName || r.نام),
      lastName: mapping.lastName ? r[mapping.lastName] : r.lastName,
      role: mapping.role ? r[mapping.role] : (r.role || 'USER'),
      departmentId: mapping.departmentId ? r[mapping.departmentId] : r.departmentId,
      password: mapping.password ? r[mapping.password] : r.password,
    }));
    try {
      const res = await fetch(`${API}/users/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ users }) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      alert(`وارد شده: ${data.imported}\nخطاها: ${data.errors?.length || 0}`);
      onImported();
    } catch (err: any) { alert('خطا: ' + (err?.message || String(err))); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-theme-primary shadow-2xl border border-theme rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-theme border-b">
          <h3 className="font-semibold text-theme-primary">وارد کردن دسته‌ای کاربران (CSV)</h3>
          <button onClick={onClose} className="hover:bg-theme-hover p-1.5 rounded-lg text-theme-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="gap-4 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">آپلود فایل CSV</label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-theme rounded-xl p-6 cursor-pointer hover:bg-theme-hover transition-colors">
                <Upload className="w-6 h-6 text-theme-muted mb-2" />
                <span className="text-theme-muted text-xs">{fileName || 'کلیک کنید یا بکشید'}</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setFileName(f.name); f.text().then(process); }} />
              </label>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">یا متن CSV پیست کنید</label>
              <textarea rows={8} value={text} onChange={e => process(e.target.value)} className="input-theme text-xs resize-none font-mono" placeholder="firstName,lastName,phone,role&#10;علی,رضایی,09121234567,USER" dir="ltr" />
            </div>
          </div>

          {headers && headers.length > 0 && (
            <div className="bg-theme-secondary border border-theme rounded-xl p-4">
              <div className="mb-2 font-medium text-theme-primary text-xs">نقشه‌بندی ستون‌ها</div>
              <div className="gap-2 grid grid-cols-2">
                {['phone', 'firstName', 'lastName', 'role', 'departmentId', 'password', 'email'].map(field => (
                  <label key={field} className="flex items-center gap-2 text-xs">
                    <span className="w-24 text-theme-secondary text-right">{field}</span>
                    <select className="select-theme flex-1 text-xs py-1" value={mapping[field] || ''} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}>
                      <option value="">-- انتخاب --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          {preview && preview.length > 0 && (
            <div>
              <div className="mb-1.5 font-medium text-theme-secondary text-xs">پیش‌نمایش ({preview.length} ردیف)</div>
              <div className="table-theme-container max-h-40 overflow-auto">
                <table className="table-theme text-xs">
                  <thead><tr>{Object.keys(preview[0]).slice(0, 6).map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{preview.slice(0, 8).map((r, i) => <tr key={i}>{Object.values(r).slice(0, 6).map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-theme-secondary text-sm">انصراف</button>
            <button onClick={importNow} disabled={!preview?.length} className="btn-theme-primary text-sm disabled:opacity-50">
              <Upload className="w-4 h-4" /> وارد کن
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
