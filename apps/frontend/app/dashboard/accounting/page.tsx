"use client";
import React from 'react';
import { CircleDollarSign, Search, TrendingUp, Boxes, BarChart3, Save, Check } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
type AssetRow = { id: string; name: string; barcode: string; cost?: number; purchaseDate?: string };

export default function AccountingPage() {
  React.useEffect(() => { document.title = "حسابداری دارایی | Arzesh AI"; }, []);

  const [rows, setRows] = React.useState<AssetRow[]>([]);
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [stats, setStats] = React.useState({ totalValue: 0, assetCount: 0, avgCost: 0 });
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/assets?q=${encodeURIComponent(q)}&take=50`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setRows(list);
      const totalValue = list.reduce((s: number, a: AssetRow) => s + (a.cost || 0), 0);
      setStats({ totalValue, assetCount: list.length, avgCost: list.length ? totalValue / list.length : 0 });
    } catch { setRows([]); } finally { setLoading(false); }
  }

  React.useEffect(() => { load(); }, []);

  async function updateRow(id: string, data: Partial<AssetRow>) {
    await fetch(`${API}/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
    await load();
  }

  const statCards = [
    { label: 'ارزش کل دارایی‌ها', value: `${stats.totalValue.toLocaleString('fa-IR')} تومان`, Icon: CircleDollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'تعداد دارایی‌ها', value: stats.assetCount.toLocaleString('fa-IR'), Icon: Boxes, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
    { label: 'متوسط قیمت', value: `${Math.round(stats.avgCost).toLocaleString('fa-IR')} تومان`, Icon: BarChart3, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="card-theme">
        <div className="card-theme-body">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl w-10 h-10">
                <CircleDollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-theme-primary text-xl">حسابداری دارایی</h1>
                <p className="text-theme-muted text-sm">مدیریت اطلاعات مالی دارایی‌ها</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="top-1/2 right-3 absolute w-4 h-4 text-theme-muted -translate-y-1/2" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') load(); }}
                  placeholder="جستجوی دارایی..."
                  className="input-theme pr-10 text-sm w-52"
                />
              </div>
              <button onClick={load} disabled={loading} className="btn-theme-primary text-sm disabled:opacity-50">
                {loading ? '...' : 'جستجو'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="gap-4 grid grid-cols-1 md:grid-cols-3">
        {statCards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`card-theme`}>
            <div className="card-theme-body">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-theme-muted text-sm">{label}</p>
                  <p className={`font-bold text-xl mt-1 ${color}`}>{value}</p>
                </div>
                <div className={`p-3 rounded-xl ${bg}`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-theme">
        <div className="card-theme-header">
          <h3 className="font-semibold text-theme-primary">اطلاعات مالی دارایی‌ها</h3>
          <p className="text-theme-muted text-sm mt-0.5">ویرایش قیمت و تاریخ خرید</p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-theme">
            <thead>
              <tr>
                <th>نام دارایی</th>
                <th>بارکد</th>
                <th>قیمت (تومان)</th>
                <th>تاریخ خرید</th>
                <th>ذخیره</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-theme-muted">در حال بارگذاری...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-theme-muted">هیچ دارایی یافت نشد</td></tr>
              ) : rows.map(r => (
                <EditableRow key={r.id} row={r} onSave={updateRow} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EditableRow({ row, onSave }: { row: AssetRow; onSave: (id: string, data: Partial<AssetRow>) => Promise<void> }) {
  const [cost, setCost] = React.useState(row.cost ? String(row.cost) : '');
  const [purchaseDate, setPurchaseDate] = React.useState(row.purchaseDate ? new Date(row.purchaseDate).toISOString().slice(0, 10) : '');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const hasChanges = cost !== (row.cost ? String(row.cost) : '') || purchaseDate !== (row.purchaseDate ? new Date(row.purchaseDate).toISOString().slice(0, 10) : '');

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(row.id, { cost: cost ? Number(cost) : undefined, purchaseDate: purchaseDate || undefined });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <tr>
      <td>
        <div className="flex items-center gap-2.5">
          <div className="flex justify-center items-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg w-7 h-7 text-white text-xs font-semibold shrink-0">
            {row.name.charAt(0)}
          </div>
          <span className="font-medium text-theme-primary text-sm">{row.name}</span>
        </div>
      </td>
      <td>
        <code className="bg-theme-secondary px-2 py-0.5 rounded text-xs font-mono text-theme-secondary">{row.barcode}</code>
      </td>
      <td>
        <input
          inputMode="decimal"
          value={cost}
          onChange={e => setCost(e.target.value)}
          placeholder="قیمت"
          className="input-theme text-sm w-36"
        />
      </td>
      <td>
        <input
          type="date"
          value={purchaseDate}
          onChange={e => setPurchaseDate(e.target.value)}
          className="input-theme text-sm w-40"
        />
      </td>
      <td>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:cursor-not-allowed
            ${saved ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : hasChanges ? 'btn-theme-primary' : 'bg-theme-secondary text-theme-muted border border-theme opacity-50'}`}
        >
          {saved ? <><Check className="w-3 h-3" /> ذخیره شد</> : saving ? '...' : <><Save className="w-3 h-3" /> ذخیره</>}
        </button>
      </td>
    </tr>
  );
}
