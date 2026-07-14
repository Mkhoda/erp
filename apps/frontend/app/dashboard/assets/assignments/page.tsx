"use client";
import React from "react";
import { Plus, Trash2, Handshake, RotateCcw } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import SkeletonTable from "../../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../../components/ui/EmptyState";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { pageTitle } from "../../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Row = { id: string; assetId: string; userId?: string; departmentId?: string; assignedAt: string; returnedAt?: string; asset?: any; user?: any; department?: any };

export default function AssignmentsPage() {
  React.useEffect(() => { document.title = pageTitle("واگذاری دارایی"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Row> | null>(null);
  const [assets, setAssets] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/asset-assignments`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); } finally { setLoading(false); }
  }

  async function loadLookups() {
    const [a, u, d] = await Promise.all([
      fetch(`${API}/assets?take=100`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
      fetch(`${API}/departments`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => []),
    ]);
    setAssets(Array.isArray(a) ? a : a?.data || []);
    setUsers(Array.isArray(u) ? u : []);
    setDepts(Array.isArray(d) ? d : []);
  }

  React.useEffect(() => { load(); loadLookups(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/asset-assignments`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editing) });
      if (!res.ok) throw new Error();
      toast.success("واگذاری ثبت شد");
      setOpen(false); setEditing(null); await load();
    } catch { toast.error("خطا در ثبت واگذاری"); } finally { setSaving(false); }
  }

  async function onReturn(id: string, name: string) {
    const ok = await confirm("بازگشت دارایی", `بازگشت دارایی "${name}" تأیید می‌شود؟`);
    if (!ok) return;
    await fetch(`${API}/asset-assignments/${id}/return`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    toast.success("دارایی برگشت داده شد");
    await load();
  }

  async function onDelete(id: string) {
    const ok = await confirm("حذف واگذاری", "آیا از حذف این واگذاری اطمینان دارید؟");
    if (!ok) return;
    await fetch(`${API}/asset-assignments/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("واگذاری حذف شد");
    await load();
  }

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="واگذاری دارایی" subtitle={loading ? undefined : `${rows.length.toLocaleString("fa-IR")} واگذاری`} icon={Handshake} iconColor="from-teal-500 to-teal-600" actions={[{ label: "واگذاری جدید", icon: Plus, onClick: () => { setEditing({}); setOpen(true); } }]} />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead><tr><th>دارایی</th><th>تحویل‌گیرنده</th><th>تاریخ واگذاری</th><th>وضعیت</th><th>اقدامات</th></tr></thead>
            {loading ? <SkeletonTable cols={5} rows={5} /> : (
              <tbody>
                {rows.length === 0 ? (
                  <EmptyStateRow icon={Handshake} title="واگذاری‌ای ثبت نشده" actionLabel="واگذاری جدید" onAction={() => { setEditing({}); setOpen(true); }} colSpan={5} />
                ) : rows.map(r => (
                  <tr key={r.id}>
                    <td><span className="font-medium text-theme-primary">{r.asset?.name || r.assetId}</span></td>
                    <td><span className="text-theme-secondary text-sm">{r.user ? `${r.user.firstName || ""} ${r.user.lastName || ""}`.trim() : r.department?.name || "-"}</span></td>
                    <td><span className="text-theme-secondary text-sm">{new Date(r.assignedAt).toLocaleDateString("fa-IR")}</span></td>
                    <td>
                      {r.returnedAt ? (
                        <span className="inline-flex items-center bg-theme-secondary border border-theme px-2 py-0.5 rounded-full text-theme-muted text-xs">پایان یافته</span>
                      ) : (
                        <span className="inline-flex items-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 text-xs">فعال</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {!r.returnedAt && (
                          <button onClick={() => onReturn(r.id, r.asset?.name || r.assetId)} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><RotateCcw className="w-3 h-3" />بازگشت</button>
                        )}
                        <button onClick={() => onDelete(r.id)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title="واگذاری جدید" size="md"
        footer={<><button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="btn-theme-secondary text-sm">انصراف</button><button form="assign-form" type="submit" disabled={saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? "..." : "ثبت واگذاری"}</button></>}
      >
        <form id="assign-form" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">دارایی *</label>
            <select value={editing?.assetId || ""} onChange={e => setEditing(s => ({ ...s, assetId: e.target.value }))} required className="select-theme">
              <option value="">انتخاب دارایی...</option>
              {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.barcode})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">کاربر</label>
              <SearchSelect
                options={users.map((u: any) => ({ id: u.id, name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone || u.email, search: `${u.firstName || ""} ${u.lastName || ""} ${u.phone || ""}` }))}
                value={editing?.userId || ""}
                onChange={id => setEditing(s => ({ ...s, userId: id, departmentId: "" }))}
                searchKey="search"
                emptyLabel="بدون کاربر"
                placeholder="انتخاب کاربر"
              />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بخش</label>
              <select value={editing?.departmentId || ""} onChange={e => setEditing(s => ({ ...s, departmentId: e.target.value, userId: "" }))} className="select-theme text-sm">
                <option value="">بدون بخش</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
