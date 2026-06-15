"use client";
import React from "react";
import { Lock, ShieldCheck, Building2, Check, X, RefreshCw, ChevronDown } from "lucide-react";
import { useToast } from "../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Dept = { id: string; name: string };
type KnownPage = { page: string; label: string };
type PermRow = { id?: string; page: string; role: string; canRead: boolean; canWrite: boolean; department?: { id: string; name: string } };

// Pages that are ADMIN-only and cannot be changed
const ADMIN_LOCKED = [
  "/dashboard/ai-settings",
  "/dashboard/access",
  "/dashboard/ai-usage",
  "/dashboard/system-logs",
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

type Matrix = Record<string, Record<CRole, boolean>>; // page → role → canRead

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
      const pageList: KnownPage[] = pRes.ok ? await pRes.json() : [];
      const deptList: Dept[] = dRes.ok ? await dRes.json() : [];
      setPages(pageList.filter(p => !ADMIN_LOCKED.includes(p.page)));
      setDepts(deptList);
      if (deptList.length > 0 && !selectedDept) setSelectedDept(deptList[0].id);
    } finally { setLoading(false); }
  }

  React.useEffect(() => { loadAll(); }, []);

  React.useEffect(() => {
    if (!selectedDept) return;
    loadDeptPerms(selectedDept);
  }, [selectedDept]);

  async function loadDeptPerms(deptId: string) {
    const res = await fetch(`${API}/permissions?departmentId=${deptId}`, { headers: authH });
    if (!res.ok) return;
    const rows: PermRow[] = await res.json();
    const m: Matrix = {};
    for (const p of pages) {
      m[p.page] = { MANAGER: false, EXPERT: false, USER: false };
    }
    for (const r of rows) {
      if (!m[r.page]) m[r.page] = { MANAGER: false, EXPERT: false, USER: false };
      if (r.role === "*") {
        CONFIGURABLE_ROLES.forEach(ro => { m[r.page][ro] = r.canRead; });
      } else if (CONFIGURABLE_ROLES.includes(r.role as CRole)) {
        m[r.page][r.role as CRole] = r.canRead;
      }
    }
    setMatrix(m);
  }

  async function toggle(page: string, role: CRole) {
    if (!selectedDept) return;
    const cur = matrix[page]?.[role] ?? false;
    const key = `${page}|${role}`;
    setSaving(key);
    try {
      await fetch(`${API}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ departmentId: selectedDept, page, role, canRead: !cur, canWrite: false }),
      });
      setMatrix(m => ({ ...m, [page]: { ...m[page], [role]: !cur } }));
    } catch { toast.error("خطا در ذخیره"); }
    finally { setSaving(null); }
  }

  const configurablePages = pages.filter(p => !ADMIN_LOCKED.includes(p.page));
  const selectedDeptName = depts.find(d => d.id === selectedDept)?.name || "انتخاب بخش";

  return (
    <div className="space-y-5 max-w-5xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            مدیریت دسترسی صفحات
          </h1>
          <p className="text-theme-muted text-sm mt-0.5">تعیین سطح دسترسی هر بخش سازمانی به صفحات سامانه</p>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary text-sm hover:bg-theme-hover transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          بروزرسانی
        </button>
      </div>

      {/* Admin locked section */}
      <div className="rounded-xl border border-theme bg-theme-secondary overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-theme bg-amber-50/50 dark:bg-amber-950/20">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-sm text-amber-700 dark:text-amber-300">صفحات مدیریت سیستم</span>
          <span className="text-xs text-amber-600/70 dark:text-amber-400/70 mr-1">— فقط مدیر ارشد، غیرقابل تغییر</span>
        </div>
        <div className="divide-y divide-theme">
          {[
            { page: "/dashboard/ai-settings", label: "تنظیمات هوش مصنوعی" },
            { page: "/dashboard/access",      label: "دسترسی صفحات" },
            { page: "/dashboard/ai-usage",    label: "مصرف AI" },
            { page: "/dashboard/system-logs", label: "لاگ سیستم" },
          ].map(p => (
            <div key={p.page} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-sm text-theme-secondary">{p.label}</span>
                <code className="text-[10px] text-theme-muted font-mono bg-theme-hover px-1.5 py-0.5 rounded">{p.page}</code>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                مدیر ارشد
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Configurable section */}
      <div className="rounded-xl border border-theme overflow-hidden bg-theme-card">
        {/* Department selector */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme bg-theme-secondary">
          <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-theme-primary">دسترسی بخش:</span>

          <div className="relative" ref={deptRef}>
            <button onClick={() => setDeptOpen(!deptOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme bg-theme-card text-sm text-theme-primary hover:bg-theme-hover transition-colors min-w-[140px]">
              <span className="flex-1 text-right">{selectedDeptName}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${deptOpen ? "rotate-180" : ""}`} />
            </button>
            {deptOpen && (
              <div className="absolute top-full right-0 mt-1 z-20 bg-theme-card border border-theme rounded-xl shadow-xl w-52 overflow-hidden">
                {depts.map(d => (
                  <button key={d.id} onClick={() => { setSelectedDept(d.id); setDeptOpen(false); }}
                    className={`w-full text-right px-3 py-2 text-sm transition-colors hover:bg-theme-hover ${d.id === selectedDept ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium" : "text-theme-secondary"}`}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-xs text-theme-muted mr-auto">تغییرات فوری اعمال می‌شوند</span>
        </div>

        {/* Permission matrix */}
        {loading ? (
          <div className="py-12 text-center text-theme-muted text-sm">در حال بارگذاری...</div>
        ) : configurablePages.length === 0 ? (
          <div className="py-12 text-center text-theme-muted text-sm">صفحه‌ای یافت نشد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-theme bg-theme-secondary/50">
                  <th className="text-right px-4 py-2.5 font-medium text-theme-muted text-xs">صفحه</th>
                  {CONFIGURABLE_ROLES.map(r => (
                    <th key={r} className="text-center px-4 py-2.5 font-medium text-xs">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${ROLE_COLORS[r]}`}>
                        {ROLE_LABELS[r]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {configurablePages.map(p => (
                  <tr key={p.page} className="hover:bg-theme-hover/50 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-theme-primary text-sm">{p.label}</span>
                        <code className="text-[10px] text-theme-muted font-mono bg-theme-hover px-1.5 py-0.5 rounded hidden group-hover:inline">{p.page}</code>
                      </div>
                    </td>
                    {CONFIGURABLE_ROLES.map(role => {
                      const on = matrix[p.page]?.[role] ?? false;
                      const key = `${p.page}|${role}`;
                      const isSaving = saving === key;
                      return (
                        <td key={role} className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => toggle(p.page, role)}
                            disabled={!!saving}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
                              isSaving ? "opacity-60 cursor-wait" :
                              on
                                ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600"
                                : "bg-theme-secondary border-theme text-theme-muted hover:border-slate-400 hover:text-theme-secondary"
                            }`}
                          >
                            {isSaving
                              ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : on ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />
                            }
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-theme bg-theme-secondary/30">
          <span className="flex items-center gap-1.5 text-xs text-theme-muted">
            <span className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>
            دسترسی دارد
          </span>
          <span className="flex items-center gap-1.5 text-xs text-theme-muted">
            <span className="w-4 h-4 rounded bg-theme-secondary border border-theme flex items-center justify-center"><X className="w-2.5 h-2.5" /></span>
            دسترسی ندارد
          </span>
          <span className="text-xs text-theme-muted mr-auto">مدیر ارشد (ADMIN) همیشه به تمام صفحات دسترسی دارد</span>
        </div>
      </div>
    </div>
  );
}
