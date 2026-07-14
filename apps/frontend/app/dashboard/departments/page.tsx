"use client";
import React from "react";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import SkeletonTable from "../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { pageTitle } from "../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Department = { id: string; name: string; description?: string; createdAt: string };

export default function DepartmentsPage() {
  React.useEffect(() => { document.title = pageTitle("دپارتمان‌ها"); }, []);

  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();

  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Department> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch { setDepartments([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const url = isNew ? `${API}/departments` : `${API}/departments/${editing.id}`;
      const res = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success(isNew ? "دپارتمان اضافه شد" : "دپارتمان ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ذخیره دپارتمان"); } finally { setSaving(false); }
  }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف دپارتمان", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/departments/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("دپارتمان حذف شد");
    await load();
  }

  function onAdd() { setEditing({}); setOpen(true); }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}

      <PageHeader
        title="دپارتمان‌ها"
        subtitle={loading ? undefined : `${departments.length.toLocaleString("fa-IR")} دپارتمان در سیستم`}
        icon={MapPin}
        iconColor="from-green-500 to-green-600"
        actions={[{ label: "دپارتمان جدید", icon: Plus, onClick: onAdd }]}
      />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th>نام دپارتمان</th>
                <th>توضیحات</th>
                <th>تاریخ ایجاد</th>
                <th>اقدامات</th>
              </tr>
            </thead>
            {loading ? (
              <SkeletonTable cols={4} rows={5} />
            ) : (
              <tbody>
                {departments.length === 0 ? (
                  <EmptyStateRow icon={MapPin} title="دپارتمانی یافت نشد" actionLabel="دپارتمان جدید" onAction={onAdd} colSpan={4} />
                ) : departments.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-theme-muted shrink-0" />
                        <span className="font-medium text-theme-primary">{d.name}</span>
                      </div>
                    </td>
                    <td><span className="text-theme-secondary text-sm">{d.description || "-"}</span></td>
                    <td><span className="text-theme-muted text-sm">{new Date(d.createdAt).toLocaleDateString("fa-IR")}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(d); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                        <button onClick={() => onDelete(d.id, d.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing?.id ? "ویرایش" : "افزودن"} دپارتمان`} size="md"
        footer={<>
          <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button>
          <button form="dept-form" type="submit" disabled={!editing?.name?.trim() || saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "در حال ذخیره..." : "ذخیره"}</button>
        </>}
      >
        <form id="dept-form" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام *</label>
            <input value={editing?.name || ""} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} required className="input-theme" placeholder="نام دپارتمان" />
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label>
            <textarea value={editing?.description || ""} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} rows={3} className="input-theme resize-none" placeholder="توضیحات" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
