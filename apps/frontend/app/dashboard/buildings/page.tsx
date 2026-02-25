"use client";
import React from 'react';
import { Plus, Trash2, Edit, Building } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type BuildingType = {
  id: string;
  name: string;
  address?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export default function BuildingsPage() {
  React.useEffect(() => {
    document.title = 'ساختمان‌ها | Arzesh ERP';
  }, []);

  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<BuildingType> | null>(null);
  const [loading, setLoading] = React.useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function loadBuildings() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/buildings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBuildings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load buildings:', e);
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadBuildings();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name?.trim()) return;

    try {
      setLoading(true);
      const method = editing.id ? 'PATCH' : 'POST';
      const url = editing.id ? `${API}/buildings/${editing.id}` : `${API}/buildings`;
      
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
      await loadBuildings();
    } catch (e) {
      console.error('Failed to save building:', e);
      alert('خطا در ذخیره ساختمان');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('آیا از حذف این ساختمان اطمینان دارید؟')) return;

    try {
      await fetch(`${API}/buildings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadBuildings();
    } catch (e) {
      console.error('Failed to delete building:', e);
      alert('خطا در حذف ساختمان');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-2xl">ساختمان‌ها</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm">
            مدیریت ساختمان‌های سازمان
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
          ساختمان جدید
        </button>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300 text-xs text-right uppercase tracking-wider">
                  نام ساختمان
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  آدرس
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
            <tbody>
              {buildings.map((building) => (
                <tr key={building.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="ml-3 w-5 h-5 text-gray-400" />
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {building.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 dark:text-gray-100 text-sm">
                      {building.address || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 dark:text-gray-100 text-sm">
                      {building.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                    {new Date(building.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="space-x-2 space-x-reverse px-6 py-4 font-medium text-sm whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(building);
                        setOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:hover:text-blue-300 dark:text-blue-400"
                    >
                      <Edit className="w-4 h-4" />
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDelete(building.id)}
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
          {buildings.length === 0 && (
            <div className="py-8 text-gray-500 dark:text-gray-400 text-center">
              {loading ? 'در حال بارگیری...' : 'هیچ ساختمانی یافت نشد'}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 shadow-xl mx-4 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-gray-200 dark:border-gray-700 border-b">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {editing?.id ? 'ویرایش ساختمان' : 'ساختمان جدید'}
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  نام ساختمان *
                </label>
                <input
                  type="text"
                  required
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.name || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="نام ساختمان را وارد کنید"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  آدرس
                </label>
                <input
                  type="text"
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.address || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="آدرس ساختمان"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  توضیحات
                </label>
                <textarea
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  rows={3}
                  value={editing?.description || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="توضیحات اضافی"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-gray-200 dark:border-gray-700 border-t">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={loading || !editing?.name?.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white transition-colors disabled:cursor-not-allowed"
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
