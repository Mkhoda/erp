"use client";
import React from 'react';
import { Plus, Trash2, Edit, Home, Building, Layers } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Room = {
  id: string;
  name: string;
  buildingId: string;
  floorId?: string;
  description?: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
  building?: {
    id: string;
    name: string;
  };
  floor?: {
    id: string;
    name: string;
  };
};

type BuildingType = {
  id: string;
  name: string;
};

type Floor = {
  id: string;
  name: string;
  buildingId: string;
};

export default function RoomsPage() {
  React.useEffect(() => {
    document.title = 'اتاق‌ها | Arzesh ERP';
  }, []);

  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [buildings, setBuildings] = React.useState<BuildingType[]>([]);
  const [floors, setFloors] = React.useState<Floor[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Partial<Room> | null>(null);
  const [loading, setLoading] = React.useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function loadRooms() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load rooms:', e);
      setRooms([]);
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

  async function loadFloors() {
    try {
      const res = await fetch(`${API}/floors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFloors(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load floors:', e);
      setFloors([]);
    }
  }

  React.useEffect(() => {
    loadRooms();
    loadBuildings();
    loadFloors();
  }, []);

  const filteredFloors = floors.filter(f => f.buildingId === editing?.buildingId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name?.trim() || !editing.buildingId) return;

    try {
      setLoading(true);
      const method = editing.id ? 'PATCH' : 'POST';
      const url = editing.id ? `${API}/rooms/${editing.id}` : `${API}/rooms`;
      
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
      await loadRooms();
    } catch (e) {
      console.error('Failed to save room:', e);
      alert('خطا در ذخیره اتاق');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('آیا از حذف این اتاق اطمینان دارید؟')) return;

    try {
      await fetch(`${API}/rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadRooms();
    } catch (e) {
      console.error('Failed to delete room:', e);
      alert('خطا در حذف اتاق');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-2xl">اتاق‌ها</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm">
            مدیریت اتاق‌های ساختمان‌ها
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
          اتاق جدید
        </button>
      </div>

      <div className="table-theme-container">
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  نام اتاق
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  ساختمان
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  طبقه
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  ظرفیت
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  توضیحات
                </th>
                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Home className="ml-3 w-5 h-5 text-gray-400" />
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {room.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="ml-2 w-4 h-4 text-gray-400" />
                      <div className="text-gray-900 dark:text-gray-100 text-sm">
                        {room.building?.name || 'نامشخص'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Layers className="ml-2 w-4 h-4 text-gray-400" />
                      <div className="text-gray-900 dark:text-gray-100 text-sm">
                        {room.floor?.name || '-'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
                    {room.capacity || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 dark:text-gray-100 text-sm">
                      {room.description || '-'}
                    </div>
                  </td>
                  <td className="space-x-2 space-x-reverse px-6 py-4 font-medium text-sm whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(room);
                        setOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:hover:text-blue-300 dark:text-blue-400"
                    >
                      <Edit className="w-4 h-4" />
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
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
          {rooms.length === 0 && (
            <div className="py-8 text-gray-500 dark:text-gray-400 text-center">
              {loading ? 'در حال بارگیری...' : 'هیچ اتاقی یافت نشد'}
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
                {editing?.id ? 'ویرایش اتاق' : 'اتاق جدید'}
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
                  onChange={(e) => setEditing(prev => ({ ...prev, buildingId: e.target.value, floorId: '' }))}
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
                  طبقه
                </label>
                <select
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.floorId || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, floorId: e.target.value }))}
                  disabled={!editing?.buildingId}
                >
                  <option value="">انتخاب طبقه (اختیاری)</option>
                  {filteredFloors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  نام اتاق *
                </label>
                <input
                  type="text"
                  required
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.name || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="نام اتاق را وارد کنید"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">
                  ظرفیت
                </label>
                <input
                  type="number"
                  min="1"
                  className="bg-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={editing?.capacity || ''}
                  onChange={(e) => setEditing(prev => ({ ...prev, capacity: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="ظرفیت اتاق"
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
