"use client";
import React from "react";
import { Plus, Pencil, Trash2, Layers, Building } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import SkeletonTable from "../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Floor = { id: string; name: string; buildingId: string; description?: string; createdAt: string; building?: { id: string; name: string } };
type BuildingType = { id: string; name: string };

export default function FloorsPage() {
  React.useEffect(() => { document.title = "طبقات | Arzesh AI"; }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Floor> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    setLoading(true);
    try {
      const [f, b] = await Promise.all([
        fetch(`${API}/floors`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/buildings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setFloors(Array.isArray(f) ? f : []); setBuildings(Array.isArray(b) ? b : []);
    } catch { setFloors([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing?.name?.trim() || !editing.buildingId) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? `${API}/floors` : `${API}/floors/${editing.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success(isNew ? "طبقه اضافه شد" : "طبقه ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ذخیره"); } finally { setSaving(false); }
  }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف طبقه", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/floors/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("طبقه حذف شد"); await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="طبقات" subtitle={loading ? undefined : `${floors.length.toLocaleString("fa-IR")} طبقه`} icon={Layers} iconColor="from-indigo-500 to-indigo-600" actions={[{ label: "طبقه جدید", icon: Plus, onClick: () => { setEditing({}); setOpen(true); } }]} />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead><tr><th>نام طبقه</th><th>ساختمان</th><th>توضیحات</th><th>تاریخ ایجاد</th><th>اقدامات</th></tr></thead>
            {loading ? <SkeletonTable cols={5} rows={4} /> : (
              <tbody>
                {floors.length === 0 ? (
                  <EmptyStateRow icon={Layers} title="طبقه‌ای یافت نشد" actionLabel="طبقه جدید" onAction={() => { setEditing({}); setOpen(true); }} colSpan={5} />
                ) : floors.map(f => (
                  <tr key={f.id}>
                    <td><div className="flex items-center gap-2"><Layers className="w-4 h-4 text-theme-muted shrink-0" /><span className="font-medium text-theme-primary">{f.name}</span></div></td>
                    <td><div className="flex items-center gap-1.5 text-theme-secondary text-sm"><Building className="w-3.5 h-3.5 text-theme-muted" />{f.building?.name || "-"}</div></td>
                    <td><span className="text-theme-muted text-sm">{f.description || "-"}</span></td>
                    <td><span className="text-theme-muted text-sm">{new Date(f.createdAt).toLocaleDateString("fa-IR")}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(f); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                        <button onClick={() => onDelete(f.id, f.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing?.id ? "ویرایش" : "افزودن"} طبقه`} size="md"
        footer={<><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button><button form="floor-form" type="submit" disabled={!editing?.name?.trim() || !editing?.buildingId || saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : "ذخیره"}</button></>}
      >
        <form id="floor-form" onSubmit={onSubmit} className="space-y-4">
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">ساختمان *</label>
            <select value={editing?.buildingId || ""} onChange={e => setEditing(s => ({ ...s, buildingId: e.target.value }))} required className="select-theme">
              <option value="">انتخاب ساختمان...</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام طبقه *</label><input value={editing?.name || ""} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} required className="input-theme" placeholder="مثال: طبقه اول" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label><textarea value={editing?.description || ""} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} rows={2} className="input-theme resize-none" /></div>
        </form>
      </Modal>
    </div>
  );
}
