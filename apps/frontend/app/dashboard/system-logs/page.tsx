"use client";
import React from "react";
import { motion } from "framer-motion";
import {
  Activity, RefreshCw, Trash2, AlertCircle, Clock,
  ChevronDown, ChevronUp, Search, Filter,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Log = {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  userId: string | null;
  body: string | null;
  response: string | null;
  latencyMs: number | null;
  errorMsg: string | null;
  ip: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  errors: number;
  slow: number;
  errorRate: number;
  errorPaths: Array<{ path: string; method: string; _count: { id: number } }>;
};

const METHOD_COLOR: Record<string, string> = {
  GET: "badge-info",
  POST: "badge-success",
  PUT: "badge-warning",
  PATCH: "badge-warning",
  DELETE: "badge-danger",
};

function statusBadge(code: number | null) {
  if (!code) return <span className="badge badge-neutral">-</span>;
  if (code < 300) return <span className="badge badge-success">{code}</span>;
  if (code < 400) return <span className="badge badge-info">{code}</span>;
  if (code < 500) return <span className="badge badge-warning">{code}</span>;
  return <span className="badge badge-danger">{code}</span>;
}

function latencyBadge(ms: number | null) {
  if (!ms) return <span className="text-theme-muted text-xs">-</span>;
  const cls = ms > 2000 ? "text-red-500" : ms > 800 ? "text-amber-500" : "text-green-500";
  return <span className={`text-xs font-mono ${cls}`}>{ms}ms</span>;
}

export default function LogsPage() {
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [days, setDays] = React.useState("1");
  const [filterMethod, setFilterMethod] = React.useState("");
  const [filterPath, setFilterPath] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [autoRefresh, setAutoRefresh] = React.useState(false);

  React.useEffect(() => { document.title = "لاگ‌های سیستم | Arzesh"; }, []);

  const fetchData = React.useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    setLoading(true);
    try {
      const params = new URLSearchParams({ days });
      if (filterMethod) params.set("method", filterMethod);
      if (filterPath)   params.set("path", filterPath);
      if (filterStatus) params.set("statusCode", filterStatus);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API}/request-logs?${params}`, { headers: h }),
        fetch(`${API}/request-logs/stats?days=${days}`, { headers: h }),
      ]);
      if (logsRes.ok)  setLogs(await logsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } finally {
      setLoading(false);
    }
  }, [days, filterMethod, filterPath, filterStatus]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchData, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchData]);

  const clearLogs = async () => {
    if (!confirm("لاگ‌های قدیمی‌تر از ۷ روز حذف شوند؟")) return;
    const token = localStorage.getItem("token");
    await fetch(`${API}/request-logs/clear`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="space-y-4 p-1" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h1 className="font-bold text-theme-primary text-lg">لاگ‌های سیستم</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            رفرش خودکار (۵ ثانیه)
          </label>
          <button onClick={fetchData} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            رفرش
          </button>
          <button onClick={clearLogs} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3 text-red-500 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
            پاک‌سازی
          </button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "کل درخواست‌ها", value: stats.total, color: "text-blue-500" },
            { label: "خطاها", value: stats.errors, color: "text-red-500" },
            { label: "کند (>2s)", value: stats.slow, color: "text-amber-500" },
            { label: "نرخ خطا", value: `${stats.errorRate}%`, color: stats.errorRate > 5 ? "text-red-500" : "text-green-500" },
          ].map(s => (
            <div key={s.label} className="card-theme p-3">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-theme-muted text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card-theme p-3 flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-theme-muted shrink-0" />
        <select value={days} onChange={e => setDays(e.target.value)} className="input-theme text-sm py-1 px-2 w-28">
          <option value="1">۱ روز اخیر</option>
          <option value="3">۳ روز</option>
          <option value="7">۷ روز</option>
          <option value="30">۳۰ روز</option>
        </select>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="input-theme text-sm py-1 px-2 w-24">
          <option value="">همه متدها</option>
          {["GET","POST","PUT","PATCH","DELETE"].map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-theme text-sm py-1 px-2 w-32">
          <option value="">همه وضعیت‌ها</option>
          <option value="400">400+</option>
          <option value="500">500+</option>
          <option value="200">200</option>
          <option value="201">201</option>
        </select>
        <div className="relative flex-1 min-w-32">
          <Search className="absolute top-1/2 -translate-y-1/2 end-2 w-3.5 h-3.5 text-theme-muted" />
          <input
            value={filterPath}
            onChange={e => setFilterPath(e.target.value)}
            placeholder="فیلتر مسیر (مثلاً /ai-settings)"
            className="input-theme text-sm py-1 pe-8 ps-3 w-full"
          />
        </div>
      </div>

      {/* Logs table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-theme overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-theme-secondary border-b border-theme text-theme-muted text-xs">
              <tr>
                <th className="text-right px-3 py-2 font-medium">زمان</th>
                <th className="text-right px-3 py-2 font-medium">متد</th>
                <th className="text-right px-3 py-2 font-medium">مسیر</th>
                <th className="text-right px-3 py-2 font-medium">وضعیت</th>
                <th className="text-right px-3 py-2 font-medium">تأخیر</th>
                <th className="text-right px-3 py-2 font-medium">IP</th>
                <th className="text-right px-3 py-2 font-medium">جزئیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading && (
                <tr><td colSpan={7} className="text-center py-10 text-theme-muted text-xs">در حال بارگذاری...</td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-theme-muted text-xs">لاگی یافت نشد</td></tr>
              )}
              {logs.map(log => (
                <React.Fragment key={log.id}>
                  <tr
                    className={`hover:bg-theme-hover transition-colors cursor-pointer ${log.statusCode && log.statusCode >= 400 ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-3 py-2 text-theme-muted text-xs whitespace-nowrap font-mono">{formatTime(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${METHOD_COLOR[log.method] || "badge-neutral"} text-xs`}>{log.method}</span>
                    </td>
                    <td className="px-3 py-2 text-theme-secondary font-mono text-xs max-w-xs truncate" title={log.path}>{log.path}</td>
                    <td className="px-3 py-2">{statusBadge(log.statusCode)}</td>
                    <td className="px-3 py-2">{latencyBadge(log.latencyMs)}</td>
                    <td className="px-3 py-2 text-theme-muted text-xs font-mono">{log.ip || "-"}</td>
                    <td className="px-3 py-2">
                      {expanded === log.id ? <ChevronUp className="w-3.5 h-3.5 text-theme-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-theme-muted" />}
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr className="bg-theme-secondary">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {log.errorMsg && (
                            <div className="md:col-span-2 flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                              <span className="text-red-600 dark:text-red-400 text-xs font-mono">{log.errorMsg}</span>
                            </div>
                          )}
                          {log.body && (
                            <div>
                              <div className="text-theme-muted text-xs mb-1 font-medium">Request Body</div>
                              <pre className="text-xs font-mono bg-theme-primary/5 border border-theme rounded p-2 overflow-x-auto max-h-40 text-theme-secondary whitespace-pre-wrap">
                                {(() => { try { return JSON.stringify(JSON.parse(log.body), null, 2); } catch { return log.body; } })()}
                              </pre>
                            </div>
                          )}
                          {log.response && (
                            <div>
                              <div className="text-theme-muted text-xs mb-1 font-medium">Response</div>
                              <pre className="text-xs font-mono bg-theme-primary/5 border border-theme rounded p-2 overflow-x-auto max-h-40 text-theme-secondary whitespace-pre-wrap">
                                {(() => { try { return JSON.stringify(JSON.parse(log.response), null, 2); } catch { return log.response; } })()}
                              </pre>
                            </div>
                          )}
                          <div className="text-xs text-theme-muted space-y-1">
                            <div>User ID: <span className="font-mono text-theme-secondary">{log.userId || "—"}</span></div>
                            <div>Latency: <span className="font-mono text-theme-secondary">{log.latencyMs}ms</span></div>
                            <div>IP: <span className="font-mono text-theme-secondary">{log.ip || "—"}</span></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-theme text-xs text-theme-muted flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          {logs.length} لاگ نمایش داده شده (فقط POST/PUT/PATCH/DELETE و خطاهای GET ثبت می‌شوند)
        </div>
      </motion.div>
    </div>
  );
}
