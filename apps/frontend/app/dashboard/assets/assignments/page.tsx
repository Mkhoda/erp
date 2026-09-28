"use client";
import React from "react";
import Link from "next/link";
import { Plus, Trash2, Handshake, RotateCcw, History, AlertCircle, Loader2 } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import SearchBar from "../../../components/ui/SearchBar";
import SkeletonTable from "../../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../../components/ui/EmptyState";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { pageTitle } from "../../../../lib/branding";
import { readError } from "../../../../lib/http";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Named = { id: string; name: string };
type Person = { id: string; firstName?: string; lastName?: string; phone?: string; email?: string };
type Row = {
  id: string; assetId: string; assignedAt: string; returnedAt?: string | null; purpose?: string; note?: string;
  asset?: { id: string; name: string; barcode: string };
  user?: Person; assignedBy?: Person; department?: Named; building?: Named; floor?: Named; room?: Named;
};
type Form = { assetId: string; userId: string; departmentId: string; buildingId: string; floorId: string; roomId: string; purpose: string; note: string };

const emptyForm: Form = { assetId: "", userId: "", departmentId: "", buildingId: "", floorId: "", roomId: "", purpose: "استفاده", note: "" };
const personName = (u?: Person) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone || u.email || "" : "");
const holder = (r: Row) => personName(r.user) || r.department?.name || "";
const place = (r: Row) => [r.building?.name, r.floor?.name, r.room?.name].filter(Boolean).join(" / ");
const faDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fa-IR") : "");

export default function AssignmentsPage() {
  React.useEffect(() => { document.title = pageTitle("واگذاری دارایی"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [status, setStatus] = React.useState<"" | "active" | "returned">("");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Form>(emptyForm);
  const [formError, setFormError] = React.useState("");
  const [assets, setAssets] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepts] = React.useState<any[]>([]);
  const [buildings, setBuildings] = React.useState<any[]>([]);
  const [floors, setFloors] = React.useState<any[]>([]);
  const [rooms, setRooms] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [history, setHistory] = React.useState<{ asset: Row["asset"]; rows: Row[] } | null>(null);
  const [returning, setReturning] = React.useState<Row | null>(null);
  const [returnNote, setReturnNote] = React.useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const auth = { Authorization: `Bearer ${token}` };

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${API}/asset-assignments${status ? `?status=${status}` : ""}`, { headers: auth });
      if (!r.ok) { toast.error(await readError(r, "خطا در دریافت واگذاری‌ها")); setRows([]); return; }
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { setRows([]); } finally { setLoading(false); }
  }

  async function loadLookups() {
    const get = (u: string) => fetch(`${API}/${u}`, { headers: auth }).then(r => (r.ok ? r.json() : [])).catch(() => []);
    const [a, u, d, b] = await Promise.all([get("assets?take=500"), get("users"), get("departments"), get("buildings")]);
    setAssets(Array.isArray(a) ? a : a?.data || []);
    setUsers(Array.isArray(u) ? u : u?.data || []);
    setDepts(Array.isArray(d) ? d : []);
    setBuildings(Array.isArray(b) ? b : []);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(); }, [status]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { loadLookups(); }, []);

  React.useEffect(() => {
    if (!form.buildingId) { setFloors([]); setRooms([]); return; }
    fetch(`${API}/floors?buildingId=${form.buildingId}`, { headers: auth }).then(r => (r.ok ? r.json() : [])).then(f => setFloors(Array.isArray(f) ? f : []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.buildingId]);
  React.useEffect(() => {
    if (!form.floorId) { setRooms([]); return; }
    fetch(`${API}/rooms?floorId=${form.floorId}`, { headers: auth }).then(r => (r.ok ? r.json() : [])).then(x => setRooms(Array.isArray(x) ? x : []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.floorId]);

  const q = query.trim().toLowerCase();
  const filtered = !q ? rows : rows.filter(r =>
    [r.asset?.name, r.asset?.barcode, holder(r), place(r)].some(v => (v || "").toLowerCase().includes(q)));

  const pickedAsset = assets.find(a => a.id === form.assetId);
  const pickedActive = rows.find(r => r.assetId === form.assetId && !r.returnedAt);

  function openNew() { setForm(emptyForm); setFormError(""); setOpen(true); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.assetId) { setFormError("دارایی را انتخاب کنید"); return; }
    if (!form.userId && !form.departmentId && !form.buildingId) { setFormError("کاربر، بخش یا مکان تحویل را مشخص کنید"); return; }
    setSaving(true);
    try {
      // Only send fields that were actually chosen — empty ids would break the foreign keys
      const payload: Record<string, string> = { assetId: form.assetId, purpose: form.purpose || "استفاده" };
      (["userId", "departmentId", "buildingId", "floorId", "roomId", "note"] as const).forEach(k => { if (form[k]) payload[k] = form[k]; });
      const res = await fetch(`${API}/asset-assignments`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify(payload) });
      if (!res.ok) { setFormError(await readError(res, "خطا در ثبت واگذاری")); return; }
      toast.success("واگذاری ثبت شد");
      setOpen(false); setForm(emptyForm); await load();
    } catch { setFormError("خطا در ارتباط با سرور"); } finally { setSaving(false); }
  }

  async function confirmReturn() {
    if (!returning) return;
    const r = await fetch(`${API}/asset-assignments/${returning.id}/return`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ note: returnNote || undefined }),
    });
    if (!r.ok) { toast.error(await readError(r, "خطا در ثبت بازگشت")); return; }
    toast.success("بازگشت دارایی ثبت شد");
    setReturning(null); setReturnNote("");
    await load();
  }

  async function onDelete(r: Row) {
    const ok = await confirm("حذف واگذاری", "این رکورد از تاریخچه حذف می‌شود (برای ثبت اشتباه). برای تحویل گرفتن دارایی از «بازگشت» استفاده کنید. ادامه می‌دهید؟");
    if (!ok) return;
    const res = await fetch(`${API}/asset-assignments/${r.id}`, { method: "DELETE", headers: auth });
    if (!res.ok) { toast.error(await readError(res, "خطا در حذف")); return; }
    toast.success("واگذاری حذف شد");
    await load();
  }

  async function openHistory(r: Row) {
    const res = await fetch(`${API}/asset-assignments?assetId=${r.assetId}`, { headers: auth });
    if (!res.ok) { toast.error(await readError(res, "خطا در دریافت تاریخچه")); return; }
    setHistory({ asset: r.asset, rows: await res.json() });
  }

  const StatusFilter = (
    <div className="flex bg-theme-secondary border border-theme p-1 rounded-xl">
      {([["", "همه"], ["active", "فعال"], ["returned", "پایان یافته"]] as const).map(([v, l]) => (
        <button key={v} onClick={() => setStatus(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === v ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted hover:text-theme-secondary"}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="واگذاری دارایی" subtitle={loading ? undefined : `${rows.length.toLocaleString("fa-IR")} واگذاری`} icon={Handshake} iconColor="from-teal-500 to-teal-600" extra={StatusFilter} actions={[{ label: "واگذاری جدید", icon: Plus, onClick: openNew }]} />

      <SearchBar value={query} onChange={setQuery} placeholder="جستجو دارایی، بارکد، تحویل‌گیرنده یا مکان..." count={filtered.length} countLabel="واگذاری" />

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead><tr><th>دارایی</th><th>تحویل‌گیرنده</th><th>مکان</th><th>نوع</th><th>از</th><th>تا</th><th>وضعیت</th><th>اقدامات</th></tr></thead>
            {loading ? <SkeletonTable cols={8} rows={5} /> : (
              <tbody>
                {filtered.length === 0 ? (
                  <EmptyStateRow icon={Handshake} title="واگذاری‌ای یافت نشد" actionLabel={!q ? "واگذاری جدید" : undefined} onAction={!q ? openNew : undefined} colSpan={8} />
                ) : filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/dashboard/assets/${r.assetId}`} className="font-medium text-theme-primary hover:text-blue-600 hover:underline">{r.asset?.name || r.assetId}</Link>
                      {r.asset?.barcode && <div className="font-mono text-theme-muted text-[11px]">{r.asset.barcode}</div>}
                    </td>
                    <td>
                      <span className="text-theme-secondary text-sm">{holder(r) || "-"}</span>
                      {r.user && r.department && <div className="text-theme-muted text-[11px]">{r.department.name}</div>}
                    </td>
                    <td><span className="text-theme-muted text-xs">{place(r) || "-"}</span></td>
                    <td><span className="text-theme-muted text-xs">{r.purpose || "-"}</span></td>
                    <td><span className="text-theme-secondary text-sm">{faDate(r.assignedAt)}</span></td>
                    <td><span className="text-theme-secondary text-sm">{faDate(r.returnedAt) || "—"}</span></td>
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
                          <button onClick={() => { setReturning(r); setReturnNote(""); }} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><RotateCcw className="w-3 h-3" />بازگشت</button>
                        )}
                        <button onClick={() => openHistory(r)} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1" title="تاریخچه این دارایی"><History className="w-3 h-3" /></button>
                        <button onClick={() => onDelete(r)} className="btn-theme-danger text-xs py-1 px-2.5" title="حذف رکورد"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* New assignment */}
      <Modal open={open} onClose={() => setOpen(false)} title="واگذاری جدید" size="lg"
        footer={<><button type="button" onClick={() => setOpen(false)} className="btn-theme-secondary text-sm">انصراف</button><button form="assign-form" type="submit" disabled={saving} className="btn-theme-primary text-sm disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ثبت واگذاری"}</button></>}
      >
        <form id="assign-form" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">دارایی *</label>
            <SearchSelect
              options={assets.map((a: any) => ({ id: a.id, name: `${a.name} (${a.barcode})`, search: `${a.name} ${a.barcode} ${a.oldBarcode || ""}` }))}
              value={form.assetId} onChange={v => setForm(s => ({ ...s, assetId: v }))} searchKey="search" placeholder="انتخاب دارایی (نام یا بارکد)"
            />
            {pickedActive && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                این دارایی اکنون در اختیار «{holder(pickedActive) || place(pickedActive)}» است؛ با ثبت، واگذاری فعلی بسته و در تاریخچه نگه داشته می‌شود.
              </p>
            )}
            {pickedAsset && ["RETIRED", "LOST", "CONSUMED"].includes(pickedAsset.availability) && (
              <p className="text-xs text-red-600 mt-1.5">وضعیت این دارایی اجازه واگذاری نمی‌دهد.</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">کاربر</label>
              <SearchSelect
                options={users.map((u: any) => ({ id: u.id, name: personName(u), search: `${u.firstName || ""} ${u.lastName || ""} ${u.phone || ""}` }))}
                value={form.userId} onChange={v => setForm(s => ({ ...s, userId: v }))} searchKey="search" emptyLabel="بدون کاربر" placeholder="انتخاب کاربر"
              />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بخش</label>
              <SearchSelect options={departments} value={form.departmentId} onChange={v => setForm(s => ({ ...s, departmentId: v }))} emptyLabel="بدون بخش" placeholder="انتخاب بخش" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">ساختمان</label>
              <SearchSelect options={buildings} value={form.buildingId} onChange={v => setForm(s => ({ ...s, buildingId: v, floorId: "", roomId: "" }))} emptyLabel="بدون ساختمان" placeholder="انتخاب ساختمان" />
            </div>
            {form.buildingId && (
              <div>
                <label className="block mb-1.5 font-medium text-theme-secondary text-sm">طبقه</label>
                <SearchSelect options={floors} value={form.floorId} onChange={v => setForm(s => ({ ...s, floorId: v, roomId: "" }))} emptyLabel="بدون طبقه" placeholder="انتخاب طبقه" />
              </div>
            )}
            {form.floorId && (
              <div>
                <label className="block mb-1.5 font-medium text-theme-secondary text-sm">اتاق</label>
                <SearchSelect options={rooms} value={form.roomId} onChange={v => setForm(s => ({ ...s, roomId: v }))} emptyLabel="بدون اتاق" placeholder="انتخاب اتاق" />
              </div>
            )}
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نوع واگذاری</label>
            <div className="flex gap-4">
              {["استفاده", "امانت تعمیرات"].map(p => (
                <label key={p} className="flex items-center gap-1.5 text-theme-secondary text-sm cursor-pointer">
                  <input type="radio" name="purpose" checked={form.purpose === p} onChange={() => setForm(s => ({ ...s, purpose: p }))} /> {p}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-sm">یادداشت</label>
            <textarea rows={2} value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} className="input-theme resize-none text-sm" />
          </div>
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 p-3 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-red-700 dark:text-red-300 text-sm">{formError}</p>
            </div>
          )}
        </form>
      </Modal>

      {/* Return */}
      <Modal open={!!returning} onClose={() => setReturning(null)} title="ثبت بازگشت دارایی" size="sm"
        footer={<><button type="button" onClick={() => setReturning(null)} className="btn-theme-secondary text-sm">انصراف</button><button onClick={confirmReturn} className="btn-theme-primary text-sm">ثبت بازگشت</button></>}
      >
        {returning && (
          <div className="space-y-3 text-sm">
            <p className="text-theme-secondary">«{returning.asset?.name}» از «{holder(returning) || place(returning)}» تحویل گرفته می‌شود و وضعیت آن «موجود» می‌شود.</p>
            <div>
              <label className="block mb-1.5 text-theme-muted text-xs">توضیح بازگشت (اختیاری)</label>
              <textarea rows={2} value={returnNote} onChange={e => setReturnNote(e.target.value)} className="input-theme resize-none text-sm" placeholder="مثلاً: سالم تحویل شد" />
            </div>
          </div>
        )}
      </Modal>

      {/* History */}
      <Modal open={!!history} onClose={() => setHistory(null)} title={`تاریخچه واگذاری — ${history?.asset?.name || ""}`} size="lg">
        {history && (
          history.rows.length === 0 ? <p className="text-theme-muted text-sm text-center py-6">تاریخچه‌ای ثبت نشده</p> : (
            <ol className="relative border-r-2 border-theme mr-2 space-y-3">
              {history.rows.map(h => (
                <li key={h.id} className="relative pr-5">
                  <span className={`absolute -right-[7px] top-3 w-3 h-3 rounded-full ${h.returnedAt ? "bg-slate-400" : "bg-emerald-500"}`} />
                  <div className="bg-theme-secondary border border-theme rounded-xl p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-theme-primary">{holder(h) || place(h) || "—"}</span>
                      {h.purpose && <span className="text-xs text-theme-muted">({h.purpose})</span>}
                      <span className="ms-auto text-xs text-theme-muted">{faDate(h.assignedAt)} تا {h.returnedAt ? faDate(h.returnedAt) : "اکنون"}</span>
                    </div>
                    {place(h) && holder(h) && <div className="text-xs text-theme-muted mt-1">{place(h)}</div>}
                    {h.assignedBy && <div className="text-xs text-theme-muted mt-1">ثبت توسط: {personName(h.assignedBy)}</div>}
                    {h.note && <div className="text-xs text-theme-secondary mt-1 whitespace-pre-wrap">{h.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )
        )}
      </Modal>
    </div>
  );
}
