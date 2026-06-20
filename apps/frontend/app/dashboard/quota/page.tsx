"use client";
import React from "react";
import { Shield, Users, RotateCcw, Settings, Plus, Trash2, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const PROVIDER_LABELS: Record<string, string> = {
  agnes: "Agnes AI", openai: "OpenAI", anthropic: "Anthropic",
  gemini: "Google Gemini", deepseek: "DeepSeek", groq: "Groq",
  openrouter: "OpenRouter", custom: "سفارشی",
};
const PROVIDER_COLORS: Record<string, string> = {
  agnes: "#6366f1", openai: "#10a37f", anthropic: "#d97757",
  gemini: "#4285f4", deepseek: "#4d6bfe", groq: "#f55036",
  openrouter: "#7c3aed", custom: "#6b7280",
};

function StatusDot({ status }: { status: string }) {
  if (status === "unlimited") return <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title="نامحدود" />;
  if (status === "critical") return <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" title="بحرانی" />;
  if (status === "warning") return <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" title="هشدار" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="عادی" />;
}

function QuotaBar({ used, limit, pct }: { used: number; limit: number; pct: number }) {
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-theme-muted">
        <span>{used.toLocaleString()}</span>
        <span>{limit === 0 ? "نامحدود" : limit.toLocaleString()}</span>
      </div>
      <div className="bg-theme-hover rounded-full w-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[10px] text-theme-muted text-left">{limit === 0 ? "∞" : `${pct}%`}</div>
    </div>
  );
}

export default function QuotaPage() {
  const [quotas, setQuotas] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [defaults, setDefaults] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"users" | "defaults" | "stats">("users");
  const [editModal, setEditModal] = React.useState<{ userId: string; providerType: string; current: number } | null>(null);
  const [defModal, setDefModal] = React.useState<{ providerType: string; current: number } | null>(null);
  const [limitInput, setLimitInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const token = () => localStorage.getItem("token");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, uRes, dRes, sRes] = await Promise.all([
        fetch(`${API}/quota?limit=200`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API}/hrm/users`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API}/quota/defaults`, { headers: { Authorization: `Bearer ${token()}` } }),
        fetch(`${API}/quota/stats`, { headers: { Authorization: `Bearer ${token()}` } }),
      ]);
      if (qRes.ok) { const d = await qRes.json(); setQuotas(d.data || []); }
      if (uRes.ok) setUsers(await uRes.json());
      if (dRes.ok) setDefaults(await dRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const saveQuota = async () => {
    if (!editModal) return;
    setSaving(true);
    await fetch(`${API}/quota/user/${editModal.userId}/${editModal.providerType}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimit: +limitInput }),
    });
    setSaving(false);
    setEditModal(null);
    load();
  };

  const resetQuota = async (userId: string, providerType: string) => {
    if (!confirm("ریست شود؟")) return;
    await fetch(`${API}/quota/user/${userId}/${providerType}/reset`, {
      method: "POST", headers: { Authorization: `Bearer ${token()}` },
    });
    load();
  };

  const saveDefault = async () => {
    if (!defModal) return;
    setSaving(true);
    await fetch(`${API}/quota/defaults/${defModal.providerType}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimit: +limitInput }),
    });
    setSaving(false);
    setDefModal(null);
    load();
  };

  const deleteDefault = async (providerType: string) => {
    if (!confirm("حذف شود؟")) return;
    await fetch(`${API}/quota/defaults/${providerType}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token()}` },
    });
    load();
  };

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-theme-primary text-xl">
            <Shield className="w-5 h-5 text-blue-600" /> مدیریت سقف توکن
          </h1>
          <p className="mt-1 text-theme-muted text-sm">کنترل و پایش مصرف توکن کاربران</p>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="gap-4 grid grid-cols-2 md:grid-cols-4">
          {[
            { label: "کل کاربران", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
            { label: "کل درخواست‌ها", value: stats.totalRequests?.toLocaleString(), icon: TrendingUp, color: "text-green-600" },
            { label: "کل توکن مصرفی", value: (stats.totalTokens || 0).toLocaleString(), icon: Zap, color: "text-purple-600" },
            { label: "توکن خروجی", value: (stats.completionTokens || 0).toLocaleString(), icon: CheckCircle, color: "text-orange-600" },
          ].map(s => (
            <div key={s.label} className="bg-theme-card p-4 border border-theme rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-theme-muted text-xs">{s.label}</span>
              </div>
              <div className="font-bold text-theme-primary text-lg">{s.value ?? "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-theme-hover p-1 rounded-xl w-fit">
        {[["users", "کاربران"], ["defaults", "پیش‌فرض‌ها"], ["stats", "برترین مصرف‌کنندگان"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-theme-card text-theme-primary shadow-sm" : "text-theme-muted hover:text-theme-secondary"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* User quotas tab */}
      {tab === "users" && (
        <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
          <div className="p-4 border-b border-theme">
            <span className="font-medium text-theme-primary text-sm">{quotas.length} رکورد quota</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-theme-muted text-sm">در حال بارگذاری...</div>
          ) : quotas.length === 0 ? (
            <div className="p-8 text-center text-theme-muted text-sm">هنوز هیچ quota ثبت نشده — بعد از اولین chat ایجاد می‌شود</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-theme-hover">
                  <tr>
                    {["کاربر", "سرویس", "وضعیت", "مصرف", "سقف ماهانه", "اقدام"].map(h => (
                      <th key={h} className="px-4 py-3 text-right font-medium text-theme-muted text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {quotas.map((q: any) => {
                    const u = userMap.get(q.userId) as any;
                    const name = u ? `${u.firstName} ${u.lastName}` : q.userId.slice(0, 8);
                    return (
                      <tr key={q.id} className="hover:bg-theme-hover transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-theme-primary text-xs">{name}</div>
                          <div className="text-[10px] text-theme-muted">{u?.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="rounded w-2 h-2" style={{ background: PROVIDER_COLORS[q.providerType] || "#888" }} />
                            <span className="text-xs">{PROVIDER_LABELS[q.providerType] || q.providerType}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <StatusDot status={q.status} />
                            <span className="text-xs text-theme-muted capitalize">
                              {q.status === "unlimited" ? "نامحدود" : q.status === "critical" ? "بحرانی" : q.status === "warning" ? "هشدار" : "عادی"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <QuotaBar used={q.usedTokens} limit={q.monthlyLimit} pct={q.usagePercent} />
                        </td>
                        <td className="px-4 py-3 text-xs text-theme-secondary">
                          {q.monthlyLimit === 0 ? "نامحدود" : q.monthlyLimit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditModal({ userId: q.userId, providerType: q.providerType, current: q.monthlyLimit }); setLimitInput(String(q.monthlyLimit)); }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-theme-muted hover:text-blue-600 transition-colors">
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => resetQuota(q.userId, q.providerType)}
                              className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 text-theme-muted hover:text-orange-600 transition-colors" title="ریست مصرف">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Defaults tab */}
      {tab === "defaults" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-theme-muted text-sm">quota پیش‌فرض که به کاربران جدید اختصاص می‌یابد</p>
            <button onClick={() => { setDefModal({ providerType: "openai", current: 0 }); setLimitInput("1000000"); }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl text-white text-sm transition-colors">
              <Plus className="w-4 h-4" /> افزودن
            </button>
          </div>
          {defaults.length === 0 ? (
            <div className="bg-theme-card p-8 border border-theme rounded-xl text-center text-theme-muted text-sm">
              هیچ quota پیش‌فرضی تعریف نشده — بدون quota پیش‌فرض، کاربران دسترسی نامحدود دارند
            </div>
          ) : (
            <div className="gap-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {defaults.map((d: any) => (
                <div key={d.id} className="bg-theme-card p-4 border border-theme rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg w-8 h-8 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: PROVIDER_COLORS[d.providerType] || "#888" }}>
                        {(PROVIDER_LABELS[d.providerType] || d.providerType).slice(0, 2)}
                      </div>
                      <span className="font-medium text-theme-primary text-sm">{PROVIDER_LABELS[d.providerType] || d.providerType}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setDefModal({ providerType: d.providerType, current: d.monthlyLimit }); setLimitInput(String(d.monthlyLimit)); }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-theme-muted hover:text-blue-600 transition-colors">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteDefault(d.providerType)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-theme-muted hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-theme-muted">سقف ماهانه</div>
                  <div className="font-bold text-theme-primary">{d.monthlyLimit === 0 ? "نامحدود" : d.monthlyLimit.toLocaleString()} توکن</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top consumers tab */}
      {tab === "stats" && stats?.topUsers && (
        <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
          <div className="p-4 border-b border-theme font-medium text-theme-primary text-sm">۱۰ کاربر پرمصرف</div>
          <div className="divide-y divide-theme">
            {stats.topUsers.map((item: any, idx: number) => {
              const u = item.user;
              return (
                <div key={idx} className="flex items-center gap-4 px-4 py-3">
                  <span className="font-bold text-theme-muted text-xs w-5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-theme-primary text-sm truncate">
                      {u ? `${u.firstName} ${u.lastName}` : "کاربر ناشناس"}
                    </div>
                    <div className="text-[11px] text-theme-muted">{u?.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-theme-primary text-sm">{item.totalTokens.toLocaleString()}</div>
                    <div className="text-[10px] text-theme-muted">توکن</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit quota modal */}
      {editModal && (
        <div className="z-50 fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="bg-theme-card border border-theme rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-theme-primary mb-4">ویرایش سقف توکن</h3>
            <div className="mb-2 text-sm text-theme-muted">سرویس: <span className="font-medium text-theme-primary">{PROVIDER_LABELS[editModal.providerType] || editModal.providerType}</span></div>
            <div className="mb-4 text-sm text-theme-muted">عدد ۰ = نامحدود</div>
            <input type="number" value={limitInput} onChange={e => setLimitInput(e.target.value)} min={0}
              className="bg-theme-primary border border-theme rounded-xl px-4 py-2.5 w-full text-theme-primary text-sm outline-none focus:border-blue-500 mb-4" placeholder="مثلاً 1000000" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 rounded-xl bg-theme-hover text-theme-secondary text-sm">انصراف</button>
              <button onClick={saveQuota} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">ذخیره</button>
            </div>
          </div>
        </div>
      )}

      {/* Default quota modal */}
      {defModal && (
        <div className="z-50 fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={() => setDefModal(null)}>
          <div className="bg-theme-card border border-theme rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-theme-primary mb-4">quota پیش‌فرض</h3>
            <div className="mb-3">
              <label className="block text-xs font-medium text-theme-primary mb-1">سرویس</label>
              <select value={defModal.providerType} onChange={e => setDefModal(d => d ? { ...d, providerType: e.target.value } : null)}
                className="bg-theme-primary border border-theme rounded-xl px-3 py-2.5 w-full text-theme-primary text-sm outline-none focus:border-blue-500">
                {Object.entries(PROVIDER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="mb-4 text-sm text-theme-muted">عدد ۰ = نامحدود</div>
            <input type="number" value={limitInput} onChange={e => setLimitInput(e.target.value)} min={0}
              className="bg-theme-primary border border-theme rounded-xl px-4 py-2.5 w-full text-theme-primary text-sm outline-none focus:border-blue-500 mb-4" placeholder="مثلاً 1000000" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDefModal(null)} className="px-4 py-2 rounded-xl bg-theme-hover text-theme-secondary text-sm">انصراف</button>
              <button onClick={saveDefault} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">ذخیره</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
