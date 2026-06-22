"use client";
import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Copy, QrCode, Barcode as BarcodeIcon, Plus, Users, Building, Layers, Home, ClipboardList, Pencil, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../../components/ui/Modal';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

function SearchSelect({ options, value, onChange, placeholder, displayKey = 'name', valueKey = 'id' }: {
  options: any[]; value?: string; onChange: (id: string) => void; placeholder?: string; displayKey?: string; valueKey?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = options.find(o => String(o[valueKey]) === String(value));
  const filtered = options.filter(o => String(o[displayKey] || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} className="input-theme flex justify-between items-center text-sm">
        <span className="truncate text-right">{selected ? String(selected[displayKey]) : (placeholder || 'انتخاب کنید')}</span>
        <ChevronDown className="w-4 h-4 text-theme-muted shrink-0" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="top-full z-50 absolute inset-x-0 bg-theme-primary shadow-2xl mt-1 border border-theme rounded-xl overflow-hidden">
            <div className="p-2 border-theme border-b">
              <input autoFocus placeholder="جستجو..." value={q} onChange={e => setQ(e.target.value)} className="input-theme text-xs py-1.5" />
            </div>
            <ul className="max-h-48 overflow-auto text-sm">
              {filtered.map(opt => (
                <li key={String(opt[valueKey])}>
                  <button type="button" onClick={() => { onChange(String(opt[valueKey])); setOpen(false); }}
                    className={`flex w-full items-center px-3 py-2 text-right hover:bg-theme-hover transition-colors ${String(opt[valueKey]) === String(value) ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'text-theme-secondary'}`}>
                    <span className="truncate">{String(opt[displayKey])}</span>
                  </button>
                </li>
              ))}
              {!filtered.length && <li className="px-3 py-2 text-theme-muted text-xs">یافت نشد</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [asset, setAsset] = React.useState<any>(null);
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState<any>({ userId: '', departmentId: '', buildingId: '', floorId: '', roomId: '', purpose: 'استفاده', note: '' });
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [buildings, setBuildings] = React.useState<any[]>([]);
  const [floors, setFloors] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editData, setEditData] = React.useState<any>({});
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  React.useEffect(() => {
    if (!id) return;
    fetch(`${API}/assets/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(a => { setAsset(a); setAssignments(Array.isArray(a?.assignments) ? a.assignments : []); });
  }, [id]);

  React.useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${token}` } } as any;
    Promise.all([
      fetch(`${API}/users`, h).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/departments`, h).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/buildings`, h).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([u, d, b]) => { setUsers(Array.isArray(u) ? u : []); setDepartments(Array.isArray(d) ? d : []); setBuildings(Array.isArray(b) ? b : []); });
  }, []);

  React.useEffect(() => {
    if (!form.buildingId) { setFloors([]); setRooms([]); return; }
    fetch(`${API}/floors?buildingId=${form.buildingId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).then(f => { setFloors(Array.isArray(f) ? f : []); setRooms([]); });
  }, [form.buildingId]);

  React.useEffect(() => {
    if (!form.floorId) { setRooms([]); return; }
    fetch(`${API}/rooms?floorId=${form.floorId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).then(r => setRooms(Array.isArray(r) ? r : []));
  }, [form.floorId]);

  async function reloadAssignments() {
    const r = await fetch(`${API}/asset-assignments?assetId=${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setAssignments(await r.json());
  }

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const payload: any = { assetId: id, purpose: form.purpose || undefined, note: form.note || undefined };
      if (form.userId) payload.userId = form.userId;
      if (form.departmentId) payload.departmentId = form.departmentId;
      if (form.buildingId) payload.buildingId = form.buildingId;
      if (form.floorId) payload.floorId = form.floorId;
      if (form.roomId) payload.roomId = form.roomId;
      const r = await fetch(`${API}/asset-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (r.ok) { setForm({ userId: '', departmentId: '', buildingId: '', floorId: '', roomId: '', note: '', purpose: 'استفاده' }); await reloadAssignments(); }
    } finally { setLoading(false); }
  }

  function copy(text: string) { try { navigator.clipboard.writeText(text); } catch { } }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`${API}/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editData) });
    if (r.ok) { const a = await (await fetch(`${API}/assets/${id}`, { headers: { Authorization: `Bearer ${token}` } })).json(); setAsset(a); setEditOpen(false); }
  }

  function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    Promise.all(Array.from(files).map(async f => {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch(`${API}/uploads/asset-image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      return (await res.json()).url as string;
    })).then(urls => setEditData((s: any) => ({ ...s, images: [...(Array.isArray(s.images) ? s.images : (asset?.images || []).map((x: any) => x.url || x)), ...urls] })));
  }

  if (!asset) return (
    <div className="flex justify-center items-center min-h-64">
      <div className="flex flex-col items-center gap-3 text-theme-muted">
        <div className="border-blue-600 border-t-transparent border-2 rounded-full w-8 h-8 animate-spin" />
        <span className="text-sm">در حال بارگذاری...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="font-bold text-theme-primary text-xl">{asset.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="inline-flex items-center gap-1.5 bg-theme-secondary border border-theme px-2.5 py-1 rounded-lg text-xs">
                  <span className="text-theme-muted">بارکد:</span>
                  <code className="font-mono text-theme-primary">{asset.barcode}</code>
                  <Link href={`${API}/assets/${asset.id}/barcode.png`} target="_blank" className="hover:bg-theme-hover p-0.5 rounded" title="نمایش بارکد"><BarcodeIcon className="w-3.5 h-3.5 text-theme-muted" /></Link>
                  <button onClick={() => copy(asset.barcode)} className="hover:bg-theme-hover p-0.5 rounded" title="کپی"><Copy className="w-3.5 h-3.5 text-theme-muted" /></button>
                </div>
                {asset.oldBarcode && (
                  <div className="inline-flex items-center gap-1.5 bg-theme-secondary border border-theme px-2.5 py-1 rounded-lg text-xs">
                    <span className="text-theme-muted">قدیم:</span>
                    <code className="font-mono text-theme-primary">{asset.oldBarcode}</code>
                    <button onClick={() => copy(asset.oldBarcode)} className="hover:bg-theme-hover p-0.5 rounded"><Copy className="w-3.5 h-3.5 text-theme-muted" /></button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditData({ name: asset.name, barcode: asset.barcode, oldBarcode: asset.oldBarcode || '', description: asset.description || '', images: (asset.images || []).map((x: any) => x.url || x) }); setEditOpen(true); }} className="btn-theme-secondary text-sm gap-1.5">
                <Pencil className="w-4 h-4" /> ویرایش
              </button>
              <Link href={`${API}/assets/${asset.id}/qr.png`} target="_blank" className="btn-theme-secondary text-sm gap-1.5">
                <QrCode className="w-4 h-4" /> QR
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="gap-4 grid md:grid-cols-3">
        {/* Details */}
        <div className="md:col-span-2 space-y-4">
          <div className="card-theme">
            <div className="card-theme-header"><h2 className="font-semibold text-theme-primary text-sm">مشخصات</h2></div>
            <div className="card-theme-body">
              <div className="gap-3 grid grid-cols-2 text-sm">
                {[
                  ['وضعیت دسترس', asset.availability],
                  ['وضعیت فیزیکی', asset.condition],
                  ['دسته‌بندی', asset.category?.name],
                  ['نوع', asset.type?.name],
                  ['مکان', asset.location],
                  ['تاریخ ثبت', asset.createdAt ? new Date(asset.createdAt).toLocaleDateString('fa-IR') : null],
                  ['ثبت توسط', asset.createdBy?.email || asset.createdBy?.phone],
                  ['توضیحات', asset.description],
                ].map(([k, v]) => v ? (
                  <div key={k as string} className="col-span-1">
                    <span className="text-theme-muted text-xs">{k}</span>
                    <div className="text-theme-primary font-medium text-sm">{v}</div>
                  </div>
                ) : null)}
              </div>
              {Array.isArray(asset.images) && asset.images.length > 0 && (() => {
                const first = asset.images[0];
                const raw = typeof first === 'string' ? first : (first?.url || '');
                const src = raw.startsWith('http') ? raw : `${API}${raw}`;
                return (
                  <div className="mt-4">
                    <p className="text-theme-muted text-xs mb-2">تصویر</p>
                    <img src={src} alt={asset.name} className="border border-theme rounded-xl max-h-64 object-contain" />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Assignments history */}
          <div className="card-theme">
            <div className="card-theme-header"><h2 className="font-semibold text-theme-primary text-sm">تاریخچه واگذاری‌ها</h2></div>
            <div className="card-theme-body">
              {assignments.length === 0 ? (
                <p className="text-theme-muted text-sm py-4 text-center">هیچ واگذاری‌ای ثبت نشده</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a: any) => (
                    <div key={a.id} className="bg-theme-secondary border border-theme p-3 rounded-xl text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="w-4 h-4 text-theme-muted" />
                        <span className="font-medium text-theme-primary">{a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.phone : '—'}</span>
                        {a.department && <><span className="text-theme-muted">•</span><span className="text-theme-secondary">{a.department.name}</span></>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-theme-muted text-xs">
                        {a.building && <><Building className="w-3 h-3" /> {a.building.name}</>}
                        {a.floor && <><Layers className="w-3 h-3" /> {a.floor.name}</>}
                        {a.room && <><Home className="w-3 h-3" /> {a.room.name}</>}
                        {a.purpose && <><ClipboardList className="w-3 h-3" /> {a.purpose}</>}
                        <span className="ms-auto">{new Date(a.assignedAt).toLocaleDateString('fa-IR')} تا {a.returnedAt ? new Date(a.returnedAt).toLocaleDateString('fa-IR') : 'اکنون'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New assignment form */}
        <div className="card-theme">
          <div className="card-theme-header"><h2 className="font-semibold text-theme-primary text-sm">واگذاری جدید</h2></div>
          <div className="card-theme-body">
            <form onSubmit={createAssignment} className="space-y-3 text-sm">
              <div>
                <label className="block mb-1.5 text-theme-muted text-xs">کاربر (اختیاری)</label>
                <SearchSelect options={users.map((u: any) => ({ id: u.id, name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.phone || u.email }))} value={form.userId} onChange={id => setForm((s: any) => ({ ...s, userId: id }))} placeholder="انتخاب کاربر" />
              </div>
              <div>
                <label className="block mb-1.5 text-theme-muted text-xs">دپارتمان (اختیاری)</label>
                <SearchSelect options={departments} value={form.departmentId} onChange={id => setForm((s: any) => ({ ...s, departmentId: id }))} placeholder="انتخاب دپارتمان" />
              </div>
              <div>
                <label className="block mb-1.5 text-theme-muted text-xs">ساختمان</label>
                <SearchSelect options={buildings} value={form.buildingId} onChange={id => setForm((s: any) => ({ ...s, buildingId: id, floorId: '', roomId: '' }))} placeholder="انتخاب ساختمان" />
              </div>
              {buildings.length > 0 && form.buildingId && (
                <>
                  <div>
                    <label className="block mb-1.5 text-theme-muted text-xs">طبقه</label>
                    <SearchSelect options={floors} value={form.floorId} onChange={id => setForm((s: any) => ({ ...s, floorId: id, roomId: '' }))} placeholder="انتخاب طبقه" />
                  </div>
                  {form.floorId && (
                    <div>
                      <label className="block mb-1.5 text-theme-muted text-xs">اتاق</label>
                      <SearchSelect options={rooms} value={form.roomId} onChange={id => setForm((s: any) => ({ ...s, roomId: id }))} placeholder="انتخاب اتاق" />
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block mb-1.5 text-theme-muted text-xs">نوع واگذاری</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-theme-secondary cursor-pointer">
                    <input type="radio" name="purpose" checked={form.purpose === 'استفاده'} onChange={() => setForm((s: any) => ({ ...s, purpose: 'استفاده' }))} /> استفاده
                  </label>
                  <label className="flex items-center gap-1.5 text-theme-secondary cursor-pointer">
                    <input type="radio" name="purpose" checked={form.purpose === 'امانت تعمیرات'} onChange={() => setForm((s: any) => ({ ...s, purpose: 'امانت تعمیرات' }))} /> امانت تعمیرات
                  </label>
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-theme-muted text-xs">یادداشت</label>
                <textarea value={form.note} onChange={e => setForm((s: any) => ({ ...s, note: e.target.value }))} className="input-theme resize-none text-sm" rows={2} />
              </div>
              <button type="submit" disabled={loading} className="btn-theme-primary w-full justify-center text-sm disabled:opacity-50">
                <Plus className="w-4 h-4" /> ثبت واگذاری
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="ویرایش دارایی"
        size="lg"
        footer={<>
          <button type="button" onClick={() => setEditOpen(false)} className="btn-theme-secondary text-sm">انصراف</button>
          <button form="asset-edit-form" type="submit" className="btn-theme-primary text-sm">ذخیره</button>
        </>}
      >
        <form id="asset-edit-form" onSubmit={onSaveEdit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام</label>
            <input value={editData.name || ''} onChange={e => setEditData((s: any) => ({ ...s, name: e.target.value }))} className="input-theme" />
          </div>
          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد</label>
              <input value={editData.barcode || ''} onChange={e => setEditData((s: any) => ({ ...s, barcode: e.target.value }))} className="input-theme font-mono" dir="ltr" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد قدیم</label>
              <input value={editData.oldBarcode || ''} onChange={e => setEditData((s: any) => ({ ...s, oldBarcode: e.target.value }))} className="input-theme font-mono" dir="ltr" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label>
            <textarea value={editData.description || ''} onChange={e => setEditData((s: any) => ({ ...s, description: e.target.value }))} className="input-theme resize-none" rows={3} />
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">تصاویر</label>
            <input type="file" accept="image/*" multiple onChange={e => onFiles(e.target.files)} className="block text-sm text-theme-muted" />
            {Array.isArray(editData.images) && editData.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {editData.images.map((u: string, i: number) => (
                  <div key={i} className="relative">
                    <img src={u.startsWith('http') ? u : `${API}${u}`} alt="" className="border border-theme rounded-lg w-20 h-20 object-cover" />
                    <button type="button" onClick={() => setEditData((s: any) => ({ ...s, images: s.images.filter((x: string) => x !== u) }))} className="-top-1.5 -right-1.5 absolute bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
