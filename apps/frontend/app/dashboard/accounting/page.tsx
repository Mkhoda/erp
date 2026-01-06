"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type AssetRow = { id:string; name:string; barcode:string; cost?:number; purchaseDate?:string };

export default function AccountingPage(){
  const [rows,setRows]=React.useState<AssetRow[]>([]);
  const [q,setQ]=React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [stats, setStats] = React.useState({ totalValue: 0, assetCount: 0, avgCost: 0 });
  const router = useRouter();
  
  React.useEffect(() => {
    document.title = 'حسابداری دارایی | ارزش ERP';
  }, []);

  const token = typeof window!=='undefined'? localStorage.getItem('token'):null;
  
  async function load(){
    setLoading(true);
    try {
      const r = await fetch(`${API}/assets?q=${encodeURIComponent(q)}&take=50`, { 
        headers:{ Authorization:`Bearer ${token}` }
      });
      if (!r.ok) throw new Error('Failed to fetch');
      const data = await r.json();
      setRows(data);
      
      // Calculate stats
      const totalValue = data.reduce((sum: number, item: AssetRow) => sum + (item.cost || 0), 0);
      const assetCount = data.length;
      const avgCost = assetCount > 0 ? totalValue / assetCount : 0;
      setStats({ totalValue, assetCount, avgCost });
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  }
  
  React.useEffect(()=>{ load(); },[]);
  
  async function updateRow(id:string, data: Partial<AssetRow>){
    try {
      await fetch(`${API}/assets/${id}`, { 
        method:'PATCH', 
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, 
        body: JSON.stringify(data) 
      });
      await load();
    } catch (error) {
      console.error('Error updating asset:', error);
    }
  }
  
  return (
    <div className="bg-gradient-to-br from-blue-50 dark:from-gray-900 via-white dark:via-gray-800 to-indigo-50 dark:to-gray-900 min-h-screen">
      <div className="top-0 z-10 sticky bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 border-b">
        <div className="mx-auto px-6 py-4 max-w-7xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-transparent text-2xl">
                  حسابداری دارایی
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">مدیریت اطلاعات مالی دارایی‌ها</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg">
                <input 
                  placeholder="جستجو در دارایی‌ها..." 
                  value={q} 
                  onChange={e=>setQ(e.target.value)}
                  className="bg-transparent px-4 py-2 border-none outline-none w-64 text-sm"
                />
                <button 
                  onClick={load} 
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-r-lg text-white text-sm transition-colors"
                >
                  {loading ? '...' : 'جستجو'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 mx-auto px-6 py-6 max-w-7xl">
        {/* Stats Cards */}
        <div className="gap-6 grid grid-cols-1 md:grid-cols-3">
          <div className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md p-6 border border-gray-200 dark:border-gray-700 rounded-xl transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">ارزش کل دارایی‌ها</p>
                <p className="font-bold text-green-600 text-2xl">{stats.totalValue.toLocaleString('fa-IR')} تومان</p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md p-6 border border-gray-200 dark:border-gray-700 rounded-xl transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">تعداد دارایی‌ها</p>
                <p className="font-bold text-blue-600 text-2xl">{stats.assetCount.toLocaleString('fa-IR')}</p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md p-6 border border-gray-200 dark:border-gray-700 rounded-xl transition-shadow">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">متوسط قیمت</p>
                <p className="font-bold text-purple-600 text-2xl">{stats.avgCost.toLocaleString('fa-IR')} تومان</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 00-2 2h2a2 2 0 002-2V5a2 2 0 00-2-2H2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Assets Table */}
        <div className="card-theme">
          <div className="px-6 py-4 border-theme border-b">
            <h3 className="font-semibold text-theme-primary text-lg">اطلاعات مالی دارایی‌ها</h3>
            <p className="text-theme-secondary text-sm">ویرایش قیمت و تاریخ خرید دارایی‌ها</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">نام دارایی</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">بارکد</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">قیمت (تومان)</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">تاریخ خرید</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs text-right uppercase tracking-wider">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="border-b-2 border-blue-600 rounded-full w-6 h-6 animate-spin"></div>
                        <span className="text-gray-500 dark:text-gray-400">در حال بارگذاری...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-gray-500 dark:text-gray-400 text-center">
                      هیچ دارایی یافت نشد
                    </td>
                  </tr>
                ) : (
                  rows.map(r=> (
                    <EditableRow key={r.id} row={r} onSave={updateRow} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableRow({ row, onSave }: { row: AssetRow; onSave: (id:string, data: Partial<AssetRow>)=>Promise<void> }){
  const [cost,setCost]=React.useState<string>(row.cost? String(row.cost):'');
  const [purchaseDate,setPurchaseDate]=React.useState<string>(row.purchaseDate? new Date(row.purchaseDate).toISOString().slice(0,10):'');
  const [saving,setSaving]=React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    const costChanged = cost !== (row.cost ? String(row.cost) : '');
    const dateChanged = purchaseDate !== (row.purchaseDate ? new Date(row.purchaseDate).toISOString().slice(0,10) : '');
    setHasChanges(costChanged || dateChanged);
  }, [cost, purchaseDate, row]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(row.id, { 
        cost: cost ? Number(cost) : null as any, 
        purchaseDate: purchaseDate || null as any 
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 w-8 h-8">
            <div className="flex justify-center items-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg w-8 h-8">
              <span className="font-medium text-white text-sm">{row.name.charAt(0)}</span>
            </div>
          </div>
          <div className="mr-4">
            <div className="font-medium text-gray-900 dark:text-white text-sm">{row.name}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="inline-flex items-center bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full font-mono font-medium text-gray-800 dark:text-gray-200 text-xs">
          {row.barcode}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="relative">
          <input 
            inputMode="decimal" 
            value={cost} 
            onChange={e=>setCost(e.target.value)} 
            placeholder="قیمت را وارد کنید"
            className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-full text-sm transition-all"
          />
          {cost && (
            <span className="top-2 left-3 absolute text-gray-500 dark:text-gray-400 text-xs">تومان</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <input 
          type="date" 
          value={purchaseDate} 
          onChange={e=>setPurchaseDate(e.target.value)} 
          className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-200 dark:border-gray-700 focus:border-transparent rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-full text-sm transition-all"
        />
      </td>
      <td className="px-6 py-4">
        <button 
          disabled={saving || !hasChanges} 
          onClick={handleSave}
          className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            hasChanges 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          } ${saving ? 'opacity-50 cursor-wait' : ''}`}
        >
          {saving ? (
            <>
              <div className="ml-2 border-white border-b-2 rounded-full w-4 h-4 animate-spin"></div>
              در حال ذخیره...
            </>
          ) : hasChanges ? (
            <>
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ذخیره
            </>
          ) : (
            'ذخیره شده'
          )}
        </button>
      </td>
    </tr>
  );
}
