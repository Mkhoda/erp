"use client";
import React from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
type Item = { id:string; name:string; description?:string };
export default function AssetTypesPage(){
  const [items,setItems]=React.useState<Item[]>([]);
  const [open,setOpen]=React.useState(false);
  const [editing,setEditing]=React.useState<Item|null>(null);
  const token = typeof window!=='undefined'? localStorage.getItem('token'):null;
  async function load(){ const r= await fetch(`${API}/asset-types`,{headers:{Authorization:`Bearer ${token}`}}); setItems(await r.json()); }
  React.useEffect(()=>{ load(); },[]);
  async function onSubmit(e:React.FormEvent){ e.preventDefault(); if(!editing) return; const m=editing.id?'PATCH':'POST'; const u=editing.id?`${API}/asset-types/${editing.id}`:`${API}/asset-types`; await fetch(u,{method:m, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(editing)}); setOpen(false); setEditing(null); await load(); }
  async function onDelete(id:string){ if(!confirm('حذف شود؟'))return; await fetch(`${API}/asset-types/${id}`,{method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); await load(); }
  return (
    <div className="space-y-4">
  <div className="flex justify-between"><h2 className="font-semibold">انواع دارایی</h2><button onClick={()=>{setEditing({id:'', name:''}); setOpen(true);}} className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-2 rounded text-white text-sm"><Plus className="w-4 h-4"/> افزودن</button></div>
      <div className="gap-3 grid sm:grid-cols-2 lg:grid-cols-3">
        {items.map(it=> (
          <div key={it.id} className="bg-white dark:bg-gray-900 shadow-sm p-3 border border-gray-200 dark:border-gray-800 rounded">
            <div className="font-medium">{it.name}</div>
            <div className="text-gray-600 text-xs">{it.description||'-'}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={()=>{setEditing(it); setOpen(true);}} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-xs"><Pencil className="w-3 h-3"/> ویرایش</button>
              <button onClick={()=>onDelete(it.id)} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-red-600 text-xs"><Trash2 className="w-3 h-3"/> حذف</button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 shadow-2xl p-4 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4 pb-2 border-gray-200 dark:border-gray-800 border-b"><h3 className="font-semibold text-sm">{editing?.id? 'ویرایش':'افزودن'} نوع دارایی</h3><button onClick={()=>setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button></div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div><label className="block mb-1 text-xs">نام</label><input value={editing?.name||''} onChange={e=>setEditing(s=>s?{...s, name:e.target.value}:s)} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm"/></div>
              <div><label className="block mb-1 text-xs">توضیحات</label><input value={editing?.description||''} onChange={e=>setEditing(s=>s?{...s, description:e.target.value}:s)} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm"/></div>
              <div className="flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded text-sm">انصراف</button><button className="bg-blue-600 shadow px-3 py-2 rounded text-white text-sm">ذخیره</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
