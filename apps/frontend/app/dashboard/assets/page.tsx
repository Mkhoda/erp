"use client";
import React from "react";
import Link from "next/link";
import { Pencil, Trash2, List, LayoutGrid, Plus, Boxes, X, Image as ImageIcon, Building2, FilterX } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "../../components/ui/PageHeader";
import SearchBar from "../../components/ui/SearchBar";
import SkeletonTable, { SkeletonCards } from "../../components/ui/SkeletonTable";
import { EmptyStateRow, EmptyStateBox } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import JalaliDatePicker from "../../components/ui/JalaliDatePicker";
import { pageTitle } from "../../../lib/branding";
import { usePagePerms } from "../../../lib/permissions";
import { readError } from "../../../lib/http";

type Asset = {
  id: string; name: string; barcode: string; oldBarcode?: string; description?: string;
  typeId?: string; categoryId?: string; condition?: "NEW" | "USED_GOOD" | "DEFECTIVE";
  availability?: "AVAILABLE" | "IN_USE" | "CONSUMED" | "MAINTENANCE" | "RETIRED" | "LOST";
  barcodeType?: "QR" | "CODE128"; serialNumber?: string; location?: string;
  purchaseDate?: string; cost?: number; createdAt?: string; updatedAt?: string; ownerId?: string | null;
  type?: { id: string; name: string }; category?: { id: string; name: string }; owner?: { id: string; name: string } | null;
  images?: Array<{ id: string; url: string; caption?: string }>;
  assignments?: Array<{ user?: { firstName?: string; lastName?: string }; department?: { name: string }; building?: { name: string }; room?: { name: string } }>;
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

const holderLabel = (a: Asset) => {
  const cur = a.assignments?.[0];
  if (!cur) return "";
  if (cur.user) return `${cur.user.firstName || ""} ${cur.user.lastName || ""}`.trim();
  return cur.department?.name || cur.room?.name || cur.building?.name || "";
};

const avLabel = (a?: string) => AVAIL[a || ""] || { label: a || "-", cls: "bg-theme-secondary text-theme-muted border-theme" };

const faDateTime = (iso?: string) => iso
  ? new Date(iso).toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" })
  : "-";

// Server-side sort keys (GET /assets?paged=1&sort=…). The holder column can't be sorted on
// the server (it's derived from the current assignment), so it has no key.
type SortKey = "barcode" | "name" | "type" | "category" | "owner" | "availability" | "createdAt" | "updatedAt";
const COLUMNS: Array<{ key?: SortKey; label: string }> = [
  { key: "barcode", label: "بارکد" }, { key: "name", label: "نام" }, { key: "type", label: "نوع" },
  { key: "category", label: "دسته" }, { key: "owner", label: "تعلق" }, { key: "availability", label: "وضعیت" },
  { label: "تحویل‌گیرنده / مکان" },
  { key: "createdAt", label: "تاریخ ایجاد" }, { key: "updatedAt", label: "آخرین تغییر" },
];
const COND_FA: Record<string, string> = { NEW: "جدید", USED_GOOD: "استفاده شده - سالم", DEFECTIVE: "معیوب" };

type Filters = { typeId: string; categoryId: string; ownerId: string; availability: string; condition: string; assigned: string; purchaseFrom: string; purchaseTo: string };
const NO_FILTERS: Filters = { typeId: "", categoryId: "", ownerId: "", availability: "", condition: "", assigned: "", purchaseFrom: "", purchaseTo: "" };
const PAGE_SIZES = [25, 50, 100, 200];

export default function AssetsPage() {
  React.useEffect(() => { document.title = pageTitle("دارایی‌ها"); }, []);

  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();

  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [total, setTotal] = React.useState(0);
  const [assetTypes, setAssetTypes] = React.useState<Array<{ id: string; name: string }>>([]);
  const [assetCategories, setAssetCategories] = React.useState<Array<{ id: string; name: string }>>([]);
  const [owners, setOwners] = React.useState<Array<{ id: string; name: string; description?: string | null; _count?: { assets: number } }>>([]);
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Asset | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [selectedImages, setSelectedImages] = React.useState<File[]>([]);
  const [ownersOpen, setOwnersOpen] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  // View / add-edit / delete flags of this page (/dashboard/access); the API enforces them too.
  const perms = usePagePerms("/dashboard/assets");

  // Default: latest change first. Clicking a header sorts by it; clicking again flips direction.
  const [sortK, setSortK] = React.useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  function thSort(k: SortKey) {
    if (sortK === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortK(k); setSortDir(k === "createdAt" || k === "updatedAt" ? "desc" : "asc"); }
  }

  React.useEffect(() => { const t = setTimeout(() => setDebouncedQuery(query.trim()), 300); return () => clearTimeout(t); }, [query]);
  // Any change to what's being listed goes back to page 1.
  React.useEffect(() => { setPage(1); }, [debouncedQuery, filters, sortK, sortDir, pageSize]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams({ paged: "1", page: String(page), pageSize: String(pageSize), sort: sortK, dir: sortDir });
      if (debouncedQuery) p.set("q", debouncedQuery);
      for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
      const res = await fetch(`${API}/assets?${p}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error(await readError(res, "خطا در دریافت دارایی‌ها")); return; }
      const data = await res.json();
      setAssets(Array.isArray(data?.items) ? data.items : []);
      setTotal(data?.total ?? 0);
    } catch { setAssets([]); setTotal(0); } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [page, pageSize, sortK, sortDir, debouncedQuery, filters]);
  React.useEffect(() => { load(); }, [load]);

  const loadOwners = React.useCallback(() => {
    fetch(`${API}/asset-owners`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).then(d => setOwners(Array.isArray(d) ? d : [])).catch(() => {});
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => {
    fetch(`${API}/asset-types`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setAssetTypes(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/asset-categories`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setAssetCategories(Array.isArray(d) ? d : [])).catch(() => {});
    loadOwners();
    // eslint-disable-next-line
  }, []);

  const filtered = assets; // already filtered, sorted and paged by the server
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const setF = (k: keyof Filters, v: string) => setFilters(f => ({ ...f, [k]: v }));

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

  /** Uploads the picked images to the server (stored on local disk) and returns their urls. */
  async function uploadImages(): Promise<string[]> {
    if (!selectedImages.length) return [];
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const file of selectedImages) {
        const fd = new FormData(); fd.append("file", file);
        const r = await fetch(`${API}/uploads/asset-image`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        if (!r.ok) { toast.error(`آپلود «${file.name}»: ${await readError(r, "ناموفق")}`); continue; }
        const d = await r.json();
        if (d?.url) urls.push(d.url);
      }
    } finally { setUploading(false); }
    return urls;
  }

  async function removeExistingImage(imageId: string) {
    if (!editing || !editing.id || editing.id === "0") return;
    const r = await fetch(`${API}/assets/${editing.id}/images/${imageId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { toast.error(await readError(r, "خطا در حذف تصویر")); return; }
    setEditing(s => s ? { ...s, images: (s.images || []).filter(i => i.id !== imageId) } : s);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name?.trim()) return;
    if (!editing.categoryId) { toast.warning("دسته‌بندی دارایی را انتخاب کنید"); return; }
    if (!editing.typeId) { toast.warning("نوع دارایی را انتخاب کنید"); return; }
    setSaving(true);
    try {
      const isNew = editing.id === "0" || !editing.id;
      const newUrls = await uploadImages();
      // Send only editable columns — never the nested type/category/images objects
      const payload: Record<string, any> = {
        name: editing.name, barcode: editing.barcode || "", oldBarcode: editing.oldBarcode || "",
        description: editing.description || "", serialNumber: editing.serialNumber || "", location: editing.location || "",
        typeId: editing.typeId, categoryId: editing.categoryId, ownerId: editing.ownerId || null,
        condition: editing.condition || "NEW", availability: editing.availability || "AVAILABLE", barcodeType: editing.barcodeType || "QR",
        purchaseDate: editing.purchaseDate || null, cost: editing.cost ?? null,
        images: [...(editing.images || []).map(i => i.url), ...newUrls],
      };
      if (isNew && !payload.barcode) delete payload.barcode; // server auto-generates
      const url = isNew ? `${API}/assets` : `${API}/assets/${editing.id}`;
      const res = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      if (!res.ok) { toast.error(await readError(res, "خطا در ذخیره دارایی")); return; }
      toast.success(isNew ? "دارایی جدید اضافه شد" : "دارایی ویرایش شد");
      setOpen(false); setEditing(null); setSelectedImages([]);
      await load();
    } catch { toast.error("خطا در ارتباط با سرور"); } finally { setSaving(false); }
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
        subtitle={loading ? undefined : `${total.toLocaleString("fa-IR")} دارایی${activeFilters || debouncedQuery ? " (با فیلتر)" : " در سیستم"}`}
        icon={Boxes}
        iconColor="from-blue-500 to-purple-600"
        extra={ViewToggle}
        actions={[
          { label: "تعلق‌ها", icon: Building2, onClick: () => setOwnersOpen(true), variant: "secondary" as const },
          ...(perms?.canWrite ? [{ label: "افزودن دارایی", icon: Plus, onClick: onAdd }] : []),
        ]}
      />

      <SearchBar value={query} onChange={setQuery} placeholder="جستجو در نام، بارکد، بارکد قدیم، سریال یا مکان..." count={total} countLabel="دارایی" />

      {/* Filters */}
      <div className="card-theme">
        <div className="card-theme-body py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 items-center">
          <select className="select-theme text-sm" value={filters.typeId} onChange={e => setF("typeId", e.target.value)}>
            <option value="">همه انواع</option>
            {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="select-theme text-sm" value={filters.categoryId} onChange={e => setF("categoryId", e.target.value)}>
            <option value="">همه دسته‌ها</option>
            {assetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select-theme text-sm" value={filters.ownerId} onChange={e => setF("ownerId", e.target.value)}>
            <option value="">همه تعلق‌ها</option>
            <option value="none">بدون تعلق</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className="select-theme text-sm" value={filters.availability} onChange={e => setF("availability", e.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(AVAIL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="select-theme text-sm" value={filters.condition} onChange={e => setF("condition", e.target.value)}>
            <option value="">همه وضعیت‌های فیزیکی</option>
            {Object.entries(COND_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="select-theme text-sm" value={filters.assigned} onChange={e => setF("assigned", e.target.value)}>
            <option value="">واگذاری: همه</option>
            <option value="yes">واگذارشده</option>
            <option value="no">واگذارنشده</option>
          </select>
          <div className="col-span-2 md:col-span-3 lg:col-span-2 flex items-center gap-1 text-xs text-theme-muted">
            <span className="shrink-0">تاریخ خرید از</span><JalaliDatePicker value={filters.purchaseFrom} onChange={v => setF("purchaseFrom", v)} />
          </div>
          <div className="col-span-2 md:col-span-3 lg:col-span-2 flex items-center gap-1 text-xs text-theme-muted">
            <span className="shrink-0">تا</span><JalaliDatePicker value={filters.purchaseTo} onChange={v => setF("purchaseTo", v)} />
          </div>
          {activeFilters > 0 && (
            <button onClick={() => setFilters(NO_FILTERS)} className="flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-lg text-red-600 hover:bg-red-500/10">
              <FilterX className="w-3.5 h-3.5" /> پاک کردن فیلترها ({activeFilters.toLocaleString("fa-IR")})
            </button>
          )}
        </div>
      </div>

      {view === "list" ? (
        <div className="table-theme-container">
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  {COLUMNS.map(c => c.key ? (
                    <th key={c.label} onClick={() => thSort(c.key!)} className="cursor-pointer select-none hover:text-theme-primary whitespace-nowrap">
                      {c.label}{sortK === c.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ) : <th key={c.label} className="whitespace-nowrap">{c.label}</th>)}
                  <th>اقدامات</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonTable cols={11} rows={6} />
              ) : (
                <tbody>
                  {filtered.length === 0 ? (
                    <EmptyStateRow icon={Boxes} title="دارایی‌ای یافت نشد" description={query || activeFilters ? "جستجو یا فیلترها را تغییر دهید" : undefined} actionLabel={!query && !activeFilters && perms?.canWrite ? "افزودن دارایی" : undefined} onAction={!query && !activeFilters && perms?.canWrite ? onAdd : undefined} colSpan={11} />
                  ) : filtered.map((a, i) => {
                    const av = avLabel(a.availability);
                    return (
                      <tr key={a.id}>
                        <td className="text-theme-muted text-xs">{((page - 1) * pageSize + i + 1).toLocaleString("fa-IR")}</td>
                        <td><Link href={`/dashboard/assets/${a.id}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline text-sm">{a.barcode}</Link></td>
                        <td><Link href={`/dashboard/assets/${a.id}`} className="font-medium text-theme-primary hover:text-blue-600 dark:hover:text-blue-400 text-sm hover:underline">{a.name}</Link></td>
                        <td><span className="text-theme-secondary text-sm">{a.type?.name || "-"}</span></td>
                        <td><span className="text-theme-secondary text-sm">{a.category?.name || "-"}</span></td>
                        <td><span className="text-theme-secondary text-sm">{a.owner?.name || "-"}</span></td>
                        <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${av.cls}`}>{av.label}</span></td>
                        <td><span className="text-theme-muted text-sm">{holderLabel(a) || a.location || "-"}</span></td>
                        <td><span className="text-theme-muted text-xs whitespace-nowrap" dir="ltr">{faDateTime(a.createdAt)}</span></td>
                        <td><span className="text-theme-muted text-xs whitespace-nowrap" dir="ltr">{faDateTime(a.updatedAt)}</span></td>
                        <td>
                          <div className="flex gap-2">
                            {perms?.canWrite && <button onClick={() => onEdit(a)} className="btn-theme-secondary text-xs py-1 px-2.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>}
                            {perms?.canDelete && <button onClick={() => onDelete(a.id, a.name)} className="btn-theme-danger text-xs py-1 px-2.5"><Trash2 className="w-3 h-3" /></button>}
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
            <EmptyStateBox icon={Boxes} title="دارایی‌ای یافت نشد" actionLabel={!query && !activeFilters && perms?.canWrite ? "افزودن دارایی" : undefined} onAction={!query && !activeFilters && perms?.canWrite ? onAdd : undefined} />
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
                    {a.owner?.name && <div className="text-theme-muted text-xs mt-0.5">تعلق: {a.owner.name}</div>}
                    {a.location && <div className="text-theme-muted text-xs mt-0.5">{a.location}</div>}
                  </div>
                  <div className="flex gap-2">
                    {perms?.canWrite && <button onClick={() => onEdit(a)} className="btn-theme-secondary text-xs flex-1 justify-center py-1.5 gap-1"><Pencil className="w-3 h-3" />ویرایش</button>}
                    {perms?.canDelete && <button onClick={() => onDelete(a.id, a.name)} className="btn-theme-danger text-xs py-1.5 px-3"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}


      {/* Pagination */}
      {total > 0 && (
        <div className="card-theme">
          <div className="card-theme-body py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-theme-muted">
              <span>نمایش</span>
              <select value={pageSize} onChange={e => setPageSize(+e.target.value)} className="select-theme text-sm w-auto py-1">
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n.toLocaleString("fa-IR")}</option>)}
              </select>
              <span>
                ردیف {((page - 1) * pageSize + 1).toLocaleString("fa-IR")} تا {Math.min(page * pageSize, total).toLocaleString("fa-IR")} از {total.toLocaleString("fa-IR")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button disabled={page <= 1 || loading} onClick={() => setPage(1)} className="px-2.5 py-1 rounded-lg border border-theme text-theme-primary disabled:opacity-40">اول</button>
              <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="px-2.5 py-1 rounded-lg border border-theme text-theme-primary disabled:opacity-40">قبلی</button>
              <span className="px-2 text-theme-muted">صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</span>
              <button disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)} className="px-2.5 py-1 rounded-lg border border-theme text-theme-primary disabled:opacity-40">بعدی</button>
              <button disabled={page >= pages || loading} onClick={() => setPage(pages)} className="px-2.5 py-1 rounded-lg border border-theme text-theme-primary disabled:opacity-40">آخر</button>
            </div>
          </div>
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
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">بارکد {editing?.id && editing.id !== "0" ? "*" : ""}</label>
              <input required={!!editing?.id && editing.id !== "0"} value={editing?.barcode || ""} onChange={e => setEditing(s => s ? { ...s, barcode: e.target.value } : s)} className="input-theme font-mono" placeholder={editing?.id && editing.id !== "0" ? "بارکد" : "خالی = تولید خودکار"} dir="ltr" />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نوع دارایی *</label>
              <select required value={editing?.typeId || ""} onChange={e => setEditing(s => s ? { ...s, typeId: e.target.value } : s)} className="select-theme">
                <option value="">انتخاب نوع...</option>
                {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">دسته‌بندی *</label>
              <select required value={editing?.categoryId || ""} onChange={e => setEditing(s => s ? { ...s, categoryId: e.target.value } : s)} className="select-theme">
                <option value="">انتخاب دسته...</option>
                {assetCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-sm">تعلق (سازمان)</label>
              <select value={editing?.ownerId || ""} onChange={e => setEditing(s => s ? { ...s, ownerId: e.target.value || null } : s)} className="select-theme">
                <option value="">نامشخص</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
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
              <span className="text-theme-muted text-xs mt-1">PNG, JPG, WEBP تا ۱۵ مگابایت — روی سرور ذخیره می‌شود</span>
              <input type="file" multiple accept="image/*" onChange={e => { setSelectedImages(p => [...p, ...Array.from(e.target.files || [])]); e.target.value = ""; }} className="hidden" />
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
                    <div key={img.id} className="relative">
                      <img src={img.url} alt={img.caption || ""} className="w-full h-20 object-cover rounded-lg border border-theme" />
                      <button type="button" onClick={() => removeExistingImage(img.id)} title="حذف تصویر" className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>

      <OwnersModal open={ownersOpen} onClose={() => setOwnersOpen(false)} owners={owners} canWrite={!!perms?.canWrite} canDelete={!!perms?.canDelete}
        onChanged={() => { loadOwners(); load(); }} />
    </div>
  );
}

// تعلق — the organizations/companies assets belong to. Add/edit needs the page's
// add-edit flag, delete its delete flag; an owner still used by assets can't be deleted.
function OwnersModal({ open, onClose, owners, canWrite, canDelete, onChanged }: {
  open: boolean; onClose: () => void; canWrite: boolean; canDelete: boolean; onChanged: () => void;
  owners: Array<{ id: string; name: string; description?: string | null; _count?: { assets: number } }>;
}) {
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const [form, setForm] = React.useState<{ id?: string; name: string; description: string }>({ name: "", description: "" });
  const [busy, setBusy] = React.useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  async function save() {
    if (!form.name.trim()) { toast.warning("نام سازمان را وارد کنید"); return; }
    setBusy(true);
    try {
      const res = await fetch(form.id ? `${API}/asset-owners/${form.id}` : `${API}/asset-owners`, {
        method: form.id ? "PATCH" : "POST", headers: h, body: JSON.stringify({ name: form.name, description: form.description }),
      });
      if (!res.ok) { toast.error(await readError(res, "خطا در ذخیره")); return; }
      toast.success(form.id ? "ویرایش شد" : "سازمان اضافه شد");
      setForm({ name: "", description: "" });
      onChanged();
    } finally { setBusy(false); }
  }

  async function remove(o: { id: string; name: string }) {
    if (!(await confirm("حذف سازمان", `سازمان «${o.name}» حذف شود؟`))) return;
    const res = await fetch(`${API}/asset-owners/${o.id}`, { method: "DELETE", headers: h });
    if (!res.ok) { toast.error(await readError(res, "خطا در حذف")); return; }
    toast.success("حذف شد");
    onChanged();
  }

  return (
    <Modal open={open} onClose={onClose} title="تعلق دارایی‌ها" subtitle="سازمان‌ها و شرکت‌هایی که دارایی‌ها به آن‌ها تعلق دارند" size="md"
      footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}>
      {ConfirmDlg}
      <div className="space-y-3">
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <input placeholder="نام سازمان / شرکت" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} className="input-theme text-sm flex-1 min-w-40" />
            <input placeholder="توضیحات (اختیاری)" value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} className="input-theme text-sm flex-1 min-w-40" />
            <button onClick={save} disabled={busy} className="btn-theme-primary text-sm disabled:opacity-50">{form.id ? "ذخیره" : "افزودن"}</button>
            {form.id && <button onClick={() => setForm({ name: "", description: "" })} className="p-2 text-theme-muted"><X className="w-4 h-4" /></button>}
          </div>
        )}
        <ul className="divide-y divide-theme border border-theme rounded-lg">
          {owners.length === 0 && <li className="px-3 py-6 text-center text-xs text-theme-muted">هنوز سازمانی تعریف نشده</li>}
          {owners.map(o => (
            <li key={o.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Building2 className="w-4 h-4 text-theme-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-theme-primary">{o.name}</div>
                {o.description && <div className="text-xs text-theme-muted truncate">{o.description}</div>}
              </div>
              <span className="text-xs text-theme-muted">{(o._count?.assets ?? 0).toLocaleString("fa-IR")} دارایی</span>
              {canWrite && <button onClick={() => setForm({ id: o.id, name: o.name, description: o.description || "" })} className="p-1 text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>}
              {canDelete && <button onClick={() => remove(o)} className="p-1 text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
