"use client";
import React from 'react';
import { List, LayoutGrid, Plus, Pencil, Trash2, X, Users as UsersIcon } from 'lucide-react';

type User = { id: string; email: string; firstName: string; lastName: string; role: 'ADMIN'|'MANAGER'|'USER'|'EXPERT'; departmentId?: string|null; department?: { id:string; name:string }; userDepartments?: Array<{ departmentId: string; department?: { id: string; name: string } }> };
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function UsersPage() {
  React.useEffect(() => {
    document.title = 'مدیریت کاربران | Arzesh ERP';
  }, []);

  const [users, setUsers] = React.useState<User[]>([]);
  const [view, setView] = React.useState<'list'|'grid'>('list');
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<User> | null>(null);
  const [departments, setDepartments] = React.useState<Array<{id:string; name:string}>>([]);
  const [deptSearch, setDeptSearch] = React.useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    try {
      const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` }});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load users', e);
      setUsers([]);
    }
  }
  async function loadDeps(){ const r = await fetch(`${API}/departments`, { headers:{ Authorization:`Bearer ${token}` }}); setDepartments(await r.json()); }
  React.useEffect(()=>{ load(); loadDeps(); },[]);

  const filtered = Array.isArray(users) ? users.filter(u => (`${u.firstName||''} ${u.lastName||''}`).includes(query) || u.email?.includes(query)) : [];
  function onAdd() { setEditing({ email: '', firstName: '', lastName: '', role: 'USER' }); setOpen(true); }
  function onEdit(u: User) {
    const deptIds = Array.isArray(u.userDepartments) ? u.userDepartments.map(x=>x.departmentId) : [];
    setEditing({ ...u, departmentIds: deptIds } as any);
    setOpen(true);
  }
  async function onDelete(id:string){ if(!confirm('حذف شود؟'))return; await fetch(`${API}/users/${id}`, {method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); await load(); }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!editing) return;
  const method = editing.id ? 'PATCH' : 'POST';
  const url = editing.id ? `${API}/users/${editing.id}` : `${API}/users`;
  await fetch(url, { method, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify(editing)});
    setOpen(false); setEditing(null); await load();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-4">
          <div>
            <h1 className="flex items-center gap-3 font-bold text-gray-900 dark:text-gray-100 text-2xl">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-2 rounded-lg">
                <UsersIcon className="w-6 h-6 text-white" />
              </div>
              مدیریت کاربران
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">مشاهده و مدیریت کاربران سیستم</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button 
                onClick={() => setView('list')} 
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  view==='list'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <List className="w-4 h-4" /> فهرست
              </button>
              <button 
                onClick={() => setView('grid')} 
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  view==='grid'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> کارت
              </button>
            </div>
            <button 
              onClick={onAdd} 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 hover:from-green-700 to-green-700 hover:to-green-800 shadow-sm hover:shadow-md px-4 py-2 rounded-lg font-medium text-white transition-all duration-200"
            >
              <Plus className="w-4 h-4" /> 
              افزودن کاربر
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex sm:flex-row flex-col gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="جستجو در کاربران..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
            {filtered.length} کاربر یافت شد
          </div>
        </div>
      </div>

      {/* Users Content */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden">
        {view==='list' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-4 font-medium text-right">نام</th>
                  <th className="px-6 py-4 font-medium text-right">ایمیل</th>
                  <th className="px-6 py-4 font-medium text-right">نقش</th>
                  <th className="px-6 py-4 font-medium text-right">بخش</th>
                  <th className="px-6 py-4 font-medium text-right">اقدامات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'ADMIN' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                        u.role === 'MANAGER' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' :
                        u.role === 'EXPERT' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(u.userDepartments) && u.userDepartments.length>0 ? (
                          u.userDepartments.map(x=> (
                            <span key={x.departmentId} className="inline-flex items-center bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded text-green-700 dark:text-green-200 text-xs">
                              {x.department?.name || x.departmentId}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={()=>onEdit(u)} 
                          className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 px-3 py-1 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 text-xs transition-colors"
                        >
                          <Pencil className="w-3 h-3"/> ویرایش
                        </button>
                        <button 
                          onClick={()=>onDelete(u.id!)} 
                          className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 px-3 py-1 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs transition-colors"
                        >
                          <Trash2 className="w-3 h-3"/> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="gap-6 grid sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(u => (
                <div key={u.id} className="group bg-white/50 dark:bg-gray-800/50 hover:shadow-lg backdrop-blur-sm p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-lg hover:scale-[1.02] transition-all duration-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:group-hover:text-green-400 dark:text-gray-100 group-hover:text-green-600 transition-colors">
                        {u.firstName} {u.lastName}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm truncate">{u.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'ADMIN' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                      u.role === 'MANAGER' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' :
                      u.role === 'EXPERT' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(u.userDepartments) && u.userDepartments.length>0 ? (
                        u.userDepartments.map(x=> (
                          <span key={x.departmentId} className="inline-flex items-center bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded text-green-700 dark:text-green-200 text-xs">
                            {x.department?.name || x.departmentId}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">دپارتمان تعیین نشده</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={()=>onEdit(u)} 
                      className="inline-flex flex-1 justify-center items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 text-xs transition-colors"
                    >
                      <Pencil className="w-3 h-3"/> ویرایش
                    </button>
                    <button 
                      onClick={()=>onDelete(u.id!)} 
                      className="inline-flex flex-1 justify-center items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 px-3 py-2 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs transition-colors"
                    >
                      <Trash2 className="w-3 h-3"/> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-sm mx-4 p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-6 pb-4 border-gray-200 dark:border-gray-700 border-b">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {editing?.id ? 'ویرایش کاربر' : 'افزودن کاربر'}
              </h3>
              <button 
                onClick={()=>setOpen(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="gap-4 grid grid-cols-2">
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">نام</label>
                  <input 
                    value={editing?.firstName || ''} 
                    onChange={e=>setEditing(s=>s?{...s, firstName:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">نام خانوادگی</label>
                  <input 
                    value={editing?.lastName || ''} 
                    onChange={e=>setEditing(s=>s?{...s, lastName:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">ایمیل</label>
                <input 
                  type="email"
                  value={editing?.email || ''} 
                  onChange={e=>setEditing(s=>s?{...s, email:e.target.value}:s)} 
                  className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 text-sm"
                />
              </div>
              {!editing?.id && (
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">رمز عبور</label>
                  <input 
                    type="password" 
                    value={(editing as any)?.password || ''} 
                    onChange={e=>setEditing(s=>s?{...s, password:e.target.value} as any:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">نقش</label>
                <select 
                  value={editing?.role||'USER'} 
                  onChange={e=>setEditing(s=>s?{...s, role: e.target.value as User['role']}:s)} 
                  className="bg-gray-50 dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="USER">USER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="EXPERT">EXPERT</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">دپارتمان‌ها (چند انتخابی)</label>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Array.isArray((editing as any)?.departmentIds) && (editing as any).departmentIds.map((id:string)=>{
                      const d = departments.find(x=>x.id===id); if(!d) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded text-green-700 dark:text-green-200 text-xs">
                          {d.name}
                          <button type="button" onClick={()=> setEditing(s=> s? ({...s, departmentIds: (s as any).departmentIds.filter((x:string)=>x!==id)}) : s)}><X className="w-3 h-3"/></button>
                        </span>
                      );
                    })}
                  </div>
                  <input 
                    placeholder="جستجوی دپارتمان..." 
                    value={deptSearch} 
                    onChange={e=>setDeptSearch(e.target.value)} 
                    className="bg-white dark:bg-gray-700 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-green-500 w-full text-xs"
                  />
                  <div className="mt-2 border border-gray-200 dark:border-gray-600 border-dashed rounded max-h-32 overflow-auto">
                    {departments.filter(d=> d.name.includes(deptSearch)).map(d=> (
                      <label key={d.id} className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 text-xs cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={Array.isArray((editing as any)?.departmentIds) && (editing as any).departmentIds.includes(d.id)} 
                          onChange={e=>{
                            const has = Array.isArray((editing as any)?.departmentIds) && (editing as any).departmentIds.includes(d.id);
                            setEditing(s=> {
                              const arr = Array.isArray((s as any)?.departmentIds) ? [...(s as any).departmentIds] : [];
                              if (has) return ({...s, departmentIds: arr.filter((x:string)=>x!==d.id)} as any);
                              arr.push(d.id); return ({...s, departmentIds: arr} as any);
                            });
                          }}
                          className="focus:ring-green-500 text-green-600"
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={()=>setOpen(false)} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                >
                  انصراف
                </button>
                <button 
                  className="bg-gradient-to-r from-green-600 hover:from-green-700 to-green-700 hover:to-green-800 shadow-sm px-4 py-2 rounded-lg font-medium text-white transition-all duration-200"
                >
                  ذخیره
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
