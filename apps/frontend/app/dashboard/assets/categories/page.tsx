"use client";
import React from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type Item = { id:string; name:string; codePrefix?:string; description?:string };
export default function AssetCategoriesPage(){
  const [items,setItems]=React.useState<Item[]>([]);
  const [open,setOpen]=React.useState(false);
  const [editing,setEditing]=React.useState<Item|null>(null);
  const token = typeof window!=='undefined'? localStorage.getItem('token'):null;
  async function load(){ const r= await fetch(`${API}/asset-categories`,{headers:{Authorization:`Bearer ${token}`}}); setItems(await r.json()); }
  React.useEffect(()=>{ load(); },[]);
  async function onSubmit(e:React.FormEvent){ e.preventDefault(); if(!editing) return; const m=editing.id?'PATCH':'POST'; const u=editing.id?`${API}/asset-categories/${editing.id}`:`${API}/asset-categories`; await fetch(u,{method:m, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(editing)}); setOpen(false); setEditing(null); await load(); }
  async function onDelete(id:string){ if(!confirm('حذف شود؟'))return; await fetch(`${API}/asset-categories/${id}`,{method:'DELETE', headers:{Authorization:`Bearer ${token}`}}); await load(); }
  return (
    <div className="space-y-4">
      <div className="flex justify-between"><h2 className="font-semibold">دسته‌بندی دارایی</h2><button onClick={()=>{setEditing({id:'', name:''}); setOpen(true);}} className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-2 rounded text-white text-sm"><Plus className="w-4 h-4"/> افزودن</button></div>
      <div className="table-theme-container">
        <table className="table-theme">
          <thead><tr><th className="px-3 py-2 text-right">نام</th><th className="px-3 py-2 text-right">پیشوند کد</th><th className="px-3 py-2 text-right">اقدامات</th></tr></thead>
          <tbody>
            {items.map(it=> (
              <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 border-gray-200 dark:border-gray-800 border-t">
                <td className="px-3 py-2">{it.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{it.codePrefix||'-'}</td>
                <td className="flex gap-2 px-3 py-2">
                  <button onClick={()=>{setEditing(it); setOpen(true);}} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-xs"><Pencil className="w-3 h-3"/> ویرایش</button>
                  <button onClick={()=>onDelete(it.id)} className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-gray-800 rounded text-red-600 text-xs"><Trash2 className="w-3 h-3"/> حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 shadow-2xl p-4 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-4 pb-2 border-gray-200 dark:border-gray-800 border-b"><h3 className="font-semibold text-sm">{editing?.id? 'ویرایش':'افزودن'} دسته‌بندی</h3><button onClick={()=>setOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button></div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div><label className="block mb-1 text-xs">نام</label><input value={editing?.name||''} onChange={e=>setEditing(s=>s?{...s, name:e.target.value}:s)} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm"/></div>
              <div><label className="block mb-1 text-xs">پیشوند کد</label><input value={editing?.codePrefix||''} onChange={e=>setEditing(s=>s?{...s, codePrefix:e.target.value}:s)} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm"/></div>
              <div className="flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded text-sm">انصراف</button><button className="bg-blue-600 shadow px-3 py-2 rounded text-white text-sm">ذخیره</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
