"use client";
import React from "react";
import { Plus, Pencil, Trash2, Building } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import SkeletonTable from "../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { pageTitle } from "../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type BuildingType = { id: string; name: string; address?: string; description?: string; createdAt: string };

export default function BuildingsPage() {
  React.useEffect(() => { document.title = pageTitle("ساختمان‌ها"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<BuildingType> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/buildings`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setBuildings(Array.isArray(data) ? data : []);
    } catch { setBuildings([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing?.name?.trim()) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? `${API}/buildings` : `${API}/buildings/${editing.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success(isNew ? "ساختمان اضافه شد" : "ساختمان ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ذخیره"); } finally { setSaving(false); }
  }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف ساختمان", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/buildings/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("ساختمان حذف شد");
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="ساختمان‌ها" subtitle={loading ? undefined : `${buildings.length.toLocaleString("fa-IR")} ساختمان`} icon={Building} iconColor="from-slate-500 to-slate-600" actions={[{ label: "ساختمان جدید", icon: Plus, onClick: () => { setEditing({}); setOpen(true); } }]} />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead><tr><th>نام ساختمان</th><th>آدرس</th><th>توضیحات</th><th>تاریخ ایجاد</th><th>اقدامات</th></tr></thead>
            {loading ? <SkeletonTable cols={5} rows={4} /> : (
              <tbody>
                {buildings.length === 0 ? (
                  <EmptyStateRow icon={Building} title="ساختمانی یافت نشد" actionLabel="ساختمان جدید" onAction={() => { setEditing({}); setOpen(true); }} colSpan={5} />
                ) : buildings.map(b => (
                  <tr key={b.id}>
                    <td><div className="flex items-center gap-2"><Building className="w-4 h-4 text-theme-muted shrink-0" /><span className="font-medium text-theme-primary">{b.name}</span></div></td>
                    <td><span className="text-theme-secondary text-sm">{b.address || "-"}</span></td>
                    <td><span className="text-theme-muted text-sm">{b.description || "-"}</span></td>
                    <td><span className="text-theme-muted text-sm">{new Date(b.createdAt).toLocaleDateString("fa-IR")}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(b); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                        <button onClick={() => onDelete(b.id, b.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing?.id ? "ویرایش" : "افزودن"} ساختمان`} size="md"
        footer={<><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button><button form="building-form" type="submit" disabled={!editing?.name?.trim() || saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : "ذخیره"}</button></>}
      >
        <form id="building-form" onSubmit={onSubmit} className="space-y-4">
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام *</label><input value={editing?.name || ""} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} required className="input-theme" placeholder="نام ساختمان" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">آدرس</label><input value={editing?.address || ""} onChange={e => setEditing(s => ({ ...s, address: e.target.value }))} className="input-theme" placeholder="آدرس" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label><textarea value={editing?.description || ""} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} rows={3} className="input-theme resize-none" /></div>
        </form>
      </Modal>
    </div>
  );
}
