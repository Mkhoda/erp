"use client";
import React from 'react';
import Link from 'next/link';
import { Pencil, Trash2, List, LayoutGrid, Plus, Boxes, Upload, X, Image as ImageIcon } from 'lucide-react';

type Asset = {
  id: string;
  name: string;
  barcode: string;
  oldBarcode?: string;
  description?: string;
  typeId?: string;
  categoryId?: string;
  condition?: 'NEW' | 'USED_GOOD' | 'DEFECTIVE';
  availability?: 'AVAILABLE' | 'IN_USE' | 'CONSUMED' | 'MAINTENANCE' | 'RETIRED' | 'LOST';
  barcodeType?: 'QR' | 'CODE128';
  serialNumber?: string;
  location?: string;
  purchaseDate?: string;
  cost?: number;
  type?: { id: string; name: string };
  category?: { id: string; name: string };
  images?: Array<{ id: string; url: string; caption?: string }>;
};

type AssetType = {
  id: string;
  name: string;
};

type AssetCategory = {
  id: string;
  name: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AssetsPage() {
  React.useEffect(() => {
    document.title = 'مدیریت دارایی‌ها | Arzesh ERP';
  }, []);

  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = React.useState<AssetType[]>([]);
  const [assetCategories, setAssetCategories] = React.useState<AssetCategory[]>([]);
  const [view, setView] = React.useState<'list' | 'grid'>('list');
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Asset | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [selectedImages, setSelectedImages] = React.useState<File[]>([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    try {
      const res = await fetch(`${API}/assets`, { headers: { Authorization: `Bearer ${token}` }});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setAssets(arr as Asset[]);
    } catch (e) {
      console.error('Failed to load assets', e);
      setAssets([]);
    }
  }

  async function loadAssetTypes() {
    try {
      const res = await fetch(`${API}/asset-types`, { headers: { Authorization: `Bearer ${token}` }});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssetTypes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load asset types', e);
      setAssetTypes([]);
    }
  }

  async function loadAssetCategories() {
    try {
      const res = await fetch(`${API}/asset-categories`, { headers: { Authorization: `Bearer ${token}` }});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssetCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load asset categories', e);
      setAssetCategories([]);
    }
  }

  React.useEffect(() => { 
    load(); 
    loadAssetTypes();
    loadAssetCategories();
  }, []);

  const q = query.toLowerCase();
  const filtered = Array.isArray(assets)
    ? assets.filter(a => (a.name||'').toLowerCase().includes(q) || (a.barcode||'').toLowerCase().includes(q))
    : [];

  function onAdd() { 
    setEditing({ 
      id: '0', 
      name: '', 
      barcode: '',
      condition: 'NEW',
      availability: 'AVAILABLE',
      barcodeType: 'QR'
    } as any); 
    setSelectedImages([]);
    setOpen(true); 
  }
  
  function onEdit(a: Asset) { 
    setEditing(a); 
    setSelectedImages([]);
    setOpen(true); 
  }

  async function onDelete(id: string) {
    if (!confirm('حذف شود؟')) return;
    await fetch(`${API}/assets/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }});
    await load();
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setSelectedImages(prev => [...prev, ...files]);
  }

  function removeSelectedImage(index: number) {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  }

  async function uploadImages(assetId: string) {
    if (selectedImages.length === 0) return;
    
    setUploading(true);
    try {
      for (const file of selectedImages) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetId', assetId);
        
        await fetch(`${API}/uploads/asset-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      }
    } catch (e) {
      console.error('Failed to upload images:', e);
      alert('خطا در آپلود تصاویر');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || !editing.name || !editing.barcode) return;
    
    setLoading(true);
    try {
      const isNew = (editing as any).id === '0' || !(editing as any).id;
      const method = isNew ? 'POST' : 'PATCH';
      const url = isNew ? `${API}/assets` : `${API}/assets/${(editing as any).id}`;
      
      // Prepare data
      const assetData = {
        name: editing.name,
        barcode: editing.barcode,
        oldBarcode: editing.oldBarcode || null,
        description: editing.description || null,
        typeId: editing.typeId || null,
        categoryId: editing.categoryId || null,
        condition: editing.condition || 'NEW',
        availability: editing.availability || 'AVAILABLE',
        barcodeType: editing.barcodeType || 'QR',
        serialNumber: editing.serialNumber || null,
        location: editing.location || null,
        purchaseDate: editing.purchaseDate || null,
        cost: editing.cost || null,
      };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(assetData)
      });
      
      if (!res.ok) throw new Error('خطا در ذخیره');
      
      const savedAsset = await res.json();
      
      // Upload images if any
      if (selectedImages.length > 0) {
        await uploadImages(savedAsset.id);
      }
      
      setOpen(false); 
      setEditing(null);
      setSelectedImages([]);
      await load();
    } catch (e) {
      console.error('Submit error:', e);
      alert('خطا در ذخیره دارایی');
    } finally { 
      setLoading(false); 
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-4">
          <div>
            <h1 className="flex items-center gap-3 font-bold text-gray-900 dark:text-gray-100 text-2xl">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
                <Boxes className="w-6 h-6 text-white" />
              </div>
              مدیریت دارایی‌ها
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">مشاهده و مدیریت کلیه دارایی‌های سازمان</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button 
                onClick={() => setView('list')} 
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  view==='list'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <List className="w-4 h-4" /> فهرست
              </button>
              <button 
                onClick={() => setView('grid')} 
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  view==='grid'
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> کارت
              </button>
            </div>
            <button 
              onClick={onAdd} 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 hover:from-blue-700 to-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md px-4 py-2 rounded-lg font-medium text-white transition-all duration-200"
            >
              <Plus className="w-4 h-4" /> 
              افزودن دارایی
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/70 dark:bg-gray-900/70 shadow-sm backdrop-blur-sm p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-xl">
        <div className="flex sm:flex-row flex-col gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="جستجو در دارایی‌ها..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
            {filtered.length} دارایی یافت شد
          </div>
        </div>
      </div>

      {/* Assets Content */}
      <div className="table-theme-container">
        {view === 'list' ? (
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th className="px-6 py-4 font-medium text-right">بارکد</th>
                  <th className="px-6 py-4 font-medium text-right">نام</th>
                  <th className="px-6 py-4 font-medium text-right">نوع</th>
                  <th className="px-6 py-4 font-medium text-right">دسته</th>
                  <th className="px-6 py-4 font-medium text-right">وضعیت</th>
                  <th className="px-6 py-4 font-medium text-right">مکان</th>
                  <th className="px-6 py-4 font-medium text-right">اقدامات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td className="px-6 py-4 font-mono text-blue-600 dark:text-blue-400">
                      <Link href={`/dashboard/assets/${a.id}`} className="hover:underline">
                        {a.barcode}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                      <Link href={`/dashboard/assets/${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {a.type?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {a.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        a.availability === 'AVAILABLE' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        a.availability === 'IN_USE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        a.availability === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {a.availability === 'AVAILABLE' ? 'موجود' :
                         a.availability === 'IN_USE' ? 'در حال استفاده' :
                         a.availability === 'MAINTENANCE' ? 'تعمیرات' :
                         a.availability === 'RETIRED' ? 'خارج از رده' :
                         a.availability === 'LOST' ? 'مفقود' :
                         a.availability === 'CONSUMED' ? 'مصرف شده' : a.availability}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                      {a.location || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={()=>onEdit(a)} 
                          className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 px-3 py-1 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 text-xs transition-colors"
                        >
                          <Pencil className="w-3 h-3"/> ویرایش
                        </button>
                        <button 
                          onClick={()=>onDelete(a.id)} 
                          className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 px-3 py-1 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs transition-colors"
                        >
                          <Trash2 className="w-3 h-3"/> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <div className="gap-6 grid sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(a => (
                <div key={a.id} className="group bg-white/50 dark:bg-gray-800/50 hover:shadow-lg backdrop-blur-sm p-4 border border-gray-200/50 dark:border-gray-700/50 rounded-lg hover:scale-[1.02] transition-all duration-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:group-hover:text-blue-400 dark:text-gray-100 group-hover:text-blue-600 transition-colors">
                        <Link href={`/dashboard/assets/${a.id}`} className="hover:underline">
                          {a.name}
                        </Link>
                      </h3>
                      <p className="font-mono text-gray-500 dark:text-gray-400 text-sm">{a.barcode}</p>
                    </div>
                  </div>
                  <div className="mb-4 text-gray-600 dark:text-gray-400 text-sm">
                    <div className="flex justify-between items-center">
                      <span>{a.type?.name || 'نوع نامشخص'}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        a.availability === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                        a.availability === 'IN_USE' ? 'bg-blue-100 text-blue-800' :
                        a.availability === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {a.availability === 'AVAILABLE' ? 'موجود' :
                         a.availability === 'IN_USE' ? 'در حال استفاده' :
                         a.availability === 'MAINTENANCE' ? 'تعمیرات' : a.availability}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span>{a.category?.name || 'دسته نامشخص'}</span>
                      {a.location && (
                        <>
                          <span className="mx-1">•</span>
                          {a.location}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={()=>onEdit(a)} 
                      className="inline-flex flex-1 justify-center items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-md text-blue-700 dark:text-blue-300 text-xs transition-colors"
                    >
                      <Pencil className="w-3 h-3"/> ویرایش
                    </button>
                    <button 
                      onClick={()=>onDelete(a.id)} 
                      className="inline-flex flex-1 justify-center items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 px-3 py-2 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-xs transition-colors"
                    >
                      <Trash2 className="w-3 h-3"/> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white/95 dark:bg-gray-900/95 shadow-2xl backdrop-blur-sm mx-4 p-6 border border-gray-200/50 dark:border-gray-700/50 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-gray-200 dark:border-gray-700 border-b">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {editing?.id && editing.id !== '0' ? 'ویرایش دارایی' : 'افزودن دارایی'}
              </h3>
              <button 
                onClick={()=>{setOpen(false); setSelectedImages([]);}} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">نام دارایی *</label>
                  <input 
                    required
                    value={editing?.name || ''} 
                    onChange={e=>setEditing(s=>s?{...s, name:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                    placeholder="نام دارایی را وارد کنید"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">بارکد جدید *</label>
                  <input 
                    required
                    value={editing?.barcode || ''} 
                    onChange={e=>setEditing(s=>s?{...s, barcode:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                    placeholder="بارکد جدید را وارد کنید"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">بارکد قدیم</label>
                  <input 
                    value={editing?.oldBarcode || ''} 
                    onChange={e=>setEditing(s=>s?{...s, oldBarcode:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                    placeholder="بارکد قدیم (در صورت وجود)"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">شماره سریال</label>
                  <input 
                    value={editing?.serialNumber || ''} 
                    onChange={e=>setEditing(s=>s?{...s, serialNumber:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                    placeholder="شماره سریال دارایی"
                  />
                </div>
              </div>

              {/* Category and Type */}
              <div className="gap-4 grid grid-cols-1 md:grid-cols-2">
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">نوع دارایی</label>
                  <select 
                    value={editing?.typeId || ''} 
                    onChange={e=>setEditing(s=>s?{...s, typeId:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  >
                    <option value="">انتخاب نوع دارایی</option>
                    {assetTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">دسته‌بندی</label>
                  <select 
                    value={editing?.categoryId || ''} 
                    onChange={e=>setEditing(s=>s?{...s, categoryId:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  >
                    <option value="">انتخاب دسته‌بندی</option>
                    {assetCategories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status and Condition */}
              <div className="gap-4 grid grid-cols-1 md:grid-cols-3">
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">وضعیت</label>
                  <select 
                    value={editing?.condition || 'NEW'} 
                    onChange={e=>setEditing(s=>s?{...s, condition:e.target.value as any}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  >
                    <option value="NEW">جدید</option>
                    <option value="USED_GOOD">استفاده شده - سالم</option>
                    <option value="DEFECTIVE">معیوب</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">در دسترس بودن</label>
                  <select 
                    value={editing?.availability || 'AVAILABLE'} 
                    onChange={e=>setEditing(s=>s?{...s, availability:e.target.value as any}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  >
                    <option value="AVAILABLE">موجود</option>
                    <option value="IN_USE">در حال استفاده</option>
                    <option value="MAINTENANCE">تعمیرات</option>
                    <option value="RETIRED">خارج از رده</option>
                    <option value="LOST">مفقود</option>
                    <option value="CONSUMED">مصرف شده</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">نوع بارکد</label>
                  <select 
                    value={editing?.barcodeType || 'QR'} 
                    onChange={e=>setEditing(s=>s?{...s, barcodeType:e.target.value as any}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  >
                    <option value="QR">QR Code</option>
                    <option value="CODE128">Code 128</option>
                  </select>
                </div>
              </div>

              {/* Location and Purchase Info */}
              <div className="gap-4 grid grid-cols-1 md:grid-cols-3">
                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">مکان</label>
                  <input 
                    value={editing?.location || ''} 
                    onChange={e=>setEditing(s=>s?{...s, location:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                    placeholder="مکان فعلی دارایی"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">تاریخ خرید</label>
                  <input 
                    type="date"
                    value={editing?.purchaseDate || ''} 
                    onChange={e=>setEditing(s=>s?{...s, purchaseDate:e.target.value}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">قیمت خرید (تومان)</label>
                  <input 
                    type="number"
                    min="0"
                    step="1000"
                    value={editing?.cost || ''} 
                    onChange={e=>setEditing(s=>s?{...s, cost:e.target.value ? parseFloat(e.target.value) : undefined}:s)} 
                    className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">توضیحات</label>
                <textarea 
                  rows={3}
                  value={editing?.description || ''} 
                  onChange={e=>setEditing(s=>s?{...s, description:e.target.value}:s)} 
                  className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border border-gray-200 focus:border-transparent dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-gray-900 dark:text-gray-100"
                  placeholder="توضیحات تکمیلی دارایی"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">تصاویر دارایی</label>
                <div className="p-4 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg">
                  <div className="text-center">
                    <ImageIcon className="mx-auto w-12 h-12 text-gray-400" />
                    <div className="mt-2">
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <span className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors">
                          انتخاب تصاویر
                        </span>
                        <input
                          id="image-upload"
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-gray-500 text-sm">PNG, JPG, GIF تا 10MB</p>
                  </div>
                  
                  {/* Selected Images Preview */}
                  {selectedImages.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">تصاویر انتخاب شده:</h4>
                      <div className="gap-2 grid grid-cols-2 md:grid-cols-4">
                        {selectedImages.map((file, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index}`}
                              className="border rounded w-20 h-20 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeSelectedImage(index)}
                              className="-top-2 -right-2 absolute flex justify-center items-center bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 text-white text-xs"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Images (for edit mode) */}
                  {editing?.id && editing.id !== '0' && editing.images && editing.images.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 font-medium text-gray-700 dark:text-gray-300 text-sm">تصاویر موجود:</h4>
                      <div className="gap-2 grid grid-cols-2 md:grid-cols-4">
                        {editing.images.map((image) => (
                          <div key={image.id} className="relative">
                            <img
                              src={image.url}
                              alt={image.caption || 'Asset image'}
                              className="border rounded w-20 h-20 object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-gray-200 dark:border-gray-700 border-t">
                <button 
                  type="button" 
                  onClick={()=>{setOpen(false); setSelectedImages([]);}} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                >
                  انصراف
                </button>
                <button 
                  disabled={loading || uploading} 
                  className="bg-gradient-to-r from-blue-600 hover:from-blue-700 to-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-sm px-4 py-2 rounded-lg font-medium text-white transition-all duration-200"
                >
                  {loading ? 'در حال ذخیره...' : uploading ? 'آپلود تصاویر...' : 'ذخیره'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
