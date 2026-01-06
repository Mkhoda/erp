"use client";
import React from 'react';
import { Plus, Trash2, Edit, MapPin } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Department = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export default function DepartmentsPage() {
  React.useEffect(() => {
    document.title = 'دپارتمان‌ها | Arzesh ERP';
  }, []);

  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Department> | null>(null);
  const [loading, setLoading] = React.useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function loadDepartments() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load departments:', e);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDepartments();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name?.trim()) return;

    try {
      setLoading(true);
      const method = editing.id ? 'PATCH' : 'POST';
      const url = editing.id ? `${API}/departments/${editing.id}` : `${API}/departments`;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editing)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setOpen(false);
      setEditing(null);
      await loadDepartments();
    } catch (e) {
      console.error('Failed to save department:', e);
      alert('خطا در ذخیره دپارتمان');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('آیا از حذف این دپارتمان اطمینان دارید؟')) return;

    try {
      await fetch(`${API}/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadDepartments();
    } catch (e) {
      console.error('Failed to delete department:', e);
      alert('خطا در حذف دپارتمان');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-2xl">دپارتمان‌ها</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm">
            مدیریت دپارتمان‌های سازمان
          </p>
        </div>
        <button
          onClick={() => {
            setEditing({});
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 shadow-lg px-4 py-2.5 rounded-xl font-medium text-white text-sm btn-primary"
        >
          <Plus className="w-4 h-4" />
          دپارتمان جدید
        </button>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-xs text-right uppercase tracking-wider">
                  نام دپارتمان
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  توضیحات
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  تاریخ ایجاد
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {departments.map((department) => (
                <tr key={department.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="ml-3 w-5 h-5 text-gray-400" />
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {department.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 dark:text-gray-100 text-sm">
                      {department.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                    {new Date(department.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="space-x-2 space-x-reverse px-6 py-4 font-medium text-sm whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(department);
                        setOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:hover:text-blue-300 dark:text-blue-400"
                    >
                      <Edit className="w-4 h-4" />
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDelete(department.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 dark:hover:text-red-300 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {departments.length === 0 && (
            <div className="py-8 text-gray-500 dark:text-gray-400 text-center">
              {loading ? 'در حال بارگیری...' : 'هیچ دپارتمانی یافت نشد'}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Modal */}
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/60 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-xl mx-4 border border-white/20 dark:border-gray-700/30 rounded-2xl w-full max-w-md glass-card">
            <div className="flex justify-between items-center p-6 border-gray-300/30 dark:border-gray-600/30 border-b">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                {editing?.id ? 'ویرایش دپارتمان' : 'دپارتمان جدید'}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div>
                <label className="block mb-2 font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  نام دپارتمان *
                </label>
                <input
                  type="text"
                  required
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-3 border border-gray-300/50 dark:border-gray-600/50 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100 transition-all duration-200 glass-card"
                  value={editing?.name || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="نام دپارتمان را وارد کنید"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  توضیحات
                </label>
                <textarea
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-3 border border-gray-300/50 dark:border-gray-600/50 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100 transition-all duration-200 resize-none glass-card"
                  rows={3}
                  value={editing?.description || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="توضیحات اضافی"
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-gray-300/50 dark:border-gray-600/50 border-t">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-gray-200/80 hover:bg-gray-300/80 dark:bg-gray-700/80 dark:hover:bg-gray-600/80 backdrop-blur-sm px-6 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-all duration-200"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={loading || !editing?.name?.trim()}
                  className="disabled:opacity-50 shadow-lg px-6 py-2.5 rounded-xl font-medium text-white disabled:cursor-not-allowed btn-primary"
                >
                  {loading ? 'در حال ذخیره...' : 'ذخیره'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
