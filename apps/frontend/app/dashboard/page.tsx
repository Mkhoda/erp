"use client";
import React from 'react';
import Link from 'next/link';
import {
  Boxes, Users, Handshake, Plus, ArrowLeft,
  Activity, CheckCircle, Clock, Building
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Stats = {
  totalAssets: number;
  totalUsers: number;
  activeAssignments: number;
  totalDepartments: number;
};

export default function DashboardPage() {
  React.useEffect(() => { document.title = 'داشبورد | ارزش ERP'; }, []);

  const [stats, setStats] = React.useState<Stats>({ totalAssets: 0, totalUsers: 0, activeAssignments: 0, totalDepartments: 0 });
  const [recentAssets, setRecentAssets] = React.useState<any[]>([]);
  const [recentAssignments, setRecentAssignments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<any>(null);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API}/auth/me`, { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/assets`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/asset-assignments`, { headers: h }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []),
    ]).then(([meData, assets, users, assignments, depts]) => {
      setMe(meData);
      const assetsArr = Array.isArray(assets) ? assets : [];
      const usersArr = Array.isArray(users) ? users : [];
      const assignArr = Array.isArray(assignments) ? assignments : [];
      const deptsArr = Array.isArray(depts) ? depts : [];

      setStats({
        totalAssets: assetsArr.length,
        totalUsers: usersArr.length,
        activeAssignments: assignArr.filter((a: any) => !a.returnedAt).length,
        totalDepartments: deptsArr.length,
      });

      setRecentAssets(assetsArr.slice(0, 5));
      setRecentAssignments(assignArr.filter((a: any) => !a.returnedAt).slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'صبح بخیر';
    if (h < 17) return 'ظهر بخیر';
    return 'عصر بخیر';
  };

  const statCards = [
    { title: 'کل دارایی‌ها', value: stats.totalAssets, icon: Boxes, color: 'blue', href: '/dashboard/assets' },
    { title: 'کاربران سیستم', value: stats.totalUsers, icon: Users, color: 'green', href: '/dashboard/users' },
    { title: 'واگذاری‌های فعال', value: stats.activeAssignments, icon: Handshake, color: 'orange', href: '/dashboard/assets/assignments' },
    { title: 'دپارتمان‌ها', value: stats.totalDepartments, icon: Building, color: 'purple', href: '/dashboard/departments' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900',
    green: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900',
    orange: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900',
    purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900',
  };
  const iconBg: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/60',
    green: 'bg-green-100 dark:bg-green-900/60',
    orange: 'bg-orange-100 dark:bg-orange-900/60',
    purple: 'bg-purple-100 dark:bg-purple-900/60',
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card-theme card-theme-body">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">
              {greeting()}، {me?.firstName || 'کاربر'} 👋
            </h1>
            <p className="text-theme-secondary mt-1 text-sm">
              {new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Link
            href="/dashboard/assets"
            className="btn-theme-primary inline-flex items-center gap-2 self-start"
          >
            <Plus className="w-4 h-4" />
            افزودن دارایی
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.title} href={s.href} className={`group p-5 rounded-xl border ${colorMap[s.color]} hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${iconBg[s.color]}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-theme-primary">
              {loading ? '...' : s.value.toLocaleString('fa-IR')}
            </div>
            <div className="text-xs mt-1 opacity-75">{s.title}</div>
          </Link>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Assets */}
        <div className="card-theme">
          <div className="card-theme-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-theme-primary">آخرین دارایی‌ها</h2>
            </div>
            <Link href="/dashboard/assets" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              مشاهده همه <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="card-theme-body">
            {loading ? (
              <div className="text-center py-6 text-theme-muted text-sm">در حال بارگذاری...</div>
            ) : recentAssets.length === 0 ? (
              <div className="text-center py-6 text-theme-muted text-sm">دارایی‌ای ثبت نشده</div>
            ) : (
              <div className="space-y-2">
                {recentAssets.map((a) => (
                  <Link key={a.id} href={`/dashboard/assets/${a.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-theme-secondary hover:bg-theme-hover transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                      <Boxes className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">{a.name}</p>
                      <p className="text-xs text-theme-muted">{a.barcode}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      a.availability === 'AVAILABLE' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                      a.availability === 'IN_USE' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {a.availability === 'AVAILABLE' ? 'موجود' : a.availability === 'IN_USE' ? 'در استفاده' : a.availability}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Assignments */}
        <div className="card-theme">
          <div className="card-theme-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <h2 className="font-semibold text-theme-primary">واگذاری‌های فعال</h2>
            </div>
            <Link href="/dashboard/assets/assignments" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              مشاهده همه <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="card-theme-body">
            {loading ? (
              <div className="text-center py-6 text-theme-muted text-sm">در حال بارگذاری...</div>
            ) : recentAssignments.length === 0 ? (
              <div className="text-center py-6 text-theme-muted text-sm">واگذاری فعالی وجود ندارد</div>
            ) : (
              <div className="space-y-2">
                {recentAssignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-theme-secondary">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center flex-shrink-0">
                      <Handshake className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">
                        {a.asset?.name || 'دارایی'}
                      </p>
                      <p className="text-xs text-theme-muted">
                        {a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() : a.department?.name || 'نامشخص'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                      <Clock className="w-3 h-3" />
                      فعال
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-theme">
        <div className="card-theme-header">
          <h2 className="font-semibold text-theme-primary">دسترسی سریع</h2>
        </div>
        <div className="card-theme-body grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { title: 'دارایی جدید', href: '/dashboard/assets', icon: Plus, color: 'blue' },
            { title: 'واگذاری جدید', href: '/dashboard/assets/assignments', icon: Handshake, color: 'green' },
            { title: 'کاربر جدید', href: '/dashboard/users', icon: Users, color: 'purple' },
            { title: 'گزارش حسابداری', href: '/dashboard/accounting', icon: CheckCircle, color: 'orange' },
          ].map((q) => (
            <Link key={q.title} href={q.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${colorMap[q.color]} hover:shadow-md transition-all text-center`}>
              <div className={`p-2 rounded-lg ${iconBg[q.color]}`}>
                <q.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">{q.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
