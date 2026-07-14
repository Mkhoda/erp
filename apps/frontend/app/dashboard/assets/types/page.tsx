"use client";
import React from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { EmptyStateBox } from "../../../components/ui/EmptyState";
import Modal from "../../../components/ui/Modal";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { pageTitle } from "../../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Item = { id: string; name: string; description?: string };

export default function AssetTypesPage() {
  React.useEffect(() => { document.title = pageTitle("انواع دارایی"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Item> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    try { const r = await fetch(`${API}/asset-types`, { headers: { Authorization: `Bearer ${token}` } }); const data = await r.json(); setItems(Array.isArray(data) ? data : []); } catch { setItems([]); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? `${API}/asset-types` : `${API}/asset-types/${editing.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success(isNew ? "نوع دارایی اضافه شد" : "ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ذخیره"); } finally { setSaving(false); }
  }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف نوع دارایی", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/asset-types/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("حذف شد"); await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="انواع دارایی" subtitle={`${items.length.toLocaleString("fa-IR")} نوع تعریف شده`} icon={Layers} iconColor="from-violet-500 to-violet-600" actions={[{ label: "افزودن نوع", icon: Plus, onClick: () => { setEditing({ name: "" }); setOpen(true); } }]} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <EmptyStateBox icon={Layers} title="نوع دارایی‌ای ثبت نشده" actionLabel="افزودن نوع" onAction={() => { setEditing({ name: "" }); setOpen(true); }} />
        ) : items.map(it => (
          <div key={it.id} className="card-theme">
            <div className="card-theme-body">
              <div className="font-semibold text-theme-primary mb-1">{it.name}</div>
              <div className="text-theme-muted text-xs mb-4">{it.description || "-"}</div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(it); setOpen(true); }} className="btn-theme-secondary text-xs flex-1 justify-center py-1.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                <button onClick={() => onDelete(it.id, it.name)} className="btn-theme-danger text-xs py-1.5 px-3"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing?.id ? "ویرایش" : "افزودن"} نوع دارایی`} size="sm"
        footer={<><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button><button form="type-form" type="submit" disabled={saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : "ذخیره"}</button></>}
      >
        <form id="type-form" onSubmit={onSubmit} className="space-y-4">
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام *</label><input value={editing?.name || ""} onChange={e => setEditing(s => s ? { ...s, name: e.target.value } : s)} required className="input-theme" placeholder="نام نوع دارایی" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label><input value={editing?.description || ""} onChange={e => setEditing(s => s ? { ...s, description: e.target.value } : s)} className="input-theme" /></div>
        </form>
      </Modal>
    </div>
  );
}
