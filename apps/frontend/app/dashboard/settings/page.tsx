"use client";
import React from 'react';
import { Settings as SettingsIcon, Globe, Smartphone, Database, Save, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  React.useEffect(() => { document.title = "تنظیمات | Arzesh AI"; }, []);

  const [activeTab, setActiveTab] = React.useState('general');
  const [saved, setSaved] = React.useState(false);
  const [general, setGeneral] = React.useState({ siteName: 'سامانه مدیریت دارایی ارزش', currency: 'IRR', language: 'fa' });

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2500); }

  const tabs = [
    { id: 'general', label: 'عمومی', icon: Globe },
    { id: 'pwa', label: 'اپلیکیشن', icon: Smartphone },
    { id: 'database', label: 'پایگاه داده', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card-theme card-theme-body flex items-center gap-3">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">تنظیمات سیستم</h1>
          <p className="text-sm text-theme-secondary">پیکربندی عمومی سامانه</p>
        </div>
      </div>

      <div className="card-theme">
        <div className="flex border-b border-theme overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-theme-secondary hover:text-theme-primary'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="card-theme-body">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">نام سامانه</label>
                <input className="input-theme w-full" value={general.siteName}
                  onChange={e => setGeneral(s => ({ ...s, siteName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">واحد پول</label>
                <select className="select-theme w-full" value={general.currency}
                  onChange={e => setGeneral(s => ({ ...s, currency: e.target.value }))}>
                  <option value="IRR">ریال ایران (IRR)</option>
                  <option value="IRT">تومان</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1.5">زبان</label>
                <select className="select-theme w-full" value={general.language}
                  onChange={e => setGeneral(s => ({ ...s, language: e.target.value }))}>
                  <option value="fa">فارسی</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <p className="text-sm text-theme-secondary">تنظیمات نصب و کش اپلیکیشن موبایل</p>
              {[
                { label: 'فعال‌سازی کش خودکار', on: true },
                { label: 'نمایش پیام نصب اپلیکیشن', on: true },
                { label: 'بروزرسانی خودکار', on: false },
              ].map((item, i) => (
                <label key={i} className="flex items-center gap-3 p-3 rounded-lg bg-theme-secondary cursor-pointer">
                  <input type="checkbox" className="rounded w-4 h-4 accent-blue-600" defaultChecked={item.on} />
                  <span className="text-sm text-theme-primary">{item.label}</span>
                </label>
              ))}
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                پشتیبان‌گیری از دیتابیس را از سرور با دستور{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">./backup.sh</code> انجام دهید.
              </div>
              <button className="btn-theme-secondary flex items-center gap-2 opacity-50 cursor-not-allowed text-sm" disabled>
                بازیابی پشتیبان (غیرفعال)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-theme-primary flex items-center gap-2">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'ذخیره شد' : 'ذخیره تغییرات'}
        </button>
      </div>
    </div>
  );
}
