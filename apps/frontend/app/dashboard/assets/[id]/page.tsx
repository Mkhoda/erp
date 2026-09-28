"use client";
import React from 'react';
import { useParams } from 'next/navigation';
import {
  Copy, QrCode, Barcode as BarcodeIcon, Plus, Users, Building, Layers, Home, ClipboardList, Pencil, X,
  ImagePlus, Loader2, RotateCcw, UserCheck, History, Printer, AlertCircle, StickyNote,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import SearchSelect from '../../../components/ui/SearchSelect';
import { useToast } from '../../../components/ui/Toast';
import { useConfirm } from '../../../components/ui/ConfirmDialog';
import { readError } from '../../../../lib/http';
import { pageTitle } from '../../../../lib/branding';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const AVAIL_FA: Record<string, string> = { AVAILABLE: 'موجود', IN_USE: 'در حال استفاده', MAINTENANCE: 'تعمیرات', RETIRED: 'خارج از رده', LOST: 'مفقود', CONSUMED: 'مصرف شده' };
const COND_FA: Record<string, string> = { NEW: 'جدید', USED_GOOD: 'استفاده شده - سالم', DEFECTIVE: 'معیوب' };

const personName = (u?: any) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.phone || u.email || '—' : '');
const faDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fa-IR') : '');
const faDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' } as any) : '');
function duration(from: string, to?: string | null) {
  const days = Math.max(0, Math.round(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 86400000));
  return days === 0 ? 'کمتر از یک روز' : `${days.toLocaleString('fa-IR')} روز`;
}
const emptyForm = { userId: '', departmentId: '', buildingId: '', floorId: '', roomId: '', purpose: 'استفاده', note: '' };

export default function AssetDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [asset, setAsset] = React.useState<any>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState<any>(emptyForm);
  const [formError, setFormError] = React.useState('');
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [buildings, setBuildings] = React.useState<any[]>([]);
  const [floors, setFloors] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editData, setEditData] = React.useState<any>({});
  const [code, setCode] = React.useState<{ kind: 'qr' | 'barcode'; src: string } | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const auth = { Authorization: `Bearer ${token}` };

  const loadAsset = React.useCallback(async () => {
    const r = await fetch(`${API}/assets/${id}`, { headers: auth });
    if (r.status === 404) { setNotFound(true); return; }
    if (r.ok) setAsset(await r.json());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => { if (id) loadAsset(); }, [id, loadAsset]);
  React.useEffect(() => { if (asset?.name) document.title = pageTitle(asset.name); }, [asset?.name]);

  React.useEffect(() => {
    const h = { headers: auth } as any;
    Promise.all([
      fetch(`${API}/users`, h).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/departments`, h).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/buildings`, h).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([u, d, b]) => {
      setUsers(Array.isArray(u) ? u : (u?.data || []));
      setDepartments(Array.isArray(d) ? d : []);
      setBuildings(Array.isArray(b) ? b : []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!form.buildingId) { setFloors([]); setRooms([]); return; }
    fetch(`${API}/floors?buildingId=${form.buildingId}`, { headers: auth }).then(r => r.ok ? r.json() : []).then(f => { setFloors(Array.isArray(f) ? f : []); setRooms([]); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.buildingId]);

  React.useEffect(() => {
    if (!form.floorId) { setRooms([]); return; }
    fetch(`${API}/rooms?floorId=${form.floorId}`, { headers: auth }).then(r => r.ok ? r.json() : []).then(r => setRooms(Array.isArray(r) ? r : []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.floorId]);

  const assignments: any[] = Array.isArray(asset?.assignments) ? asset.assignments : [];
  const current = assignments.find(a => !a.returnedAt);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.userId && !form.departmentId && !form.buildingId) { setFormError('کاربر، بخش یا مکان تحویل را مشخص کنید'); return; }
    if (current) {
      const ok = await confirm('واگذاری جدید', `این دارایی اکنون در اختیار «${personName(current.user) || current.department?.name || current.building?.name}» است. واگذاری فعلی بسته و در تاریخچه ثبت می‌شود. ادامه می‌دهید؟`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      const payload: any = { assetId: id, purpose: form.purpose || 'استفاده' };
      for (const k of ['userId', 'departmentId', 'buildingId', 'floorId', 'roomId', 'note']) if (form[k]) payload[k] = form[k];
      const r = await fetch(`${API}/asset-assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(payload) });
      if (!r.ok) { setFormError(await readError(r, 'خطا در ثبت واگذاری')); return; }
      toast.success('واگذاری ثبت شد');
      setForm(emptyForm);
      await loadAsset();
    } catch { setFormError('خطا در ارتباط با سرور'); } finally { setSaving(false); }
  }

  async function returnCurrent() {
    if (!current) return;
    const ok = await confirm('بازگشت دارایی', 'بازگشت دارایی به انبار ثبت شود؟');
    if (!ok) return;
    const r = await fetch(`${API}/asset-assignments/${current.id}/return`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: '{}' });
    if (!r.ok) { toast.error(await readError(r, 'خطا در ثبت بازگشت')); return; }
    toast.success('بازگشت دارایی ثبت شد');
    await loadAsset();
  }

  function copy(text: string) { try { navigator.clipboard.writeText(text); toast.success('کپی شد'); } catch { } }

  // The QR/barcode endpoints need the bearer token, so load them as blobs instead of plain links
  async function showCode(kind: 'qr' | 'barcode') {
    const r = await fetch(`${API}/assets/${id}/${kind === 'qr' ? 'qr' : 'barcode'}.png`, { headers: auth });
    if (!r.ok) { toast.error(await readError(r, 'خطا در ساخت کد')); return; }
    const blob = await r.blob();
    setCode({ kind, src: URL.createObjectURL(blob) });
  }

  function printCode() {
    if (!code) return;
    const w = window.open('', '_blank', 'width=420,height=520');
    if (!w) return;
    w.document.write(`<html><head><title>${asset.barcode}</title></head><body style="text-align:center;font-family:sans-serif;padding:24px">
      <img src="${code.src}" style="max-width:320px"/><div style="margin-top:8px;font-size:14px">${asset.name}</div>
      <div style="font-family:monospace;font-size:13px">${asset.barcode}</div>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  }

  async function uploadImages(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData(); fd.append('file', f); fd.append('assetId', id);
        const r = await fetch(`${API}/uploads/asset-image`, { method: 'POST', headers: auth, body: fd });
        if (!r.ok) toast.error(`آپلود «${f.name}»: ${await readError(r, 'ناموفق')}`);
      }
      await loadAsset();
    } finally { setUploading(false); }
  }

  async function deleteImage(imageId: string) {
    const ok = await confirm('حذف تصویر', 'این تصویر حذف شود؟');
    if (!ok) return;
    const r = await fetch(`${API}/assets/${id}/images/${imageId}`, { method: 'DELETE', headers: auth });
    if (!r.ok) { toast.error(await readError(r, 'خطا در حذف تصویر')); return; }
    await loadAsset();
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`${API}/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(editData) });
    if (!r.ok) { toast.error(await readError(r, 'خطا در ذخیره')); return; }
    toast.success('دارایی ویرایش شد');
    setEditOpen(false);
    await loadAsset();
  }

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-2 text-theme-muted" dir="rtl">
      <AlertCircle className="w-8 h-8" /> <span className="text-sm">دارایی یافت نشد</span>
    </div>
  );

  if (!asset) return (
    <div className="flex justify-center items-center min-h-64">
      <div className="flex flex-col items-center gap-3 text-theme-muted">
        <div className="border-blue-600 border-t-transparent border-2 rounded-full w-8 h-8 animate-spin" />
        <span className="text-sm">در حال بارگذاری...</span>
      </div>
    </div>
  );

  const images: any[] = Array.isArray(asset.images) ? asset.images : [];

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
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
                  <button onClick={() => showCode('barcode')} className="hover:bg-theme-hover p-0.5 rounded" title="نمایش بارکد"><BarcodeIcon className="w-3.5 h-3.5 text-theme-muted" /></button>
                  <button onClick={() => copy(asset.barcode)} className="hover:bg-theme-hover p-0.5 rounded" title="کپی"><Copy className="w-3.5 h-3.5 text-theme-muted" /></button>
                </div>
                {asset.oldBarcode && (
                  <div className="inline-flex items-center gap-1.5 bg-theme-secondary border border-theme px-2.5 py-1 rounded-lg text-xs">
                    <span className="text-theme-muted">قدیم:</span>
                    <code className="font-mono text-theme-primary">{asset.oldBarcode}</code>
                    <button onClick={() => copy(asset.oldBarcode)} className="hover:bg-theme-hover p-0.5 rounded"><Copy className="w-3.5 h-3.5 text-theme-muted" /></button>
                  </div>
                )}
                <span className="inline-flex items-center bg-theme-secondary border border-theme px-2.5 py-1 rounded-lg text-xs text-theme-secondary">{AVAIL_FA[asset.availability] || asset.availability}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditData({ name: asset.name, barcode: asset.barcode, oldBarcode: asset.oldBarcode || '', serialNumber: asset.serialNumber || '', location: asset.location || '', description: asset.description || '' }); setEditOpen(true); }} className="btn-theme-secondary text-sm gap-1.5">
                <Pencil className="w-4 h-4" /> ویرایش
              </button>
              <button onClick={() => showCode('qr')} className="btn-theme-secondary text-sm gap-1.5">
                <QrCode className="w-4 h-4" /> QR
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="gap-4 grid md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          {/* Details */}
          <div className="card-theme">
            <div className="card-theme-header"><h2 className="font-semibold text-theme-primary text-sm">مشخصات</h2></div>
            <div className="card-theme-body">
              <div className="gap-3 grid grid-cols-2 text-sm">
                {[
                  ['وضعیت دسترس', AVAIL_FA[asset.availability] || asset.availability],
                  ['وضعیت فیزیکی', COND_FA[asset.condition] || asset.condition],
                  ['دسته‌بندی', asset.category?.name],
                  ['نوع', asset.type?.name],
                  ['شماره سریال', asset.serialNumber],
                  ['مکان', asset.location],
                  ['تاریخ خرید', faDate(asset.purchaseDate)],
                  ['قیمت خرید', asset.cost != null ? `${Number(asset.cost).toLocaleString('fa-IR')} تومان` : null],
                  ['تاریخ ثبت', faDate(asset.createdAt)],
                  ['ثبت توسط', personName(asset.createdBy)],
                  ['توضیحات', asset.description],
                ].map(([k, v]) => v ? (
                  <div key={k as string} className="col-span-1">
                    <span className="text-theme-muted text-xs">{k}</span>
                    <div className="text-theme-primary font-medium text-sm">{v}</div>
                  </div>
                ) : null)}
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="card-theme">
            <div className="card-theme-header flex items-center justify-between">
              <h2 className="font-semibold text-theme-primary text-sm">تصاویر ({images.length.toLocaleString('fa-IR')})</h2>
              <label className={`btn-theme-secondary text-xs gap-1.5 py-1 px-2.5 ${uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {uploading ? 'در حال آپلود...' : 'افزودن تصویر'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => { uploadImages(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
            <div className="card-theme-body">
              {images.length === 0 ? (
                <p className="text-theme-muted text-sm py-4 text-center">تصویری ثبت نشده</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map(img => (
                    <div key={img.id} className="relative group">
                      <img src={img.url} alt={asset.name} onClick={() => setPreview(img.url)}
                        className="w-full h-28 object-cover rounded-xl border border-theme cursor-zoom-in" />
                      <button type="button" onClick={() => deleteImage(img.id)} title="حذف تصویر"
                        className="absolute top-1.5 left-1.5 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assignment history */}
          <div className="card-theme">
            <div className="card-theme-header flex items-center gap-2">
              <History className="w-4 h-4 text-theme-muted" />
              <h2 className="font-semibold text-theme-primary text-sm">تاریخچه واگذاری‌ها ({assignments.length.toLocaleString('fa-IR')})</h2>
            </div>
            <div className="card-theme-body">
              {assignments.length === 0 ? (
                <p className="text-theme-muted text-sm py-4 text-center">هیچ واگذاری‌ای ثبت نشده</p>
              ) : (
                <ol className="relative border-r-2 border-theme mr-2 space-y-4">
                  {assignments.map((a: any) => (
                    <li key={a.id} className="relative pr-5">
                      <span className={`absolute -right-[7px] top-3 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${a.returnedAt ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                      <div className="bg-theme-secondary border border-theme p-3 rounded-xl text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Users className="w-4 h-4 text-theme-muted" />
                          <span className="font-medium text-theme-primary">{personName(a.user) || a.department?.name || 'بدون تحویل‌گیرنده'}</span>
                          {a.user && a.department && <><span className="text-theme-muted">•</span><span className="text-theme-secondary">{a.department.name}</span></>}
                          <span className={`ms-auto text-[11px] px-2 py-0.5 rounded-full border ${a.returnedAt ? 'bg-theme-card border-theme text-theme-muted' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'}`}>
                            {a.returnedAt ? 'پایان یافته' : 'فعال'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-theme-muted text-xs">
                          {a.building && <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {a.building.name}</span>}
                          {a.floor && <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {a.floor.name}</span>}
                          {a.room && <span className="flex items-center gap-1"><Home className="w-3 h-3" /> {a.room.name}</span>}
                          {a.purpose && <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> {a.purpose}</span>}
                          {a.assignedBy && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> ثبت: {personName(a.assignedBy)}</span>}
                        </div>
                        {a.note && <div className="flex items-start gap-1 mt-1.5 text-xs text-theme-secondary whitespace-pre-wrap"><StickyNote className="w-3 h-3 mt-0.5 shrink-0" />{a.note}</div>}
                        <div className="mt-1.5 text-xs text-theme-muted">
                          از {faDateTime(a.assignedAt)} تا {a.returnedAt ? faDateTime(a.returnedAt) : 'اکنون'} <span className="opacity-70">({duration(a.assignedAt, a.returnedAt)})</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Current holder */}
          <div className="card-theme">
            <div className="card-theme-header"><h2 className="font-semibold text-theme-primary text-sm">در اختیار</h2></div>
            <div className="card-theme-body text-sm">
              {current ? (
                <div className="space-y-2">
                  <div className="font-medium text-theme-primary">{personName(current.user) || current.department?.name || current.building?.name}</div>
                  <div className="text-xs text-theme-muted">از {faDate(current.assignedAt)} ({duration(current.assignedAt)})</div>
                  <button onClick={returnCurrent} className="btn-theme-secondary w-full justify-center text-xs gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> ثبت بازگشت به انبار</button>
                </div>
              ) : (
                <p className="text-theme-muted text-xs">این دارایی در حال حاضر به کسی واگذار نشده است.</p>
              )}
            </div>
          </div>

          {/* New assignment form */}
          <div className="card-theme">
            <div className="card-theme-header"><h2 className="font-semibold text-theme-primary text-sm">{current ? 'انتقال / واگذاری جدید' : 'واگذاری جدید'}</h2></div>
            <div className="card-theme-body">
              <form onSubmit={createAssignment} className="space-y-3 text-sm">
                <div>
                  <label className="block mb-1.5 text-theme-muted text-xs">کاربر</label>
                  <SearchSelect options={users.map((u: any) => ({ id: u.id, name: personName(u), search: `${u.firstName || ''} ${u.lastName || ''} ${u.phone || ''}` }))} searchKey="search" emptyLabel="بدون کاربر" value={form.userId} onChange={v => setForm((s: any) => ({ ...s, userId: v }))} placeholder="انتخاب کاربر" />
                </div>
                <div>
                  <label className="block mb-1.5 text-theme-muted text-xs">بخش</label>
                  <SearchSelect options={departments} emptyLabel="بدون بخش" value={form.departmentId} onChange={v => setForm((s: any) => ({ ...s, departmentId: v }))} placeholder="انتخاب بخش" />
                </div>
                <div>
                  <label className="block mb-1.5 text-theme-muted text-xs">ساختمان</label>
                  <SearchSelect options={buildings} emptyLabel="بدون ساختمان" value={form.buildingId} onChange={v => setForm((s: any) => ({ ...s, buildingId: v, floorId: '', roomId: '' }))} placeholder="انتخاب ساختمان" />
                </div>
                {form.buildingId && (
                  <>
                    <div>
                      <label className="block mb-1.5 text-theme-muted text-xs">طبقه</label>
                      <SearchSelect options={floors} emptyLabel="بدون طبقه" value={form.floorId} onChange={v => setForm((s: any) => ({ ...s, floorId: v, roomId: '' }))} placeholder="انتخاب طبقه" />
                    </div>
                    {form.floorId && (
                      <div>
                        <label className="block mb-1.5 text-theme-muted text-xs">اتاق</label>
                        <SearchSelect options={rooms} emptyLabel="بدون اتاق" value={form.roomId} onChange={v => setForm((s: any) => ({ ...s, roomId: v }))} placeholder="انتخاب اتاق" />
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="block mb-1.5 text-theme-muted text-xs">نوع واگذاری</label>
                  <div className="flex gap-3">
                    {['استفاده', 'امانت تعمیرات'].map(p => (
                      <label key={p} className="flex items-center gap-1.5 text-theme-secondary cursor-pointer">
                        <input type="radio" name="purpose" checked={form.purpose === p} onChange={() => setForm((s: any) => ({ ...s, purpose: p }))} /> {p}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5 text-theme-muted text-xs">یادداشت</label>
                  <textarea value={form.note} onChange={e => setForm((s: any) => ({ ...s, note: e.target.value }))} className="input-theme resize-none text-sm" rows={2} />
                </div>
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-2.5 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-red-700 dark:text-red-300 text-xs">{formError}</p>
                  </div>
                )}
                <button type="submit" disabled={saving} className="btn-theme-primary w-full justify-center text-sm disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} ثبت واگذاری
                </button>
              </form>
            </div>
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
            <input required value={editData.name || ''} onChange={e => setEditData((s: any) => ({ ...s, name: e.target.value }))} className="input-theme" />
          </div>
          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد</label>
              <input required value={editData.barcode || ''} onChange={e => setEditData((s: any) => ({ ...s, barcode: e.target.value }))} className="input-theme font-mono" dir="ltr" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد قدیم</label>
              <input value={editData.oldBarcode || ''} onChange={e => setEditData((s: any) => ({ ...s, oldBarcode: e.target.value }))} className="input-theme font-mono" dir="ltr" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">شماره سریال</label>
              <input value={editData.serialNumber || ''} onChange={e => setEditData((s: any) => ({ ...s, serialNumber: e.target.value }))} className="input-theme" dir="ltr" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">مکان</label>
              <input value={editData.location || ''} onChange={e => setEditData((s: any) => ({ ...s, location: e.target.value }))} className="input-theme" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label>
            <textarea value={editData.description || ''} onChange={e => setEditData((s: any) => ({ ...s, description: e.target.value }))} className="input-theme resize-none" rows={3} />
          </div>
        </form>
      </Modal>

      {/* QR / barcode modal */}
      <Modal open={!!code} onClose={() => { if (code) URL.revokeObjectURL(code.src); setCode(null); }} title={code?.kind === 'qr' ? 'کد QR' : 'بارکد'} size="sm"
        footer={<button onClick={printCode} className="btn-theme-primary text-sm gap-1.5"><Printer className="w-4 h-4" /> چاپ</button>}>
        {code && (
          <div className="text-center space-y-2">
            <img src={code.src} alt={asset.barcode} className="mx-auto max-w-full" />
            <div className="text-sm text-theme-primary">{asset.name}</div>
            <code className="font-mono text-xs text-theme-muted">{asset.barcode}</code>
          </div>
        )}
      </Modal>

      {/* Image preview */}
      {preview && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
