"use client";
import React from "react";
import { pageTitle } from "../../../lib/branding";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  Boxes, Users, Handshake, Building2, BarChart3, TrendingUp,
  Package, UserCheck, CheckCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-theme-primary">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</div>
        <div className="text-sm text-theme-muted mt-0.5">{label}</div>
        {sub && <div className="text-xs text-blue-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const faTooltip = (label: string) => ({ formatter: (v: any) => [v.toLocaleString("fa-IR"), label] });

export default function ReportsPage() {
  React.useEffect(() => { document.title = pageTitle("گزارش‌ها"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };

  const [assets, setAssets] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [depts, setDepts] = React.useState<any[]>([]);
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch(`${API}/assets`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/asset-assignments`, { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([a, u, d, ass]) => {
      setAssets(Array.isArray(a) ? a : a?.data ?? []);
      setUsers(Array.isArray(u) ? u : u?.data ?? []);
      setDepts(Array.isArray(d) ? d : d?.data ?? []);
      setAssignments(Array.isArray(ass) ? ass : ass?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  // Compute stats
  const activeAssignments = assignments.filter((a: any) => !a.returnedAt);
  const returnedAssignments = assignments.filter((a: any) => a.returnedAt);

  // Assets by category
  const byCat: Record<string, number> = {};
  for (const a of assets) {
    const k = a.category?.name || a.type?.name || "سایر";
    byCat[k] = (byCat[k] || 0) + 1;
  }
  const catData = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  // Assets per department (from assignments)
  const byDept: Record<string, number> = {};
  for (const a of activeAssignments) {
    const k = a.department?.name || a.user?.department?.name || "نامشخص";
    byDept[k] = (byDept[k] || 0) + 1;
  }
  const deptData = Object.entries(byDept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Users per department
  const usersByDept = depts.map((d: any) => ({
    name: d.name,
    value: users.filter((u: any) => u.departments?.some((ud: any) => ud.departmentId === d.id || ud.id === d.id)).length,
  })).filter(d => d.value > 0);

  // Assignment trend (group by month from createdAt)
  const trendMap: Record<string, number> = {};
  for (const a of assignments) {
    if (!a.createdAt) continue;
    const d = new Date(a.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap[key] = (trendMap[key] || 0) + 1;
  }
  const trendData = Object.entries(trendMap).sort().slice(-8).map(([name, value]) => ({ name: name.slice(5) + "/" + name.slice(0, 4), value }));

  // Role distribution
  const roleMap: Record<string, number> = {};
  for (const u of users) { roleMap[u.role || "USER"] = (roleMap[u.role || "USER"] || 0) + 1; }
  const ROLE_FA: Record<string, string> = { ADMIN: "مدیر ارشد", MANAGER: "مدیر", EXPERT: "کارشناس", USER: "کاربر" };
  const roleData = Object.entries(roleMap).map(([name, value]) => ({ name: ROLE_FA[name] || name, value }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-theme-muted">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">در حال بارگذاری گزارش‌ها...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5" dir="rtl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">گزارش‌ها و تحلیل‌ها</h1>
          <p className="text-theme-muted text-sm">نمای کلی از وضعیت دارایی‌ها، کاربران و واگذاری‌های سازمان</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Boxes} label="کل دارایی‌ها" value={assets.length} color="bg-gradient-to-br from-blue-500 to-blue-600" />
        <StatCard icon={Users} label="کاربران" value={users.length} sub={`${depts.length} دپارتمان`} color="bg-gradient-to-br from-purple-500 to-purple-600" />
        <StatCard icon={Handshake} label="واگذاری فعال" value={activeAssignments.length} sub={`${returnedAssignments.length} بازگشتی`} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
        <StatCard icon={Building2} label="دپارتمان‌ها" value={depts.length} color="bg-gradient-to-br from-amber-500 to-amber-600" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assets by category */}
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <h2 className="font-semibold text-theme-primary text-sm mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" /> دارایی‌ها بر اساس دسته‌بندی
          </h2>
          {catData.length === 0
            ? <div className="h-48 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
            : <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [v.toLocaleString("fa-IR"), "تعداد"]} />
              </PieChart>
            </ResponsiveContainer>
          }
        </div>

        {/* Assignments trend */}
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <h2 className="font-semibold text-theme-primary text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" /> روند واگذاری‌ها (ماهانه)
          </h2>
          {trendData.length === 0
            ? <div className="h-48 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
            : <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...faTooltip("واگذاری")} />
                <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#grad1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Assets per dept */}
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <h2 className="font-semibold text-theme-primary text-sm mb-4 flex items-center gap-2">
            <Handshake className="w-4 h-4 text-emerald-500" /> دارایی واگذارشده به هر بخش
          </h2>
          {deptData.length === 0
            ? <div className="h-48 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
            : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip {...faTooltip("دارایی")} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        </div>

        {/* Role distribution */}
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <h2 className="font-semibold text-theme-primary text-sm mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-500" /> توزیع نقش کاربران
          </h2>
          {roleData.length === 0
            ? <div className="h-48 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
            : <ResponsiveContainer width="100%" height={220}>
              <BarChart data={roleData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip {...faTooltip("کاربر")} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Assignment status summary */}
      <div className="bg-theme-card border border-theme rounded-xl p-4">
        <h2 className="font-semibold text-theme-primary text-sm mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-500" /> خلاصه وضعیت واگذاری‌ها
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "کل واگذاری‌ها", value: assignments.length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
            { label: "فعال", value: activeAssignments.length, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "بازگشتی", value: returnedAssignments.length, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
            { label: "درصد فعال", value: assignments.length ? `${Math.round(activeAssignments.length / assignments.length * 100)}٪` : "۰٪", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
              <div className={`text-2xl font-bold ${s.color}`}>
                {typeof s.value === "number" ? s.value.toLocaleString("fa-IR") : s.value}
              </div>
              <div className="text-xs text-theme-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
