"use client";
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
type Row = { id:string; assetId:string; userId?:string; departmentId?:string; buildingId?:string; floorId?:string; roomId?:string; assignedAt:string; returnedAt?:string; asset?:any; user?:any; department?:any; };
export default function AssignmentsPage(){
  const [rows,setRows]=React.useState<Row[]>([]);
  const [open,setOpen]=React.useState(false);
  const [editing,setEditing]=React.useState<Partial<Row>|null>(null);
  const [assets,setAssets]=React.useState<any[]>([]);
  const [users,setUsers]=React.useState<any[]>([]);
  const [departments,setDepts]=React.useState<any[]>([]);
  const token = typeof window!=='undefined'? localStorage.getItem('token'):null;
  async function load(){ const r= await fetch(`${API}/asset-assignments`,{headers:{Authorization:`Bearer ${token}`}}); setRows(await r.json()); }
  async function loadLookups(){
    const [a,u,d] = await Promise.all([
      fetch(`${API}/assets?take=100`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/users`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]),
      fetch(`${API}/departments`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]),
    ]);
    setAssets(a||[]); setUsers(u||[]); setDepts(d||[]);
  }
  React.useEffect(()=>{ load(); loadLookups(); },[]);
  async function onSubmit(e:React.FormEvent){ e.preventDefault(); if(!editing) return; const m=editing.id?'PATCH':'POST'; const u=editing.id?`${API}/asset-assignments/${editing.id}`:`${API}/asset-assignments`; await fetch(u,{method:m, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(editing)}); setOpen(false); setEditing(null); await load(); }
  async function onDelete(id:string){ if(!confirm('حذف شود؟'))return; await fetch(`${API}/asset-assignments/${id}`,{method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); await load(); }
  return (
    <div className="space-y-4">
      <div className="flex justify-between"><h2 className="font-semibold">واگذاری دارایی</h2><button onClick={()=>{setEditing({}); setOpen(true);}} className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-2 rounded text-white text-sm"><Plus className="w-4 h-4"/> واگذاری جدید</button></div>
      <div className="table-theme-container">
        <table className="table-theme">
          <thead><tr><th className="px-3 py-2">دارایی</th><th className="px-3 py-2">کاربر/بخش</th><th className="px-3 py-2">تاریخ واگذاری</th><th className="px-3 py-2">تاریخ پایان</th><th className="px-3 py-2">اقدامات</th></tr></thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 border-gray-200 dark:border-gray-800 border-t">
                <td className="px-3 py-2">{r.asset?.name||r.assetId}</td>
                <td className="px-3 py-2">{r.user?.email || r.department?.name || '-'}</td>
                <td className="px-3 py-2">{new Date(r.assignedAt).toLocaleDateString('fa-IR')}</td>
                <td className="px-3 py-2">{r.returnedAt? new Date(r.returnedAt).toLocaleDateString('fa-IR'):'-'}</td>
                <td className="flex gap-2 px-3 py-2">
                  <button onClick={()=>onDelete(r.id)} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-red-600 text-xs"><Trash2 className="w-3 h-3"/> حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 shadow-2xl p-4 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4 pb-2 border-gray-200 dark:border-gray-800 border-b"><h3 className="font-semibold text-sm">واگذاری جدید</h3><button onClick={()=>setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button></div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="block mb-1 text-xs">دارایی</label>
                <select value={editing?.assetId||''} onChange={e=>setEditing(s=>({...s, assetId:e.target.value}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm">
                  <option value="">- انتخاب کنید -</option>
                  {assets.map((a:any)=> (<option key={a.id} value={a.id}>{a.name} ({a.barcode})</option>))}
                </select>
              </div>
              <div className="gap-2 grid grid-cols-2">
                <div>
                  <label className="block mb-1 text-xs">کاربر</label>
                  <select value={editing?.userId||''} onChange={e=>setEditing(s=>({...s, userId:e.target.value, departmentId:''}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm">
                    <option value="">- بدون کاربر -</option>
                    {users.map((u:any)=> (<option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-xs">بخش</label>
                  <select value={editing?.departmentId||''} onChange={e=>setEditing(s=>({...s, departmentId:e.target.value, userId:''}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm">
                    <option value="">- بدون بخش -</option>
                    {departments.map((d:any)=> (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded text-sm">انصراف</button><button className="bg-blue-600 shadow px-3 py-2 rounded text-white text-sm">ثبت</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
