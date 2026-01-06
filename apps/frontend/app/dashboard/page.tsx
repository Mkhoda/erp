"use client";
import React from 'react';
import Link from 'next/link';
import { 
  Boxes, 
  Users, 
  Shield, 
  FileText, 
  Settings, 
  CircleDollarSign, 
  TrendingUp, 
  Activity,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  Calendar,
  Target,
  Zap
} from 'lucide-react';

export default function DashboardPage() {
  React.useEffect(() => {
    document.title = 'داشبورد | Arzesh ERP';
  }, []);

  const [stats, setStats] = React.useState({
    totalAssets: 0,
    activeUsers: 0,
    pendingAssignments: 0,
    completedTasks: 0
  });

  const [recentActivities] = React.useState([
    { id: 1, action: 'دارایی جدید اضافه شد', item: 'لپ تاپ HP ProBook', time: '۲ ساعت پیش', type: 'asset' },
    { id: 2, action: 'واگذاری انجام شد', item: 'پرینتر Canon', time: '۴ ساعت پیش', type: 'assignment' },
    { id: 3, action: 'کاربر جدید ثبت نام کرد', item: 'علی محمدی', time: '۶ ساعت پیش', type: 'user' },
    { id: 4, action: 'بروزرسانی موقعیت', item: 'اتاق ۲۰۱', time: '۱ روز پیش', type: 'location' }
  ]);

  React.useEffect(() => {
    // Load dashboard stats
    const loadStats = async () => {
      try {
        const token = localStorage.getItem('token');
        // You can add API calls here to get real stats
        setStats({
          totalAssets: 1247,
          activeUsers: 42,
          pendingAssignments: 8,
          completedTasks: 156
        });
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
      }
    };
    loadStats();
  }, []);

  const quickActions = [
    {
      title: 'افزودن دارایی',
      description: 'دارایی جدید به سیستم اضافه کنید',
      href: '/dashboard/assets',
      icon: Plus,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950'
    },
    {
      title: 'مدیریت کاربران',
      description: 'کاربران سیستم را مدیریت کنید',
      href: '/dashboard/users',
      icon: Users,
      color: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950'
    },
    {
      title: 'گزارش‌گیری',
      description: 'گزارش‌های مالی و عملکرد',
      href: '/dashboard/accounting',
      icon: BarChart3,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950'
    },
    {
      title: 'تنظیمات سیستم',
      description: 'پیکربندی عمومی سیستم',
      href: '/dashboard/settings',
      icon: Settings,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-950'
    }
  ];

  const statCards = [
    {
      title: 'کل دارایی‌ها',
      value: stats.totalAssets.toLocaleString('fa-IR'),
      change: '+۱۲%',
      trend: 'up',
      icon: Boxes,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950'
    },
    {
      title: 'کاربران فعال',
      value: stats.activeUsers.toLocaleString('fa-IR'),
      change: '+۵%',
      trend: 'up',
      icon: Users,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950'
    },
    {
      title: 'واگذاری‌های در انتظار',
      value: stats.pendingAssignments.toLocaleString('fa-IR'),
      change: '-۳%',
      trend: 'down',
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950'
    },
    {
      title: 'وظایف تکمیل شده',
      value: stats.completedTasks.toLocaleString('fa-IR'),
      change: '+۸%',
      trend: 'up',
      icon: CheckCircle,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 dark:from-blue-500/20 to-purple-600/10 dark:to-purple-500/20 rounded-2xl"></div>
        <div className="relative bg-theme-card shadow-theme-lg backdrop-blur-sm p-8 rounded-2xl">
          <div className="flex lg:flex-row flex-col justify-between lg:items-center gap-6">
            <div>
              <h1 className="mb-2 font-bold text-theme-primary text-3xl">
                خوش آمدید به سیستم مدیریت ارزش 🎯
              </h1>
              <p className="text-theme-secondary text-lg">
                آمار کلی و دسترسی سریع به ابزارهای مدیریتی
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="font-bold text-blue-600 dark:text-blue-400 text-2xl">
                  {new Date().toLocaleDateString('fa-IR', { day: 'numeric' })}
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  {new Date().toLocaleDateString('fa-IR', { month: 'long' })}
                </div>
              </div>
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="gap-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div key={index} className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5 dark:to-gray-800/5 rounded-xl rotate-1 group-hover:rotate-0 transition-transform transform"></div>
            <div className={`relative p-6 ${stat.bg} border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200`}>
              <div className="flex justify-between items-center mb-4">
                <div className={`p-3 rounded-lg ${stat.color.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-').replace('-600', '-100').replace('-400', '-900')}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-sm ${stat.trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  <TrendingUp className={`w-4 h-4 ${stat.trend === 'down' ? 'rotate-180' : ''}`} />
                  {stat.change}
                </div>
              </div>
              <div>
                <h3 className="mb-1 font-medium text-theme-secondary text-sm">{stat.title}</h3>
                <p className="font-bold text-theme-primary text-2xl">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="gap-8 grid lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="shadow-theme backdrop-blur-sm p-6 card-theme">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-bold text-theme-primary text-xl">دسترسی سریع</h2>
            </div>
            <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href} className="group">
                  <div className={`p-4 ${action.bgColor} border border-gray-200/50 dark:border-gray-700/50 rounded-lg hover:shadow-md transition-all duration-200 group-hover:scale-[1.02]`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-2 ${action.color} rounded-lg flex-shrink-0`}>
                        <action.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="mb-1 font-semibold text-theme-primary">{action.title}</h3>
                        <p className="mb-2 text-theme-secondary text-sm">{action.description}</p>
                        <div className="flex items-center group-hover:gap-2 text-blue-600 dark:text-blue-400 text-sm transition-all">
                          شروع کنید
                          <ArrowRight className="mr-1 group-hover:mr-0 w-4 h-4 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="shadow-theme backdrop-blur-sm p-6 card-theme">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-r from-green-500 to-blue-500 p-2 rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-bold text-theme-primary text-xl">فعالیت‌های اخیر</h2>
            </div>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 bg-gray-50/50 dark:bg-gray-800/50 p-3 rounded-lg">
                  <div className={`p-1.5 rounded-full flex-shrink-0 ${
                    activity.type === 'asset' ? 'bg-blue-100 dark:bg-blue-900' :
                    activity.type === 'assignment' ? 'bg-green-100 dark:bg-green-900' :
                    activity.type === 'user' ? 'bg-purple-100 dark:bg-purple-900' :
                    'bg-orange-100 dark:bg-orange-900'
                  }`}>
                    {activity.type === 'asset' ? <Boxes className="w-3 h-3 text-blue-600 dark:text-blue-400" /> :
                     activity.type === 'assignment' ? <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" /> :
                     activity.type === 'user' ? <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" /> :
                     <Target className="w-3 h-3 text-orange-600 dark:text-orange-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-theme-primary text-sm">{activity.action}</p>
                    <p className="text-theme-secondary text-sm truncate">{activity.item}</p>
                    <p className="mt-1 text-theme-muted text-xs">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-theme border-t">
              <Link href="/dashboard/activity" className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm hover:underline">
                مشاهده همه فعالیت‌ها
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="shadow-theme backdrop-blur-sm p-6 card-theme">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-bold text-theme-primary text-xl">نمای کلی عملکرد</h2>
          </div>
          <Link href="/dashboard/reports" className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
            گزارش‌های تفصیلی
          </Link>
        </div>
        <div className="gap-6 grid grid-cols-1 md:grid-cols-3">
          <div className="bg-gradient-to-br from-blue-50 dark:from-blue-950 to-indigo-50 dark:to-indigo-950 p-4 rounded-lg text-center">
            <div className="mb-2 font-bold text-blue-600 dark:text-blue-400 text-2xl">۹۲%</div>
            <div className="text-theme-secondary text-sm">بهره‌وری سیستم</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 dark:from-green-950 to-emerald-50 dark:to-emerald-950 p-4 rounded-lg text-center">
            <div className="mb-2 font-bold text-green-600 dark:text-green-400 text-2xl">۹۷%</div>
            <div className="text-theme-secondary text-sm">رضایت کاربران</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 dark:from-purple-950 to-pink-50 dark:to-pink-950 p-4 rounded-lg text-center">
            <div className="mb-2 font-bold text-purple-600 dark:text-purple-400 text-2xl">۹۵%</div>
            <div className="text-theme-secondary text-sm">دقت داده‌ها</div>
          </div>
        </div>
      </div>
    </div>
  );
}
