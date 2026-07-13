"use client";
import React from "react";
import {
  Megaphone, Plus, Pencil, Trash2, Send, Eye, Users, Globe, Tag,
  Calendar, AlertCircle, CheckCircle2, X, ChevronRight, ChevronLeft,
  Search, Filter, BarChart3, Clock,
} from "lucide-react";
import { useToast } from "../../../components/ui/Toast";
import SearchSelect from "../../../components/ui/SearchSelect";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const TYPE_FA: Record<string, string> = { BANNER: "بنر", POPUP: "پاپ‌آپ", NOTIFICATION: "اعلان" };
const TARGET_FA: Record<string, string> = { ALL: "همه کاربران", DEPARTMENT: "دپارتمان", ROLE: "نقش", USER: "کاربر خاص" };
const PRIORITY_FA: Record<string, string> = { CRITICAL: "بحرانی", HIGH: "بالا", NORMAL: "عادی", LOW: "کم", INFO: "اطلاعات" };
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950/50",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-950/40",
  NORMAL: "bg-blue-50 text-blue-700 dark:bg-blue-950/30",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800",
  INFO: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30",
};
const TYPE_COLORS: Record<string, string> = {
  BANNER: "bg-green-50 text-green-700 dark:bg-green-950/30",
  POPUP: "bg-amber-50 text-amber-700 dark:bg-amber-950/30",
  NOTIFICATION: "bg-blue-50 text-blue-700 dark:bg-blue-950/30",
};

const ROLES = [
  { id: "ADMIN", name: "مدیر سیستم" },
  { id: "MANAGER", name: "مدیر" },
  { id: "USER", name: "کاربر" },
  { id: "EXPERT", name: "کارشناس" },
];

type Ann = {
  id: string; title: string; body: string; type: string; priority: string;
  targetType: string; targetDeptIds: string[]; targetRoles: string[]; targetUserIds: string[];
  isSticky: boolean; isPublished: boolean; showOnce: boolean; showUntilAck: boolean;
  publishAt: string | null; expireAt: string | null;
  author: { firstName: string; lastName: string };
  _count: { acks: number };
  createdAt: string; updatedAt: string;
};

const emptyForm = () => ({
  title: "", body: "", type: "NOTIFICATION", priority: "NORMAL", targetType: "ALL",
  targetDeptIds: [] as string[], targetRoles: [] as string[], targetUserIds: [] as string[],
  isSticky: false, showOnce: false, showUntilAck: false,
  publishAt: "", expireAt: "",
});

export default function AnnouncementsPage() {
  React.useEffect(() => { document.title = "مدیریت اطلاعیه‌ها | Arzesh"; }, []);
  const toast = useToast();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };

  const [rows, setRows] = React.useState<Ann[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const limit = 15;

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [publishedFilter, setPublishedFilter] = React.useState("");

  const [modal, setModal] = React.useState<"create" | "edit" | "ackstats" | null>(null);
  const [editing, setEditing] = React.useState<Ann | null>(null);
  const [form, setForm] = React.useState(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [ackStats, setAckStats] = React.useState<any>(null);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);

  const pf = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = React.useCallback(async (p = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (publishedFilter !== "") params.set("isPublished", publishedFilter);
      const r = await fetch(`${API}/notifications/announcements?${params}`, { headers: h as any });
      if (!r.ok) return;
      const data = await r.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, typeFilter, publishedFilter]);

  React.useEffect(() => { setPage(1); load(1); }, [load]);

  React.useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API}/departments`, { headers: h as any }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h as any }).then(r => r.ok ? r.json() : []),
    ]).then(([depts, us]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      const arr = Array.isArray(us) ? us : (us?.data ?? []);
      setUsers(arr.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModal("create");
  };

  const openEdit = (ann: Ann) => {
    setEditing(ann);
    setForm({
      title: ann.title, body: ann.body, type: ann.type, priority: ann.priority,
      targetType: ann.targetType, targetDeptIds: ann.targetDeptIds, targetRoles: ann.targetRoles,
      targetUserIds: ann.targetUserIds, isSticky: ann.isSticky, showOnce: ann.showOnce,
      showUntilAck: ann.showUntilAck,
      publishAt: ann.publishAt ? ann.publishAt.slice(0, 16) : "",
      expireAt: ann.expireAt ? ann.expireAt.slice(0, 16) : "",
    });
    setModal("edit");
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.warning("عنوان و متن الزامی است"); return; }
    setSaving(true);
    try {
      const body: any = { ...form, publishAt: form.publishAt || undefined, expireAt: form.expireAt || undefined };
      const url = modal === "edit" && editing ? `${API}/notifications/announcements/${editing.id}` : `${API}/notifications/announcements`;
      const method = modal === "edit" ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { ...h, "Content-Type": "application/json" } as any, body: JSON.stringify(body) });
      if (!r.ok) { toast.error("خطا در ذخیره"); return; }
      toast.success(modal === "edit" ? "اطلاعیه ویرایش شد" : "اطلاعیه ایجاد شد");
      setModal(null);
      load(page);
    } finally { setSaving(false); }
  };

  const publish = async (id: string) => {
    const r = await fetch(`${API}/notifications/announcements/${id}/publish`, { method: "POST", headers: h as any });
    if (r.ok) { toast.success("اطلاعیه منتشر شد"); load(page); }
    else toast.error("خطا در انتشار");
  };

  const deleteAnn = async (id: string) => {
    if (!confirm("آیا مطمئن هستید؟")) return;
    await fetch(`${API}/notifications/announcements/${id}`, { method: "DELETE", headers: h as any });
    toast.success("اطلاعیه حذف شد");
    load(page);
  };

  const openAckStats = async (id: string) => {
    const r = await fetch(`${API}/notifications/announcements/${id}/ack-stats`, { headers: h as any });
    if (r.ok) { setAckStats(await r.json()); setModal("ackstats"); }
  };

  const totalPages = Math.ceil(total / limit);
  const deptOptions = departments.map((d: any) => ({ id: d.id, name: d.name }));

  const toggleRole = (role: string) => {
    pf("targetRoles", form.targetRoles.includes(role)
      ? form.targetRoles.filter(r => r !== role)
      : [...form.targetRoles, role]);
  };

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("fa-IR") : "—";

  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-theme-primary">مدیریت اطلاعیه‌ها</h1>
          <p className="text-sm text-theme-muted">{total} اطلاعیه ثبت شده</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> اطلاعیه جدید
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
          <input className="input-theme w-full pr-9 text-sm" placeholder="جستجو..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-theme text-sm py-1.5" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">همه انواع</option>
          {Object.entries(TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input-theme text-sm py-1.5" value={publishedFilter} onChange={e => setPublishedFilter(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          <option value="true">منتشر شده</option>
          <option value="false">پیش‌نویس</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="py-16 text-center">
            <Megaphone className="w-10 h-10 text-theme-muted mx-auto mb-3 opacity-40" />
            <p className="text-theme-muted text-sm">هیچ اطلاعیه‌ای یافت نشد</p>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-theme-secondary text-theme-muted text-xs">
                <tr>
                  <th className="text-right px-3 py-2.5 font-medium">عنوان</th>
                  <th className="text-right px-3 py-2.5 font-medium">نوع</th>
                  <th className="text-right px-3 py-2.5 font-medium">اولویت</th>
                  <th className="text-right px-3 py-2.5 font-medium">مخاطب</th>
                  <th className="text-right px-3 py-2.5 font-medium">وضعیت</th>
                  <th className="text-right px-3 py-2.5 font-medium">تاریخ انقضا</th>
                  <th className="text-right px-3 py-2.5 font-medium">تاییدیه</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {rows.map((ann) => (
                  <tr key={ann.id} className="hover:bg-theme-hover transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-theme-primary max-w-48 truncate">{ann.title}</div>
                      <div className="text-xs text-theme-muted mt-0.5">
                        {ann.author.firstName} {ann.author.lastName} · {fmtDate(ann.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[ann.type] ?? ""}`}>
                        {TYPE_FA[ann.type]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ann.priority] ?? ""}`}>
                        {PRIORITY_FA[ann.priority]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-theme-secondary">{TARGET_FA[ann.targetType]}</td>
                    <td className="px-3 py-2.5">
                      {ann.isPublished ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> منتشر شده
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5" /> پیش‌نویس
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-theme-secondary">{fmtDate(ann.expireAt)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => openAckStats(ann.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> {ann._count.acks}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {!ann.isPublished && (
                          <button onClick={() => publish(ann.id)} title="انتشار"
                            className="p-1.5 rounded-lg hover:bg-theme-hover text-emerald-600 hover:text-emerald-700">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => openEdit(ann)} title="ویرایش"
                          className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-theme-secondary">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteAnn(ann.id)} title="حذف"
                          className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-muted hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => { setPage(p => p + 1); load(page + 1); }} disabled={page >= totalPages}
            className="p-2 rounded-lg border border-theme text-theme-secondary hover:bg-theme-hover disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-theme-muted">صفحه {page} از {totalPages}</span>
          <button onClick={() => { setPage(p => p - 1); load(page - 1); }} disabled={page <= 1}
            className="p-2 rounded-lg border border-theme text-theme-secondary hover:bg-theme-hover disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-theme-card border border-theme rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-theme">
              <h2 className="font-bold text-theme-primary text-lg">
                {modal === "edit" ? "ویرایش اطلاعیه" : "اطلاعیه جدید"}
              </h2>
              <button onClick={() => setModal(null)} className="text-theme-muted hover:text-theme-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">
                  عنوان <span className="text-red-500">*</span>
                </label>
                <input className="input-theme w-full text-sm" placeholder="عنوان اطلاعیه"
                  value={form.title} onChange={e => pf("title", e.target.value)} />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">
                  متن <span className="text-red-500">*</span>
                </label>
                <textarea className="input-theme w-full text-sm resize-none" rows={4}
                  placeholder="متن کامل اطلاعیه..."
                  value={form.body} onChange={e => pf("body", e.target.value)} />
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1.5">نوع</label>
                  <select className="input-theme w-full text-sm" value={form.type} onChange={e => pf("type", e.target.value)}>
                    {Object.entries(TYPE_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1.5">اولویت</label>
                  <select className="input-theme w-full text-sm" value={form.priority} onChange={e => pf("priority", e.target.value)}>
                    {Object.entries(PRIORITY_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">مخاطبان</label>
                <select className="input-theme w-full text-sm mb-2" value={form.targetType} onChange={e => pf("targetType", e.target.value)}>
                  {Object.entries(TARGET_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                {form.targetType === "DEPARTMENT" && (
                  <SearchSelect
                    options={deptOptions} value="" onChange={(id) => {
                      if (id && !form.targetDeptIds.includes(id))
                        pf("targetDeptIds", [...form.targetDeptIds, id]);
                    }}
                    placeholder="دپارتمان را انتخاب کنید" emptyLabel="انتخاب دپارتمان"
                  />
                )}
                {form.targetType === "DEPARTMENT" && form.targetDeptIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.targetDeptIds.map(id => {
                      const dept = departments.find((d: any) => d.id === id);
                      return (
                        <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 border border-blue-200 dark:border-blue-800">
                          {dept?.name ?? id}
                          <button onClick={() => pf("targetDeptIds", form.targetDeptIds.filter(x => x !== id))}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {form.targetType === "ROLE" && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ROLES.map(r => (
                      <button key={r.id} type="button" onClick={() => toggleRole(r.id)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${form.targetRoles.includes(r.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}>
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}

                {form.targetType === "USER" && (
                  <>
                    <SearchSelect
                      options={users} value="" onChange={(id) => {
                        if (id && !form.targetUserIds.includes(id))
                          pf("targetUserIds", [...form.targetUserIds, id]);
                      }}
                      placeholder="کاربر را انتخاب کنید" emptyLabel="انتخاب کاربر"
                    />
                    {form.targetUserIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.targetUserIds.map(id => {
                          const user = users.find(u => u.id === id);
                          return (
                            <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 dark:bg-green-950/40 text-green-700 border border-green-200 dark:border-green-800">
                              {user?.name ?? id}
                              <button onClick={() => pf("targetUserIds", form.targetUserIds.filter(x => x !== id))}>
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1.5">تاریخ انتشار (اختیاری)</label>
                  <input type="datetime-local" className="input-theme w-full text-sm"
                    value={form.publishAt} onChange={e => pf("publishAt", e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1.5">تاریخ انقضا (اختیاری)</label>
                  <input type="datetime-local" className="input-theme w-full text-sm"
                    value={form.expireAt} onChange={e => pf("expireAt", e.target.value)} dir="ltr" />
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" checked={form.isSticky} onChange={e => pf("isSticky", e.target.checked)} />
                  <span className="text-sm text-theme-secondary">چسبنده (Sticky)</span>
                </label>
                {form.type === "POPUP" && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded" checked={form.showOnce} onChange={e => pf("showOnce", e.target.checked)} />
                      <span className="text-sm text-theme-secondary">فقط یک بار نمایش</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded" checked={form.showUntilAck} onChange={e => pf("showUntilAck", e.target.checked)} />
                      <span className="text-sm text-theme-secondary">تا تایید نمایش بده</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-theme">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-theme text-theme-secondary text-sm hover:bg-theme-hover">
                انصراف
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {modal === "edit" ? "ذخیره" : "ایجاد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ack Stats Modal */}
      {modal === "ackstats" && ackStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-theme-card border border-theme rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-theme">
              <h2 className="font-bold text-theme-primary">آمار تاییدیه‌ها</h2>
              <button onClick={() => setModal(null)} className="text-theme-muted hover:text-theme-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-indigo-600">{ackStats.ackCount}</span>
                <p className="text-sm text-theme-muted mt-1">کاربر تایید کرده</p>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {ackStats.acks.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-theme last:border-0">
                    <span className="text-theme-secondary">{a.user.firstName} {a.user.lastName}</span>
                    <span className="text-xs text-theme-muted">{new Date(a.ackedAt).toLocaleDateString("fa-IR")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
