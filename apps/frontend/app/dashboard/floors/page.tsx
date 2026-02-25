"use client";
import React from 'react';
import { Plus, Trash2, Edit, Layers, Building } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Floor = {
  id: string;
  name: string;
  buildingId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  building?: {
    id: string;
    name: string;
  };
};

type BuildingType = {
  id: string;
  name: string;
};

export default function FloorsPage() {
  React.useEffect(() => {
    document.title = 'طبقات | Arzesh ERP';
  }, []);

  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Floor> | null>(null);
  const [loading, setLoading] = React.useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function loadFloors() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/floors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFloors(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load floors:', e);
      setFloors([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadBuildings() {
    try {
      const res = await fetch(`${API}/buildings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBuildings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load buildings:', e);
      setBuildings([]);
    }
  }

  React.useEffect(() => {
    loadFloors();
    loadBuildings();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name?.trim() || !editing.buildingId) return;

    try {
      setLoading(true);
      const method = editing.id ? 'PATCH' : 'POST';
      const url = editing.id ? `${API}/floors/${editing.id}` : `${API}/floors`;
      
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
      await loadFloors();
    } catch (e) {
      console.error('Failed to save floor:', e);
      alert('خطا در ذخیره طبقه');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('آیا از حذف این طبقه اطمینان دارید؟')) return;

    try {
      await fetch(`${API}/floors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadFloors();
    } catch (e) {
      console.error('Failed to delete floor:', e);
      alert('خطا در حذف طبقه');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-2xl">طبقات</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm">
            مدیریت طبقات ساختمان‌ها
          </p>
        </div>
        <button
          onClick={() => {
            setEditing({});
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          طبقه جدید
        </button>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  نام طبقه
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  ساختمان
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
              {floors.map((floor) => (
                <tr key={floor.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Layers className="ml-3 w-5 h-5 text-gray-400" />
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {floor.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="ml-2 w-4 h-4 text-gray-400" />
                      <div className="text-gray-900 dark:text-gray-100 text-sm">
                        {floor.building?.name || 'نامشخص'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 dark:text-gray-100 text-sm">
                      {floor.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                    {new Date(floor.createdAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="space-x-2 space-x-reverse px-6 py-4 font-medium text-sm whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(floor);
                        setOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:hover:text-blue-300 dark:text-blue-400"
                    >
                      <Edit className="w-4 h-4" />
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDelete(floor.id)}
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
          {floors.length === 0 && (
            <div className="py-8 text-gray-500 dark:text-gray-400 text-center">
              {loading ? 'در حال بارگیری...' : 'هیچ طبقه‌ای یافت نشد'}
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
                {editing?.id ? 'ویرایش طبقه' : 'طبقه جدید'}
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
                  ساختمان *
                </label>
                <select
                  required
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.buildingId || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, buildingId: e.target.value }))}
                >
                  <option value="">انتخاب ساختمان</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  نام طبقه *
                </label>
                <input
                  type="text"
                  required
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.name || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="نام طبقه را وارد کنید"
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
                  disabled={loading || !editing?.name?.trim() || !editing?.buildingId}
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
