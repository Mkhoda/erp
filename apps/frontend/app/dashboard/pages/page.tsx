"use client";
import React from 'react';
import { RefreshCw, BookOpen, ToggleLeft, ToggleRight, Plus } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type PageRow = {
  id: string;
  path: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function PagesPage() {
  React.useEffect(() => { document.title = 'مدیریت صفحات | Arzesh ERP'; }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authH = { Authorization: `Bearer ${token}` };

  const [pages, setPages] = React.useState<PageRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [toggling, setToggling] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/permissions/pages`, { headers: authH });
      if (r.ok) setPages(await r.json());
    } finally { setLoading(false); }
  }

  React.useEffect(() => { load(); }, []);

  async function syncPages() {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/permissions/pages/sync`, { method: 'POST', headers: authH });
      if (r.ok) {
        const d = await r.json();
        alert(`${d.created} صفحه جدید اضافه شد (مجموع: ${d.total})`);
        await load();
      }
    } finally { setSyncing(false); }
  }

  async function toggleActive(row: PageRow) {
    setToggling(row.id);
    try {
      const r = await fetch(`${API}/permissions/pages/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (r.ok) {
        setPages(prev => prev.map(p => p.id === row.id ? { ...p, isActive: !row.isActive } : p));
      }
    } finally { setToggling(null); }
  }

  const active = pages.filter(p => p.isActive).length;
  const inactive = pages.length - active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-gray-100 text-xl">مدیریت صفحات</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">فعال/غیرفعال کردن صفحات داشبورد</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تازه‌سازی
            </button>
            <button onClick={syncPages} disabled={syncing} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" /> {syncing ? '...' : 'همگام‌سازی صفحات'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-3 py-1.5 rounded-lg">
            <ToggleRight className="w-4 h-4" />
            <span>{active} فعال</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            <ToggleLeft className="w-4 h-4" />
            <span>{inactive} غیرفعال</span>
          </div>
        </div>

        <p className="mt-3 text-gray-500 dark:text-gray-400 text-xs">
          «همگام‌سازی» صفحات تعریف‌شده در کد را به پایگاه داده اضافه می‌کند و برچسب‌ها را به‌روز می‌کند.
          صفحات غیرفعال از منوی همه کاربران (حتی مدیر سیستم) پنهان می‌شوند.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white/70 dark:bg-gray-900/70 border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center text-gray-400 py-10">در حال بارگیری...</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-gray-400 text-sm">هیچ صفحه‌ای در پایگاه داده وجود ندارد</p>
            <button onClick={syncPages} disabled={syncing} className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm">
              <Plus className="w-4 h-4" /> همگام‌سازی صفحات اولیه
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-gray-700/50">
              <tr>
                <th className="px-5 py-3 text-right font-medium text-gray-500 text-xs w-1/3">عنوان صفحه</th>
                <th className="px-3 py-3 text-right font-medium text-gray-500 text-xs">مسیر</th>
                <th className="px-3 py-3 text-center font-medium text-gray-500 text-xs w-32">وضعیت</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500 text-xs w-28">فعال/غیرفعال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pages.map(row => (
                <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${!row.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{row.label}</td>
                  <td className="px-3 py-3">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                      {row.path}
                    </code>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> فعال
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" /> غیرفعال
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleActive(row)}
                      disabled={toggling === row.id}
                      title={row.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                      className="disabled:opacity-50 transition-colors"
                    >
                      {row.isActive ? (
                        <ToggleRight className="w-8 h-8 text-green-500 hover:text-green-600" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-400 hover:text-gray-500" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
