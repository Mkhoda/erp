"use client";
import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  PieChart, Loader2, Users, Fingerprint, Boxes, ListTodo, Ticket, Activity, Table2, BarChart3, RefreshCw,
} from "lucide-react";
import { pageTitle } from "../../../lib/branding";
import { readError } from "../../../lib/http";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

// ── Labels ───────────────────────────────────────────────────────────────
const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const ATT_FA: Record<string, string> = { PRESENT: "حاضر", LATE: "تاخیر", EARLY_LEAVE: "تعجیل", ABSENT: "غیبت", INCOMPLETE: "ناقص", LEAVE: "مرخصی", SICK_LEAVE: "استعلاجی", MISSION: "ماموریت", REMOTE_WORK: "دورکاری", HOLIDAY: "تعطیل", COMPANY_HOLIDAY: "تعطیل شرکت", WEEKEND: "آخر هفته", OFF_DUTY: "استراحت (شیفت)" };
const AVAIL_FA: Record<string, string> = { AVAILABLE: "موجود", IN_USE: "در حال استفاده", CONSUMED: "مصرف شده", MAINTENANCE: "تعمیرات", RETIRED: "خارج از رده", LOST: "مفقود" };
const COND_FA: Record<string, string> = { NEW: "جدید", USED_GOOD: "استفاده‌شده سالم", DEFECTIVE: "معیوب" };
const TICKET_FA: Record<string, string> = { OPEN: "باز", ASSIGNED: "ارجاع‌شده", IN_PROGRESS: "در حال انجام", WAITING_USER: "منتظر کاربر", USER_REPLIED: "پاسخ کاربر", RESOLVED: "حل‌شده", CLOSED: "بسته", CANCELLED: "لغوشده", REJECTED: "ردشده" };
const PRIORITY_FA: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "زیاد", CRITICAL: "بحرانی" };
const ROLE_FA: Record<string, string> = { ADMIN: "مدیر ارشد", MANAGER: "مدیر", EXPERT: "کارشناس", USER: "کاربر" };
const REQ_FA: Record<string, string> = { CHECK_IN_FIX: "اصلاح ورود", CHECK_OUT_FIX: "اصلاح خروج", FULL_DAY_FIX: "اصلاح کل روز", EXPLANATION: "توضیح", LEAVE: "مرخصی/ماموریت/دورکاری" };
const NOTIF_FA: Record<string, string> = { SYSTEM: "سیستمی", TICKET: "تیکت", WORKFLOW: "گردش کار", APPROVAL: "تایید", HR: "منابع انسانی", FINANCE: "مالی", IT: "فناوری", ATTENDANCE: "حضور", SECURITY: "امنیت", CHAT: "گفتگو", REMINDER: "یادآوری", INFORMATION: "اطلاع‌رسانی" };

// ── Formatting ───────────────────────────────────────────────────────────
const toFa = (s: string) => s.replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const hrs = (min: number) => Math.round((min || 0) / 6) / 10; // minutes → hours, 1 decimal
const fmtH = (min: number) => `${faNum(hrs(min))} ساعت`;
const money = (n: number) => `${faNum(Math.round(n || 0))} تومان`;
const pct = (a: number, b: number) => (b ? `${faNum(Math.round((a / b) * 100))}٪` : "—");
const faDay = (iso: string) => toFa(new Date(iso + "T00:00:00Z").toLocaleDateString("en-US-u-ca-persian", { day: "numeric", timeZone: "UTC" }));

function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return { jYear: +(p.find(x => x.type === "year")?.value || 0), jMonth: +(p.find(x => x.type === "month")?.value || 0) };
}

// ── Chart palette (validated reference palette, fixed slot order, light + dark steps) ──
const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
const INK = {
  light: { grid: "#e1e0d9", axis: "#c3c2b7", muted: "#898781", text: "#52514e", surface: "#fcfcfb" },
  dark: { grid: "#2c2c2a", axis: "#383835", muted: "#898781", text: "#c3c2b7", surface: "#1a1a19" },
};
function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
function useChartTheme() {
  const dark = useIsDark();
  return { series: dark ? SERIES_DARK : SERIES_LIGHT, ink: dark ? INK.dark : INK.light };
}

type TabKey = "overview" | "attendance" | "assets" | "worklog" | "tickets" | "system";
const TABS: Array<{ k: TabKey; label: string; icon: any; path: string; period?: boolean }> = [
  { k: "overview", label: "نمای کلی", icon: PieChart, path: "overview" },
  { k: "attendance", label: "حضور و غیاب", icon: Fingerprint, path: "attendance", period: true },
  { k: "assets", label: "اموال", icon: Boxes, path: "assets" },
  { k: "worklog", label: "عملکرد", icon: ListTodo, path: "work-log", period: true },
  { k: "tickets", label: "تیکت‌ها", icon: Ticket, path: "tickets" },
  { k: "system", label: "کاربران و سامانه", icon: Users, path: "system" },
];

export default function AnalyticsPage() {
  React.useEffect(() => { document.title = pageTitle("داشبورد مدیریتی"); }, []);
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [period, setPeriod] = React.useState(currentJalali);
  const [data, setData] = React.useState<Record<string, any>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const cur = TABS.find(t => t.k === tab)!;
  const cacheKey = cur.period ? `${tab}:${period.jYear}-${period.jMonth}` : tab;

  const load = React.useCallback(async (force = false) => {
    if (!force && data[cacheKey]) return;
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("token");
      const qs = cur.period ? `?jYear=${period.jYear}&jMonth=${period.jMonth}` : "";
      const res = await fetch(`${API}/analytics/${cur.path}${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError(await readError(res, "خطا در دریافت آمار")); return; }
      const d = await res.json();
      setData(s => ({ ...s, [cacheKey]: d }));
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [cacheKey]);
  React.useEffect(() => { load(); }, [load]);

  const d = data[cacheKey];
  const yearOpts = [period.jYear - 1, period.jYear, period.jYear + 1].filter((y, i, a) => a.indexOf(y) === i);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><PieChart className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">داشبورد مدیریتی</h1>
            <p className="text-sm text-theme-muted">متریک‌های حضور، اموال، عملکرد، تیکت‌ها و سامانه در یک‌جا</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cur.period && (
            <>
              <select className="input-theme text-sm w-auto" value={period.jMonth} onChange={e => setPeriod(p => ({ ...p, jMonth: +e.target.value }))}>
                {J_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className="input-theme text-sm w-auto" value={period.jYear} onChange={e => setPeriod(p => ({ ...p, jYear: +e.target.value }))}>
                {yearOpts.map(y => <option key={y} value={y}>{toFa(String(y))}</option>)}
              </select>
            </>
          )}
          <button onClick={() => load(true)} disabled={loading} title="بروزرسانی" className="p-2 rounded-lg bg-theme-card border border-theme text-theme-primary disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap bg-theme-secondary border border-theme p-1 rounded-xl w-fit max-w-full">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.k ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {!d ? (
        loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> : null
      ) : tab === "overview" ? <OverviewTab d={d} />
        : tab === "attendance" ? <AttendanceTab d={d} />
        : tab === "assets" ? <AssetsTab d={d} />
        : tab === "worklog" ? <WorkLogTab d={d} />
        : tab === "tickets" ? <TicketsTab d={d} />
        : <SystemTab d={d} />}
    </div>
  );
}

// ═════════════════════════════ Building blocks ═════════════════════════════

function Tile({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon?: any }) {
  return (
    <div className="bg-theme-card border border-theme rounded-2xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-theme-muted">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-theme-primary">{value}</div>
      {sub && <div className="text-[11px] text-theme-muted mt-0.5">{sub}</div>}
    </div>
  );
}

// Every chart has a table view (relief for light-mode series below 3:1, and for exact values).
function ChartCard({ title, subtitle, table, children, className = "" }: {
  title: string; subtitle?: string; className?: string;
  table: { head: string[]; rows: (string | number)[][] }; children: React.ReactNode;
}) {
  const [asTable, setAsTable] = React.useState(false);
  return (
    <div className={`bg-theme-card border border-theme rounded-xl p-3 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-semibold text-theme-primary">{title}</div>
          {subtitle && <div className="text-[11px] text-theme-muted">{subtitle}</div>}
        </div>
        <button onClick={() => setAsTable(v => !v)} title={asTable ? "نمایش نمودار" : "نمایش جدول"} className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-hover">
          {asTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
        </button>
      </div>
      {table.rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-theme-muted">داده‌ای وجود ندارد</div>
      ) : asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-theme-muted border-b border-theme">{table.head.map(h => <th key={h} className="text-right py-1.5 px-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => (
              <tr key={i} className="border-b border-theme/40">{r.map((c, j) => <td key={j} className="py-1.5 px-2 text-theme-secondary">{typeof c === "number" ? faNum(c) : c}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : children}
    </div>
  );
}

function TooltipBox({ active, payload, label, fmt, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="bg-theme-card border border-theme rounded-lg shadow-lg px-3 py-2 text-xs">
      {label != null && <div className="text-theme-primary font-medium mb-1">{labelFmt ? labelFmt(label) : label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-theme-secondary">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}:</span><span className="text-theme-primary font-medium">{fmt ? fmt(p.value) : faNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Ranked single-series horizontal bars (one hue, no legend — the title names the measure).
function HBars({ data, valueLabel, fmt, limit = 10 }: { data: { name: string; value: number }[]; valueLabel: string; fmt?: (v: number) => string; limit?: number }) {
  const { series, ink } = useChartTheme();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  if (sorted.length > limit) top.push({ name: "سایر", value: sorted.slice(limit).reduce((s, x) => s + x.value, 0) });
  const h = Math.max(120, top.length * 30 + 30);
  return (
    <div dir="ltr" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={ink.grid} />
          <XAxis type="number" reversed tick={{ fill: ink.muted, fontSize: 11 }} tickFormatter={v => faNum(v)} axisLine={{ stroke: ink.axis }} tickLine={false} />
          <YAxis type="category" dataKey="name" orientation="right" width={130} tick={{ fill: ink.text, fontSize: 11 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
          <Tooltip cursor={{ fill: ink.grid, opacity: 0.4 }} content={<TooltipBox fmt={fmt} />} />
          <Bar dataKey="value" name={valueLabel} fill={series[0]} radius={[4, 0, 0, 4]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Stacked daily bars: fixed slot order per series, legend always present (>= 2 series).
function DailyStack({ data, series: defs, height = 240 }: { data: any[]; series: { key: string; label: string }[]; height?: number }) {
  const { series, ink } = useChartTheme();
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={ink.grid} />
          <XAxis dataKey="date" reversed tickFormatter={faDay} tick={{ fill: ink.muted, fontSize: 10 }} axisLine={{ stroke: ink.axis }} tickLine={false} interval="preserveStartEnd" />
          <YAxis orientation="right" width={36} allowDecimals={false} tick={{ fill: ink.muted, fontSize: 10 }} tickFormatter={v => faNum(v)} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: ink.grid, opacity: 0.4 }} content={<TooltipBox labelFmt={(l: string) => `روز ${faDay(l)}`} />} />
          <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />
          {defs.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={series[i]} stroke={ink.surface} strokeWidth={1}
              radius={i === defs.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={22} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DailyLines({ data, series: defs, height = 240 }: { data: any[]; series: { key: string; label: string }[]; height?: number }) {
  const { series, ink } = useChartTheme();
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={ink.grid} />
          <XAxis dataKey="date" reversed tickFormatter={faDay} tick={{ fill: ink.muted, fontSize: 10 }} axisLine={{ stroke: ink.axis }} tickLine={false} interval="preserveStartEnd" />
          <YAxis orientation="right" width={36} allowDecimals={false} tick={{ fill: ink.muted, fontSize: 10 }} tickFormatter={v => faNum(v)} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: ink.axis }} content={<TooltipBox labelFmt={(l: string) => `روز ${faDay(l)}`} />} />
          {defs.length > 1 && <Legend wrapperStyle={{ fontSize: 11, direction: "rtl" }} />}
          {defs.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={series[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: ink.surface, strokeWidth: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const kv = (rows: { key: string; count: number }[], map: Record<string, string>) => rows.map(r => ({ name: map[r.key] || r.key, value: r.count }));

// ═════════════════════════════ Tabs ═════════════════════════════

function OverviewTab({ d }: { d: any }) {
  const st = d.attendanceToday.statuses || {};
  const wl = d.workLogToday || {};
  const statusRows = Object.entries(st).map(([k, v]) => ({ name: ATT_FA[k] || k, value: v as number }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Tile icon={Users} label="کاربران فعال" value={faNum(d.users.active)} sub={`${faNum(d.users.onlineNow)} نفر آنلاین · ${faNum(d.users.disabled)} غیرفعال`} />
        <Tile icon={Fingerprint} label="حاضر امروز" value={faNum(d.attendanceToday.present)} sub={`غیبت ${faNum(st.ABSENT || 0)} · مرخصی ${faNum((st.LEAVE || 0) + (st.SICK_LEAVE || 0))} · دورکاری ${faNum(st.REMOTE_WORK || 0)}`} />
        <Tile icon={Boxes} label="اموال" value={faNum(d.assets.count)} sub={money(d.assets.value)} />
        <Tile icon={Ticket} label="تیکت‌های باز" value={faNum(d.tickets.open)} sub={`${faNum(d.tickets.overdue)} مورد از مهلت گذشته`} />
        <Tile icon={ListTodo} label="گزارش عملکرد امروز" value={pct((wl.submitted || 0) + (wl.late || 0), wl.required || 0)} sub={`${faNum((wl.submitted || 0) + (wl.late || 0))} از ${faNum(wl.required || 0)} نفر ثبت کرده‌اند`} />
        <Tile icon={Fingerprint} label="درخواست‌های حضور در انتظار" value={faNum(d.attendanceRequestsPending)} />
        <Tile icon={Activity} label="اعلان‌های خوانده‌نشده" value={faNum(d.unreadNotifications)} />
        <Tile icon={ListTodo} label="زمان ثبت‌شده امروز" value={fmtH(wl.loggedMinutes || 0)} />
      </div>
      <ChartCard title="وضعیت حضور امروز" subtitle="تعداد نفرات در هر وضعیت" table={{ head: ["وضعیت", "تعداد"], rows: statusRows.map(r => [r.name, r.value]) }}>
        <HBars data={statusRows} valueLabel="نفر" />
      </ChartCard>
    </div>
  );
}

function AttendanceTab({ d }: { d: any }) {
  const t = d.totals || {};
  const people = (rows: any[], key: string) => rows.map((r: any) => ({ name: r.name, value: hrs(r[key]) }));
  const statusRows = Object.entries(d.statusCounts || {}).map(([k, v]) => ({ name: ATT_FA[k] || k, value: v as number }));
  const series = [{ key: "present", label: "حاضر" }, { key: "late", label: "با تاخیر" }, { key: "absent", label: "غیبت" }, { key: "leave", label: "مرخصی" }, { key: "remote", label: "دورکاری" }];
  // "late" is a subset of present — chart present-on-time so the stack adds up.
  const daily = (d.daily || []).map((x: any) => ({ ...x, present: x.present - x.late }));
  const reqRows = (d.requests || []).map((r: any) => [REQ_FA[r.type] || r.type, r.status === "PENDING" ? "در انتظار" : r.status === "APPROVED" ? "تاییدشده" : r.status === "REJECTED" ? "ردشده" : r.status, r.count]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <Tile label="کارکرد کل" value={fmtH(t.workedMinutes)} />
        <Tile label="اضافه‌کار عادی" value={fmtH(t.overtimeMinutes)} />
        <Tile label="تعطیل‌کاری" value={fmtH(t.holidayOvertimeMinutes)} />
        <Tile label="کسری" value={fmtH(t.deficitMinutes)} />
        <Tile label="تاخیر" value={fmtH(t.delayMinutes)} />
        <Tile label="دورکاری" value={fmtH(t.remoteMinutes)} sub={`اضافه‌کار دورکاری: ${fmtH(t.remoteOvertimeMinutes)}`} />
      </div>
      <ChartCard title={`روند روزانه حضور — ${J_MONTHS[d.jMonth - 1]} ${toFa(String(d.jYear))}`} subtitle="تعداد نفرات در هر روز"
        table={{ head: ["روز", ...series.map(s => s.label)], rows: (d.daily || []).map((x: any) => [faDay(x.date), x.present - x.late, x.late, x.absent, x.leave, x.remote]) }}>
        <DailyStack data={daily} series={series} />
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="بیشترین اضافه‌کار" subtitle="ساعت" table={{ head: ["نام", "دپارتمان", "ساعت"], rows: d.topOvertime.map((r: any) => [r.name, r.department || "—", hrs(r.overtimeMinutes)]) }}>
          <HBars data={people(d.topOvertime, "overtimeMinutes")} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="بیشترین تاخیر" subtitle="ساعت" table={{ head: ["نام", "دپارتمان", "ساعت"], rows: d.topDelay.map((r: any) => [r.name, r.department || "—", hrs(r.delayMinutes)]) }}>
          <HBars data={people(d.topDelay, "delayMinutes")} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="بیشترین کسری کارکرد" subtitle="ساعت" table={{ head: ["نام", "دپارتمان", "ساعت"], rows: d.topDeficit.map((r: any) => [r.name, r.department || "—", hrs(r.deficitMinutes)]) }}>
          <HBars data={people(d.topDeficit, "deficitMinutes")} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="کارکرد به تفکیک دپارتمان" subtitle="ساعت"
          table={{ head: ["دپارتمان", "نفرات", "کارکرد", "اضافه‌کار", "تاخیر", "کسری"], rows: d.byDepartment.map((r: any) => [r.department, r.people, hrs(r.workedMinutes), hrs(r.overtimeMinutes), hrs(r.delayMinutes), hrs(r.deficitMinutes)]) }}>
          <HBars data={d.byDepartment.map((r: any) => ({ name: r.department, value: hrs(r.workedMinutes) }))} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="روزها بر اساس وضعیت" subtitle="تعداد روز-نفر در ماه" table={{ head: ["وضعیت", "تعداد"], rows: statusRows.map(r => [r.name, r.value]) }}>
          <HBars data={statusRows} valueLabel="روز" />
        </ChartCard>
        <ChartCard title="درخواست‌های اصلاح و مرخصی" subtitle="ثبت‌شده در این ماه" table={{ head: ["نوع", "وضعیت", "تعداد"], rows: reqRows }}>
          <HBars data={Object.values((d.requests || []).reduce((m: any, r: any) => { const k = REQ_FA[r.type] || r.type; m[k] = { name: k, value: (m[k]?.value || 0) + r.count }; return m; }, {}))} valueLabel="درخواست" />
        </ChartCard>
      </div>
    </div>
  );
}

function AssetsTab({ d }: { d: any }) {
  const months = d.addedPerMonth.map((m: any) => ({ date: m.label, count: m.count }));
  const { series, ink } = useChartTheme();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Tile icon={Boxes} label="تعداد اموال" value={faNum(d.total)} />
        <Tile label="ارزش کل" value={money(d.value)} />
        <Tile label="واگذاری‌های فعال" value={faNum(d.activeAssignments)} sub={pct(d.activeAssignments, d.total) + " از اموال"} />
        <Tile label="معیوب" value={faNum(d.byCondition.find((c: any) => c.key === "DEFECTIVE")?.count || 0)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="وضعیت در دسترس بودن" table={{ head: ["وضعیت", "تعداد", "ارزش"], rows: d.byAvailability.map((r: any) => [AVAIL_FA[r.key] || r.key, r.count, money(r.value)]) }}>
          <HBars data={kv(d.byAvailability, AVAIL_FA)} valueLabel="دارایی" />
        </ChartCard>
        <ChartCard title="وضعیت فیزیکی" table={{ head: ["وضعیت", "تعداد"], rows: d.byCondition.map((r: any) => [COND_FA[r.key] || r.key, r.count]) }}>
          <HBars data={kv(d.byCondition, COND_FA)} valueLabel="دارایی" />
        </ChartCard>
        <ChartCard title="به تفکیک دسته" table={{ head: ["دسته", "تعداد", "ارزش"], rows: d.byCategory.map((r: any) => [r.name, r.count, money(r.value)]) }}>
          <HBars data={d.byCategory.map((r: any) => ({ name: r.name, value: r.count }))} valueLabel="دارایی" />
        </ChartCard>
        <ChartCard title="به تفکیک نوع" table={{ head: ["نوع", "تعداد"], rows: d.byType.map((r: any) => [r.name, r.count]) }}>
          <HBars data={d.byType.map((r: any) => ({ name: r.name, value: r.count }))} valueLabel="دارایی" />
        </ChartCard>
        <ChartCard title="واگذاری فعال به تفکیک دپارتمان" table={{ head: ["دپارتمان", "تعداد"], rows: d.assignedByDepartment.map((r: any) => [r.name, r.count]) }}>
          <HBars data={d.assignedByDepartment.map((r: any) => ({ name: r.name, value: r.count }))} valueLabel="دارایی" />
        </ChartCard>
        <ChartCard title="دارایی‌های ثبت‌شده در ۱۲ ماه اخیر" table={{ head: ["ماه", "تعداد"], rows: months.map((m: any) => [toFa(m.date), m.count]) }}>
          <div dir="ltr" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={4}>
                <CartesianGrid vertical={false} stroke={ink.grid} />
                <XAxis dataKey="date" reversed tickFormatter={(v: string) => toFa(v.slice(2))} tick={{ fill: ink.muted, fontSize: 10 }} axisLine={{ stroke: ink.axis }} tickLine={false} />
                <YAxis orientation="right" width={32} allowDecimals={false} tick={{ fill: ink.muted, fontSize: 10 }} tickFormatter={v => faNum(v)} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: ink.grid, opacity: 0.4 }} content={<TooltipBox labelFmt={(l: string) => toFa(l)} />} />
                <Bar dataKey="count" name="دارایی" fill={series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function WorkLogTab({ d }: { d: any }) {
  const s = d.summary;
  if (!s) return <div className="bg-theme-card border border-theme rounded-xl p-8 text-center text-sm text-theme-muted">برای این ماه هنوز داده‌ای وجود ندارد</div>;
  const done = s.submitted + s.late;
  const series = [{ key: "submitted", label: "به‌موقع" }, { key: "late", label: "با تأخیر" }, { key: "missing", label: "ثبت‌نشده" }];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Tile label="نرخ ثبت گزارش" value={pct(done, s.required)} sub={`${faNum(done)} از ${faNum(s.required)} روز-نفر`} />
        <Tile label="ثبت به‌موقع" value={faNum(s.submitted)} />
        <Tile label="ثبت با تأخیر" value={faNum(s.late)} />
        <Tile label="ثبت‌نشده" value={faNum(s.missing)} />
        <Tile label="کل زمان ثبت‌شده" value={fmtH(s.loggedMinutes)} />
      </div>
      <ChartCard title={`روند روزانه ثبت گزارش — ${J_MONTHS[d.jMonth - 1]} ${toFa(String(d.jYear))}`} subtitle="تعداد نفرات"
        table={{ head: ["روز", ...series.map(x => x.label)], rows: d.daily.map((x: any) => [faDay(x.date), x.submitted, x.late, x.missing]) }}>
        <DailyStack data={d.daily} series={series} />
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="زمان ثبت‌شده به تفکیک دسته" subtitle="ساعت" table={{ head: ["دسته", "ساعت"], rows: d.byCategory.map((r: any) => [r.name, hrs(r.minutes)]) }}>
          <HBars data={d.byCategory.map((r: any) => ({ name: r.name, value: hrs(r.minutes) }))} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="بیشترین زمان ثبت‌شده" subtitle="ساعت" table={{ head: ["نام", "دپارتمان", "ساعت", "گزارش", "با تأخیر", "ثبت‌نشده"], rows: d.topUsers.map((r: any) => [r.name, r.department || "—", hrs(r.loggedMinutes), r.reports, r.late, r.missing]) }}>
          <HBars data={d.topUsers.map((r: any) => ({ name: r.name, value: hrs(r.loggedMinutes) }))} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="نرخ ثبت گزارش به تفکیک دپارتمان" subtitle="درصد روزهای نیازمند گزارش که ثبت شده"
          table={{ head: ["دپارتمان", "الزامی", "به‌موقع", "با تأخیر", "ثبت‌نشده", "زمان (ساعت)"], rows: d.byDepartment.map((r: any) => [r.department, r.required, r.submitted, r.late, r.missing, hrs(r.loggedMinutes)]) }}
          className="lg:col-span-2">
          <HBars data={d.byDepartment.map((r: any) => ({ name: r.department, value: r.required ? Math.round(((r.submitted + r.late) / r.required) * 100) : 0 }))} valueLabel="درصد" fmt={v => `${faNum(v)}٪`} />
        </ChartCard>
      </div>
    </div>
  );
}

function TicketsTab({ d }: { d: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Tile label="ایجادشده (۳۰ روز)" value={faNum(d.createdLast30)} />
        <Tile label="حل‌شده (۳۰ روز)" value={faNum(d.resolvedLast30)} />
        <Tile label="میانگین زمان حل" value={d.avgResolutionHours == null ? "—" : `${faNum(d.avgResolutionHours)} ساعت`} />
        <Tile label="از مهلت گذشته" value={faNum(d.overdue)} />
      </div>
      <ChartCard title="تیکت‌های ایجادشده و حل‌شده — ۳۰ روز اخیر"
        table={{ head: ["روز", "ایجادشده", "حل‌شده"], rows: d.daily.map((x: any) => [faDay(x.date), x.created, x.resolved]) }}>
        <DailyLines data={d.daily} series={[{ key: "created", label: "ایجادشده" }, { key: "resolved", label: "حل‌شده" }]} />
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="همه تیکت‌ها بر اساس وضعیت" table={{ head: ["وضعیت", "تعداد"], rows: d.byStatus.map((r: any) => [TICKET_FA[r.key] || r.key, r.count]) }}>
          <HBars data={kv(d.byStatus, TICKET_FA)} valueLabel="تیکت" />
        </ChartCard>
        <ChartCard title="تیکت‌های باز بر اساس اولویت" table={{ head: ["اولویت", "تعداد"], rows: d.openByPriority.map((r: any) => [PRIORITY_FA[r.key] || r.key, r.count]) }}>
          <HBars data={kv(d.openByPriority, PRIORITY_FA)} valueLabel="تیکت" />
        </ChartCard>
        <ChartCard title="تیکت‌های باز به تفکیک دپارتمان" table={{ head: ["دپارتمان", "تعداد"], rows: d.openByDepartment.map((r: any) => [r.name, r.count]) }}>
          <HBars data={d.openByDepartment.map((r: any) => ({ name: r.name, value: r.count }))} valueLabel="تیکت" />
        </ChartCard>
      </div>
    </div>
  );
}

function SystemTab({ d }: { d: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Tile label="آنلاین (۱۵ دقیقه اخیر)" value={faNum(d.onlineNow)} />
        <Tile label="نشست فعال (۲۴ ساعت)" value={faNum(d.activeSessions24h)} />
        <Tile label="کاربران غیرفعال" value={faNum(d.disabledUsers)} />
        <Tile label="کاربران بدون کارت حضور" value={faNum(d.usersWithoutCard)} />
        <Tile label="پیام‌ها (۳۰ روز)" value={faNum(d.messagesLast30)} />
      </div>
      <ChartCard title="پیام‌های ارسال‌شده — ۳۰ روز اخیر" table={{ head: ["روز", "پیام"], rows: d.messagesDaily.map((x: any) => [faDay(x.date), x.messages]) }}>
        <DailyLines data={d.messagesDaily} series={[{ key: "messages", label: "پیام" }]} height={200} />
      </ChartCard>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="کاربران فعال بر اساس نقش" table={{ head: ["نقش", "تعداد"], rows: d.usersByRole.map((r: any) => [ROLE_FA[r.key] || r.key, r.count]) }}>
          <HBars data={kv(d.usersByRole, ROLE_FA)} valueLabel="کاربر" />
        </ChartCard>
        <ChartCard title="کاربران فعال به تفکیک دپارتمان" table={{ head: ["دپارتمان", "تعداد"], rows: d.usersByDepartment.map((r: any) => [r.name, r.count]) }}>
          <HBars data={d.usersByDepartment.map((r: any) => ({ name: r.name, value: r.count }))} valueLabel="کاربر" />
        </ChartCard>
        <ChartCard title="اعلان‌های ارسال‌شده (۳۰ روز)" table={{ head: ["دسته", "تعداد"], rows: d.notificationsByCategory.map((r: any) => [NOTIF_FA[r.key] || r.key, r.count]) }}>
          <HBars data={kv(d.notificationsByCategory, NOTIF_FA)} valueLabel="اعلان" />
        </ChartCard>
      </div>
    </div>
  );
}
