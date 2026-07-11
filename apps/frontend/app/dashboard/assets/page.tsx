"use client";
import React from "react";
import Link from "next/link";
import { Pencil, Trash2, List, LayoutGrid, Plus, Boxes, X, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "../../components/ui/PageHeader";
import SearchBar from "../../components/ui/SearchBar";
import SkeletonTable, { SkeletonCards } from "../../components/ui/SkeletonTable";
import { EmptyStateRow, EmptyStateBox } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import JalaliDatePicker from "../../components/ui/JalaliDatePicker";

type Asset = {
  id: string; name: string; barcode: string; oldBarcode?: string; description?: string;
  typeId?: string; categoryId?: string; condition?: "NEW" | "USED_GOOD" | "DEFECTIVE";
  availability?: "AVAILABLE" | "IN_USE" | "CONSUMED" | "MAINTENANCE" | "RETIRED" | "LOST";
  barcodeType?: "QR" | "CODE128"; serialNumber?: string; location?: string;
  purchaseDate?: string; cost?: number;
  type?: { id: string; name: string }; category?: { id: string; name: string };
  images?: Array<{ id: string; url: string; caption?: string }>;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const AVAIL: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: "موجود", cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
  IN_USE: { label: "در حال استفاده", cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  MAINTENANCE: { label: "تعمیرات", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  RETIRED: { label: "خارج از رده", cls: "bg-theme-secondary text-theme-muted border-theme" },
  LOST: { label: "مفقود", cls: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  CONSUMED: { label: "مصرف شده", cls: "bg-theme-secondary text-theme-muted border-theme" },
};

const avLabel = (a?: string) => AVAIL[a || ""] || { label: a || "-", cls: "bg-theme-secondary text-theme-muted border-theme" };

export default function AssetsPage() {
  React.useEffect(() => { document.title = "دارایی‌ها | Arzesh AI"; }, []);

  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();

  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = React.useState<Array<{ id: string; name: string }>>([]);
  const [assetCategories, setAssetCategories] = React.useState<Array<{ id: string; name: string }>>([]);
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Asset | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedImages, setSelectedImages] = React.useState<File[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/assets`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : (data?.data || []));
    } catch { setAssets([]); } finally { setLoading(false); }
  }

  React.useEffect(() => {
    load();
    fetch(`${API}/asset-types`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setAssetTypes(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/asset-categories`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setAssetCategories(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const filtered = assets.filter(a =>
    (a.name || "").toLowerCase().includes(query.toLowerCase()) ||
    (a.barcode || "").toLowerCase().includes(query.toLowerCase())
  );

  function onAdd() {
    setEditing({ id: "0", name: "", barcode: "", condition: "NEW", availability: "AVAILABLE", barcodeType: "QR" } as any);
    setSelectedImages([]);
    setOpen(true);
  }
  function onEdit(a: Asset) { setEditing(a); setSelectedImages([]); setOpen(true); }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف دارایی", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/assets/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("دارایی با موفقیت حذف شد");
    await load();
  }

  async function uploadImages(assetId: string) {
    if (!selectedImages.length) return;
    setUploading(true);
    try {
      for (const file of selectedImages) {
        const fd = new FormData(); fd.append("file", file); fd.append("assetId", assetId);
        await fetch(`${API}/uploads/asset-image`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      }
    } finally { setUploading(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name || !editing.barcode) return;
    setSaving(true);
    try {
      const isNew = (editing as any).id === "0" || !(editing as any).id;
      const url = isNew ? `${API}/assets` : `${API}/assets/${(editing as any).id}`;
      const res = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      if (selectedImages.length) await uploadImages(saved.id);
      toast.success(isNew ? "دارایی جدید اضافه شد" : "دارایی ویرایش شد");
      setOpen(false); setEditing(null); setSelectedImages([]);
      await load();
    } catch { toast.error("خطا در ذخیره دارایی"); } finally { setSaving(false); }
  }

  // View toggle
  const ViewToggle = (
    <div className="flex bg-theme-secondary border border-theme p-1 rounded-xl">
      {(["list", "grid"] as const).map(v => (
        <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === v ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted hover:text-theme-secondary"}`}>
          {v === "list" ? <><List className="w-3.5 h-3.5" />فهرست</> : <><LayoutGrid className="w-3.5 h-3.5" />کارت</>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}

      <PageHeader
        title="مدیریت دارایی‌ها"
        subtitle={loading ? undefined : `${assets.length.toLocaleString("fa-IR")} دارایی در سیستم`}
        icon={Boxes}
        iconColor="from-blue-500 to-purple-600"
        extra={ViewToggle}
        actions={[{ label: "افزودن دارایی", icon: Plus, onClick: onAdd }]}
      />

      <SearchBar value={query} onChange={setQuery} placeholder="جستجو نام یا بارکد..." count={filtered.length} countLabel="دارایی" />

      {view === "list" ? (
        <div className="table-theme-container">
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th>بارکد</th><th>نام</th><th>نوع</th><th>دسته</th><th>وضعیت</th><th>مکان</th><th>اقدامات</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonTable cols={7} rows={6} />
              ) : (
                <tbody>
                  {filtered.length === 0 ? (
                    <EmptyStateRow icon={Boxes} title="دارایی‌ای یافت نشد" description={query ? "عبارت جستجو را تغییر دهید" : undefined} actionLabel={!query ? "افزودن دارایی" : undefined} onAction={!query ? onAdd : undefined} colSpan={7} />
                  ) : filtered.map(a => {
                    const av = avLabel(a.availability);
                    return (
                      <tr key={a.id}>
                        <td><Link href={`/dashboard/assets/${a.id}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline text-sm">{a.barcode}</Link></td>
                        <td><Link href={`/dashboard/assets/${a.id}`} className="font-medium text-theme-primary hover:text-blue-600 dark:hover:text-blue-400 text-sm hover:underline">{a.name}</Link></td>
                        <td><span className="text-theme-secondary text-sm">{a.type?.name || "-"}</span></td>
                        <td><span className="text-theme-secondary text-sm">{a.category?.name || "-"}</span></td>
                        <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${av.cls}`}>{av.label}</span></td>
                        <td><span className="text-theme-muted text-sm">{a.location || "-"}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => onEdit(a)} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                            <button onClick={() => onDelete(a.id, a.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <SkeletonCards count={6} />
          ) : filtered.length === 0 ? (
            <EmptyStateBox icon={Boxes} title="دارایی‌ای یافت نشد" actionLabel={!query ? "افزودن دارایی" : undefined} onAction={!query ? onAdd : undefined} />
          ) : filtered.map(a => {
            const av = avLabel(a.availability);
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-theme quick-action-card group">
                <div className="card-theme-body">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/dashboard/assets/${a.id}`} className="font-semibold text-theme-primary hover:text-blue-600 dark:hover:text-blue-400 text-sm block truncate">{a.name}</Link>
                      <p className="font-mono text-theme-muted text-xs mt-0.5">{a.barcode}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium shrink-0 mr-2 ${av.cls}`}>{av.label}</span>
                  </div>
                  <div className="text-theme-secondary text-sm mb-4">
                    <div>{a.type?.name || "نوع نامشخص"}{a.category?.name ? ` • ${a.category.name}` : ""}</div>
                    {a.location && <div className="text-theme-muted text-xs mt-0.5">{a.location}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(a)} className="btn-theme-secondary text-xs flex-1 justify-center py-1.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                    <button onClick={() => onDelete(a.id, a.name)} className="btn-theme-danger text-xs py-1.5 px-3"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); setSelectedImages([]); }}
        title={editing?.id && editing.id !== "0" ? "ویرایش دارایی" : "افزودن دارایی جدید"}
        size="xl"
        footer={
          <>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); setSelectedImages([]); }} className="btn-theme-secondary text-sm">انصراف</button>
            <button form="asset-form" type="submit" disabled={saving || uploading} className="btn-theme-primary text-sm disabled:opacity-50">
              {saving ? "در حال ذخیره..." : uploading ? "آپلود تصاویر..." : "ذخیره"}
            </button>
          </>
        }
      >
        <form id="asset-form" onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام دارایی *</label>
              <input required value={editing?.name || ""} onChange={e => setEditing(s => s ? { ...s, name: e.target.value } : s)} className="input-theme" placeholder="نام دارایی" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد *</label>
              <input required value={editing?.barcode || ""} onChange={e => setEditing(s => s ? { ...s, barcode: e.target.value } : s)} className="input-theme font-mono" placeholder="بارکد" dir="ltr" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد قدیم</label>
              <input value={editing?.oldBarcode || ""} onChange={e => setEditing(s => s ? { ...s, oldBarcode: e.target.value } : s)} className="input-theme font-mono" dir="ltr" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">شماره سریال</label>
              <input value={editing?.serialNumber || ""} onChange={e => setEditing(s => s ? { ...s, serialNumber: e.target.value } : s)} className="input-theme" dir="ltr" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نوع دارایی</label>
              <select value={editing?.typeId || ""} onChange={e => setEditing(s => s ? { ...s, typeId: e.target.value } : s)} className="select-theme">
                <option value="">انتخاب نوع...</option>
                {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">دسته‌بندی</label>
              <select value={editing?.categoryId || ""} onChange={e => setEditing(s => s ? { ...s, categoryId: e.target.value } : s)} className="select-theme">
                <option value="">انتخاب دسته...</option>
                {assetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">وضعیت</label>
              <select value={editing?.condition || "NEW"} onChange={e => setEditing(s => s ? { ...s, condition: e.target.value as any } : s)} className="select-theme">
                <option value="NEW">جدید</option>
                <option value="USED_GOOD">استفاده شده - سالم</option>
                <option value="DEFECTIVE">معیوب</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">در دسترس بودن</label>
              <select value={editing?.availability || "AVAILABLE"} onChange={e => setEditing(s => s ? { ...s, availability: e.target.value as any } : s)} className="select-theme">
                <option value="AVAILABLE">موجود</option>
                <option value="IN_USE">در حال استفاده</option>
                <option value="MAINTENANCE">تعمیرات</option>
                <option value="RETIRED">خارج از رده</option>
                <option value="LOST">مفقود</option>
                <option value="CONSUMED">مصرف شده</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نوع بارکد</label>
              <select value={editing?.barcodeType || "QR"} onChange={e => setEditing(s => s ? { ...s, barcodeType: e.target.value as any } : s)} className="select-theme">
                <option value="QR">QR Code</option>
                <option value="CODE128">Code 128</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">مکان</label>
              <input value={editing?.location || ""} onChange={e => setEditing(s => s ? { ...s, location: e.target.value } : s)} className="input-theme" placeholder="مکان فعلی" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">تاریخ خرید</label>
              <JalaliDatePicker value={editing?.purchaseDate || ""} onChange={v => setEditing(s => s ? { ...s, purchaseDate: v } : s)} />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">قیمت خرید (تومان)</label>
              <input type="number" min="0" value={editing?.cost || ""} onChange={e => setEditing(s => s ? { ...s, cost: e.target.value ? parseFloat(e.target.value) : undefined } : s)} className="input-theme" placeholder="0" />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label>
            <textarea rows={3} value={editing?.description || ""} onChange={e => setEditing(s => s ? { ...s, description: e.target.value } : s)} className="input-theme resize-none" placeholder="توضیحات تکمیلی" />
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">تصاویر دارایی</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-theme rounded-xl p-6 cursor-pointer hover:bg-theme-hover transition-colors">
              <ImageIcon className="w-8 h-8 text-theme-muted mb-2" />
              <span className="text-theme-muted text-sm">کلیک کنید یا تصویر را بکشید</span>
              <span className="text-theme-muted text-xs mt-1">PNG, JPG تا 10MB</span>
              <input type="file" multiple accept="image/*" onChange={e => setSelectedImages(p => [...p, ...Array.from(e.target.files || [])])} className="hidden" />
            </label>
            {selectedImages.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {selectedImages.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-20 object-cover rounded-lg border border-theme" />
                    <button type="button" onClick={() => setSelectedImages(p => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {editing?.id && editing.id !== "0" && editing.images && editing.images.length > 0 && (
              <div className="mt-3">
                <p className="text-theme-muted text-xs mb-2">تصاویر موجود:</p>
                <div className="grid grid-cols-4 gap-2">
                  {editing.images.map(img => (
                    <img key={img.id} src={img.url} alt={img.caption || ""} className="w-full h-20 object-cover rounded-lg border border-theme" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
