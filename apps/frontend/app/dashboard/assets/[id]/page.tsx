"use client";
import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Copy, QrCode, Barcode as BarcodeIcon, Plus, Users, Building, Layers, Home, ClipboardList, Pencil } from 'lucide-react';
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  displayKey = 'name',
  valueKey = 'id',
}: { options:any[]; value?: string; onChange:(id:string)=>void; placeholder?:string; displayKey?:string; valueKey?:string }){
  const [open,setOpen]=React.useState(false);
  const [q,setQ]=React.useState('');
  const ref=React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{
    function onDoc(e:MouseEvent){ if(!ref.current) return; if(!ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onDoc); return ()=>document.removeEventListener('mousedown', onDoc);
  },[]);
  const selected = options.find(o=> String(o[valueKey])===String(value));
  const filtered = options.filter(o=> String(o[displayKey]||'').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={()=>setOpen(v=>!v)} className="flex justify-between items-center bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full text-sm">
        <span className="text-left truncate">{selected? String(selected[displayKey]) : (placeholder||'انتخاب کنید')}</span>
        <svg className="opacity-60 w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
      </button>
      {open && (
        <div className="top-full z-50 absolute inset-x-0 bg-white dark:bg-gray-900 shadow-xl mt-1 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
          <div className="p-2">
            <input autoFocus placeholder="جستجو..." value={q} onChange={e=>setQ(e.target.value)} className="bg-white dark:bg-gray-900 px-2 py-1.5 border border-gray-200 dark:border-gray-800 rounded w-full text-xs"/>
          </div>
          <ul className="max-h-56 overflow-auto text-sm">
            {filtered.map(opt=> (
              <li key={String(opt[valueKey])}>
                <button type="button" onClick={()=>{ onChange(String(opt[valueKey])); setOpen(false); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${String(opt[valueKey])===String(value)?'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-200':''}`}>
                  <span className="truncate">{String(opt[displayKey])}</span>
                </button>
              </li>
            ))}
            {!filtered.length && (<li className="px-3 py-2 text-gray-500 text-xs">یافت نشد</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AssetDetailPage(){
  const params = useParams();
  const id = params?.id as string;
  const [asset,setAsset]=React.useState<any>(null);
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState<any>({ userId: '', departmentId: '', buildingId: '', floorId: '', roomId: '', purpose: 'استفاده', note: '' });
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [buildings, setBuildings] = React.useState<any[]>([]);
  const [floors, setFloors] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const token = typeof window!=='undefined'? localStorage.getItem('token'):null;
  const [editOpen, setEditOpen] = React.useState(false);
  const [editData, setEditData] = React.useState<any>({});
  React.useEffect(()=>{ (async()=>{ if(!id) return; const r= await fetch(`${API}/assets/${id}`,{headers:{Authorization:`Bearer ${token}`}}); const a = await r.json(); setAsset(a); setAssignments(Array.isArray(a?.assignments)? a.assignments : []); })(); },[id]);
  React.useEffect(()=>{ (async()=>{
    try {
      const h = { headers:{ Authorization:`Bearer ${token}` } } as any;
      const [u,d,b] = await Promise.all([
        fetch(`${API}/users`, h).then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetch(`${API}/departments`, h).then(r=>r.ok?r.json():[]).catch(()=>[]),
        fetch(`${API}/buildings`, h).then(r=>r.ok?r.json():[]).catch(()=>[]),
      ]);
      setUsers(Array.isArray(u)?u:[]); setDepartments(Array.isArray(d)?d:[]); setBuildings(Array.isArray(b)?b:[]);
    } catch {}
  })(); }, []);
  React.useEffect(()=>{ (async()=>{
    if (!form.buildingId) { setFloors([]); setRooms([]); return; }
    const h = { headers:{ Authorization:`Bearer ${token}` } } as any;
    const fl = await fetch(`${API}/floors?buildingId=${form.buildingId}`, h).then(r=>r.ok?r.json():[]).catch(()=>[]);
    setFloors(Array.isArray(fl)?fl:[]); setRooms([]);
  })(); }, [form.buildingId]);
  React.useEffect(()=>{ (async()=>{
    if (!form.floorId) { setRooms([]); return; }
    const h = { headers:{ Authorization:`Bearer ${token}` } } as any;
    const rm = await fetch(`${API}/rooms?floorId=${form.floorId}`, h).then(r=>r.ok?r.json():[]).catch(()=>[]);
    setRooms(Array.isArray(rm)?rm:[]);
  })(); }, [form.floorId]);
  async function reloadAssignments(){
    const r = await fetch(`${API}/asset-assignments?assetId=${id}`,{ headers:{ Authorization:`Bearer ${token}` }});
    if (r.ok) setAssignments(await r.json());
  }
  async function createAssignment(e: React.FormEvent){
    e.preventDefault();
    setLoading(true);
    try {
  const payload:any = { assetId: id, purpose: form.purpose || undefined, note: form.note || undefined };
  if(form.userId) payload.userId = form.userId; if(form.departmentId) payload.departmentId = form.departmentId;
  if(form.buildingId) payload.buildingId = form.buildingId; if(form.floorId) payload.floorId = form.floorId; if(form.roomId) payload.roomId = form.roomId;
      const r = await fetch(`${API}/asset-assignments`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
  if (r.ok) { setForm({ userId:'', departmentId:'', buildingId:'', floorId:'', roomId:'', note:''}); await reloadAssignments(); }
    } finally { setLoading(false); }
  }
  function copy(text:string){ try{ navigator.clipboard.writeText(text);}catch{} }
  async function onSaveEdit(e: React.FormEvent){
    e.preventDefault();
    const payload: any = { name: editData.name, barcode: editData.barcode, oldBarcode: editData.oldBarcode, description: editData.description };
    if (Array.isArray(editData.images)) payload.images = editData.images;
    const r = await fetch(`${API}/assets/${id}`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) { const a = await (await fetch(`${API}/assets/${id}`,{headers:{Authorization:`Bearer ${token}`}})).json(); setAsset(a); setEditOpen(false); }
  }
  function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    Promise.all(arr.map(async(f)=>{
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch(`${API}/uploads/asset-image`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
      const j = await res.json(); return j.url as string;
    })).then(urls => setEditData((s:any)=> ({...s, images: [ ...(Array.isArray(s.images)?s.images: (Array.isArray(asset?.images)? asset.images.map((x:any)=> x.url || x):[]) ), ...urls ] })));
  }
  if(!asset) return <div>در حال بارگذاری…</div>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="font-semibold text-xl">{asset.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
            {asset.oldBarcode && (
              <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 shadow-sm px-2 py-1 border border-gray-200 dark:border-gray-800 rounded">
                <span className="text-gray-500">بارکد قدیم:</span>
                <code className="font-mono">{asset.oldBarcode}</code>
                <button onClick={()=>copy(asset.oldBarcode)} title="کپی" className="hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"><Copy className="w-4 h-4"/></button>
              </div>
            )}
            <div className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 shadow-sm px-2 py-1 border border-gray-200 dark:border-gray-800 rounded">
              <span className="text-gray-500">بارکد:</span>
              <code className="font-mono">{asset.barcode}</code>
              <Link href={`${API}/assets/${asset.id}/barcode.png`} target="_blank" className="hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded" title="نمایش بارکد"><BarcodeIcon className="w-4 h-4"/></Link>
              <button onClick={()=>copy(asset.barcode)} title="کپی" className="hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"><Copy className="w-4 h-4"/></button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
        <button onClick={()=>{ setEditData({ name: asset.name, barcode: asset.barcode, oldBarcode: asset.oldBarcode||'', description: asset.description||'', images: (asset.images||[]).map((x:any)=> x.url || x) }); setEditOpen(true); }} className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 shadow px-3 py-2 border border-gray-200 dark:border-gray-800 rounded" title="ویرایش">
          <Pencil className="w-4 h-4"/> ویرایش
        </button>
        <Link href={`${API}/assets/${asset.id}/qr.png`} target="_blank" className="inline-flex items-center gap-2 bg-white dark:bg-gray-900 shadow px-3 py-2 border border-gray-200 dark:border-gray-800 rounded" title="نمایش QR">
          <QrCode className="w-4 h-4"/> QR
        </Link>
        </div>
      </div>
      <div className="gap-4 grid md:grid-cols-3">
        <div className="md:col-span-2 bg-white dark:bg-gray-900 shadow-sm p-4 border border-gray-200 dark:border-gray-800 rounded">
          <div className="mb-3 font-medium">مشخصات</div>
          <div className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
            <div>وضعیت: {asset.availability}</div>
            <div>دسته: {asset.category?.name || '-'}</div>
            <div>توضیحات: {asset.description || '-'}</div>
            <div>تاریخ ثبت: {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString('fa-IR') : '-'}</div>
            <div>ثبت توسط: {asset.createdBy?.email || '-'}</div>
          </div>
          {Array.isArray(asset.images) && asset.images.length>0 && (()=>{
            const first = asset.images[0];
            const raw = typeof first === 'string' ? first : (first?.url || '');
            const src = raw.startsWith('http') ? raw : `${API}${raw}`;
            return (
              <div className="mt-4">
                <div className="mb-2 text-gray-500 text-sm">تصویر</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={asset.name} className="border border-gray-200 dark:border-gray-800 rounded max-h-64 object-contain"/>
              </div>
            );
          })()}
        </div>
        <div className="bg-white dark:bg-gray-900 shadow-sm p-4 border border-gray-200 dark:border-gray-800 rounded">
          <div className="mb-3 font-medium">واگذاری جدید</div>
          <form onSubmit={createAssignment} className="space-y-3 text-sm">
            <div>
              <label className="block mb-1 text-xs">کاربر (اختیاری)</label>
              <SearchSelect options={users.map((u:any)=>({ id:u.id, name:`${u.firstName||''} ${u.lastName||''} (${u.email})` }))} value={form.userId} onChange={(id)=>setForm((s:any)=>({...s, userId:id}))} placeholder="جستجو و انتخاب کاربر" />
            </div>
            <div>
              <label className="block mb-1 text-xs">دپارتمان (اختیاری)</label>
              <SearchSelect options={departments} value={form.departmentId} onChange={(id)=>setForm((s:any)=>({...s, departmentId:id}))} placeholder="جستجو و انتخاب دپارتمان" />
            </div>
            <div className="gap-2 grid grid-cols-1 sm:grid-cols-3">
              <div>
                <label className="block mb-1 text-xs">ساختمان</label>
                <SearchSelect options={buildings} value={form.buildingId} onChange={(id)=>setForm((s:any)=>({...s, buildingId:id, floorId:'', roomId:''}))} placeholder="انتخاب ساختمان" />
              </div>
              <div>
                <label className="block mb-1 text-xs">طبقه</label>
                <SearchSelect options={floors} value={form.floorId} onChange={(id)=>setForm((s:any)=>({...s, floorId:id, roomId:''}))} placeholder="انتخاب طبقه" />
              </div>
              <div>
                <label className="block mb-1 text-xs">اتاق</label>
                <SearchSelect options={rooms} value={form.roomId} onChange={(id)=>setForm((s:any)=>({...s, roomId:id}))} placeholder="انتخاب اتاق" />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs">نوع واگذاری</label>
              <div className="gap-2 grid grid-cols-2">
                <label className="flex items-center gap-2 text-xs"><input type="radio" name="purpose" checked={form.purpose==='استفاده'} onChange={()=>setForm((s:any)=>({...s,purpose:'استفاده'}))}/> استفاده</label>
                <label className="flex items-center gap-2 text-xs"><input type="radio" name="purpose" checked={form.purpose==='امانت تعمیرات'} onChange={()=>setForm((s:any)=>({...s,purpose:'امانت تعمیرات'}))}/> امانت تعمیرات</label>
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs">یادداشت</label>
              <textarea value={form.note} onChange={e=>setForm((s:any)=>({...s,note:e.target.value}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full" rows={3} />
            </div>
            <button disabled={loading} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow px-3 py-2 rounded text-white"><Plus className="w-4 h-4"/> ثبت واگذاری</button>
          </form>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 shadow-sm p-4 border border-gray-200 dark:border-gray-800 rounded">
        <div className="mb-3 font-medium">واگذاری‌ها</div>
        <div className="space-y-2">
          {assignments.map((a:any)=> (
            <div key={a.id} className="px-2 py-2 border border-gray-100 dark:border-gray-800 rounded">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400"/>
                <span className="font-medium">{a.user?.email || '—'}</span>
                <span className="text-gray-400">•</span>
                <span>{a.department?.name || 'بدون دپارتمان'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-gray-600 dark:text-gray-400 text-xs">
                <Building className="w-3.5 h-3.5"/> {a.building?.name || '—'}
                <Layers className="w-3.5 h-3.5"/> {a.floor?.name || '—'}
                <Home className="w-3.5 h-3.5"/> {a.room?.name || '—'}
                <ClipboardList className="w-3.5 h-3.5"/> {a.purpose || a.note?.includes('تعمیر') ? 'امانت تعمیرات' : 'استفاده'}
                <span className="ms-auto">از {new Date(a.assignedAt).toLocaleDateString('fa-IR')} تا {a.returnedAt ? new Date(a.returnedAt).toLocaleDateString('fa-IR') : 'اکنون'}</span>
              </div>
              {a.assignedBy && (<div className="mt-1 text-[11px] text-gray-500">ثبت توسط: {a.assignedBy?.email}</div>)}
            </div>
          ))}
        </div>
      </div>
      {editOpen && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 shadow-2xl p-4 border border-gray-200 dark:border-gray-800 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4 pb-2 border-gray-200 dark:border-gray-800 border-b"><h3 className="font-semibold text-sm">ویرایش دارایی</h3><button onClick={()=>setEditOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button></div>
            <form onSubmit={onSaveEdit} className="space-y-3 text-sm">
              <div>
                <label className="block mb-1 text-xs">نام</label>
                <input value={editData.name||''} onChange={e=>setEditData((s:any)=>({...s, name:e.target.value}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full"/>
              </div>
              <div className="gap-2 grid grid-cols-2">
                <div>
                  <label className="block mb-1 text-xs">بارکد</label>
                  <input value={editData.barcode||''} onChange={e=>setEditData((s:any)=>({...s, barcode:e.target.value}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full"/>
                </div>
                <div>
                  <label className="block mb-1 text-xs">بارکد قدیم</label>
                  <input value={editData.oldBarcode||''} onChange={e=>setEditData((s:any)=>({...s, oldBarcode:e.target.value}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full"/>
                </div>
              </div>
              <div>
                <label className="block mb-1 text-xs">توضیحات</label>
                <textarea value={editData.description||''} onChange={e=>setEditData((s:any)=>({...s, description:e.target.value}))} className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded w-full" rows={3}/>
              </div>
              <div>
                <label className="block mb-1 text-xs">تصاویر</label>
                <input type="file" accept="image/*" multiple onChange={e=> onFiles(e.target.files)} className="block"/>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Array.isArray(editData.images) && editData.images.map((u:string, idx:number)=> (
                    <div key={idx} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API}${u}`} alt="img" className="border border-gray-200 dark:border-gray-800 rounded w-24 h-24 object-cover"/>
                      <button type="button" onClick={()=> setEditData((s:any)=> ({...s, images: s.images.filter((x:string)=>x!==u) }))} className="-top-2 -right-2 absolute bg-white border border-gray-200 rounded-full w-6 h-6 text-red-600">×</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditOpen(false)} className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded">انصراف</button><button className="bg-blue-600 shadow px-3 py-2 rounded text-white">ذخیره</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
