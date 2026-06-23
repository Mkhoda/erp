"use client";
import React from "react";
import { Shield, Users, RotateCcw, Settings, Plus, Trash2, CheckCircle, TrendingUp, Zap, Cpu } from "lucide-react";
import Modal from "../../components/ui/Modal";
import SearchSelect from "../../components/ui/SearchSelect";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const PROVIDER_COLORS: Record<string, string> = {
  agnes: "#6366f1", openai: "#10a37f", anthropic: "#d97757",
  gemini: "#4285f4", deepseek: "#4d6bfe", groq: "#f55036",
  openrouter: "#7c3aed", custom: "#6b7280",
};

type Provider = { id: string; name: string; type: string; model: string | null; isActive?: boolean };

const providerColor = (type?: string) => PROVIDER_COLORS[type || ""] || "#888";
const modelLabel = (p?: { name?: string; model?: string | null; type?: string } | null) =>
  p ? `${p.name}${p.model ? ` — ${p.model}` : ""}` : "—";

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

function ModelBadge({ provider }: { provider?: Provider | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="rounded w-2 h-2" style={{ background: providerColor(provider?.type) }} />
      <span className="text-xs">{provider ? provider.name : "مدل حذف‌شده"}</span>
      {provider?.model && <span className="text-[10px] text-theme-muted">· {provider.model}</span>}
    </div>
  );
}

export default function QuotaPage() {
  const [quotas, setQuotas] = React.useState<any[]>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [defaults, setDefaults] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"users" | "defaults" | "stats">("users");
  // userModal: per-user override. isNew toggles the user/model pickers.
  const [userModal, setUserModal] = React.useState<{ userId: string; providerId: string; isNew: boolean } | null>(null);
  const [defModal, setDefModal] = React.useState<{ providerId: string; isNew: boolean } | null>(null);
  const [limitInput, setLimitInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const token = () => localStorage.getItem("token");
  const auth = () => ({ Authorization: `Bearer ${token()}` });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, uRes, pRes, dRes, sRes] = await Promise.all([
        fetch(`${API}/quota?limit=200`, { headers: auth() }),
        fetch(`${API}/users`, { headers: auth() }),
        fetch(`${API}/ai-settings/providers/active`, { headers: auth() }),
        fetch(`${API}/quota/defaults`, { headers: auth() }),
        fetch(`${API}/quota/stats`, { headers: auth() }),
      ]);
      if (qRes.ok) { const d = await qRes.json(); setQuotas(d.data || []); }
      if (uRes.ok) setUsers(await uRes.json());
      if (pRes.ok) setProviders(await pRes.json());
      if (dRes.ok) setDefaults(await dRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const saveQuota = async () => {
    if (!userModal || !userModal.userId || !userModal.providerId) return;
    setSaving(true);
    await fetch(`${API}/quota/user/${userModal.userId}/${userModal.providerId}`, {
      method: "PUT",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimit: +limitInput }),
    });
    setSaving(false);
    setUserModal(null);
    load();
  };

  const resetQuota = async (userId: string, providerId: string) => {
    if (!confirm("مصرف این مدل برای این کاربر ریست شود؟")) return;
    await fetch(`${API}/quota/user/${userId}/${providerId}/reset`, { method: "POST", headers: auth() });
    load();
  };

  const saveDefault = async () => {
    if (!defModal || !defModal.providerId) return;
    setSaving(true);
    await fetch(`${API}/quota/defaults/${defModal.providerId}`, {
      method: "PUT",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimit: +limitInput }),
    });
    setSaving(false);
    setDefModal(null);
    load();
  };

  const deleteDefault = async (providerId: string) => {
    if (!confirm("پیش‌فرض این مدل حذف شود؟")) return;
    await fetch(`${API}/quota/defaults/${providerId}`, { method: "DELETE", headers: auth() });
    load();
  };

  const userMap = new Map(users.map((u: any) => [u.id, u]));
  // Models without a default yet — offered first when adding a new default
  const modelsWithoutDefault = providers.filter(p => !defaults.some(d => d.providerId === p.id));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-theme-primary text-xl">
            <Shield className="w-5 h-5 text-blue-600" /> مدیریت سقف توکن
          </h1>
          <p className="mt-1 text-theme-muted text-sm">کنترل و پایش مصرف توکن کاربران به تفکیک مدل</p>
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
        {[["users", "کاربران"], ["defaults", "پیش‌فرض مدل‌ها"], ["stats", "برترین مصرف‌کنندگان"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-theme-card text-theme-primary shadow-sm" : "text-theme-muted hover:text-theme-secondary"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* User quotas tab */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-theme-muted text-sm">سقف اختصاصی هر کاربر برای یک مدل — در نبود رکورد، از پیش‌فرض همان مدل پیروی می‌شود</p>
            <button onClick={() => { setUserModal({ userId: users[0]?.id || "", providerId: providers[0]?.id || "", isNew: true }); setLimitInput("1000000"); }}
              disabled={providers.length === 0 || users.length === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-2 rounded-xl text-white text-sm transition-colors">
              <Plus className="w-4 h-4" /> افزودن محدودیت کاربر
            </button>
          </div>
          <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
            <div className="p-4 border-b border-theme">
              <span className="font-medium text-theme-primary text-sm">{quotas.length} رکورد محدودیت</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-theme-muted text-sm">در حال بارگذاری...</div>
            ) : quotas.length === 0 ? (
              <div className="p-8 text-center text-theme-muted text-sm">هنوز محدودیتی ثبت نشده — بعد از اولین استفاده یا با دکمه «افزودن» ایجاد می‌شود</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-theme-hover">
                    <tr>
                      {["کاربر", "مدل", "وضعیت", "مصرف", "سقف ماهانه", "اقدام"].map(h => (
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
                          <td className="px-4 py-3"><ModelBadge provider={q.provider} /></td>
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
                              <button onClick={() => { setUserModal({ userId: q.userId, providerId: q.providerId, isNew: false }); setLimitInput(String(q.monthlyLimit)); }}
                                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-theme-muted hover:text-blue-600 transition-colors" title="ویرایش سقف">
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => resetQuota(q.userId, q.providerId)}
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
        </div>
      )}

      {/* Defaults tab */}
      {tab === "defaults" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-theme-muted text-sm">سقف پیش‌فرض هر مدل که هنگام اولین استفاده به کاربران اعمال می‌شود</p>
            <button onClick={() => { setDefModal({ providerId: modelsWithoutDefault[0]?.id || providers[0]?.id || "", isNew: true }); setLimitInput("1000000"); }}
              disabled={providers.length === 0}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-2 rounded-xl text-white text-sm transition-colors">
              <Plus className="w-4 h-4" /> افزودن
            </button>
          </div>
          {providers.length === 0 ? (
            <div className="bg-theme-card p-8 border border-theme rounded-xl text-center text-theme-muted text-sm">
              هیچ مدل فعالی در «تنظیمات AI» تعریف نشده — ابتدا یک مدل اضافه کنید
            </div>
          ) : defaults.length === 0 ? (
            <div className="bg-theme-card p-8 border border-theme rounded-xl text-center text-theme-muted text-sm">
              هیچ پیش‌فرضی تعریف نشده — بدون پیش‌فرض، کاربران روی این مدل‌ها دسترسی نامحدود دارند
            </div>
          ) : (
            <div className="gap-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {defaults.map((d: any) => (
                <div key={d.id} className="bg-theme-card p-4 border border-theme rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="rounded-lg w-8 h-8 flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: providerColor(d.provider?.type) }}>
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-theme-primary text-sm truncate">{d.provider?.name || "مدل حذف‌شده"}</div>
                        {d.provider?.model && <div className="text-[10px] text-theme-muted truncate">{d.provider.model}</div>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setDefModal({ providerId: d.providerId, isNew: false }); setLimitInput(String(d.monthlyLimit)); }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 text-theme-muted hover:text-blue-600 transition-colors">
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteDefault(d.providerId)}
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

      {/* User quota modal */}
      <Modal
        open={!!userModal}
        onClose={() => setUserModal(null)}
        title={userModal?.isNew ? "افزودن محدودیت کاربر" : "ویرایش سقف توکن"}
        size="sm"
        footer={<>
          <button onClick={() => setUserModal(null)} className="btn-theme-secondary text-sm">انصراف</button>
          <button onClick={saveQuota} disabled={saving || !userModal?.userId || !userModal?.providerId} className="btn-theme-primary text-sm disabled:opacity-50">ذخیره</button>
        </>}
      >
        <div className="space-y-3">
          {userModal?.isNew ? (
            <>
              <div>
                <label className="block text-xs font-medium text-theme-secondary mb-1.5">کاربر</label>
                <SearchSelect
                  options={users.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}${u.phone ? ` — ${u.phone}` : ""}`, search: `${u.firstName} ${u.lastName} ${u.phone || ""}` }))}
                  value={userModal?.userId || ""}
                  onChange={id => setUserModal(m => m ? { ...m, userId: id } : null)}
                  searchKey="search"
                  placeholder="انتخاب کاربر"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-secondary mb-1.5">مدل</label>
                <SearchSelect
                  options={providers.map(p => ({ id: p.id, name: modelLabel(p) }))}
                  value={userModal?.providerId || ""}
                  onChange={id => setUserModal(m => m ? { ...m, providerId: id } : null)}
                  placeholder="انتخاب مدل"
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-theme-muted">
              کاربر: <span className="font-medium text-theme-primary">{(() => { const u = userMap.get(userModal?.userId) as any; return u ? `${u.firstName} ${u.lastName}` : userModal?.userId?.slice(0, 8); })()}</span>
              <span className="mx-2">·</span>
              مدل: <span className="font-medium text-theme-primary">{modelLabel(providers.find(p => p.id === userModal?.providerId) || quotas.find(q => q.providerId === userModal?.providerId)?.provider)}</span>
            </div>
          )}
          <div className="text-xs text-theme-muted">عدد ۰ = نامحدود</div>
          <input type="number" value={limitInput} onChange={e => setLimitInput(e.target.value)} min={0} className="input-theme text-sm" placeholder="مثلاً 1000000" />
        </div>
      </Modal>

      {/* Default quota modal */}
      <Modal
        open={!!defModal}
        onClose={() => setDefModal(null)}
        title={defModal?.isNew ? "افزودن پیش‌فرض مدل" : "ویرایش پیش‌فرض مدل"}
        size="sm"
        footer={<>
          <button onClick={() => setDefModal(null)} className="btn-theme-secondary text-sm">انصراف</button>
          <button onClick={saveDefault} disabled={saving || !defModal?.providerId} className="btn-theme-primary text-sm disabled:opacity-50">ذخیره</button>
        </>}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-theme-secondary mb-1.5">مدل</label>
            {defModal?.isNew ? (
              <select value={defModal?.providerId || ""} onChange={e => setDefModal(d => d ? { ...d, providerId: e.target.value } : null)} className="select-theme text-sm">
                {providers.map(p => (
                  <option key={p.id} value={p.id} disabled={defaults.some(d => d.providerId === p.id)}>
                    {modelLabel(p)}{defaults.some(d => d.providerId === p.id) ? " (تعریف‌شده)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm font-medium text-theme-primary">
                {modelLabel(providers.find(p => p.id === defModal?.providerId) || defaults.find(d => d.providerId === defModal?.providerId)?.provider)}
              </div>
            )}
          </div>
          <div className="text-xs text-theme-muted">عدد ۰ = نامحدود</div>
          <input type="number" value={limitInput} onChange={e => setLimitInput(e.target.value)} min={0} className="input-theme text-sm" placeholder="مثلاً 1000000" />
        </div>
      </Modal>
    </div>
  );
}
