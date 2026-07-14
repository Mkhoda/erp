"use client";
import React from "react";
import { pageTitle } from "../../../../lib/branding";
import {
  BarChart2, Bell, CheckCheck, TrendingUp, AlertTriangle,
  RefreshCw, Info,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const CATEGORY_FA: Record<string, string> = {
  SYSTEM: "سیستم", TICKET: "تیکت", WORKFLOW: "گردش‌کار", APPROVAL: "تایید",
  HR: "منابع انسانی", FINANCE: "مالی", IT: "فناوری اطلاعات", ATTENDANCE: "حضور و غیاب",
  SECURITY: "امنیت", CHAT: "پیام‌رسانی", REMINDER: "یادآوری", INFORMATION: "اطلاعات",
  WARNING: "هشدار", SUCCESS: "موفق", ERROR: "خطا", ANNOUNCEMENT: "اطلاعیه",
};
const PRIORITY_FA: Record<string, string> = {
  CRITICAL: "بحرانی", HIGH: "بالا", NORMAL: "عادی", LOW: "کم", INFO: "اطلاعات",
};

const PIE_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316",
  "#e11d48", "#0ea5e9", "#d97706", "#7c3aed", "#059669", "#475569",
];
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", NORMAL: "#3b82f6", LOW: "#94a3b8", INFO: "#06b6d4",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-theme-card border border-theme rounded-xl px-3 py-2 text-sm shadow-xl" dir="rtl">
      {label && <p className="text-theme-muted text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-theme-secondary">{p.name || p.dataKey}: </span>
          <span className="font-semibold text-theme-primary">{p.value?.toLocaleString("fa-IR")}</span>
        </div>
      ))}
    </div>
  );
};

export default function NotificationsDashboardPage() {
  React.useEffect(() => { document.title = pageTitle("آمار اعلان‌ها"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };

  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/notifications/analytics`, { headers: h as any });
      if (r.ok) setStats(await r.json());
    } finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const categoryData = (stats?.byCategory ?? []).map((r: any) => ({
    name: CATEGORY_FA[r.category] ?? r.category,
    count: r.count,
  }));

  const priorityData = (stats?.byPriority ?? []).map((r: any) => ({
    name: PRIORITY_FA[r.priority] ?? r.priority,
    count: r.count,
    fill: PRIORITY_COLORS[r.priority] ?? "#94a3b8",
  }));

  const trendData = (stats?.recentPerDay ?? []).map((r: any) => {
    const d = new Date(r.day);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    return { label, count: r.count };
  });

  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <BarChart2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-theme-primary">آمار اعلان‌ها</h1>
          <p className="text-sm text-theme-muted">تحلیل جامع سیستم اعلان‌رسانی سازمان</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme text-theme-secondary text-sm hover:bg-theme-hover">
          <RefreshCw className="w-3.5 h-3.5" /> بازخوانی
        </button>
      </div>

      {!stats && (
        <div className="bg-theme-card border border-theme rounded-xl p-8 text-center text-theme-muted">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">داده‌ای برای نمایش وجود ندارد</p>
        </div>
      )}

      {stats && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "کل اعلان‌ها", value: stats.total, icon: Bell, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
              { label: "خوانده نشده", value: stats.unread, icon: AlertTriangle, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
              { label: "نرخ خواندن", value: `${stats.readRate}%`, icon: CheckCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
              { label: "۳۰ روز اخیر", value: trendData.reduce((s: number, r: any) => s + r.count, 0), icon: TrendingUp, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-theme-card border border-theme rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-theme-muted">{label}</span>
                  <div className={`p-1.5 rounded-lg ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-theme-primary" dir="ltr">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</div>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          <div className="bg-theme-card border border-theme rounded-xl p-4">
            <h3 className="font-semibold text-theme-primary text-sm mb-4">روند ۳۰ روزه اعلان‌ها</h3>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" name="اعلان" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-32 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* By category */}
            <div className="bg-theme-card border border-theme rounded-xl p-4">
              <h3 className="font-semibold text-theme-primary text-sm mb-4">اعلان‌ها بر اساس دسته</h3>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RePieChart>
                    <Pie data={categoryData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                      {categoryData.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-32 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
              )}
            </div>

            {/* By priority */}
            <div className="bg-theme-card border border-theme rounded-xl p-4">
              <h3 className="font-semibold text-theme-primary text-sm mb-4">اعلان‌ها بر اساس اولویت</h3>
              {priorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={priorityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="تعداد" radius={[4, 4, 0, 0]}>
                      {priorityData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-32 flex items-center justify-center text-theme-muted text-sm">داده‌ای موجود نیست</div>
              )}
            </div>
          </div>

          {/* Category breakdown table */}
          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-theme">
              <h3 className="font-semibold text-theme-primary text-sm">تفکیک دسته‌بندی</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-theme-secondary text-xs text-theme-muted">
                  <tr>
                    <th className="text-right px-4 py-2.5 font-medium">دسته</th>
                    <th className="text-right px-4 py-2.5 font-medium">تعداد</th>
                    <th className="text-right px-4 py-2.5 font-medium">سهم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {categoryData.map((r: any) => (
                    <tr key={r.name} className="hover:bg-theme-hover transition-colors">
                      <td className="px-4 py-2.5 text-theme-secondary">{r.name}</td>
                      <td className="px-4 py-2.5 font-semibold text-theme-primary" dir="ltr">{r.count.toLocaleString("fa-IR")}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-theme-hover rounded-full overflow-hidden max-w-24">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.total ? Math.round((r.count / stats.total) * 100) : 0}%` }} />
                          </div>
                          <span className="text-xs text-theme-muted">
                            {stats.total ? Math.round((r.count / stats.total) * 100) : 0}٪
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
