"use client";
import React from 'react';

// Backend permissions API works with departments and pages: canRead/canWrite
type Department = { id: string; name: string };
type Permission = { departmentId: string; page: string; canRead: boolean; canWrite: boolean };

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const PAGES = [
  { key: 'dashboard', label: 'نمای کلی' },
  { key: 'assets', label: 'دارایی‌ها' },
  { key: 'users', label: 'کاربران' },
  { key: 'settings', label: 'تنظیمات' },
];

export default function AccessPage(){
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = React.useState<string>('');
  const [perms, setPerms] = React.useState<Record<string, { canRead: boolean; canWrite: boolean }>>({});
  const [loading, setLoading] = React.useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  React.useEffect(()=>{ (async ()=>{
    const r = await fetch(`${API}/departments`, { headers:{ Authorization:`Bearer ${token}` } });
    const list: Department[] = await r.json();
    setDepartments(list);
    if(list.length){ setSelectedDept(list[0].id); }
  })(); },[]);

  React.useEffect(()=>{ (async ()=>{
    if(!selectedDept) return;
    const r = await fetch(`${API}/permissions?departmentId=${encodeURIComponent(selectedDept)}`, { headers:{ Authorization:`Bearer ${token}`}});
    const rows: Permission[] = await r.json();
    const map: Record<string, { canRead:boolean; canWrite:boolean }> = {};
    rows.forEach(p => { map[p.page] = { canRead: !!p.canRead, canWrite: !!p.canWrite }; });
    setPerms(map);
  })(); },[selectedDept]);

  function toggle(pageKey: string, field: 'canRead'|'canWrite'){
    setPerms(prev => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [field]: !prev[pageKey]?.[field] }
    }));
  }

  async function save(){
    if(!selectedDept) return;
    setLoading(true);
    try{
      // Upsert each page permission; if both flags false, remove.
      await Promise.all(PAGES.map(async p => {
        const state = perms[p.key] || { canRead:false, canWrite:false };
        const hasAny = state.canRead || state.canWrite;
        if(hasAny){
          await fetch(`${API}/permissions`, {
            method:'POST',
            headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
            body: JSON.stringify({ departmentId: selectedDept, page: p.key, canRead: state.canRead, canWrite: state.canWrite })
          });
        } else {
          await fetch(`${API}/permissions/${encodeURIComponent(selectedDept)}/${encodeURIComponent(p.key)}`, {
            method:'DELETE', headers:{ Authorization:`Bearer ${token}` }
          });
        }
      }));
      alert('ذخیره شد');
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <h2 className="font-semibold">دسترسی صفحات بر اساس بخش</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm">بخش:</label>
          <select value={selectedDept} onChange={e=>setSelectedDept(e.target.value)} className="bg-white dark:bg-gray-900 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-sm">
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button disabled={!selectedDept || loading} onClick={save} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-2 rounded text-white text-sm">{loading?'...':'ذخیره'}</button>
        </div>
      </div>
      <div className="table-theme-container">
        <table className="table-theme">
          <thead>
            <tr>
              <th className="px-3 py-2 text-right">صفحه</th>
              <th className="px-3 py-2 text-right">خواندن</th>
              <th className="px-3 py-2 text-right">نوشتن</th>
            </tr>
          </thead>
          <tbody>
            {PAGES.map(p => {
              const state = perms[p.key] || { canRead:false, canWrite:false };
              return (
                <tr key={p.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 border-gray-200 dark:border-gray-800 border-t">
                  <td className="px-3 py-2">{p.label}<div className="text-gray-500 text-xs">{p.key}</div></td>
                  <td className="px-3 py-2"><input type="checkbox" checked={!!state.canRead} onChange={()=>toggle(p.key,'canRead')} /></td>
                  <td className="px-3 py-2"><input type="checkbox" checked={!!state.canWrite} onChange={()=>toggle(p.key,'canWrite')} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
