"use client";
import React from "react";
import { Loader2, Plus, Trash2, Edit2, Check, X, Settings, Save, ChevronDown, ChevronUp } from "lucide-react";
import SearchSelect from "../../../components/ui/SearchSelect";
import { useToast } from "../../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Tab = "departments" | "global";

// JS getDay(): 0=Sun,1=Mon,...,5=Fri,6=Sat — Persian week starts Saturday
const WORK_DAYS: { day: number; label: string }[] = [
  { day: 6, label: "شنبه" },
  { day: 0, label: "یکشنبه" },
  { day: 1, label: "دوشنبه" },
  { day: 2, label: "سه‌شنبه" },
  { day: 3, label: "چهارشنبه" },
  { day: 4, label: "پنجشنبه" },
  { day: 5, label: "جمعه" },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? "bg-blue-600" : "bg-theme-secondary border border-theme"}`}>
      <span className={`inline-block w-3.5 h-3.5 transform rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// Per-dept editable config state
type DeptCfgState = {
  id?: string;
  isEnabled: boolean;
  slaFirstResponseHours: number;
  slaResolutionHours: number;
  workHoursStart: string;
  workHoursEnd: string;
  workDays: number[];
  managerIds: string[];
  defaultAssigneeIds: string[];
  categories: any[];
};

export default function TicketSettingsPage() {
  React.useEffect(() => { document.title = "تنظیمات تیکت | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const toast = useToast();

  const [tab, setTab] = React.useState<Tab>("departments");
  const [loading, setLoading] = React.useState(true);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [expandedDept, setExpandedDept] = React.useState<string | null>(null);
  // Per-dept config state keyed by deptId
  const [deptCfgs, setDeptCfgs] = React.useState<Record<string, DeptCfgState>>({});
  const [loadingDept, setLoadingDept] = React.useState<Record<string, boolean>>({});
  const [savingDept, setSavingDept] = React.useState<Record<string, boolean>>({});

  // New category per dept
  const [newCatName, setNewCatName] = React.useState<Record<string, string>>({});
  const [savingCat, setSavingCat] = React.useState<Record<string, boolean>>({});

  // Edit category
  const [editCat, setEditCat] = React.useState<any>(null);

  // Global settings
  const [globalDraft, setGlobalDraft] = React.useState<any>(null);
  const [savingGlobal, setSavingGlobal] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/departments`, { headers: h as any }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h as any }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/tickets/settings/global`, { headers: h as any }).then(r => r.ok ? r.json() : {}),
    ]).then(([depts, us, stg]) => {
      setDepartments(Array.isArray(depts) ? depts : (depts.data ?? []));
      setUsers(Array.isArray(us) ? us : (us.data ?? []));
      setGlobalDraft(stg ?? {});
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDeptConfig = async (deptId: string) => {
    if (deptCfgs[deptId]) return; // already loaded
    setLoadingDept(p => ({ ...p, [deptId]: true }));
    try {
      const res = await fetch(`${API}/tickets/config/${deptId}`, { headers: h as any });
      if (res.ok) {
        const cfg = await res.json();
        setDeptCfgs(p => ({
          ...p,
          [deptId]: {
            id: cfg.id,
            isEnabled: cfg.isEnabled ?? false,
            slaFirstResponseHours: cfg.slaFirstResponseHours ?? 4,
            slaResolutionHours: cfg.slaResolutionHours ?? 24,
            workHoursStart: cfg.workHoursStart ?? "08:00",
            workHoursEnd: cfg.workHoursEnd ?? "17:00",
            workDays: cfg.workDays ?? [6, 0, 1, 2, 3],
            managerIds: (cfg.managers ?? []).map((m: any) => m.userId),
            defaultAssigneeIds: (cfg.defaultAssignees ?? []).map((a: any) => a.userId),
            categories: cfg.categories ?? [],
          },
        }));
      } else {
        // No config yet — set defaults
        setDeptCfgs(p => ({
          ...p,
          [deptId]: { isEnabled: false, slaFirstResponseHours: 4, slaResolutionHours: 24, workHoursStart: "08:00", workHoursEnd: "17:00", workDays: [6, 0, 1, 2, 3], managerIds: [], defaultAssigneeIds: [], categories: [] },
        }));
      }
    } finally { setLoadingDept(p => ({ ...p, [deptId]: false })); }
  };

  const patchDeptCfg = (deptId: string, patch: Partial<DeptCfgState>) => {
    setDeptCfgs(p => ({ ...p, [deptId]: { ...p[deptId], ...patch } }));
  };

  const toggleExpand = async (deptId: string) => {
    if (expandedDept === deptId) { setExpandedDept(null); return; }
    setExpandedDept(deptId);
    await loadDeptConfig(deptId);
  };

  const saveDeptConfig = async (deptId: string) => {
    const cfg = deptCfgs[deptId];
    if (!cfg) return;
    setSavingDept(p => ({ ...p, [deptId]: true }));
    try {
      const res = await fetch(`${API}/tickets/config`, {
        method: "POST", headers: h as any,
        body: JSON.stringify({
          departmentId: deptId,
          isEnabled: cfg.isEnabled,
          slaFirstResponseHours: cfg.slaFirstResponseHours,
          slaResolutionHours: cfg.slaResolutionHours,
          workHoursStart: cfg.workHoursStart,
          workHoursEnd: cfg.workHoursEnd,
          workDays: cfg.workDays,
          managerIds: cfg.managerIds,
          defaultAssigneeIds: cfg.defaultAssigneeIds,
        }),
      });
      if (!res.ok) { toast.error("خطا در ذخیره پیکربندی"); return; }
      toast.success("پیکربندی ذخیره شد");
      // Re-load config to get updated id/data
      setDeptCfgs(p => { const n = { ...p }; delete n[deptId]; return n; });
      await loadDeptConfig(deptId);
    } finally { setSavingDept(p => ({ ...p, [deptId]: false })); }
  };

  const addCategory = async (deptId: string) => {
    const name = (newCatName[deptId] ?? "").trim();
    if (!name) { toast.warning("نام دسته‌بندی را وارد کنید"); return; }
    const cfg = deptCfgs[deptId];
    if (!cfg?.id) { toast.error("ابتدا پیکربندی دپارتمان را ذخیره کنید"); return; }
    setSavingCat(p => ({ ...p, [deptId]: true }));
    try {
      const res = await fetch(`${API}/tickets/categories`, {
        method: "POST", headers: h as any,
        body: JSON.stringify({ configId: cfg.id, name }),
      });
      if (!res.ok) { toast.error("خطا در افزودن دسته‌بندی"); return; }
      toast.success("دسته‌بندی افزوده شد");
      setNewCatName(p => ({ ...p, [deptId]: "" }));
      // Re-load dept config to refresh categories
      setDeptCfgs(p => { const n = { ...p }; delete n[deptId]; return n; });
      await loadDeptConfig(deptId);
    } finally { setSavingCat(p => ({ ...p, [deptId]: false })); }
  };

  const updateCategory = async (catId: string, patch: any) => {
    const res = await fetch(`${API}/tickets/categories/${catId}`, {
      method: "PATCH", headers: h as any, body: JSON.stringify(patch),
    });
    if (!res.ok) { toast.error("خطا در ویرایش"); return; }
    toast.success("ذخیره شد");
    setEditCat(null);
    // Refresh all expanded dept cats
    if (expandedDept) {
      setDeptCfgs(p => { const n = { ...p }; delete n[expandedDept]; return n; });
      await loadDeptConfig(expandedDept);
    }
  };

  const deleteCategory = async (catId: string) => {
    if (!confirm("این دسته‌بندی حذف شود؟")) return;
    const res = await fetch(`${API}/tickets/categories/${catId}`, { method: "DELETE", headers: h as any });
    if (!res.ok) { toast.error("خطا در حذف"); return; }
    toast.success("حذف شد");
    if (expandedDept) {
      setDeptCfgs(p => { const n = { ...p }; delete n[expandedDept]; return n; });
      await loadDeptConfig(expandedDept);
    }
  };

  const saveGlobal = async () => {
    setSavingGlobal(true);
    try {
      const res = await fetch(`${API}/tickets/settings/global`, {
        method: "PATCH", headers: h as any, body: JSON.stringify(globalDraft),
      });
      if (!res.ok) { toast.error("خطا در ذخیره تنظیمات"); return; }
      toast.success("تنظیمات ذخیره شد");
    } finally { setSavingGlobal(false); }
  };

  const patchGlobal = (key: string, val: any) => setGlobalDraft((prev: any) => ({ ...prev, [key]: val }));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">تنظیمات میز خدمت</h1>
          <p className="text-sm text-theme-muted">پیکربندی دپارتمان‌ها، دسته‌بندی‌ها و قوانین SLA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-theme-card border border-theme rounded-xl p-1">
        {(["departments", "global"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? "bg-blue-600 text-white" : "text-theme-secondary hover:bg-theme-hover"}`}>
            {t === "departments" ? "دپارتمان‌ها و دسته‌بندی‌ها" : "تنظیمات عمومی"}
          </button>
        ))}
      </div>

      {/* Department configs */}
      {tab === "departments" && (
        <div className="space-y-3">
          {departments.length === 0 && <p className="text-center text-theme-muted py-8">دپارتمانی یافت نشد</p>}
          {departments.map(dept => {
            const cfg = deptCfgs[dept.id];
            const isOpen = expandedDept === dept.id;
            const isLoading = loadingDept[dept.id];

            return (
              <div key={dept.id} className="bg-theme-card border border-theme rounded-xl overflow-hidden">
                <button type="button" onClick={() => toggleExpand(dept.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-theme-hover text-right">
                  <span className="font-medium text-theme-primary">{dept.name}</span>
                  {cfg?.isEnabled && <span className="text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">فعال</span>}
                  {cfg && <span className="text-xs text-theme-muted">{cfg.categories.length} دسته</span>}
                  <span className="mr-auto">{isLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : isOpen ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}</span>
                </button>

                {isOpen && cfg && (
                  <div className="border-t border-theme p-4 space-y-5">
                    {/* Enable toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-theme-secondary">فعال بودن پشتیبانی تیکت</span>
                      <Toggle value={cfg.isEnabled} onChange={v => patchDeptCfg(dept.id, { isEnabled: v })} />
                    </div>

                    {/* SLA */}
                    <div>
                      <div className="text-sm font-medium text-theme-primary mb-3">قوانین SLA</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <label className="block text-xs text-theme-muted mb-1">پاسخ اول (ساعت)</label>
                          <input type="number" min="1" className="input-theme text-sm w-full" dir="ltr"
                            value={cfg.slaFirstResponseHours}
                            onChange={e => patchDeptCfg(dept.id, { slaFirstResponseHours: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="block text-xs text-theme-muted mb-1">حل نهایی (ساعت)</label>
                          <input type="number" min="1" className="input-theme text-sm w-full" dir="ltr"
                            value={cfg.slaResolutionHours}
                            onChange={e => patchDeptCfg(dept.id, { slaResolutionHours: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="block text-xs text-theme-muted mb-1">شروع کار</label>
                          <input type="time" className="input-theme text-sm w-full" dir="ltr"
                            value={cfg.workHoursStart}
                            onChange={e => patchDeptCfg(dept.id, { workHoursStart: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs text-theme-muted mb-1">پایان کار</label>
                          <input type="time" className="input-theme text-sm w-full" dir="ltr"
                            value={cfg.workHoursEnd}
                            onChange={e => patchDeptCfg(dept.id, { workHoursEnd: e.target.value })} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="text-xs text-theme-muted mb-2">روزهای کاری</div>
                        <div className="flex gap-2 flex-wrap">
                          {WORK_DAYS.map(({ day, label }) => {
                            const checked = cfg.workDays.includes(day);
                            return (
                              <button key={day} type="button"
                                onClick={() => patchDeptCfg(dept.id, { workDays: checked ? cfg.workDays.filter(d => d !== day) : [...cfg.workDays, day] })}
                                className={`px-2.5 py-1 rounded-lg border text-xs transition-colors
                                  ${checked ? "bg-blue-600 border-blue-600 text-white" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Managers */}
                    <div>
                      <div className="text-sm font-medium text-theme-primary mb-2">مدیران پشتیبانی</div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {cfg.managerIds.map(uid => {
                          const u = users.find((x: any) => x.id === uid);
                          return u ? (
                            <span key={uid} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-theme-secondary border border-theme">
                              {u.firstName} {u.lastName}
                              <button onClick={() => patchDeptCfg(dept.id, { managerIds: cfg.managerIds.filter(x => x !== uid) })}
                                className="text-theme-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                            </span>
                          ) : null;
                        })}
                      </div>
                      <SearchSelect
                        options={users.filter((u: any) => !cfg.managerIds.includes(u.id))}
                        value="" onChange={uid => { if (uid) patchDeptCfg(dept.id, { managerIds: [...cfg.managerIds, uid] }); }}
                        emptyLabel="افزودن مدیر" placeholder="جستجوی کاربر"
                        displayKey="firstName" searchKey="lastName" />
                    </div>

                    {/* Assignees */}
                    <div>
                      <div className="text-sm font-medium text-theme-primary mb-2">مسئولین پیش‌فرض (round-robin)</div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {cfg.defaultAssigneeIds.map(uid => {
                          const u = users.find((x: any) => x.id === uid);
                          return u ? (
                            <span key={uid} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-theme-secondary border border-theme">
                              {u.firstName} {u.lastName}
                              <button onClick={() => patchDeptCfg(dept.id, { defaultAssigneeIds: cfg.defaultAssigneeIds.filter(x => x !== uid) })}
                                className="text-theme-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                            </span>
                          ) : null;
                        })}
                      </div>
                      <SearchSelect
                        options={users.filter((u: any) => !cfg.defaultAssigneeIds.includes(u.id))}
                        value="" onChange={uid => { if (uid) patchDeptCfg(dept.id, { defaultAssigneeIds: [...cfg.defaultAssigneeIds, uid] }); }}
                        emptyLabel="افزودن مسئول" placeholder="جستجوی کاربر"
                        displayKey="firstName" searchKey="lastName" />
                    </div>

                    {/* Save SLA btn */}
                    <div className="flex justify-end">
                      <button onClick={() => saveDeptConfig(dept.id)} disabled={savingDept[dept.id]}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
                        {savingDept[dept.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        ذخیره پیکربندی
                      </button>
                    </div>

                    {/* Categories */}
                    <div>
                      <div className="text-sm font-medium text-theme-primary mb-3">دسته‌بندی‌ها</div>
                      {!cfg.id && (
                        <p className="text-xs text-amber-600 mb-2">ابتدا پیکربندی را ذخیره کنید تا بتوانید دسته‌بندی اضافه کنید</p>
                      )}
                      <div className="space-y-2">
                        {cfg.categories.map((cat: any) => (
                          <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg bg-theme-secondary border border-theme">
                            {editCat?.id === cat.id ? (
                              <>
                                <input className="input-theme text-sm flex-1" value={editCat.name}
                                  onChange={e => setEditCat((p: any) => ({ ...p, name: e.target.value }))} />
                                <button onClick={() => updateCategory(cat.id, { name: editCat.name, isActive: editCat.isActive })}
                                  className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditCat(null)} className="text-red-500"><X className="w-4 h-4" /></button>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-sm text-theme-primary">{cat.name}</span>
                                {!cat.isActive && <span className="text-xs text-theme-muted bg-theme-card px-1.5 py-0.5 rounded">غیرفعال</span>}
                                <button onClick={() => setEditCat(cat)} className="text-theme-muted hover:text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteCategory(cat.id)} className="text-theme-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      {cfg.id && (
                        <div className="flex gap-2 mt-3">
                          <input className="input-theme text-sm flex-1" placeholder="نام دسته‌بندی جدید"
                            value={newCatName[dept.id] ?? ""} onChange={e => setNewCatName(p => ({ ...p, [dept.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") addCategory(dept.id); }} />
                          <button onClick={() => addCategory(dept.id)} disabled={savingCat[dept.id]}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
                            {savingCat[dept.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            افزودن
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Global settings */}
      {tab === "global" && globalDraft && (
        <div className="bg-theme-card border border-theme rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs text-theme-muted mb-1.5">پیشوند شماره تیکت</label>
              <input className="input-theme text-sm w-full" dir="ltr" value={globalDraft.ticketPrefix ?? "TKT"}
                onChange={e => patchGlobal("ticketPrefix", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-theme-muted mb-1.5">حداکثر حجم فایل (MB)</label>
              <input type="number" min="1" max="100" className="input-theme text-sm w-full" dir="ltr"
                value={globalDraft.maxFileSizeMb ?? 10} onChange={e => patchGlobal("maxFileSizeMb", Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-theme-muted mb-1.5">بستن خودکار بعد از (روز)</label>
              <input type="number" min="0" className="input-theme text-sm w-full" dir="ltr"
                value={globalDraft.autoCloseAfterDays ?? 7} onChange={e => patchGlobal("autoCloseAfterDays", Number(e.target.value))} />
              <p className="text-xs text-theme-muted mt-1">۰ = غیرفعال</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: "allowUserPriority", label: "کاربر می‌تواند اولویت انتخاب کند" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-theme-secondary">{label}</span>
                <Toggle value={globalDraft[key] ?? false} onChange={v => patchGlobal(key, v)} />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs text-theme-muted mb-1.5">پسوندهای مجاز (با کاما جدا کنید)</label>
            <input className="input-theme text-sm w-full" dir="ltr"
              value={(globalDraft.allowedExtensions ?? []).join(",")}
              onChange={e => patchGlobal("allowedExtensions", e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean))} />
          </div>

          <div className="flex justify-end pt-2 border-t border-theme">
            <button onClick={saveGlobal} disabled={savingGlobal}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
              {savingGlobal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              ذخیره تنظیمات عمومی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
