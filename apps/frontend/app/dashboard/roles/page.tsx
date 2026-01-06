"use client";
import React from 'react';
import { Shield, Crown, User, Star, AlertCircle } from 'lucide-react';

// Backend defines roles as a fixed enum: 'ADMIN' | 'MANAGER' | 'USER' | 'EXPERT'
type StaticRole = { 
  id: 'ADMIN' | 'MANAGER' | 'USER' | 'EXPERT'; 
  name: string; 
  description?: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
};

const ROLES: StaticRole[] = [
  { 
    id: 'ADMIN', 
    name: 'مدیر سیستم', 
    description: 'دسترسی کامل به تمامی بخش‌های سیستم و مدیریت کلی', 
    icon: Crown,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950'
  },
  { 
    id: 'MANAGER', 
    name: 'مدیر', 
    description: 'مدیریت بخش‌ها، کاربران و نظارت بر فرآیندها', 
    icon: Shield,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950'
  },
  { 
    id: 'EXPERT', 
    name: 'متخصص', 
    description: 'متخصص حسابداری دارایی با دسترسی به ویرایش اطلاعات مالی', 
    icon: Star,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950'
  },
  { 
    id: 'USER', 
    name: 'کاربر عادی', 
    description: 'دسترسی استاندارد به مشاهده و ورود اطلاعات پایه', 
    icon: User,
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800'
  },
];

export default function RolesPage(){
  React.useEffect(() => {
    document.title = 'مدیریت نقش‌ها | Arzesh ERP';
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-theme-card shadow-theme backdrop-blur-sm p-6 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-theme-primary text-2xl">مدیریت نقش‌ها</h1>
            <p className="mt-1 text-theme-secondary">نمایش و توضیح نقش‌های مختلف سیستم</p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-50/70 dark:bg-amber-950/70 backdrop-blur-sm p-4 border border-amber-200 dark:border-amber-800 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="flex-shrink-0 mt-0.5 w-5 h-5 text-amber-600 dark:text-amber-400" />
          <div>
            <h3 className="font-medium text-amber-800 dark:text-amber-200">توجه</h3>
            <p className="mt-1 text-amber-700 dark:text-amber-300 text-sm">
              نقش‌ها در سیستم از قبل تعریف شده و قابل تغییر نیستند. برای تخصیص نقش به کاربران، از بخش «مدیریت کاربران» استفاده کنید.
            </p>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="gap-6 grid sm:grid-cols-2 lg:grid-cols-2">
        {ROLES.map(role => (
          <div 
            key={role.id} 
            className="group shadow-theme hover:shadow-theme-lg backdrop-blur-sm overflow-hidden transition-all duration-200 card-theme"
          >
            <div className={`p-6 ${role.bgColor} border-b border-theme`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${role.color.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-').replace('-600', '-100').replace('-400', '-900')} shadow-sm`}>
                  <role.icon className={`w-6 h-6 ${role.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-theme-primary text-lg">{role.name}</h3>
                  <p className={`text-sm font-medium ${role.color} uppercase tracking-wide`}>{role.id}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <p className="text-theme-secondary leading-relaxed">{role.description}</p>
              
              {/* Role Permissions */}
              <div className="mt-4 pt-4 border-theme border-t">
                <h4 className="mb-3 font-semibold text-theme-primary text-sm">دسترسی‌های کلیدی:</h4>
                <div className="space-y-2">
                  {role.id === 'ADMIN' && (
                    <>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-red-500 rounded-full w-1.5 h-1.5"></div>
                        مدیریت کامل کاربران و نقش‌ها
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-red-500 rounded-full w-1.5 h-1.5"></div>
                        تنظیمات سیستم و پیکربندی
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-red-500 rounded-full w-1.5 h-1.5"></div>
                        دسترسی به تمامی گزارش‌ها
                      </div>
                    </>
                  )}
                  
                  {role.id === 'MANAGER' && (
                    <>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-purple-500 rounded-full w-1.5 h-1.5"></div>
                        مدیریت دارایی‌ها و واگذاری‌ها
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-purple-500 rounded-full w-1.5 h-1.5"></div>
                        نظارت بر عملکرد تیم
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-purple-500 rounded-full w-1.5 h-1.5"></div>
                        دسترسی به گزارش‌های مدیریتی
                      </div>
                    </>
                  )}
                  
                  {role.id === 'EXPERT' && (
                    <>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-blue-500 rounded-full w-1.5 h-1.5"></div>
                        ویرایش اطلاعات مالی دارایی‌ها
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-blue-500 rounded-full w-1.5 h-1.5"></div>
                        دسترسی به بخش حسابداری
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-blue-500 rounded-full w-1.5 h-1.5"></div>
                        تهیه گزارش‌های مالی
                      </div>
                    </>
                  )}
                  
                  {role.id === 'USER' && (
                    <>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-gray-500 rounded-full w-1.5 h-1.5"></div>
                        مشاهده اطلاعات دارایی‌ها
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-gray-500 rounded-full w-1.5 h-1.5"></div>
                        ثبت درخواست‌های جدید
                      </div>
                      <div className="flex items-center gap-2 text-theme-secondary text-sm">
                        <div className="bg-gray-500 rounded-full w-1.5 h-1.5"></div>
                        دسترسی به پروفایل شخصی
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50/70 dark:bg-blue-950/70 backdrop-blur-sm p-6 border border-blue-200 dark:border-blue-800 rounded-xl">
        <h3 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">راهنمای تخصیص نقش</h3>
        <p className="mb-4 text-blue-800 dark:text-blue-200 text-sm">
          برای تخصیص نقش جدید به کاربران یا تغییر نقش موجود، به بخش «مدیریت کاربران» مراجعه کرده و گزینه ویرایش کاربر مورد نظر را انتخاب کنید.
        </p>
        <a 
          href="/dashboard/users" 
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white text-sm transition-colors"
        >
          <User className="w-4 h-4" />
          رفتن به مدیریت کاربران
        </a>
      </div>
    </div>
  );
}
