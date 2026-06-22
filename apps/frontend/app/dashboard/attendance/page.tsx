"use client";
import React from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  Users, Clock, AlertTriangle, Moon, CalendarCheck, CalendarX,
  RefreshCw, Loader2, Fingerprint, ArrowLeft, TimerReset, Database, ChevronDown, Stethoscope,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const STATUS_FA: Record<string,string> = { PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت", INCOMPLETE:"ناقص", LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته" };
const STATUS_COLOR: Record<string,string> = { PRESENT:"#10b981", LATE:"#f59e0b", EARLY_LEAVE:"#eab308", ABSENT:"#ef4444", INCOMPLETE:"#f97316", LEAVE:"#3b82f6", MISSION:"#8b5cf6", REMOTE_WORK:"#06b6d4", HOLIDAY:"#94a3b8", COMPANY_HOLIDAY:"#64748b", WEEKEND:"#cbd5e1" };

const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const faY = (n: number) => (n ?? 0).toLocaleString("fa-IR", { useGrouping: false }); // years: no separator
const fmtMin = (m: number) => { const h = Math.floor((m||0)/60); const mm = (m||0)%60; return `${h}:${String(mm).padStart(2,"0")}`.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]); };
const fmtHours = (m: number) => `${faNum(Math.round((m||0)/60*10)/10)} ساعت`;

export default function AttendanceDashboardPage() {
  React.useEffect(() => { document.title = "داشبورد حضور و غیاب | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [data, setData] = React.useState<any>(null);
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  const [jYear, setJYear] = React.useState<number | null>(null);
  const [jMonth, setJMonth] = React.useState<number | null>(null);
  const [deptId, setDeptId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [relinking, setRelinking] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [diag, setDiag] = React.useState<any>(null);
  const [diagOpen, setDiagOpen] = React.useState(false);
  const [periods, setPeriods] = React.useState<Array<{ jYear: number; jMonth: number }>>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (jYear) qs.set("jYear", String(jYear));
      if (jMonth) qs.set("jMonth", String(jMonth));
      if (deptId) qs.set("departmentId", deptId);
      const res = await fetch(`${API}/attendance/dashboard?${qs}`, { headers: h });
      const d = res.ok ? await res.json() : null;
      setData(d);
      // Fallback seed (overridden by periods effect when data exists).
      if (d && jYear == null && Number.isFinite(d.jYear)) { setJYear(d.jYear); setJMonth(d.jMonth); }
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [jYear, jMonth, deptId]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
    fetch(`${API}/attendance/records/periods`, { headers: h }).then(r => r.ok ? r.json() : []).then((p) => {
      const arr = Array.isArray(p) ? p : [];
      setPeriods(arr);
      // Seed to the most recent period that actually has data.
      if (arr.length && jYear == null) { setJYear(arr[0].jYear); setJMonth(arr[0].jMonth); }
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  async function relink() {
    setRelinking(true); setMsg(null);
    try {
      const res = await fetch(`${API}/attendance/maintenance/relink`, { method: "POST", headers: h });
      const r = await res.json();
      setMsg(`اتصال انجام شد: ${faNum(r.linked)} پانچ متصل، ${faNum(r.recomputed)} روز محاسبه شد`);
      await load();
      await loadDiag();
    } catch { setMsg("خطا در بازمحاسبه (ممکن است به‌خاطر حجم زیاد طول بکشد — دوباره بزنید)"); }
    finally { setRelinking(false); setTimeout(() => setMsg(null), 8000); }
  }

  async function provisionCards() {
    if (!confirm("برای هر شماره کارتِ بدون کاربر، یک کاربر موقت (غیرفعال) با نام «کارت <شماره>» ساخته می‌شود و کل حضور و غیاب محاسبه می‌گردد. بعداً می‌توانید نام واقعی را در صفحه کاربران ویرایش کنید. ادامه می‌دهید؟")) return;
    setRelinking(true); setMsg(null);
    try {
      const res = await fetch(`${API}/attendance/maintenance/provision-cards`, { method: "POST", headers: h });
      const r = await res.json();
      setMsg(`${faNum(r.createdUsers)} کاربر ساخته شد، ${faNum(r.linked)} پانچ متصل، ${faNum(r.recomputed)} روز محاسبه شد (کل خام: ${faNum(r.rawTotal)})`);
      await load();
      await loadDiag();
    } catch { setMsg("خطا در عملیات (ممکن است طول بکشد — دوباره بزنید)"); }
    finally { setRelinking(false); setTimeout(() => setMsg(null), 10000); }
  }

  const loadDiag = React.useCallback(async () => {
    const d = await fetch(`${API}/attendance/maintenance/diagnostics`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null);
    setDiag(d);
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { loadDiag(); }, [loadDiag]);

  // Data-driven options — only years/months that have data.
  const yearOpts = React.useMemo(() => {
    const ys = [...new Set(periods.map(p => p.jYear))].sort((a, b) => b - a);
    return ys.length ? ys : (jYear ? [jYear] : []);
  }, [periods, jYear]);
  const monthOpts = React.useMemo(() => {
    const ms = [...new Set(periods.filter(p => p.jYear === jYear).map(p => p.jMonth))].sort((a, b) => a - b);
    return ms.length ? ms : (jMonth ? [jMonth] : []);
  }, [periods, jYear, jMonth]);

  const statusPie = Object.entries(data?.statusCounts || {}).map(([k, v]) => ({ name: STATUS_FA[k] || k, key: k, value: v as number }));
  const trend = (data?.trend || []).map((t: any) => ({ روز: t.jDay, حاضر: t.present, اضافه‌کار: Math.round(t.overtimeMinutes/60*10)/10, تاخیر: Math.round(t.delayMinutes/60*10)/10 }));
  const topOt = (data?.topOvertime || []).map((u: any) => ({ name: u.name, ساعت: Math.round(u.value/60*10)/10 }));
  const topDelay = (data?.topDelay || []).map((u: any) => ({ name: u.name, دقیقه: u.value }));
  const t = data?.totals || {};
  const today = data?.todayCounts || {};

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-5" dir="rtl">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Fingerprint className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">داشبورد حضور و غیاب</h1>
            <p className="text-sm text-theme-muted">{jMonth ? `${J_MONTHS[jMonth-1]} ${faY(jYear||0)}` : "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input-theme text-sm w-auto" value={jYear ?? ""} onChange={e => setJYear(+e.target.value)}>
            {yearOpts.map(y => <option key={y} value={y}>{faY(y)}</option>)}
          </select>
          <select className="input-theme text-sm w-auto" value={jMonth ?? ""} onChange={e => setJMonth(+e.target.value)}>
            {monthOpts.map(m => <option key={m} value={m}>{J_MONTHS[m-1]}</option>)}
          </select>
          <select className="input-theme text-sm w-auto" value={deptId} onChange={e => setDeptId(e.target.value)}>
            <option value="">همه دپارتمان‌ها</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Link href="/dashboard/attendance/records" className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><ArrowLeft className="w-4 h-4" /> کارکرد روزانه</Link>
          <button onClick={provisionCards} disabled={relinking} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50" title="ساخت خودکار کاربر برای هر شماره کارت و محاسبه کامل">
            {relinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} ساخت کاربر از کارت‌ها
          </button>
          <button onClick={relink} disabled={relinking} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50" title="اتصال پانچ‌های وارد‌شده به کاربران دارای کد کارت و بازمحاسبه">
            {relinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <TimerReset className="w-4 h-4" />} اتصال و بازمحاسبه
          </button>
        </div>
      </div>
      {msg && <div className="text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-2">{msg}</div>}

      {/* Data diagnostics — shown prominently when there is raw data but no computed days */}
      {diag && (
        <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
          <button onClick={() => setDiagOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Stethoscope className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-theme-primary">بررسی وضعیت داده</span>
              <span className="text-theme-muted">
                خام: {faNum(diag.rawTotal)} · متصل: {faNum(diag.rawMapped)} · بدون‌کاربر: {faNum(diag.rawUnmapped)} · روزهای محاسبه‌شده: {faNum(diag.dayTotal)} · کاربران دارای کارت: {faNum(diag.usersWithCard)}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform ${diagOpen ? "rotate-180" : ""}`} />
          </button>

          {diag.rawTotal > 0 && diag.dayTotal === 0 && (
            <div className="mx-4 mb-3 text-sm text-amber-700 bg-amber-500/10 rounded-lg p-3">
              {diag.usersWithCard === 0
                ? "هیچ کاربری کد کارت ندارد. ابتدا در صفحه «کاربران» برای هر فرد «کد کارت» را برابر همان CardNo دستگاه بگذارید، سپس «اتصال و بازمحاسبه» را بزنید. لیست کارت‌های موجود در دستگاه را در جدول پایین می‌بینید."
                : "کاربران دارای کارت هستند اما هیچ پانچی متصل نشده — یعنی کد کارت‌ها با CardNo دستگاه دقیقاً یکی نیستند. مقادیر ستون «کد کارت» جدول پایین را عیناً در پروفایل کاربران وارد کنید، سپس «اتصال و بازمحاسبه»."}
            </div>
          )}

          {diagOpen && (
            <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card list from device */}
              <div>
                <div className="text-xs font-semibold text-theme-secondary mb-2 flex items-center gap-1"><Database className="w-3.5 h-3.5" /> کارت‌های موجود در دستگاه</div>
                <div className="max-h-64 overflow-y-auto border border-theme rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-theme-card"><tr className="text-theme-muted text-right border-b border-theme">
                      <th className="py-1.5 px-2 font-medium">کد کارت</th><th className="font-medium px-2">تعداد پانچ</th><th className="font-medium px-2">وضعیت</th>
                    </tr></thead>
                    <tbody>
                      {diag.cards.map((c: any) => (
                        <tr key={c.cardNo} className="border-b border-theme/40">
                          <td className="py-1 px-2 text-theme-primary" dir="ltr">{c.cardNo}</td>
                          <td className="px-2 text-theme-muted">{faNum(c.count)}</td>
                          <td className="px-2">{c.mapped ? <span className="text-green-600">متصل</span> : <span className="text-red-500">بدون کاربر</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Sample raw rows — verify date parsing */}
              <div>
                <div className="text-xs font-semibold text-theme-secondary mb-2 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> نمونه پانچ‌های خام (بررسی تاریخ)</div>
                <div className="max-h-64 overflow-y-auto border border-theme rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-theme-card"><tr className="text-theme-muted text-right border-b border-theme">
                      <th className="py-1.5 px-2 font-medium">کارت</th><th className="font-medium px-2">mDate</th><th className="font-medium px-2">RTime</th><th className="font-medium px-2">تاریخ تشخیص</th><th className="font-medium px-2">ساعت</th>
                    </tr></thead>
                    <tbody>
                      {diag.sample.map((s: any, i: number) => (
                        <tr key={i} className="border-b border-theme/40">
                          <td className="py-1 px-2 text-theme-primary" dir="ltr">{s.cardNo}</td>
                          <td className="px-2 text-theme-muted" dir="ltr">{s.mDate || "—"}</td>
                          <td className="px-2 text-theme-muted" dir="ltr">{s.rTime || "—"}</td>
                          <td className="px-2 text-theme-primary" dir="ltr">{s.parsedJalali}</td>
                          <td className="px-2 text-theme-primary" dir="ltr">{s.parsedTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : !data ? (
        <div className="bg-theme-card border border-theme rounded-xl p-8 text-center text-theme-muted">داده‌ای یافت نشد</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat icon={Users} color="bg-blue-500" label="کاربران دارای کارت" value={faNum(data.mappedUsers)} />
            <Stat icon={CalendarCheck} color="bg-green-500" label="حاضر امروز" value={faNum(today.PRESENT || 0)} />
            <Stat icon={CalendarX} color="bg-red-500" label="غایب امروز" value={faNum(today.ABSENT || 0)} />
            <Stat icon={Clock} color="bg-violet-500" label="مجموع اضافه‌کار" value={fmtHours(t.overtimeMinutes)} />
            <Stat icon={AlertTriangle} color="bg-amber-500" label="مجموع تاخیر" value={fmtHours(t.delayMinutes)} />
            <Stat icon={Moon} color="bg-slate-500" label="مجموع شب‌کاری" value={fmtHours(t.nightMinutes)} />
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="توزیع وضعیت">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e:any)=>faNum(e.value)}>
                    {statusPie.map((s, i) => <Cell key={i} fill={STATUS_COLOR[s.key] || "#888"} />)}
                  </Pie>
                  <Tooltip formatter={(v:any)=>faNum(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <div className="lg:col-span-2">
              <Card title="روند ماهانه (حاضرین و اضافه‌کار)">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="روز" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="حاضر" stroke="#10b981" fill="#10b98133" />
                    <Area type="monotone" dataKey="اضافه‌کار" stroke="#8b5cf6" fill="#8b5cf633" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="بیشترین اضافه‌کار (ساعت)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topOt} layout="vertical" margin={{ right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="ساعت" fill="#8b5cf6" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="بیشترین تاخیر (دقیقه)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topDelay} layout="vertical" margin={{ right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="دقیقه" fill="#f59e0b" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-theme-primary truncate">{value}</div>
        <div className="text-[11px] text-theme-muted truncate">{label}</div>
      </div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-4">
      <h2 className="font-semibold text-theme-primary text-sm mb-3">{title}</h2>
      {children}
    </div>
  );
}
