"use client";
import React from "react";
import { List, LayoutGrid, Plus, Pencil, Users as UsersIcon, Upload, Phone, Ban, CheckCircle, KeyRound, Eye, EyeOff, UserX, CreditCard, Mail, ShieldCheck, Clock, Hash } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import SearchBar from "../../components/ui/SearchBar";
import SkeletonTable, { SkeletonCards } from "../../components/ui/SkeletonTable";
import { EmptyStateRow, EmptyStateBox } from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { pageTitle } from "../../../lib/branding";

type User = {
  id: string;
  maxSessions?: number;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "MANAGER" | "USER" | "EXPERT";
  disabled?: boolean;
  attendanceCardNo?: string | null;
  createdAt?: string;
  userDepartments?: Array<{ departmentId: string; department?: { id: string; name: string } }>;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const ROLE_LABELS: Record<string, string> = { ADMIN: "مدیر ارشد", MANAGER: "مدیر", EXPERT: "کارشناس", USER: "کاربر" };
const AVATAR_COLORS = ["from-blue-500 to-blue-600","from-purple-500 to-purple-600","from-green-500 to-green-600","from-amber-500 to-amber-600","from-pink-500 to-pink-600","from-teal-500 to-teal-600"];
const avatarColor = (u: User) => AVATAR_COLORS[(u.firstName?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    ADMIN:   "badge badge-danger",
    MANAGER: "badge badge-purple",
    EXPERT:  "badge badge-info",
    USER:    "badge badge-neutral",
  };
  return <span className={map[role] || "badge badge-neutral"}>{ROLE_LABELS[role] || role}</span>;
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="flex items-center gap-4 bg-theme-card px-5 py-4 border border-theme rounded-2xl">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
        <UsersIcon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="font-bold text-theme-primary text-2xl">{value.toLocaleString("fa-IR")}</div>
        <div className="text-theme-muted text-xs">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-theme-muted">{sub}</div>}
      </div>
    </div>
  );
}

export default function UsersPage() {
  React.useEffect(() => { document.title = pageTitle("مدیریت کاربران"); }, []);

  const toast  = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();

  const [users, setUsers]                   = React.useState<User[]>([]);
  const [departments, setDepartments]       = React.useState<Array<{ id: string; name: string }>>([]);
  const [schedules, setSchedules]           = React.useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [view, setView]                     = React.useState<"list" | "grid">("list");
  const [query, setQuery]                   = React.useState("");
  const [roleFilter, setRoleFilter]         = React.useState("ALL");
  const [departmentFilter, setDepartmentFilter] = React.useState("");
  const [showDisabled, setShowDisabled]     = React.useState(false);
  const [loading, setLoading]               = React.useState(true);
  const [open, setOpen]                     = React.useState(false);
  const [bulkOpen, setBulkOpen]             = React.useState(false);
  const [editing, setEditing]               = React.useState<any | null>(null);
  const [deptSearch, setDeptSearch]         = React.useState("");
  const [saving, setSaving]                 = React.useState(false);
  const [showNewPwd, setShowNewPwd]         = React.useState(false);
  const [showPwdField, setShowPwdField]     = React.useState(false);
  const [page, setPage]                     = React.useState(1);
  const [pageSize, setPageSize]             = React.useState(25);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = () => ({ Authorization: `Bearer ${token}` });

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/users`, { headers: h() });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); } finally { setLoading(false); }
  }

  async function loadDeps() {
    try {
      const r = await fetch(`${API}/departments`, { headers: h() });
      const data = await r.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch { setDepartments([]); }
    try {
      const r2 = await fetch(`${API}/attendance/schedules-lite`, { headers: h() });
      const d2 = await r2.json();
      setSchedules(Array.isArray(d2) ? d2 : []);
    } catch { setSchedules([]); }
  }

  React.useEffect(() => { load(); loadDeps(); }, []);

  const filtered = users.filter(u => {
    if (!showDisabled && u.disabled) return false;
    const name  = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
    const matchQ    = name.includes(query.toLowerCase()) || (u.phone || "").includes(query) || (u.email || "").toLowerCase().includes(query.toLowerCase()) || (u.attendanceCardNo || "").includes(query);
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchDept = !departmentFilter || u.userDepartments?.some(x => x.departmentId === departmentFilter);
    return matchQ && matchRole && matchDept;
  });

  // Paging (same "show count" + prev/next as the attendance records grid).
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  React.useEffect(() => { setPage(1); }, [query, roleFilter, departmentFilter, showDisabled, pageSize]);

  // Stats
  const active    = users.filter(u => !u.disabled).length;
  const disabled  = users.filter(u => u.disabled).length;
  const admins    = users.filter(u => u.role === "ADMIN" || u.role === "MANAGER").length;
  const withCard  = users.filter(u => u.attendanceCardNo).length;

  const DEFAULT_RULE = { employeeType: "FULL_TIME", scheduleId: "", otAllowed: true, checkInEnd: "", checkOutStart: "", dailyMinutes: "", otMaxDaily: "", otMaxMonthly: "" };

  function onAdd() {
    setEditing({ firstName: "", lastName: "", phone: "", email: "", password: "", role: "USER", maxSessions: 1, departmentIds: [], rule: { ...DEFAULT_RULE } });
    setShowPwdField(false); setShowNewPwd(false);
    setOpen(true);
  }

  async function onEdit(u: User) {
    setEditing({ ...u, departmentIds: (u.userDepartments || []).map(x => x.departmentId), newPassword: "", rule: { ...DEFAULT_RULE } });
    setShowPwdField(false); setShowNewPwd(false);
    setOpen(true);
    try {
      const r = await fetch(`${API}/attendance/user-rules/${u.id}`, { headers: h() });
      if (r.ok) {
        const rule = await r.json();
        if (rule) setEditing((s: any) => s && s.id === u.id ? ({ ...s, rule: { ...DEFAULT_RULE, ...Object.fromEntries(Object.entries(rule).map(([k, v]) => [k, v ?? (DEFAULT_RULE as any)[k] ?? ""])) } }) : s);
      }
    } catch { /* ignore */ }
  }

  async function onToggleDisable(u: User) {
    const action = u.disabled ? "فعال‌سازی" : "غیرفعال‌سازی";
    const ok = await confirm(`${action} کاربر`, `آیا از ${action} کاربر "${u.firstName} ${u.lastName}" اطمینان دارید؟`);
    if (!ok) return;
    const res = await fetch(`${API}/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...h() },
      body: JSON.stringify({ disabled: !u.disabled }),
    });
    if (res.ok) { toast.success(u.disabled ? "کاربر فعال شد" : "کاربر غیرفعال شد"); await load(); }
    else toast.error("خطا در عملیات");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const isNew = !editing.id;

    if (isNew && !editing.phone?.trim()) { toast.warning("شماره موبایل برای کاربر جدید الزامی است"); return; }
    if (isNew && !editing.password?.trim()) { toast.warning("رمز عبور برای کاربر جدید الزامی است"); return; }

    setSaving(true);
    try {
      const payload: any = {
        firstName: editing.firstName, lastName: editing.lastName,
        phone: editing.phone || null, email: editing.email || null,
        role: editing.role, attendanceCardNo: editing.attendanceCardNo || null,
        maxSessions: Number(editing.maxSessions) || 1,
        departmentIds: editing.departmentIds,
      };
      if (isNew) payload.password = editing.password;
      if (!isNew && editing.newPassword?.trim()) payload.password = editing.newPassword;

      const url = isNew ? `${API}/users` : `${API}/users/${editing.id}`;
      const res = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json", ...h() }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || "خطا در ذخیره"); }

      const saved = await res.json().catch(() => null);
      const savedId = isNew ? saved?.id : editing.id;
      if (savedId && editing.rule) {
        try {
          await fetch(`${API}/attendance/user-rules/${savedId}`, { method: "PUT", headers: { "Content-Type": "application/json", ...h() }, body: JSON.stringify(editing.rule) });
        } catch { /* best-effort */ }
      }
      toast.success(isNew ? "کاربر اضافه شد" : "کاربر ویرایش شد");
      setOpen(false); setEditing(null); await load();
    } catch (err: any) { toast.error(err.message || "خطا در ذخیره کاربر"); }
    finally { setSaving(false); }
  }

  const ViewToggle = (
    <div className="flex bg-theme-secondary p-1 border border-theme rounded-xl">
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
        title="مدیریت کاربران"
        subtitle={loading ? undefined : `${users.length.toLocaleString("fa-IR")} کاربر${disabled ? ` · ${disabled.toLocaleString("fa-IR")} غیرفعال` : ""}`}
        icon={UsersIcon}
        iconColor="from-emerald-500 to-emerald-600"
        extra={ViewToggle}
        actions={[
          { label: "وارد دسته‌ای", icon: Upload, onClick: () => setBulkOpen(true), variant: "secondary" },
          { label: "افزودن کاربر", icon: Plus, onClick: onAdd },
        ]}
      />

      {/* Stats row */}
      {!loading && (
        <div className="gap-3 grid grid-cols-2 lg:grid-cols-4">
          <StatCard label="کل کاربران" value={users.length} color="from-blue-500 to-blue-600" />
          <StatCard label="کاربران فعال" value={active} sub={disabled > 0 ? `${disabled} غیرفعال` : undefined} color="from-emerald-500 to-emerald-600" />
          <StatCard label="مدیران و سرپرستان" value={admins} color="from-purple-500 to-purple-600" />
          <StatCard label="کارت حضور ثبت‌شده" value={withCard} sub={`${users.length - withCard} بدون کارت`} color="from-amber-500 to-amber-600" />
        </div>
      )}

      <SearchBar value={query} onChange={setQuery} placeholder="جستجو نام، موبایل، ایمیل، کد کارت..." count={filtered.length} countLabel="کاربر">
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="text-sm select-theme">
          <option value="ALL">همه نقش‌ها</option>
          <option value="ADMIN">مدیر ارشد</option>
          <option value="MANAGER">مدیر</option>
          <option value="EXPERT">کارشناس</option>
          <option value="USER">کاربر</option>
        </select>
        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="text-sm select-theme">
          <option value="">همه دپارتمان‌ها</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-theme-secondary text-sm whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)} className="rounded accent-blue-600" />
          نمایش غیرفعال {disabled > 0 && <span className="text-[10px] badge badge-warning">{disabled}</span>}
        </label>
      </SearchBar>

      {/* ── LIST VIEW ── */}
      {view === "list" ? (
        <div className="table-theme-container">
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>تماس</th>
                  <th>نقش</th>
                  <th>دپارتمان</th>
                  <th>کد کارت</th>
                  <th>وضعیت</th>
                  <th>اقدامات</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonTable cols={7} rows={6} />
              ) : (
                <tbody>
                  {filtered.length === 0 ? (
                    <EmptyStateRow icon={UsersIcon} title="کاربری یافت نشد" description={query ? "عبارت جستجو را تغییر دهید" : undefined} actionLabel={!query ? "افزودن کاربر" : undefined} onAction={!query ? onAdd : undefined} colSpan={7} />
                  ) : paged.map(u => (
                    <tr key={u.id} className={u.disabled ? "opacity-55" : ""}>
                      {/* Name + email */}
                      <td>
                        <div className="flex items-center gap-3 text-justify">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${u.disabled ? "from-slate-400 to-slate-500" : avatarColor(u)} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                            {u.disabled ? <UserX className="w-3.5 h-3.5" /> : (u.firstName?.[0] || u.phone?.[0] || "U").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-theme-primary text-sm">{u.firstName} {u.lastName}</div>
                            {u.email && (
                              <div className="flex items-center gap-1 mt-0.5 text-theme-muted text-xs">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="max-w-[160px] truncate" dir="ltr">{u.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Phone */}
                      <td>
                        <div className="flex justify-center items-center gap-1 text-theme-secondary text-sm" dir="ltr">
                          {u.phone ? <><Phone className="w-3 h-3 text-theme-muted" />{u.phone}</> : <span className="text-theme-muted">—</span>}
                        </div>
                      </td>
                      <td><RoleBadge role={u.role} /></td>
                      {/* Departments */}
                      <td>
                        <div className="flex flex-wrap justify-center gap-1">
                          {u.userDepartments?.length
                            ? u.userDepartments.slice(0, 2).map(x => <span key={x.departmentId} className="badge badge-teal">{x.department?.name || x.departmentId}</span>)
                            : <span className="text-theme-muted text-sm">—</span>}
                          {(u.userDepartments?.length || 0) > 2 && <span className="badge badge-neutral">+{u.userDepartments!.length - 2}</span>}
                        </div>
                      </td>
                      {/* Card */}
                      <td>
                        {u.attendanceCardNo
                          ? <span className="flex items-center gap-1 font-mono text-theme-secondary text-xs"><Hash className="w-3 h-3" />{u.attendanceCardNo}</span>
                          : <span className="text-theme-muted text-xs">—</span>}
                      </td>
                      {/* Status */}
                      <td>
                        {u.disabled
                          ? <span className="badge badge-warning"><Ban className="me-0.5 w-3 h-3" />غیرفعال</span>
                          : <span className="badge badge-success"><CheckCircle className="me-0.5 w-3 h-3" />فعال</span>}
                      </td>
                      {/* Actions */}
                      <td>
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => onEdit(u)} className="gap-1 px-2.5 py-1 text-xs btn-theme-secondary">
                            <Pencil className="w-3 h-3" />ویرایش
                          </button>
                          <button
                            onClick={() => onToggleDisable(u)}
                            title={u.disabled ? "فعال‌سازی" : "غیرفعال‌سازی"}
                            className={`text-xs py-1 px-2.5 rounded-lg border transition-all ${u.disabled
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100"}`}
                          >
                            {u.disabled ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID VIEW ── */
        <div className="gap-4 grid sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <SkeletonCards count={6} />
          ) : filtered.length === 0 ? (
            <EmptyStateBox icon={UsersIcon} title="کاربری یافت نشد" actionLabel={!query ? "افزودن کاربر" : undefined} onAction={!query ? onAdd : undefined} />
          ) : paged.map(u => (
            <div key={u.id} className={`card-theme ${u.disabled ? "opacity-60" : ""}`}>
              <div className="card-theme-body">
                {/* Avatar + name + role */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${u.disabled ? "from-slate-400 to-slate-500" : avatarColor(u)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {u.disabled ? <UserX className="w-4 h-4" /> : (u.firstName?.[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-theme-primary text-sm">{u.firstName} {u.lastName}</div>
                      <RoleBadge role={u.role} />
                    </div>
                  </div>
                  {u.disabled
                    ? <span className="text-[10px] badge badge-warning">غیرفعال</span>
                    : <span className="text-[10px] badge badge-success">فعال</span>}
                </div>

                {/* Info rows */}
                <div className="space-y-2 mb-4 text-xs">
                  {u.phone && (
                    <div className="flex items-center gap-2 text-theme-secondary" dir="ltr">
                      <Phone className="w-3.5 h-3.5 text-theme-muted shrink-0" />
                      <span>{u.phone}</span>
                    </div>
                  )}
                  {u.email && (
                    <div className="flex items-center gap-2 text-theme-secondary">
                      <Mail className="w-3.5 h-3.5 text-theme-muted shrink-0" />
                      <span className="truncate" dir="ltr">{u.email}</span>
                    </div>
                  )}
                  {u.attendanceCardNo && (
                    <div className="flex items-center gap-2 text-theme-secondary">
                      <CreditCard className="w-3.5 h-3.5 text-theme-muted shrink-0" />
                      <span dir="ltr" className="font-mono">کارت: {u.attendanceCardNo}</span>
                    </div>
                  )}
                </div>

                {/* Departments */}
                {(u.userDepartments?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {u.userDepartments!.slice(0, 3).map(x => <span key={x.departmentId} className="badge badge-teal">{x.department?.name}</span>)}
                    {u.userDepartments!.length > 3 && <span className="badge badge-neutral">+{u.userDepartments!.length - 3}</span>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-theme border-t">
                  <button onClick={() => onEdit(u)} className="flex-1 justify-center gap-1 mt-3 py-1.5 text-xs btn-theme-secondary">
                    <Pencil className="w-3 h-3" />ویرایش
                  </button>
                  <button
                    onClick={() => onToggleDisable(u)}
                    className={`mt-3 text-xs py-1.5 px-3 rounded-lg border transition-all ${u.disabled
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"}`}
                  >
                    {u.disabled ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-theme-muted">
            <span>نمایش</span>
            <select value={pageSize} onChange={e => setPageSize(+e.target.value)} className="input-theme text-sm w-auto py-1">
              {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n.toLocaleString("fa-IR")}</option>)}
            </select>
            <span>از {filtered.length.toLocaleString("fa-IR")} کاربر</span>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">قبلی</button>
            <span className="text-theme-muted">صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">بعدی</button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        title={editing?.id ? "ویرایش کاربر" : "افزودن کاربر جدید"}
        size="lg"
        footer={<>
          <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="text-sm btn-theme-secondary">انصراف</button>
          <button form="user-form" type="submit" disabled={saving} className="disabled:opacity-50 text-sm btn-theme-primary">{saving ? "در حال ذخیره..." : "ذخیره"}</button>
        </>}
      >
        <form id="user-form" onSubmit={onSubmit} className="space-y-4">
          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نام *</label>
              <input required value={editing?.firstName || ""} onChange={e => setEditing((s: any) => ({ ...s, firstName: e.target.value }))} className="text-sm input-theme" placeholder="نام" />
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نام خانوادگی *</label>
              <input required value={editing?.lastName || ""} onChange={e => setEditing((s: any) => ({ ...s, lastName: e.target.value }))} className="text-sm input-theme" placeholder="نام خانوادگی" />
            </div>
          </div>

          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">
                شماره موبایل {!editing?.id && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Phone className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <input type="tel" dir="ltr" value={editing?.phone || ""} onChange={e => setEditing((s: any) => ({ ...s, phone: e.target.value }))} className="pr-10 text-sm input-theme" placeholder="09123456789" />
              </div>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">ایمیل (اختیاری)</label>
              <div className="relative">
                <Mail className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <input type="email" dir="ltr" value={editing?.email || ""} onChange={e => setEditing((s: any) => ({ ...s, email: e.target.value }))} className="pr-10 text-sm input-theme" placeholder="email@example.com" />
              </div>
            </div>
          </div>

          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">کد کارت حضور و غیاب</label>
              <div className="relative">
                <CreditCard className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <input type="text" dir="ltr" value={editing?.attendanceCardNo || ""} onChange={e => setEditing((s: any) => ({ ...s, attendanceCardNo: e.target.value }))} className="pr-10 text-sm input-theme" placeholder="مثلاً 1024" />
              </div>
            </div>
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">نقش</label>
              <div className="relative">
                <ShieldCheck className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <select value={editing?.role || "USER"} onChange={e => setEditing((s: any) => ({ ...s, role: e.target.value }))} className="pr-10 text-sm select-theme">
                  <option value="USER">کاربر</option>
                  <option value="EXPERT">کارشناس</option>
                  <option value="MANAGER">مدیر</option>
                  <option value="ADMIN">مدیر ارشد</option>
                </select>
              </div>
            </div>
          </div>

          {/* Session limit */}
          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                حداکثر نشست همزمان
              </label>
              <input
                type="number" min={0} max={20} dir="ltr"
                value={editing?.maxSessions ?? 1}
                onChange={e => setEditing((s: any) => ({ ...s, maxSessions: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="text-sm input-theme w-full"
              />
              <p className="mt-1 text-theme-muted text-xs">
                {(editing?.maxSessions ?? 1) === 0 ? "نامحدود" : `هنگام ورود جدید، ${editing?.maxSessions ?? 1} نشست باقی می‌ماند`}
              </p>
            </div>
          </div>

          {/* Password */}
          {!editing?.id ? (
            <div>
              <label className="block mb-1.5 font-medium text-theme-secondary text-xs">رمز عبور <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showNewPwd ? "text" : "password"} value={editing?.password || ""} onChange={e => setEditing((s: any) => ({ ...s, password: e.target.value }))} required className="pl-10 text-sm input-theme" placeholder="حداقل ۶ کاراکتر" />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} className="top-1/2 left-3 absolute text-theme-muted hover:text-theme-secondary -translate-y-1/2">
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {!showPwdField ? (
                <button type="button" onClick={() => setShowPwdField(true)} className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm hover:underline">
                  <KeyRound className="w-4 h-4" />تغییر رمز عبور
                </button>
              ) : (
                <div>
                  <label className="block mb-1.5 font-medium text-theme-secondary text-xs">رمز عبور جدید (خالی = بدون تغییر)</label>
                  <div className="relative">
                    <input type={showNewPwd ? "text" : "password"} value={editing?.newPassword || ""} onChange={e => setEditing((s: any) => ({ ...s, newPassword: e.target.value }))} className="pl-10 text-sm input-theme" placeholder="رمز جدید..." />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)} className="top-1/2 left-3 absolute text-theme-muted hover:text-theme-secondary -translate-y-1/2">
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setShowPwdField(false); setEditing((s: any) => ({ ...s, newPassword: "" })); }} className="mt-1 text-theme-muted text-xs hover:underline">لغو تغییر رمز</button>
                </div>
              )}
            </div>
          )}

          {/* Departments */}
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">دپارتمان‌ها</label>
            <div className="bg-theme-secondary p-3 border border-theme rounded-xl">
              <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
                {(editing?.departmentIds || []).map((id: string) => {
                  const d = departments.find(x => x.id === id);
                  if (!d) return null;
                  return (
                    <span key={id} className="gap-1 badge badge-teal">
                      {d.name}
                      <button type="button" onClick={() => setEditing((s: any) => ({ ...s, departmentIds: s.departmentIds.filter((x: string) => x !== id) }))} className="hover:opacity-70">×</button>
                    </span>
                  );
                })}
              </div>
              <input placeholder="جستجوی دپارتمان..." value={deptSearch} onChange={e => setDeptSearch(e.target.value)} className="mb-2 text-xs input-theme" />
              <div className="border border-theme rounded-lg max-h-28 overflow-auto">
                {departments.filter(d => d.name.includes(deptSearch)).map(d => (
                  <label key={d.id} className="flex items-center gap-2 hover:bg-theme-hover px-3 py-1.5 text-xs transition-colors cursor-pointer">
                    <input type="checkbox" checked={(editing?.departmentIds || []).includes(d.id)}
                      onChange={() => setEditing((s: any) => {
                        const arr = [...(s.departmentIds || [])];
                        const idx = arr.indexOf(d.id);
                        if (idx >= 0) arr.splice(idx, 1); else arr.push(d.id);
                        return { ...s, departmentIds: arr };
                      })} className="rounded text-blue-600" />
                    <span className="text-theme-secondary">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Attendance rule */}
          <div className="pt-4 border-theme border-t">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-theme-primary text-sm">تنظیمات حضور و غیاب</span>
            </div>
            <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
              <div>
                <label className="block mb-1.5 text-theme-secondary text-xs">نوع کارمند</label>
                <select value={editing?.rule?.employeeType || "FULL_TIME"} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, employeeType: e.target.value } }))} className="text-sm input-theme">
                  <option value="FULL_TIME">تمام‌وقت (اضافه‌کار و تاخیر محاسبه می‌شود)</option>
                  <option value="HOURLY">ساعتی (فقط ساعت حضور؛ بدون اضافه‌کار)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5 text-theme-secondary text-xs">گروه / برنامه کاری</label>
                <select value={editing?.rule?.scheduleId || ""} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, scheduleId: e.target.value } }))} className="text-sm input-theme">
                  <option value="">پیش‌فرض سازمان</option>
                  {schedules.filter(sc => !sc.isDefault).map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4 mt-6">
                <label className="flex items-center gap-2 text-theme-primary text-sm">
                  <input type="checkbox" checked={!!editing?.rule?.flexEnabled} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, flexEnabled: e.target.checked } }))} /> شناوری
                </label>
                {editing?.rule?.employeeType !== "HOURLY" && (
                  <label className="flex items-center gap-2 text-theme-primary text-sm">
                    <input type="checkbox" checked={editing?.rule?.otAllowed !== false} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, otAllowed: e.target.checked } }))} /> اضافه‌کار مجاز
                  </label>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-theme-secondary text-xs">پایان بازه ورود (اختیاری)</label>
                <input type="time" dir="ltr" value={editing?.rule?.checkInEnd || ""} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, checkInEnd: e.target.value } }))} className="text-sm input-theme" />
              </div>
              <div>
                <label className="block mb-1.5 text-theme-secondary text-xs">شروع بازه خروج (اختیاری)</label>
                <input type="time" dir="ltr" value={editing?.rule?.checkOutStart || ""} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, checkOutStart: e.target.value } }))} className="text-sm input-theme" />
              </div>
              <div>
                <label className="block mb-1.5 text-theme-secondary text-xs">ساعت کار مورد نیاز (دقیقه)</label>
                <input type="number" dir="ltr" value={editing?.rule?.dailyMinutes ?? ""} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, dailyMinutes: e.target.value } }))} className="text-sm input-theme" placeholder="پیش‌فرض/گروه" />
              </div>
              {editing?.rule?.employeeType !== "HOURLY" && <>
                <div>
                  <label className="block mb-1.5 text-theme-secondary text-xs">حداکثر اضافه‌کار روزانه (دقیقه)</label>
                  <input type="number" dir="ltr" value={editing?.rule?.otMaxDaily ?? ""} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, otMaxDaily: e.target.value } }))} className="text-sm input-theme" placeholder="پیش‌فرض سازمان" />
                </div>
                <div>
                  <label className="block mb-1.5 text-theme-secondary text-xs">حداکثر اضافه‌کار ماهانه (دقیقه)</label>
                  <input type="number" dir="ltr" value={editing?.rule?.otMaxMonthly ?? ""} onChange={e => setEditing((s: any) => ({ ...s, rule: { ...s.rule, otMaxMonthly: e.target.value } }))} className="text-sm input-theme" placeholder="پیش‌فرض سازمان" />
                </div>
              </>}
            </div>
            <p className="mt-2 text-[11px] text-theme-muted">فیلدهای خالی از مقدار پیش‌فرض «قوانین کارکرد» سازمان استفاده می‌کنند.</p>
          </div>
        </form>
      </Modal>

      {bulkOpen && (
        <BulkImportModal departments={departments} onClose={() => setBulkOpen(false)} onImported={async () => { setBulkOpen(false); await load(); }} />
      )}
    </div>
  );
}

function BulkImportModal({ onClose, onImported, departments }: { onClose: () => void; onImported: () => void; departments: Array<{ id: string; name: string }> }) {
  const toast = useToast();
  const [text, setText]         = React.useState("");
  const [preview, setPreview]   = React.useState<Array<Record<string, string>> | null>(null);
  const [headers, setHeaders]   = React.useState<string[] | null>(null);
  const [mapping, setMapping]   = React.useState<Record<string, string>>({});
  const [fileName, setFileName] = React.useState<string | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  function parseCSV(src: string) {
    const lines = src.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const parseLine = (line: string) => {
      const cols: string[] = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (c === delim && !inQ) { cols.push(cur); cur = ""; }
        else cur += c;
      }
      cols.push(cur);
      return cols.map(c => c.trim());
    };
    const h = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => { const c = parseLine(line); const o: Record<string, string> = {}; h.forEach((k, i) => { o[k] = c[i] ?? ""; }); return o; });
    return { headers: h, rows };
  }

  function process(src: string) {
    setText(src);
    const { headers: h, rows } = parseCSV(src);
    setHeaders(h); setPreview(rows);
    if (h.length && !Object.keys(mapping).length) {
      const map: Record<string, string> = {};
      for (const hdr of h) {
        const l = hdr.toLowerCase();
        if (!map.phone      && (l.includes("phone")  || l.includes("تلفن") || l.includes("موبایل")))    map.phone = hdr;
        if (!map.firstName  && (l.includes("first")  || l === "نام"))                                     map.firstName = hdr;
        if (!map.lastName   && (l.includes("last")   || l.includes("خانوادگی")))                          map.lastName = hdr;
        if (!map.role       && (l === "role"          || l.includes("نقش")))                               map.role = hdr;
        if (!map.departmentId && (l.includes("department") || l.includes("دپارتمان")))                    map.departmentId = hdr;
        if (!map.password   && l.includes("pass"))                                                         map.password = hdr;
        if (!map.email      && l.includes("email"))                                                        map.email = hdr;
      }
      setMapping(map);
    }
  }

  async function importNow() {
    if (!preview?.length) { toast.warning("هیچ داده‌ای وجود ندارد"); return; }
    const users = preview.map(r => ({
      phone:        mapping.phone        ? r[mapping.phone]        : r.phone,
      email:        mapping.email        ? r[mapping.email]        : r.email,
      firstName:    mapping.firstName    ? r[mapping.firstName]    : r.firstName,
      lastName:     mapping.lastName     ? r[mapping.lastName]     : r.lastName,
      role:         mapping.role         ? r[mapping.role]         : "USER",
      departmentId: mapping.departmentId ? r[mapping.departmentId] : r.departmentId,
      password:     mapping.password     ? r[mapping.password]     : r.password,
    }));
    try {
      const res = await fetch(`${API}/users/bulk`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ users }) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`وارد شده: ${data.imported} | خطاها: ${data.errors?.length || 0}`);
      onImported();
    } catch (err: any) { toast.error("خطا: " + (err?.message || String(err))); }
  }

  return (
    <Modal open onClose={onClose} title="وارد کردن دسته‌ای کاربران (CSV)" size="xl"
      footer={<><button onClick={onClose} className="text-sm btn-theme-secondary">انصراف</button><button onClick={importNow} disabled={!preview?.length} className="gap-1.5 disabled:opacity-50 text-sm btn-theme-primary"><Upload className="w-4 h-4" />وارد کن</button></>}
    >
      <div className="space-y-4">
        <div className="gap-4 grid grid-cols-2">
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">آپلود فایل CSV</label>
            <label className="flex flex-col justify-center items-center hover:bg-theme-hover p-6 border-2 border-theme border-dashed rounded-xl transition-colors cursor-pointer">
              <Upload className="mb-2 w-6 h-6 text-theme-muted" />
              <span className="text-theme-muted text-xs">{fileName || "کلیک کنید یا بکشید"}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setFileName(f.name); f.text().then(process); }} />
            </label>
          </div>
          <div>
            <label className="block mb-1.5 font-medium text-theme-secondary text-xs">یا متن CSV پیست کنید</label>
            <textarea rows={8} value={text} onChange={e => process(e.target.value)} className="font-mono text-xs resize-none input-theme" placeholder="firstName,lastName,phone,role" dir="ltr" />
          </div>
        </div>
        {headers && headers.length > 0 && (
          <div className="bg-theme-secondary p-4 border border-theme rounded-xl">
            <div className="mb-2 font-medium text-theme-primary text-xs">نقشه‌بندی ستون‌ها</div>
            <div className="gap-2 grid grid-cols-2">
              {["phone","firstName","lastName","role","departmentId","password","email"].map(field => (
                <label key={field} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-theme-secondary text-right">{field}</span>
                  <select className="flex-1 py-1 text-xs select-theme" value={mapping[field] || ""} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}>
                    <option value="">-- انتخاب --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
        {preview && preview.length > 0 && (
          <div>
            <div className="mb-1.5 font-medium text-theme-secondary text-xs">پیش‌نمایش ({preview.length} ردیف)</div>
            <div className="table-theme-container max-h-40 overflow-auto">
              <table className="table-theme text-xs">
                <thead><tr>{Object.keys(preview[0]).slice(0, 6).map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{preview.slice(0, 8).map((r, i) => <tr key={i}>{Object.values(r).slice(0, 6).map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
