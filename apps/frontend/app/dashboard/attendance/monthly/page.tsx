"use client";
import React from "react";
import { pageTitle } from "../../../../lib/branding";
import { CalendarRange, Loader2, ArrowLeft, Check, X, Users as UsersIcon } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const faY = (n: number) => (n ?? 0).toLocaleString("fa-IR", { useGrouping: false });
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => { const h = Math.floor(Math.abs(m||0)/60); const mm = Math.abs(m||0)%60; return toFa(`${m<0?"-":""}${h}:${String(mm).padStart(2,"0")}`); };

function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return { jYear: +(p.find(x => x.type === "year")?.value || 0), jMonth: +(p.find(x => x.type === "month")?.value || 0) };
}

type PersonOpt = { id: string; name: string; search: string };

function MultiSelectField({ options, value, onChange, placeholder }: { options: PersonOpt[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => `${o.name} ${o.search}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  const selected = options.filter(o => value.includes(o.id));

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input-theme flex flex-wrap items-center gap-1 text-sm min-h-[38px] w-full text-right">
        {selected.length === 0 ? (
          <span className="text-theme-muted">{placeholder}</span>
        ) : selected.map(s => (
          <span key={s.id} className="flex items-center gap-1 bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-md px-1.5 py-0.5 text-xs">
            {s.name}
            <X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); toggle(s.id); }} />
          </span>
        ))}
      </button>
      {open && (
        <div dir="rtl" className="absolute z-[9999] mt-1 w-full min-w-[240px] bg-theme-primary border border-theme rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-theme">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام/موبایل/کارت..."
              className="input-theme text-xs py-1.5" />
          </div>
          <ul className="max-h-56 overflow-auto text-sm">
            {filtered.map(o => {
              const isSel = value.includes(o.id);
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => toggle(o.id)}
                    className={`flex w-full items-center gap-1.5 px-3 py-2 text-right hover:bg-theme-hover transition-colors ${isSel ? "text-blue-700 dark:text-blue-300 font-medium" : "text-theme-secondary"}`}>
                    <Check className={`w-3.5 h-3.5 shrink-0 ${isSel ? "opacity-100" : "opacity-0"}`} />
                    <span className="truncate">{o.name}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-3 py-3 text-theme-muted text-xs text-center">موردی یافت نشد</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chips({ options, value, onChange, render }: { options: number[]; value: number[]; onChange: (v: number[]) => void; render: (n: number) => string }) {
  const toggle = (n: number) => onChange(value.includes(n) ? value.filter(v => v !== n) : [...value, n]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(n => (
        <button key={n} type="button" onClick={() => toggle(n)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${value.includes(n) ? "bg-blue-600 text-white border-blue-600" : "bg-theme-secondary text-theme-secondary border-theme hover:bg-theme-hover"}`}>
          {render(n)}
        </button>
      ))}
    </div>
  );
}

export default function AttendanceMonthlyReportPage() {
  React.useEffect(() => { document.title = pageTitle("کارکرد ماهانه"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [departments, setDepartments] = React.useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = React.useState<any[]>([]);
  const [periods, setPeriods] = React.useState<Array<{ jYear: number; jMonth: number }>>([]);
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [deptId, setDeptId] = React.useState("");
  const [jYears, setJYears] = React.useState<number[]>(() => [currentJalali().jYear]);
  const [jMonths, setJMonths] = React.useState<number[]>(() => [currentJalali().jMonth]);
  const [userIds, setUserIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
    fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {});
    fetch(`${API}/attendance/records/periods`, { headers: h }).then(r => r.ok ? r.json() : []).then(p => setPeriods(Array.isArray(p) ? p : [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const qs = React.useCallback(() => {
    const p = new URLSearchParams();
    if (jYears.length) p.set("jYears", jYears.join(","));
    if (jMonths.length) p.set("jMonths", jMonths.join(","));
    if (userIds.length) p.set("userIds", userIds.join(","));
    if (deptId) p.set("departmentId", deptId);
    return p.toString();
  }, [jYears, jMonths, userIds, deptId]);

  const load = React.useCallback(async () => {
    if (!userIds.length || !jYears.length || !jMonths.length) { setRows([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/attendance/records/monthly-summary?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : []);
      setRows(Array.isArray(r) ? r : []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [qs]);

  React.useEffect(() => { load(); }, [load]);

  const yearOpts = [...new Set(periods.map(p => p.jYear))].sort((a, b) => b - a);
  const personOptions: PersonOpt[] = users
    .filter((u: any) => !deptId || u.departmentId === deptId || (u.userDepartments || []).some((ud: any) => ud.departmentId === deptId))
    .map((u: any) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}${u.attendanceCardNo ? ` (${u.attendanceCardNo})` : ""}`,
      search: `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`,
    }));

  const grouped = React.useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rows) {
      const arr = m.get(r.userId) || [];
      arr.push(r);
      m.set(r.userId, arr);
    }
    return [...m.entries()];
  }, [rows]);

  const cols: Array<{ key: string; label: string; cls?: string; render: (r: any) => React.ReactNode }> = [
    { key: "days", label: "روزهای دارای داده", render: r => faNum(r.distinctDays) },
    { key: "worked", label: "کارکرد", render: r => <span dir="ltr">{fmtMin(r.workedMinutes)}</span> },
    { key: "delay", label: "تاخیر", cls: "text-amber-600", render: r => r.delayMinutes ? <span dir="ltr">{fmtMin(r.delayMinutes)}</span> : "—" },
    { key: "early", label: "تعجیل", cls: "text-yellow-600", render: r => r.earlyLeaveMinutes ? <span dir="ltr">{fmtMin(r.earlyLeaveMinutes)}</span> : "—" },
    { key: "deficit", label: "کسری", cls: "text-orange-600 font-medium", render: r => r.deficitMinutes ? <span dir="ltr">{fmtMin(r.deficitMinutes)}</span> : "—" },
    { key: "hourlyLeave", label: "مرخصی ساعتی", cls: "text-blue-600", render: r => r.hourlyLeaveMinutes ? <span dir="ltr">{fmtMin(r.hourlyLeaveMinutes)}</span> : "—" },
    { key: "leaveDays", label: "مرخصی روزانه", cls: "text-blue-600", render: r => r.leaveDays ? `${faNum(r.leaveDays)} روز` : "—" },
    { key: "overtime", label: "اضافه‌کار عادی", cls: "text-violet-600", render: r => r.overtimeMinutes ? <span dir="ltr">{fmtMin(r.overtimeMinutes)}</span> : "—" },
    { key: "holidayOt", label: "تعطیل‌کاری", cls: "text-rose-600", render: r => r.holidayOvertimeMinutes ? <span dir="ltr">{fmtMin(r.holidayOvertimeMinutes)}</span> : "—" },
    { key: "night", label: "شب‌کاری", cls: "text-slate-600", render: r => r.nightMinutes ? <span dir="ltr">{fmtMin(r.nightMinutes)}</span> : "—" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><CalendarRange className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">کارکرد ماهانه</h1>
            <p className="text-sm text-theme-muted">{faNum(grouped.length)} نفر — {faNum(rows.length)} رکورد ماهانه</p>
          </div>
        </div>
        <Link href="/dashboard/attendance" className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><ArrowLeft className="w-4 h-4" /> داشبورد</Link>
      </div>

      {/* Filters */}
      <div className="relative z-20 bg-theme-card border border-theme rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-theme-muted">سال‌ها</label>
            <Chips options={yearOpts} value={jYears} onChange={setJYears} render={y => `سال ${faY(y)}`} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-theme-muted">ماه‌ها</label>
            <Chips options={Array.from({ length: 12 }, (_, i) => i + 1)} value={jMonths} onChange={setJMonths} render={m => J_MONTHS[m - 1]} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs text-theme-muted">دپارتمان (اختیاری)</label>
            <select className="input-theme text-sm w-full" value={deptId} onChange={e => setDeptId(e.target.value)}>
              <option value="">همه دپارتمان‌ها</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs text-theme-muted">افراد</label>
            <MultiSelectField options={personOptions} value={userIds} onChange={setUserIds} placeholder="جستجو و انتخاب افراد..." />
          </div>
        </div>
      </div>

      {/* Results */}
      {!userIds.length || !jYears.length || !jMonths.length ? (
        <div className="bg-theme-card border border-theme rounded-xl p-10 flex flex-col items-center gap-2 text-theme-muted">
          <UsersIcon className="w-8 h-8 opacity-50" />
          <p className="text-sm">حداقل یک سال، یک ماه و یک نفر را انتخاب کنید</p>
        </div>
      ) : loading ? (
        <div className="bg-theme-card border border-theme rounded-xl flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : grouped.length === 0 ? (
        <div className="bg-theme-card border border-theme rounded-xl p-10 text-center text-theme-muted text-sm">داده‌ای برای فیلتر انتخاب‌شده یافت نشد</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([uid, list]) => {
            const u = list[0].user;
            return (
              <div key={uid} className="bg-theme-card border border-theme rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-theme-secondary/30 border-b border-theme">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-theme-primary font-semibold text-sm">{u ? `${u.firstName} ${u.lastName}` : "—"}</span>
                    {u?.attendanceCardNo && <span className="text-theme-muted text-xs" dir="ltr">({u.attendanceCardNo})</span>}
                    {u?.department?.name && <span className="text-theme-muted text-xs">— {u.department.name}</span>}
                  </div>
                  <span className="text-theme-muted text-xs">{faNum(list.length)} ماه</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-center">
                    <thead><tr className="text-theme-muted text-center border-b border-theme">
                      <th className="py-2 px-2 font-medium">ماه</th>
                      {cols.map(c => <th key={c.key} className="font-medium px-2">{c.label}</th>)}
                    </tr></thead>
                    <tbody>
                      {list.map((r: any) => (
                        <tr key={`${r.jYear}-${r.jMonth}`} className="border-b border-theme/40 hover:bg-theme-hover">
                          <td className="px-2 py-1.5 text-theme-primary font-medium whitespace-nowrap">{J_MONTHS[r.jMonth - 1]} {faY(r.jYear)}</td>
                          {cols.map(c => <td key={c.key} className={`px-2 ${c.cls || "text-theme-primary"}`}>{c.render(r)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
