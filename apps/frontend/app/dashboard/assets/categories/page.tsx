"use client";
import React from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import SkeletonTable from "../../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../../components/ui/EmptyState";
import Modal from "../../../components/ui/Modal";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { pageTitle } from "../../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Item = { id: string; name: string; codePrefix?: string; description?: string };

export default function AssetCategoriesPage() {
  React.useEffect(() => { document.title = pageTitle("دسته‌بندی دارایی"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Item> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/asset-categories`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json(); setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? `${API}/asset-categories` : `${API}/asset-categories/${editing.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success(isNew ? "دسته‌بندی اضافه شد" : "ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ذخیره"); } finally { setSaving(false); }
  }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف دسته‌بندی", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/asset-categories/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("دسته‌بندی حذف شد"); await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="دسته‌بندی دارایی" subtitle={loading ? undefined : `${items.length.toLocaleString("fa-IR")} دسته‌بندی`} icon={Tag} iconColor="from-amber-500 to-amber-600" actions={[{ label: "افزودن دسته", icon: Plus, onClick: () => { setEditing({ name: "" }); setOpen(true); } }]} />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead><tr><th>نام</th><th>پیشوند کد</th><th>توضیحات</th><th>اقدامات</th></tr></thead>
            {loading ? <SkeletonTable cols={4} rows={4} /> : (
              <tbody>
                {items.length === 0 ? (
                  <EmptyStateRow icon={Tag} title="دسته‌بندی ثبت نشده" actionLabel="افزودن دسته" onAction={() => { setEditing({ name: "" }); setOpen(true); }} colSpan={4} />
                ) : items.map(it => (
                  <tr key={it.id}>
                    <td><span className="font-medium text-theme-primary">{it.name}</span></td>
                    <td><code className="bg-theme-secondary px-2 py-0.5 rounded text-xs font-mono text-theme-secondary">{it.codePrefix || "-"}</code></td>
                    <td><span className="text-theme-muted text-sm">{it.description || "-"}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(it); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                        <button onClick={() => onDelete(it.id, it.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing?.id ? "ویرایش" : "افزودن"} دسته‌بندی`} size="sm"
        footer={<><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button><button form="cat-form" type="submit" disabled={saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : "ذخیره"}</button></>}
      >
        <form id="cat-form" onSubmit={onSubmit} className="space-y-4">
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام *</label><input value={editing?.name || ""} onChange={e => setEditing(s => s ? { ...s, name: e.target.value } : s)} required className="input-theme" placeholder="نام دسته‌بندی" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">پیشوند کد</label><input value={editing?.codePrefix || ""} onChange={e => setEditing(s => s ? { ...s, codePrefix: e.target.value } : s)} className="input-theme font-mono" placeholder="مثال: COMP" dir="ltr" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label><input value={editing?.description || ""} onChange={e => setEditing(s => s ? { ...s, description: e.target.value } : s)} className="input-theme" /></div>
        </form>
      </Modal>
    </div>
  );
}
