"use client";
import React from "react";
import { RefreshCw, BookOpen, ToggleLeft, ToggleRight, Plus } from "lucide-react";
import { useToast } from "../../components/ui/Toast";
import { pageTitle } from "../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type PageRow = { id: string; path: string; label: string; isActive: boolean; createdAt: string };

export default function PagesPage() {
  React.useEffect(() => { document.title = pageTitle("مدیریت صفحات"); }, []);
  const toast = useToast();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authH = { Authorization: `Bearer ${token}` };

  const [pages, setPages] = React.useState<PageRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [toggling, setToggling] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { const r = await fetch(`${API}/permissions/pages`, { headers: authH }); if (r.ok) setPages(await r.json()); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function syncPages() {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/permissions/pages/sync`, { method: 'POST', headers: authH });
      if (r.ok) { const d = await r.json(); toast.success(`${d.created} صفحه جدید اضافه شد`); await load(); }
    } finally { setSyncing(false); }
  }

  async function toggleActive(row: PageRow) {
    setToggling(row.id);
    try {
      const r = await fetch(`${API}/permissions/pages/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (r.ok) setPages(prev => prev.map(p => p.id === row.id ? { ...p, isActive: !row.isActive } : p));
    } finally { setToggling(null); }
  }

  const active = pages.filter(p => p.isActive).length;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl w-10 h-10">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">مدیریت صفحات</h1>
                <p className="text-theme-muted text-sm">فعال/غیرفعال کردن صفحات داشبورد</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={load} disabled={loading} className="btn-theme-secondary text-sm gap-1.5 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تازه‌سازی
              </button>
              <button onClick={syncPages} disabled={syncing} className="btn-theme-primary text-sm gap-1.5 disabled:opacity-50">
                <Plus className="w-4 h-4" /> {syncing ? '...' : 'همگام‌سازی'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 text-sm">
              <ToggleRight className="w-4 h-4" /> {active} فعال
            </div>
            <div className="inline-flex items-center gap-1.5 bg-theme-secondary border border-theme px-3 py-1.5 rounded-lg text-theme-muted text-sm">
              <ToggleLeft className="w-4 h-4" /> {pages.length - active} غیرفعال
            </div>
          </div>
          <p className="mt-3 text-theme-muted text-xs">صفحات غیرفعال از منوی همه کاربران پنهان می‌شوند.</p>
        </div>
      </div>

      <div className="table-theme-container">
        {loading ? (
          <div className="py-12 text-center text-theme-muted">در حال بارگیری...</div>
        ) : pages.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-theme-muted mx-auto" />
            <p className="text-theme-muted text-sm">هیچ صفحه‌ای ثبت نشده</p>
            <button onClick={syncPages} disabled={syncing} className="btn-theme-primary text-sm">
              <Plus className="w-4 h-4" /> همگام‌سازی اولیه
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th>عنوان صفحه</th>
                  <th>مسیر</th>
                  <th className="text-center">وضعیت</th>
                  <th className="text-center">فعال/غیرفعال</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(row => (
                  <tr key={row.id} className={!row.isActive ? 'opacity-50' : ''}>
                    <td><span className="font-medium text-theme-primary">{row.label}</span></td>
                    <td><code className="bg-theme-secondary px-2 py-0.5 rounded text-xs font-mono text-theme-secondary">{row.path}</code></td>
                    <td className="text-center">
                      {row.isActive ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 text-xs">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> فعال
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-theme-secondary border border-theme px-2 py-0.5 rounded-full text-theme-muted text-xs">
                          <span className="w-1.5 h-1.5 bg-theme-muted rounded-full" /> غیرفعال
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <button onClick={() => toggleActive(row)} disabled={toggling === row.id} className="disabled:opacity-50 transition-colors">
                        {row.isActive
                          ? <ToggleRight className="w-8 h-8 text-emerald-500 hover:text-emerald-600" />
                          : <ToggleLeft className="w-8 h-8 text-theme-muted hover:text-theme-secondary" />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
