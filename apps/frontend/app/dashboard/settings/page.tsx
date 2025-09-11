"use client";
import React from 'react';
import { Settings as SettingsIcon, Globe, Smartphone, Building, MapPin, Users, Database } from 'lucide-react';

export default function SettingsPage(){
  React.useEffect(() => {
    document.title = 'تنظیمات سیستم | Arzesh ERP';
  }, []);

  const [activeTab, setActiveTab] = React.useState('general');

  const tabs = [
    { id: 'general', label: 'عمومی', icon: Globe },
    { id: 'departments', label: 'دپارتمان‌ها', icon: Users },
    { id: 'locations', label: 'مکان‌ها', icon: MapPin },
    { id: 'pwa', label: 'اپلیکیشن', icon: Smartphone },
    { id: 'database', label: 'پایگاه داده', icon: Database },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-gray-100 text-2xl">تنظیمات سیستم</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">پیکربندی و مدیریت تنظیمات سیستم</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/50'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">تنظیمات عمومی</h2>
            <div className="gap-6 grid sm:grid-cols-2">
              <div className="bg-gradient-to-br from-blue-50 dark:from-blue-950 to-indigo-50 dark:to-indigo-950 p-4 border border-blue-200/50 dark:border-blue-800/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">زبان و منطقه</h3>
                </div>
                <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">تنظیمات زبان، تاریخ و واحد پول</p>
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300 text-sm">زبان پیش‌فرض</label>
                    <select className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md w-full text-sm">
                      <option value="fa">فارسی</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300 text-sm">واحد پول</label>
                    <select className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md w-full text-sm">
                      <option value="IRR">ریال ایران</option>
                      <option value="USD">دلار آمریکا</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 dark:from-green-950 to-emerald-50 dark:to-emerald-950 p-4 border border-green-200/50 dark:border-green-800/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">اطلاعات سازمان</h3>
                </div>
                <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">نام و اطلاعات تماس سازمان</p>
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300 text-sm">نام سازمان</label>
                    <input 
                      type="text" 
                      placeholder="نام سازمان خود را وارد کنید"
                      className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300 text-sm">آدرس</label>
                    <textarea 
                      placeholder="آدرس سازمان"
                      className="bg-white dark:bg-gray-800 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md w-full text-sm"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">مدیریت دپارتمان‌ها</h2>
            <div className="bg-gradient-to-br from-blue-50 dark:from-blue-950 to-indigo-50 dark:to-indigo-950 p-4 border border-blue-200/50 dark:border-blue-800/50 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400 text-sm">این بخش برای مدیریت دپارتمان‌های سازمان در نظر گرفته شده است.</p>
              <div className="mt-4">
                <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white text-sm transition-colors">
                  افزودن دپارتمان جدید
                </button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'locations' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">مدیریت مکان‌ها</h2>
            <div className="bg-gradient-to-br from-green-50 dark:from-green-950 to-emerald-50 dark:to-emerald-950 p-4 border border-green-200/50 dark:border-green-800/50 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400 text-sm">مدیریت ساختمان‌ها، طبقات و اتاق‌ها</p>
              <div className="mt-4">
                <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white text-sm transition-colors">
                  افزودن مکان جدید
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pwa' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">تنظیمات اپلیکیشن</h2>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50 dark:from-purple-950 to-pink-50 dark:to-pink-950 p-4 border border-purple-200/50 dark:border-purple-800/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">PWA (Progressive Web App)</h3>
                </div>
                <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">تنظیمات نصب و کش اپلیکیشن</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="border-gray-300 rounded" defaultChecked />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">فعال‌سازی کش خودکار</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="border-gray-300 rounded" defaultChecked />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">نمایش پیام نصب اپلیکیشن</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="border-gray-300 rounded" />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">بروزرسانی خودکار</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">مدیریت پایگاه داده</h2>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-orange-50 dark:from-orange-950 to-red-50 dark:to-red-950 p-4 border border-orange-200/50 dark:border-orange-800/50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">پشتیبان‌گیری</h3>
                </div>
                <p className="mb-4 text-gray-600 dark:text-gray-400 text-sm">ایجاد و بازیابی نسخه پشتیبان</p>
                <div className="flex gap-3">
                  <button className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-white text-sm transition-colors">
                    ایجاد پشتیبان
                  </button>
                  <button className="hover:bg-orange-50 dark:hover:bg-orange-950 px-4 py-2 border border-orange-600 rounded-lg text-orange-600 dark:text-orange-400 text-sm transition-colors">
                    بازیابی پشتیبان
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="bg-gradient-to-r from-purple-600 hover:from-purple-700 to-purple-700 hover:to-purple-800 shadow-sm px-6 py-2 rounded-lg font-medium text-white transition-all duration-200">
          ذخیره تغییرات
        </button>
      </div>
    </div>
  );
}
