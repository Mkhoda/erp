"use client";
import React from "react";
import { Loader2, AlertTriangle, TrendingUp, Users, PieChart } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useToast } from "../../../components/ui/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_FA: Record<string, string> = {
  OPEN: "باز", ASSIGNED: "تخصیص‌یافته", IN_PROGRESS: "در جریان",
  WAITING_USER: "منتظر کاربر", USER_REPLIED: "پاسخ کاربر", RESOLVED: "حل‌شده",
  CLOSED: "بسته", CANCELLED: "لغو", REJECTED: "رد", REOPENED: "بازگشایی",
};
const PRIORITY_FA: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "بالا", CRITICAL: "بحرانی" };

const STATUS_COLORS = ["#3b82f6","#6366f1","#8b5cf6","#f59e0b","#06b6d4","#22c55e","#94a3b8","#ef4444","#dc2626","#f97316"];
const PRIORITY_COLORS = ["#94a3b8","#3b82f6","#f59e0b","#ef4444"];

const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");

function KpiCard({ label, value, sub, cls }: { label: string; value: any; sub?: string; cls?: string }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-4">
      <div className={`text-2xl font-bold ${cls ?? "text-theme-primary"}`}>{typeof value === "number" ? faNum(value) : value}</div>
      <div className="text-sm text-theme-secondary mt-0.5">{label}</div>
      {sub && <div className="text-xs text-theme-muted mt-1">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-2 text-xs shadow-lg" dir="rtl">
      <p className="font-medium text-theme-primary mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {faNum(p.value)}</p>
      ))}
    </div>
  );
};

export default function TicketDashboardPage() {
  React.useEffect(() => { document.title = "داشبورد تیکت | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };
  const toast = useToast();

  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<any>(null);
  const [workload, setWorkload] = React.useState<any[]>([]);
  const [slaReport, setSlaReport] = React.useState<any>(null);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/tickets/analytics/dashboard`, { headers: h as any }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/tickets/analytics/workload`, { headers: h as any }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/tickets/analytics/sla`, { headers: h as any }).then(r => r.ok ? r.json() : null),
    ]).then(([s, w, sla]) => {
      setStats(s);
      setWorkload(Array.isArray(w) ? w : []);
      setSlaReport(sla);
    }).catch(() => toast.error("خطا در بارگذاری آمار")).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (!stats) return <div className="text-center py-20 text-theme-muted">داده‌ای یافت نشد</div>;

  const statusPieData = Object.entries(stats.byStatus ?? {}).map(([k, v]: [string, any]) => ({ name: STATUS_FA[k] ?? k, value: v }));
  const priorityPieData = Object.entries(stats.byPriority ?? {}).map(([k, v]: [string, any]) => ({ name: PRIORITY_FA[k] ?? k, value: v }));
  const deptBarData = (stats.byDepartment ?? []).map((d: any) => ({ name: d.name, تیکت: d.total, باز: d.open }));
  const trendData = (stats.dailyTrend ?? []).map((d: any) => ({ date: d.date, جدید: d.count }));

  const fmtMin = (m: number) => {
    if (!m) return "—";
    const h2 = Math.floor(m / 60), mn = m % 60;
    return `${faNum(h2)}:${String(mn).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center shadow-lg">
          <PieChart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">داشبورد میز خدمت</h1>
          <p className="text-sm text-theme-muted">آمار و تحلیل تیکت‌های پشتیبانی</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="کل تیکت‌ها" value={stats.total ?? 0} />
        <KpiCard label="باز" value={stats.open ?? 0} cls="text-blue-600" />
        <KpiCard label="تأخیر SLA" value={stats.overSla ?? 0} cls="text-red-600"
          sub={slaReport ? `نرخ تأخیر: ${((slaReport.breachRate ?? 0) * 100).toFixed(1)}٪` : undefined} />
        <KpiCard label="میانگین پاسخ اول"
          value={slaReport?.avgFirstResponse ? fmtMin(Math.round(slaReport.avgFirstResponse)) : "—"}
          sub="ساعت:دقیقه" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status pie */}
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <div className="text-sm font-medium text-theme-primary mb-3">توزیع وضعیت</div>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RePieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {statusPieData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => <span className="text-xs text-theme-secondary">{v}</span>} />
              </RePieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-theme-muted text-sm py-12">داده‌ای موجود نیست</p>}
        </div>

        {/* Priority pie */}
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <div className="text-sm font-medium text-theme-primary mb-3">توزیع اولویت</div>
          {priorityPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RePieChart>
                <Pie data={priorityPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {priorityPieData.map((_, i) => <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => <span className="text-xs text-theme-secondary">{v}</span>} />
              </RePieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-theme-muted text-sm py-12">داده‌ای موجود نیست</p>}
        </div>
      </div>

      {/* Trend */}
      <div className="bg-theme-card border border-theme rounded-xl p-4">
        <div className="text-sm font-medium text-theme-primary mb-3">روند ثبت تیکت (۳۰ روز اخیر)</div>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="جدید" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-theme-muted text-sm py-8">داده‌ای موجود نیست</p>}
      </div>

      {/* Dept bar */}
      {deptBarData.length > 0 && (
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <div className="text-sm font-medium text-theme-primary mb-3">تیکت‌ها بر اساس دپارتمان</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={deptBarData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="تیکت" fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="باز" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Workload table */}
      {workload.length > 0 && (
        <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-theme">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-theme-muted" />
              <span className="text-sm font-medium text-theme-primary">بار کاری مسئولین</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="border-b border-theme bg-theme-secondary/30 text-theme-muted text-xs">
                  <th className="px-4 py-2 text-right font-medium">مسئول</th>
                  <th className="px-4 font-medium">کل</th>
                  <th className="px-4 font-medium">باز</th>
                  <th className="px-4 font-medium">حل‌شده</th>
                  <th className="px-4 font-medium">تأخیر SLA</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((w: any) => (
                  <tr key={w.assigneeId} className="border-b border-theme/40 hover:bg-theme-hover">
                    <td className="px-4 py-2 text-right text-theme-primary">{w.assigneeName}</td>
                    <td className="px-4 text-theme-secondary">{faNum(w.total)}</td>
                    <td className="px-4 text-blue-600">{faNum(w.open)}</td>
                    <td className="px-4 text-green-600">{faNum(w.resolved)}</td>
                    <td className="px-4 text-red-600">{faNum(w.overSla)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLA summary */}
      {slaReport && (
        <div className="bg-theme-card border border-theme rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-theme-primary">گزارش SLA</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-theme-muted">نرخ تأخیر</div>
              <div className={`text-lg font-bold ${(slaReport.breachRate ?? 0) > 0.2 ? "text-red-600" : "text-green-600"}`}>
                {((slaReport.breachRate ?? 0) * 100).toFixed(1)}٪
              </div>
            </div>
            <div>
              <div className="text-xs text-theme-muted">میانگین پاسخ اول</div>
              <div className="text-lg font-bold text-theme-primary">{fmtMin(Math.round(slaReport.avgFirstResponse ?? 0))}</div>
            </div>
            <div>
              <div className="text-xs text-theme-muted">میانگین زمان حل</div>
              <div className="text-lg font-bold text-theme-primary">{fmtMin(Math.round(slaReport.avgResolution ?? 0))}</div>
            </div>
            <div>
              <div className="text-xs text-theme-muted">طولانی‌ترین باز</div>
              <div className="text-lg font-bold text-amber-600">{slaReport.longestOpenDays ?? 0} روز</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
