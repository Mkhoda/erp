"use client";
import React from 'react';
import { Settings as SettingsIcon, Globe, Smartphone, Building, MapPin, Users, Database } from 'lucide-react';

export default function SettingsPage() {
  React.useEffect(() => { document.title = 'تنظیمات سیستم | Arzesh ERP'; }, []);
  const [activeTab, setActiveTab] = React.useState('general');

  const tabs = [
    { id: 'general', label: 'عمومی', Icon: Globe },
    { id: 'departments', label: 'دپارتمان‌ها', Icon: Users },
    { id: 'locations', label: 'مکان‌ها', Icon: MapPin },
    { id: 'pwa', label: 'اپلیکیشن', Icon: Smartphone },
    { id: 'database', label: 'پایگاه داده', Icon: Database },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex items-center gap-3">
            <div className="flex justify-center items-center bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl w-10 h-10">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-theme-primary text-xl">تنظیمات سیستم</h1>
              <p className="text-theme-muted text-sm">پیکربندی و مدیریت تنظیمات</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card-theme overflow-hidden">
        <div className="flex overflow-x-auto border-theme border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30'
                  : 'border-transparent text-theme-muted hover:text-theme-secondary hover:bg-theme-hover'
              }`}
            >
              <tab.Icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card-theme-body">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h2 className="font-semibold text-theme-primary">تنظیمات عمومی</h2>
              <div className="gap-5 grid sm:grid-cols-2">
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-theme-primary">زبان و منطقه</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block mb-1.5 font-medium text-theme-secondary text-sm">زبان پیش‌فرض</label>
                      <select className="select-theme text-sm">
                        <option value="fa">فارسی</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-theme-secondary text-sm">واحد پول</label>
                      <select className="select-theme text-sm">
                        <option value="IRR">ریال ایران</option>
                        <option value="USD">دلار آمریکا</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/50 p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-theme-primary">اطلاعات سازمان</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block mb-1.5 font-medium text-theme-secondary text-sm">نام سازمان</label>
                      <input type="text" placeholder="نام سازمان" className="input-theme text-sm" />
                    </div>
                    <div>
                      <label className="block mb-1.5 font-medium text-theme-secondary text-sm">آدرس</label>
                      <textarea placeholder="آدرس سازمان" rows={2} className="input-theme text-sm resize-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'departments' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-theme-primary">مدیریت دپارتمان‌ها</h2>
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 p-4 rounded-xl">
                <p className="text-theme-secondary text-sm mb-3">برای مدیریت دپارتمان‌ها از صفحه اختصاصی استفاده کنید.</p>
                <a href="/dashboard/departments" className="btn-theme-primary text-sm inline-flex">رفتن به دپارتمان‌ها</a>
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-theme-primary">مدیریت مکان‌ها</h2>
              <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/50 p-4 rounded-xl">
                <p className="text-theme-secondary text-sm mb-3">مدیریت ساختمان‌ها، طبقات و اتاق‌ها</p>
                <div className="flex gap-2">
                  <a href="/dashboard/buildings" className="btn-theme-secondary text-sm inline-flex">ساختمان‌ها</a>
                  <a href="/dashboard/floors" className="btn-theme-secondary text-sm inline-flex">طبقات</a>
                  <a href="/dashboard/rooms" className="btn-theme-secondary text-sm inline-flex">اتاق‌ها</a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-theme-primary">تنظیمات اپلیکیشن PWA</h2>
              <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50 p-4 rounded-xl space-y-3">
                {[
                  { label: 'فعال‌سازی کش خودکار', on: true },
                  { label: 'نمایش پیام نصب اپلیکیشن', on: true },
                  { label: 'بروزرسانی خودکار', on: false },
                ].map((item, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" defaultChecked={item.on} className="rounded text-blue-600" />
                    <span className="text-theme-secondary text-sm">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-theme-primary">مدیریت پایگاه داده</h2>
              <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/50 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-theme-primary">پشتیبان‌گیری</h3>
                </div>
                <p className="text-theme-secondary text-sm mb-4">ایجاد و بازیابی نسخه پشتیبان</p>
                <div className="flex gap-3">
                  <button className="btn-theme-primary text-sm" style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>ایجاد پشتیبان</button>
                  <button className="btn-theme-secondary text-sm">بازیابی پشتیبان</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-theme-primary" style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>ذخیره تغییرات</button>
      </div>
    </div>
  );
}
