"use client";
import React from "react";
import {
  Lock, ShieldCheck, Building2, Check, X, RefreshCw, ChevronDown,
  Boxes, Users, BarChart3, Fingerprint, MapPin, Navigation,
  LayoutDashboard, MessageSquare, User, KeyRound,
} from "lucide-react";
import { useToast } from "../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Dept = { id: string; name: string };
type KnownPage = { page: string; label: string };
type PermRow = { page: string; role: string; canRead: boolean; canWrite: boolean };

const ADMIN_LOCKED = [
  "/dashboard/ai-settings",
  "/dashboard/access",
  "/dashboard/ai-usage",
  "/dashboard/quota",
  "/dashboard/system-logs",
  "/dashboard/attendance/settings",
  "/dashboard/attendance/sync",
  "/dashboard/attendance/work-rules",
];

const UNIVERSAL_PAGES = [
  "/dashboard",
  "/dashboard/chat",
  "/dashboard/profile",
  "/dashboard/change-password",
  "/dashboard/attendance/my",
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدیر ارشد", MANAGER: "مدیر", EXPERT: "کارشناس", USER: "کاربر",
};
const CONFIGURABLE_ROLES = ["MANAGER", "EXPERT", "USER"] as const;
type CRole = typeof CONFIGURABLE_ROLES[number];

const ROLE_COLORS: Record<string, string> = {
  MANAGER: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700",
  EXPERT: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  USER: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

type Matrix = Record<string, Record<CRole, boolean>>;

type PageGroup = { id: string; title: string; icon: React.ElementType; pages: string[] };
type Section = { id: string; title: string; groups: PageGroup[] };

const SECTIONS: Section[] = [
  {
    id: "erp",
    title: "ERP",
    groups: [
      {
        id: "erp-assets",
        title: "مدیریت دارایی",
        icon: Boxes,
        pages: [
          "/dashboard/assets",
          "/dashboard/assets/types",
          "/dashboard/assets/categories",
          "/dashboard/assets/assignments",
        ],
      },
      {
        id: "erp-org",
        title: "مدیریت سازمان",
        icon: MapPin,
        pages: [
          "/dashboard/departments",
          "/dashboard/buildings",
          "/dashboard/floors",
          "/dashboard/rooms",
        ],
      },
      { id: "erp-users", title: "کاربران", icon: Users, pages: ["/dashboard/users"] },
    ],
  },
  {
    id: "analysis",
    title: "تحلیل",
    groups: [
      { id: "reports", title: "گزارش‌ها", icon: BarChart3, pages: ["/dashboard/reports"] },
    ],
  },
  {
    id: "attendance",
    title: "حضور و غیاب",
    groups: [
      {
        id: "attendance",
        title: "حضور و غیاب",
        icon: Fingerprint,
        pages: [
          "/dashboard/attendance",
          "/dashboard/attendance/records",
          "/dashboard/attendance/calendar",
          "/dashboard/attendance/requests",
          "/dashboard/attendance/approvals",
          "/dashboard/attendance/holidays",
          "/dashboard/attendance/shifts",
          "/dashboard/attendance/reports",
        ],
      },
    ],
  },
];

const ADMIN_LOCKED_DISPLAY = [
  { page: "/dashboard/ai-settings",          label: "تنظیمات هوش مصنوعی" },
  { page: "/dashboard/access",               label: "دسترسی صفحات" },
  { page: "/dashboard/ai-usage",             label: "مصرف AI" },
  { page: "/dashboard/quota",                label: "سقف توکن" },
  { page: "/dashboard/system-logs",          label: "لاگ سیستم" },
  { page: "/dashboard/attendance/settings",  label: "تنظیمات حضور و غیاب" },
  { page: "/dashboard/attendance/sync",      label: "پایش همگام‌سازی" },
  { page: "/dashboard/attendance/work-rules",label: "قوانین کارکرد" },
];

const UNIVERSAL_DISPLAY = [
  { page: "/dashboard",                   label: "نمای کلی",          icon: LayoutDashboard },
  { page: "/dashboard/chat",              label: "گفتگو با AI",       icon: MessageSquare },
  { page: "/dashboard/profile",           label: "پروفایل",           icon: User },
  { page: "/dashboard/change-password",   label: "تغییر رمز عبور",    icon: KeyRound },
  { page: "/dashboard/attendance/my",     label: "حضور من",           icon: Fingerprint },
];

export default function AccessPage() {
  React.useEffect(() => { document.title = "دسترسی صفحات | Arzesh AI"; }, []);
  const toast = useToast();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authH = { Authorization: `Bearer ${token}` };

  const [pages, setPages] = React.useState<KnownPage[]>([]);
  const [depts, setDepts] = React.useState<Dept[]>([]);
  const [selectedDept, setSelectedDept] = React.useState<string>("");
  const [matrix, setMatrix] = React.useState<Matrix>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [deptOpen, setDeptOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(
    () => new Set(SECTIONS.flatMap(s => s.groups.map(g => g.id)))
  );
  const deptRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (!deptRef.current?.contains(e.target as Node)) setDeptOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        fetch(`${API}/permissions/pages`, { headers: authH }),
        fetch(`${API}/departments`, { headers: authH }),
      ]);
      const rawPages = pRes.ok ? await pRes.json() : [];
      const pageList: KnownPage[] = rawPages.map((p: any) => ({ page: p.path ?? p.page, label: p.label }));
      const deptList: Dept[] = dRes.ok ? await dRes.json() : [];
      setPages(pageList.filter(p => !ADMIN_LOCKED.includes(p.page) && !UNIVERSAL_PAGES.includes(p.page)));
      setDepts(deptList);
      if (deptList.length > 0 && !selectedDept) setSelectedDept(deptList[0].id);
    } finally { setLoading(false); }
  }

  React.useEffect(() => { loadAll(); }, []);

  React.useEffect(() => {
    if (!selectedDept) return;
    loadDeptPerms(selectedDept);
  }, [selectedDept]);

  const pagesRef = React.useRef<KnownPage[]>([]);
  React.useEffect(() => { pagesRef.current = pages; }, [pages]);

  async function loadDeptPerms(deptId: string) {
    const res = await fetch(`${API}/permissions?departmentId=${deptId}`, { headers: authH });
    if (!res.ok) return;
    const rows: PermRow[] = await res.json();
    const m: Matrix = {};
    for (const p of pagesRef.current) {
      m[p.page] = { MANAGER: false, EXPERT: false, USER: false };
    }
    const wildcardValues: Record<string, boolean> = {};
    for (const r of rows) {
      if (r.role === "*") wildcardValues[r.page] = r.canRead;
    }
    for (const page of Object.keys(m)) {
      if (wildcardValues[page] !== undefined) {
        CONFIGURABLE_ROLES.forEach(ro => { m[page][ro] = wildcardValues[page]; });
      }
    }
    for (const r of rows) {
      if (CONFIGURABLE_ROLES.includes(r.role as CRole)) {
        if (!m[r.page]) m[r.page] = { MANAGER: false, EXPERT: false, USER: false };
        m[r.page][r.role as CRole] = r.canRead;
      }
    }
    setMatrix(m);
  }

  async function savePermission(page: string, role: CRole, value: boolean) {
    const res = await fetch(`${API}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authH },
      body: JSON.stringify({ departmentId: selectedDept, page, role, canRead: value, canWrite: false }),
    });
    if (!res.ok) throw new Error("save failed");
  }

  async function toggle(page: string, role: CRole) {
    if (!selectedDept) return;
    const cur = matrix[page]?.[role] ?? false;
    const key = `${page}|${role}`;
    setSaving(key);
    try {
      await savePermission(page, role, !cur);
      await loadDeptPerms(selectedDept);
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(null); }
  }

  async function toggleAll(page: string) {
    if (!selectedDept) return;
    const cur = matrix[page] ?? { MANAGER: false, EXPERT: false, USER: false };
    const newVal = !CONFIGURABLE_ROLES.every(r => cur[r]);
    const key = `${page}|all`;
    setSaving(key);
    try {
      await Promise.all(CONFIGURABLE_ROLES.map(r => savePermission(page, r, newVal)));
      await loadDeptPerms(selectedDept);
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(null); }
  }

  async function toggleGroupAll(groupPages: string[], enable: boolean) {
    if (!selectedDept) return;
    const key = `group|${groupPages[0]}`;
    setSaving(key);
    try {
      await Promise.all(
        groupPages.flatMap(page =>
          CONFIGURABLE_ROLES.map(role => savePermission(page, role, enable))
        )
      );
      await loadDeptPerms(selectedDept);
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(null); }
  }

  const pageMap = React.useMemo(() => {
    const m = new Map<string, string>();
    pages.forEach(p => m.set(p.page, p.label));
    return m;
  }, [pages]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const selectedDeptName = depts.find(d => d.id === selectedDept)?.name || "انتخاب بخش";

  return (
    <div className="space-y-4 max-w-5xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            مدیریت دسترسی و ناوبری
          </h1>
          <p className="text-theme-muted text-sm mt-0.5">کنترل دسترسی هر بخش به صفحات و منوی ناوبری سامانه</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary text-sm hover:bg-theme-hover transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          بروزرسانی
        </button>
      </div>

      {/* Department selector */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-theme bg-theme-card">
        <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="text-sm font-medium text-theme-primary">بخش سازمانی:</span>
        <div className="relative" ref={deptRef}>
          <button onClick={() => setDeptOpen(!deptOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme bg-theme-secondary text-sm text-theme-primary hover:bg-theme-hover transition-colors min-w-[160px]">
            <span className="flex-1 text-right">{selectedDeptName}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${deptOpen ? "rotate-180" : ""}`} />
          </button>
          {deptOpen && (
            <div className="absolute top-full right-0 mt-1 z-20 bg-theme-card border border-theme rounded-xl shadow-xl w-56 overflow-hidden">
              {depts.map(d => (
                <button key={d.id} onClick={() => { setSelectedDept(d.id); setDeptOpen(false); }}
                  className={`w-full text-right px-3 py-2.5 text-sm transition-colors hover:bg-theme-hover ${d.id === selectedDept ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium" : "text-theme-secondary"}`}>
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-theme-muted mr-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          تغییرات فوری اعمال می‌شوند
        </span>
      </div>

      {/* Navigation info note */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-sm">
        <Navigation className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <span className="text-blue-700 dark:text-blue-300">
          دسترسی به هر صفحه، نمایش آن در <strong>منوی ناوبری سمت راست</strong> کاربران آن بخش را نیز کنترل می‌کند.
        </span>
      </div>

      {/* Admin locked section */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-sm text-amber-700 dark:text-amber-300">صفحات سیستمی</span>
          <span className="text-xs text-amber-600/70 dark:text-amber-400/70">— فقط مدیر ارشد، غیرقابل تغییر</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-amber-100/50 dark:bg-amber-900/10">
          {ADMIN_LOCKED_DISPLAY.map(p => (
            <div key={p.page} className="flex items-center gap-2 px-3 py-2 bg-theme-card">
              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-xs text-theme-secondary truncate">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Universal pages section */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">صفحات عمومی</span>
          <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">— همه کاربران احراز هویت‌شده، غیرقابل تغییر</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-emerald-100/30 dark:bg-emerald-900/10">
          {UNIVERSAL_DISPLAY.map(p => (
            <div key={p.page} className="flex items-center gap-2 px-3 py-2 bg-theme-card">
              <p.icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-theme-secondary truncate">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Configurable sections */}
      {loading ? (
        <div className="rounded-xl border border-theme bg-theme-card py-16 text-center text-theme-muted text-sm">
          در حال بارگذاری...
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(section => {
            const resolvedGroups = section.groups.map(group => ({
              ...group,
              resolvedPages: group.pages
                .filter(path => pageMap.has(path))
                .map(path => ({ page: path, label: pageMap.get(path)! })),
            })).filter(g => g.resolvedPages.length > 0);

            if (resolvedGroups.length === 0) return null;

            return (
              <div key={section.id}>
                {/* Section label */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-bold text-theme-muted uppercase tracking-widest">{section.title}</span>
                  <div className="flex-1 h-px bg-theme-secondary/50" />
                </div>

                <div className="space-y-2">
                  {resolvedGroups.map(group => {
                    const isOpen = openGroups.has(group.id);
                    const GroupIcon = group.icon;

                    // Compute group-level stats
                    const totalCells = group.resolvedPages.length * CONFIGURABLE_ROLES.length;
                    const grantedCells = group.resolvedPages.reduce((acc, p) => {
                      const cur = matrix[p.page] ?? { MANAGER: false, EXPERT: false, USER: false };
                      return acc + CONFIGURABLE_ROLES.filter(r => cur[r]).length;
                    }, 0);
                    const groupAllOn = grantedCells === totalCells;
                    const groupSomeOn = grantedCells > 0;
                    const groupKey = `group|${group.pages[0]}`;
                    const isGroupSaving = saving === groupKey;

                    return (
                      <div key={group.id} className="rounded-xl border border-theme overflow-hidden bg-theme-card">
                        {/* Group header */}
                        <div className={`flex items-center gap-3 px-4 py-3 border-b border-theme cursor-pointer select-none transition-colors
                          ${isOpen ? "bg-theme-secondary/50" : "hover:bg-theme-hover"}`}
                          onClick={() => toggleGroup(group.id)}>
                          <GroupIcon className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-medium text-sm text-theme-primary flex-1">{group.title}</span>
                          <span className="text-xs text-theme-muted">
                            {group.resolvedPages.length} صفحه
                          </span>

                          {/* Group quick-toggle */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleGroupAll(group.pages.filter(p => pageMap.has(p)), !groupAllOn); }}
                            disabled={!!saving}
                            title={groupAllOn ? "حذف همه دسترسی‌های گروه" : "دسترسی کامل برای گروه"}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                              isGroupSaving ? "opacity-60 cursor-wait" :
                              groupAllOn
                                ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600"
                                : groupSomeOn
                                ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                                : "bg-theme-secondary border-theme text-theme-muted hover:border-blue-400 hover:text-blue-500"
                            }`}
                          >
                            {isGroupSaving
                              ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : groupAllOn ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 flex items-center justify-center">{groupAllOn ? "✓" : groupSomeOn ? "−" : "+"}</span>
                            }
                            {groupAllOn ? "همه دسترسی دارند" : groupSomeOn ? `${grantedCells}/${totalCells} دسترسی` : "بدون دسترسی"}
                          </button>

                          <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </div>

                        {/* Permission matrix */}
                        {isOpen && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-theme bg-theme-secondary/30">
                                  <th className="text-right px-4 py-2 font-medium text-theme-muted text-xs">صفحه</th>
                                  {CONFIGURABLE_ROLES.map(r => (
                                    <th key={r} className="text-center px-3 py-2 font-medium text-xs w-24">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${ROLE_COLORS[r]}`}>
                                        {ROLE_LABELS[r]}
                                      </span>
                                    </th>
                                  ))}
                                  <th className="text-center px-3 py-2 font-medium text-theme-muted text-xs w-14">همه</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-theme">
                                {group.resolvedPages.map(({ page, label }) => {
                                  const cur = matrix[page] ?? { MANAGER: false, EXPERT: false, USER: false };
                                  const allOn = CONFIGURABLE_ROLES.every(r => cur[r]);
                                  const someOn = CONFIGURABLE_ROLES.some(r => cur[r]);
                                  const allKey = `${page}|all`;
                                  return (
                                    <tr key={page} className="hover:bg-theme-hover/50 transition-colors group">
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-theme-primary text-sm">{label}</span>
                                          <code className="text-[10px] text-theme-muted font-mono bg-theme-hover px-1.5 py-0.5 rounded hidden group-hover:inline">{page}</code>
                                        </div>
                                      </td>
                                      {CONFIGURABLE_ROLES.map(role => {
                                        const on = cur[role];
                                        const key = `${page}|${role}`;
                                        const isSaving = saving === key || saving === allKey || saving === groupKey;
                                        return (
                                          <td key={role} className="px-3 py-2.5 text-center">
                                            <button
                                              onClick={() => toggle(page, role)}
                                              disabled={!!saving}
                                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
                                                isSaving ? "opacity-60 cursor-wait" :
                                                on
                                                  ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600"
                                                  : "bg-theme-secondary border-theme text-theme-muted hover:border-slate-400 hover:text-theme-secondary"
                                              }`}
                                            >
                                              {isSaving
                                                ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                : on ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />
                                              }
                                            </button>
                                          </td>
                                        );
                                      })}
                                      {/* Row all-toggle */}
                                      <td className="px-3 py-2.5 text-center">
                                        <button
                                          onClick={() => toggleAll(page)}
                                          disabled={!!saving}
                                          title={allOn ? "حذف دسترسی همه نقش‌ها" : "دسترسی همه نقش‌ها"}
                                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
                                            saving === allKey ? "opacity-60 cursor-wait" :
                                            allOn
                                              ? "bg-blue-500 border-blue-400 text-white hover:bg-blue-600"
                                              : someOn
                                              ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                                              : "bg-theme-secondary border-theme text-theme-muted hover:border-blue-400 hover:text-blue-500"
                                          }`}
                                        >
                                          {saving === allKey
                                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            : allOn
                                            ? <Check className="w-3.5 h-3.5" />
                                            : someOn
                                            ? <span className="w-2 h-0.5 bg-current rounded block" />
                                            : <Check className="w-3.5 h-3.5 opacity-30" />
                                          }
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-theme bg-theme-secondary/30">
        <span className="flex items-center gap-1.5 text-xs text-theme-muted">
          <span className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>
          دسترسی دارد — در منوی کاربر نمایش داده می‌شود
        </span>
        <span className="flex items-center gap-1.5 text-xs text-theme-muted">
          <span className="w-4 h-4 rounded bg-theme-secondary border border-theme flex items-center justify-center"><X className="w-2.5 h-2.5" /></span>
          بدون دسترسی — از منوی کاربر پنهان می‌شود
        </span>
        <span className="text-xs text-theme-muted mr-auto">مدیر ارشد (ADMIN) همیشه به تمام صفحات دسترسی دارد</span>
      </div>
    </div>
  );
}
