"use client";
import React from "react";
import { Plus, Pencil, Trash2, Home, Building, Layers } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import SkeletonTable from "../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { pageTitle } from "../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Room = { id: string; name: string; buildingId: string; floorId?: string; description?: string; capacity?: number; createdAt: string; building?: { id: string; name: string }; floor?: { id: string; name: string } };
type BuildingType = { id: string; name: string };
type Floor = { id: string; name: string; buildingId: string };

export default function RoomsPage() {
  React.useEffect(() => { document.title = pageTitle("اتاق‌ها"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Room> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    setLoading(true);
    try {
      const [r, b, f] = await Promise.all([
        fetch(`${API}/rooms`, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
        fetch(`${API}/buildings`, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
        fetch(`${API}/floors`, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
      ]);
      setRooms(Array.isArray(r) ? r : []); setBuildings(Array.isArray(b) ? b : []); setFloors(Array.isArray(f) ? f : []);
    } catch { setRooms([]); } finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  const filteredFloors = floors.filter(f => f.buildingId === editing?.buildingId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing?.name?.trim() || !editing.buildingId) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? `${API}/rooms` : `${API}/rooms/${editing.id}`, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success(isNew ? "اتاق اضافه شد" : "اتاق ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ذخیره"); } finally { setSaving(false); }
  }

  async function onDelete(id: string, name: string) {
    const ok = await confirm("حذف اتاق", `آیا از حذف "${name}" اطمینان دارید؟`);
    if (!ok) return;
    await fetch(`${API}/rooms/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("اتاق حذف شد"); await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="اتاق‌ها" subtitle={loading ? undefined : `${rooms.length.toLocaleString("fa-IR")} اتاق`} icon={Home} iconColor="from-cyan-500 to-cyan-600" actions={[{ label: "اتاق جدید", icon: Plus, onClick: () => { setEditing({}); setOpen(true); } }]} />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead><tr><th>نام اتاق</th><th>ساختمان</th><th>طبقه</th><th>ظرفیت</th><th>توضیحات</th><th>اقدامات</th></tr></thead>
            {loading ? <SkeletonTable cols={6} rows={4} /> : (
              <tbody>
                {rooms.length === 0 ? (
                  <EmptyStateRow icon={Home} title="اتاقی یافت نشد" actionLabel="اتاق جدید" onAction={() => { setEditing({}); setOpen(true); }} colSpan={6} />
                ) : rooms.map(r => (
                  <tr key={r.id}>
                    <td><div className="flex items-center gap-2"><Home className="w-4 h-4 text-theme-muted shrink-0" /><span className="font-medium text-theme-primary">{r.name}</span></div></td>
                    <td><div className="flex items-center gap-1.5 text-theme-secondary text-sm"><Building className="w-3.5 h-3.5 text-theme-muted" />{r.building?.name || "-"}</div></td>
                    <td><div className="flex items-center gap-1.5 text-theme-secondary text-sm"><Layers className="w-3.5 h-3.5 text-theme-muted" />{r.floor?.name || "-"}</div></td>
                    <td><span className="text-theme-secondary text-sm">{r.capacity || "-"}</span></td>
                    <td><span className="text-theme-muted text-sm">{r.description || "-"}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditing(r); setOpen(true); }} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>
                        <button onClick={() => onDelete(r.id, r.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing?.id ? "ویرایش" : "افزودن"} اتاق`} size="md"
        footer={<><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button><button form="room-form" type="submit" disabled={!editing?.name?.trim() || !editing?.buildingId || saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : "ذخیره"}</button></>}
      >
        <form id="room-form" onSubmit={onSubmit} className="space-y-4">
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">ساختمان *</label>
            <select value={editing?.buildingId || ""} onChange={e => setEditing(s => ({ ...s, buildingId: e.target.value, floorId: "" }))} required className="select-theme">
              <option value="">انتخاب ساختمان...</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">طبقه</label>
            <select value={editing?.floorId || ""} onChange={e => setEditing(s => ({ ...s, floorId: e.target.value }))} disabled={!editing?.buildingId} className="select-theme disabled:opacity-50">
              <option value="">انتخاب طبقه (اختیاری)</option>
              {filteredFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام اتاق *</label><input value={editing?.name || ""} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} required className="input-theme" placeholder="نام اتاق" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">ظرفیت</label><input type="number" min="1" value={editing?.capacity || ""} onChange={e => setEditing(s => ({ ...s, capacity: e.target.value ? parseInt(e.target.value) : undefined }))} className="input-theme" placeholder="تعداد نفر" /></div>
          <div><label className="block mb-1.5 font-medium text-theme-secondary text-sm">توضیحات</label><textarea value={editing?.description || ""} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} rows={2} className="input-theme resize-none" /></div>
        </form>
      </Modal>
    </div>
  );
}
