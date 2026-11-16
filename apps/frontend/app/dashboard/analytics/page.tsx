"use client";
import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  toFa, faNum, hrs, fmtH, money, pct, faDay, useChartTheme, Tile, ChartCard, TooltipBox, HBars, DailyStack, DailyLines,
} from "../../components/charts/ChartKit";
import {
  PieChart, Loader2, Users, Fingerprint, Boxes, ListTodo, Ticket, Activity, RefreshCw,
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
function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return { jYear: +(p.find(x => x.type === "year")?.value || 0), jMonth: +(p.find(x => x.type === "month")?.value || 0) };
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
  // Work-rule groups (checkboxes) + department narrow the people-based tabs.
  const [groups, setGroups] = React.useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [groupIds, setGroupIds] = React.useState<string[]>([]);
  const [deptId, setDeptId] = React.useState("");
  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API}/attendance/schedules-lite`, { headers: h }).then(r => r.ok ? r.json() : []).then(d => setGroups(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const peopleTab = tab === "overview" || tab === "attendance" || tab === "worklog";
  const peopleQs = peopleTab ? [groupIds.length ? `scheduleIds=${groupIds.join(",")}` : "", deptId ? `departmentId=${deptId}` : ""].filter(Boolean).join("&") : "";
  const cacheKey = (cur.period ? `${tab}:${period.jYear}-${period.jMonth}` : tab) + (peopleQs ? `|${peopleQs}` : "");

  const load = React.useCallback(async (force = false) => {
    if (!force && data[cacheKey]) return;
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("token");
      const parts = [cur.period ? `jYear=${period.jYear}&jMonth=${period.jMonth}` : "", peopleQs].filter(Boolean);
      const qs = parts.length ? `?${parts.join("&")}` : "";
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

      {peopleTab && (groups.length > 0 || departments.length > 0) && (
        <div className="bg-theme-card border border-theme rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-xs text-theme-muted">گروه‌های قوانین کاری:</span>
          {groups.map(g => (
            <label key={g.id} className="flex items-center gap-1.5 text-theme-primary cursor-pointer">
              <input type="checkbox" checked={groupIds.includes(g.id)} onChange={e => setGroupIds(ids => e.target.checked ? [...ids, g.id] : ids.filter(x => x !== g.id))} />
              {g.isDefault ? "پیش‌فرض سازمان" : g.name}
            </label>
          ))}
          <select value={deptId} onChange={e => setDeptId(e.target.value)} className="input-theme text-sm w-auto">
            <option value="">همه دپارتمان‌ها</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {(groupIds.length > 0 || deptId) && <button onClick={() => { setGroupIds([]); setDeptId(""); }} className="text-xs text-red-600 hover:underline">حذف فیلترها</button>}
          <span className="text-[11px] text-theme-muted mr-auto">هیچ گروهی انتخاب نشود = همه</span>
        </div>
      )}

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
  const td = d.today || { statuses: {} };
  const st = td.statuses || {};
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-theme-secondary">امروز (لحظه‌ای)</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <Tile label="درصد حضور" value={td.attendancePct == null ? "—" : `${faNum(td.attendancePct)}٪`} sub={`${faNum(td.present || 0)} از ${faNum(td.activeUsers || 0)} نفر`} />
        <Tile label="در حال کار" value={faNum(td.working || 0)} />
        <Tile label="حاضر" value={faNum(st.PRESENT || 0)} />
        <Tile label="با تاخیر" value={faNum(st.LATE || 0)} />
        <Tile label="تعجیل" value={faNum(st.EARLY_LEAVE || 0)} />
        <Tile label="غایب" value={faNum(st.ABSENT || 0)} />
        <Tile label="ناقص" value={faNum(st.INCOMPLETE || 0)} />
        <Tile label="مرخصی / ماموریت / دورکاری" value={faNum((st.LEAVE || 0) + (st.SICK_LEAVE || 0) + (st.MISSION || 0) + (st.REMOTE_WORK || 0))} />
      </div>
      <div className="text-xs font-semibold text-theme-secondary">{J_MONTHS[d.jMonth - 1]} {toFa(String(d.jYear))}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <Tile label="کارکرد کل" value={fmtH(t.workedMinutes)} />
        <Tile label="شب‌کاری" value={fmtH(t.nightMinutes)} />
        <Tile label="تعجیل" value={fmtH(t.earlyLeaveMinutes)} />
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
        <ChartCard title="بیشترین کارکرد" subtitle="ساعت — همه‌ی کارکنان، شامل ساعتی" table={{ head: ["نام", "دپارتمان", "ساعت"], rows: (d.topWorked || []).map((r: any) => [r.name, r.department || "—", hrs(r.workedMinutes)]) }}>
          <HBars data={people(d.topWorked || [], "workedMinutes")} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="درخواست‌های اصلاح و مرخصی" subtitle="ثبت‌شده در این ماه" table={{ head: ["نوع", "وضعیت", "تعداد"], rows: reqRows }}>
          <HBars data={Object.values((d.requests || []).reduce((m: any, r: any) => { const k = REQ_FA[r.type] || r.type; m[k] = { name: k, value: (m[k]?.value || 0) + r.count }; return m; }, {}))} valueLabel="درخواست" />
        </ChartCard>
      </div>
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-theme">
          <span className="text-sm font-semibold text-theme-primary">رکوردهای ناقص نیازمند اصلاح ({faNum((d.incompleteOpen || []).length)})</span>
          <a href="/dashboard/attendance/records" className="text-xs text-blue-600 hover:underline">کارکرد روزانه</a>
        </div>
        {(d.incompleteOpen || []).length === 0 ? (
          <div className="py-6 text-center text-xs text-theme-muted">رکورد ناقصی در این ماه نیست</div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-theme-muted border-b border-theme"><th className="text-right py-1.5 px-3">نام</th><th className="text-right">دپارتمان</th><th className="text-right">تاریخ</th><th>ورود</th><th>خروج</th></tr></thead>
              <tbody>{d.incompleteOpen.map((r: any) => (
                <tr key={r.userId + r.date} className="border-b border-theme/40">
                  <td className="py-1.5 px-3 text-theme-primary">{r.name}</td><td className="text-theme-muted">{r.department || "—"}</td>
                  <td className="text-theme-muted">{new Date(r.date + "T00:00:00Z").toLocaleDateString("fa-IR", { timeZone: "UTC" })}</td>
                  <td className="text-center" dir="ltr">{r.firstCheckIn ? new Date(r.firstCheckIn).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }) : "—"}</td>
                  <td className="text-center" dir="ltr">{r.lastCheckOut ? new Date(r.lastCheckOut).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }) : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      <Insights d={d} />
      <p className="text-[11px] text-theme-muted">کارکنان ساعتی فقط در آمار کارکرد می‌آیند؛ در رتبه‌بندی اضافه‌کار، تاخیر و کسری حساب نمی‌شوند.</p>
    </div>
  );
}

// Short plain-language notes derived from the month's numbers.
function Insights({ d }: { d: any }) {
  const notes: string[] = [];
  const daily = (d.daily || []) as any[];
  const worst = [...daily].sort((a, b) => b.absent - a.absent)[0];
  if (worst?.absent) notes.push(`بیشترین غیبت در روز ${faDay(worst.date)} با ${faNum(worst.absent)} نفر بوده است.`);
  const lateDays = daily.filter(x => x.late > 0);
  if (lateDays.length) notes.push(`در ${faNum(lateDays.length)} روز از ماه تاخیر ثبت شده؛ میانگین ${faNum(Math.round(lateDays.reduce((s, x) => s + x.late, 0) / lateDays.length))} نفر در هر روز.`);
  const deptDelay = [...(d.byDepartment || [])].sort((a: any, b: any) => b.delayMinutes - a.delayMinutes)[0];
  if (deptDelay?.delayMinutes) notes.push(`بیشترین تاخیر مربوط به دپارتمان «${deptDelay.department}» با ${fmtH(deptDelay.delayMinutes)} است.`);
  const deptOt = [...(d.byDepartment || [])].sort((a: any, b: any) => b.overtimeMinutes - a.overtimeMinutes)[0];
  if (deptOt?.overtimeMinutes) notes.push(`بیشترین اضافه‌کار مربوط به دپارتمان «${deptOt.department}» با ${fmtH(deptOt.overtimeMinutes)} است.`);
  if ((d.incompleteOpen || []).length) notes.push(`${faNum(d.incompleteOpen.length)} رکورد ناقص نیاز به اصلاح دارد.`);
  if (d.today?.attendancePct != null) notes.push(`درصد حضور امروز ${faNum(d.today.attendancePct)}٪ است (${faNum(d.today.working || 0)} نفر هم‌اکنون در حال کار).`);
  if (!notes.length) return null;
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-3">
      <div className="text-sm font-semibold text-theme-primary mb-2">بینش‌ها</div>
      <ul className="space-y-1 text-sm text-theme-secondary list-disc pr-5">{notes.map(n => <li key={n}>{n}</li>)}</ul>
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
        <Tile label="واگذاری‌های فعال" value={faNum(d.activeAssignments)} sub={`${pct(d.activeAssignments, d.total)} از اموال · ${faNum(d.assignments?.total || 0)} واگذاری تا کنون، ${faNum(d.assignments?.returned || 0)} بازگشتی`} />
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
        <ChartCard title="روند واگذاری‌ها — ۱۲ ماه اخیر" subtitle="واگذاری جدید و بازگشت در هر ماه"
          table={{ head: ["ماه", "واگذاری", "بازگشت"], rows: d.addedPerMonth.map((m: any) => [toFa(m.label), m.assigned || 0, m.returned || 0]) }}>
          <DailyLines data={d.addedPerMonth.map((m: any) => ({ date: m.label, assigned: m.assigned || 0, returned: m.returned || 0 }))}
            series={[{ key: "assigned", label: "واگذاری" }, { key: "returned", label: "بازگشت" }]} height={220} xFormat={(v: string) => toFa(v.slice(2))} />
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
