"use client";
import React from "react";
import { BarChart3, Users, Zap, Clock, TrendingUp, Search, ChevronDown, ChevronUp } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import SearchBar from "../../components/ui/SearchBar";
import SkeletonTable from "../../components/ui/SkeletonTable";
import { EmptyStateRow } from "../../components/ui/EmptyState";
import { pageTitle } from "../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type UserUsage = {
  userId: string;
  user?: { firstName: string; lastName: string; email?: string; phone?: string };
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalRequests: number;
  successCount: number;
  providers: string[];
};

type UsageLog = {
  id: string;
  userId: string;
  user?: { firstName: string; lastName: string };
  providerType: string;
  model?: string;
  prompt: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorMsg?: string;
  createdAt: string;
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "badge-success",
  anthropic: "badge-purple",
  gemini: "badge-info",
  deepseek: "badge-teal",
  agnes: "badge-warning",
  custom: "badge-neutral",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  agnes: "Agnes",
  custom: "سفارشی",
};

function ProviderBadge({ type }: { type: string }) {
  return <span className={`badge ${PROVIDER_COLORS[type] || "badge-neutral"}`}>{PROVIDER_LABELS[type] || type}</span>;
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card-theme">
      <div className="card-theme-body flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-theme-primary">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</div>
          <div className="text-theme-muted text-xs">{label}</div>
          {sub && <div className="text-theme-muted text-[10px] mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export default function AiUsagePage() {
  React.useEffect(() => { document.title = pageTitle("مصرف هوش مصنوعی"); }, []);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const [days, setDays] = React.useState(30);
  const [tab, setTab] = React.useState<"users" | "logs">("users");
  const [query, setQuery] = React.useState("");
  const [providerFilter, setProviderFilter] = React.useState("");
  const [userUsage, setUserUsage] = React.useState<UserUsage[]>([]);
  const [logs, setLogs] = React.useState<UsageLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sortKey, setSortKey] = React.useState<"totalTokens" | "totalRequests">("totalTokens");
  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc");
  const [expandedLog, setExpandedLog] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch(`${API}/ai-settings/usage/users?days=${days}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/ai-settings/usage?days=${days}${providerFilter ? `&providerType=${providerFilter}` : ""}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const usersData = await usersRes.json();
      const logsData = await logsRes.json();
      setUserUsage(Array.isArray(usersData) ? usersData : []);
      setLogs(Array.isArray(logsData) ? logsData : (logsData?.items ?? []));
    } catch { setUserUsage([]); setLogs([]); } finally { setLoading(false); }
  }

  React.useEffect(() => { load(); }, [days, providerFilter]);

  const totalTokens = userUsage.reduce((a, u) => a + u.totalTokens, 0);
  const totalRequests = userUsage.reduce((a, u) => a + u.totalRequests, 0);
  const activeUsers = userUsage.filter(u => u.totalRequests > 0).length;
  const avgLatency = logs.length ? Math.round(logs.reduce((a, l) => a + l.latencyMs, 0) / logs.length) : 0;

  const filteredUsers = userUsage
    .filter(u => {
      const name = `${u.user?.firstName || ""} ${u.user?.lastName || ""}`.toLowerCase();
      return name.includes(query.toLowerCase()) || (u.user?.phone || "").includes(query);
    })
    .sort((a, b) => {
      const v = sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey];
      return v;
    });

  const filteredLogs = logs.filter(l => {
    const name = `${l.user?.firstName || ""} ${l.user?.lastName || ""}`.toLowerCase();
    return name.includes(query.toLowerCase()) || l.prompt?.toLowerCase().includes(query.toLowerCase());
  });

  function toggleSort(key: "totalTokens" | "totalRequests") {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const SortIcon = ({ k }: { k: string }) => sortKey === k ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null;

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        title="مصرف هوش مصنوعی"
        subtitle="آمار جستجو و مصرف توکن کاربران"
        icon={BarChart3}
        iconColor="from-violet-500 to-purple-600"
        actions={[
          { label: "به‌روزرسانی", icon: TrendingUp, onClick: load, variant: "secondary" },
        ]}
      />

      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 14, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${days === d ? "bg-blue-600 text-white border-blue-600" : "bg-theme-card text-theme-secondary border-theme hover:bg-theme-hover"}`}>
            {d} روز
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Zap} label="کل توکن مصرفی" value={totalTokens.toLocaleString("fa-IR")} color="from-violet-500 to-purple-600" />
        <StatCard icon={Search} label="کل درخواست‌ها" value={totalRequests} color="from-blue-500 to-blue-600" />
        <StatCard icon={Users} label="کاربران فعال" value={activeUsers} color="from-emerald-500 to-emerald-600" />
        <StatCard icon={Clock} label="میانگین تأخیر" value={`${avgLatency.toLocaleString("fa-IR")} ms`} color="from-amber-500 to-amber-600" />
      </div>

      {/* Tab switcher */}
      <div className="flex bg-theme-secondary border border-theme p-1 rounded-xl w-fit">
        {([["users", "بر اساس کاربر"], ["logs", "لاگ‌های جستجو"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted hover:text-theme-secondary"}`}>
            {label}
          </button>
        ))}
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder={tab === "users" ? "جستجو نام کاربر..." : "جستجو متن یا کاربر..."} count={tab === "users" ? filteredUsers.length : filteredLogs.length} countLabel={tab === "users" ? "کاربر" : "درخواست"}>
        <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} className="select-theme text-sm">
          <option value="">همه مدل‌ها</option>
          {["openai", "anthropic", "gemini", "deepseek", "agnes", "custom"].map(p => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </SearchBar>

      {tab === "users" ? (
        <div className="table-theme-container">
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>مدل‌های استفاده‌شده</th>
                  <th onClick={() => toggleSort("totalRequests")} className="cursor-pointer select-none hover:bg-theme-hover">
                    <span className="flex items-center gap-1">درخواست‌ها <SortIcon k="totalRequests" /></span>
                  </th>
                  <th onClick={() => toggleSort("totalTokens")} className="cursor-pointer select-none hover:bg-theme-hover">
                    <span className="flex items-center gap-1">کل توکن <SortIcon k="totalTokens" /></span>
                  </th>
                  <th>توکن ورودی</th>
                  <th>توکن خروجی</th>
                  <th>موفقیت</th>
                </tr>
              </thead>
              {loading ? (
                <SkeletonTable cols={7} rows={6} />
              ) : (
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <EmptyStateRow icon={Users} title="داده‌ای یافت نشد" description="در این بازه زمانی هیچ مصرفی ثبت نشده" colSpan={7} />
                  ) : filteredUsers.map(u => {
                    const successRate = u.totalRequests > 0 ? Math.round((u.successCount / u.totalRequests) * 100) : 0;
                    return (
                      <tr key={u.userId}>
                        <td>
                          <div className="font-medium text-theme-primary text-sm">{u.user?.firstName} {u.user?.lastName}</div>
                          {u.user?.phone && <div className="text-theme-muted text-xs" dir="ltr">{u.user.phone}</div>}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {u.providers.map(p => <ProviderBadge key={p} type={p} />)}
                          </div>
                        </td>
                        <td><span className="font-mono text-sm">{u.totalRequests.toLocaleString("fa-IR")}</span></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-theme-secondary rounded-full h-1.5 min-w-[60px]">
                              <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${totalTokens > 0 ? Math.min(100, (u.totalTokens / totalTokens) * 100) : 0}%` }} />
                            </div>
                            <span className="font-mono text-sm text-theme-secondary whitespace-nowrap">{u.totalTokens.toLocaleString("fa-IR")}</span>
                          </div>
                        </td>
                        <td><span className="font-mono text-xs text-theme-muted">{u.promptTokens.toLocaleString("fa-IR")}</span></td>
                        <td><span className="font-mono text-xs text-theme-muted">{u.completionTokens.toLocaleString("fa-IR")}</span></td>
                        <td>
                          <span className={`badge ${successRate >= 90 ? "badge-success" : successRate >= 70 ? "badge-warning" : "badge-danger"}`}>
                            {successRate.toLocaleString("fa-IR")}٪
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="table-theme-container">
          <div className="overflow-x-auto">
            <table className="table-theme">
              <thead>
                <tr><th>زمان</th><th>کاربر</th><th>مدل</th><th>متن جستجو</th><th>توکن</th><th>تأخیر</th><th>وضعیت</th></tr>
              </thead>
              {loading ? (
                <SkeletonTable cols={7} rows={8} />
              ) : (
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <EmptyStateRow icon={Search} title="لاگی یافت نشد" colSpan={7} />
                  ) : filteredLogs.slice(0, 200).map(l => (
                    <React.Fragment key={l.id}>
                      <tr className={`cursor-pointer ${expandedLog === l.id ? "bg-theme-hover" : ""}`} onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}>
                        <td>
                          <div className="text-xs text-theme-muted whitespace-nowrap">
                            {new Date(l.createdAt).toLocaleDateString("fa-IR")}
                          </div>
                          <div className="text-[10px] text-theme-muted" dir="ltr">
                            {new Date(l.createdAt).toLocaleTimeString("fa-IR")}
                          </div>
                        </td>
                        <td className="text-sm">{l.user?.firstName} {l.user?.lastName}</td>
                        <td><ProviderBadge type={l.providerType} />{l.model && <div className="text-[10px] text-theme-muted mt-0.5" dir="ltr">{l.model}</div>}</td>
                        <td className="max-w-[200px]">
                          <p className="text-sm text-theme-secondary truncate">{l.prompt}</p>
                        </td>
                        <td><span className="font-mono text-xs">{l.totalTokens.toLocaleString("fa-IR")}</span></td>
                        <td><span className="font-mono text-xs text-theme-muted">{l.latencyMs.toLocaleString("fa-IR")}ms</span></td>
                        <td>
                          {l.success
                            ? <span className="badge badge-success">موفق</span>
                            : <span className="badge badge-danger">خطا</span>}
                        </td>
                      </tr>
                      {expandedLog === l.id && (
                        <tr>
                          <td colSpan={7} className="bg-theme-secondary">
                            <div className="p-3 space-y-2">
                              <div>
                                <span className="text-xs font-medium text-theme-muted">متن کامل:</span>
                                <p className="text-sm text-theme-primary mt-1 whitespace-pre-wrap">{l.prompt}</p>
                              </div>
                              {l.errorMsg && (
                                <div>
                                  <span className="text-xs font-medium text-red-500">خطا:</span>
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{l.errorMsg}</p>
                                </div>
                              )}
                              <div className="flex gap-4 text-xs text-theme-muted">
                                <span>ورودی: {l.promptTokens.toLocaleString("fa-IR")} توکن</span>
                                <span>خروجی: {l.completionTokens.toLocaleString("fa-IR")} توکن</span>
                                <span>تأخیر: {l.latencyMs.toLocaleString("fa-IR")} ms</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
