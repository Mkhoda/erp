"use client";
import React from "react";
import { Trophy, Loader2, Settings2, Save, Info, X } from "lucide-react";
import { pageTitle } from "../../../lib/branding";
import { readError } from "../../../lib/http";
import Modal from "../../components/ui/Modal";
import DateRangeFilter, { presetRange } from "../../components/ui/DateRangeFilter";
import SearchSelect from "../../components/ui/SearchSelect";
import { faDate } from "../../components/work-log/meta";
import { useToast } from "../../components/ui/Toast";
import { faNum, fmtH } from "../../components/charts/ChartKit";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type CKey = "report" | "punctuality" | "attendance" | "tickets" | "coverage";
const COMP: Record<CKey, { label: string; hint: string }> = {
  report: { label: "گزارش کار روزانه", hint: "ثبت به‌موقع گزارش روزانه؛ ثبت با تأخیر نصف امتیاز دارد" },
  punctuality: { label: "وقت‌شناسی", hint: "روزهای حضور بدون تاخیر و تعجیل (برای کارکنان ساعتی محاسبه نمی‌شود)" },
  attendance: { label: "حضور", hint: "روزهای کاری بدون غیبت" },
  tickets: { label: "پاسخگویی تیکت", hint: "تیکت‌های دپارتمان‌های فرد که به‌موقع پاسخ/حل شده‌اند؛ تأخیر برای همه‌ی کسانی که به کارتابل آن دپارتمان دسترسی دارند منفی است" },
  coverage: { label: "پوشش زمان کار", hint: "زمان ثبت‌شده در «عملکرد من» نسبت به کارکرد حضور" },
};
const KEYS = Object.keys(COMP) as CKey[];
const GRADE: Record<string, { label: string; cls: string; bar: string }> = {
  EXCELLENT: { label: "عالی", cls: "bg-green-500/15 text-green-700 dark:text-green-300", bar: "bg-green-500" },
  GOOD: { label: "خوب", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  FAIR: { label: "متوسط", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  POOR: { label: "ضعیف", cls: "bg-red-500/15 text-red-700 dark:text-red-300", bar: "bg-red-500" },
};
const gradeOf = (v: number | null) => v == null ? null : v >= 90 ? "EXCELLENT" : v >= 75 ? "GOOD" : v >= 60 ? "FAIR" : "POOR";


function Bar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-theme-muted text-xs">—</span>;
  const g = GRADE[gradeOf(v)!];
  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-theme-secondary overflow-hidden"><div className={`h-full rounded-full ${g.bar}`} style={{ width: `${Math.max(2, v)}%` }} /></div>
      <span className="text-xs text-theme-primary w-9 text-left" dir="ltr">{faNum(Math.round(v))}</span>
    </div>
  );
}

export default function PerformancePage() {
  React.useEffect(() => { document.title = pageTitle("امتیاز عملکرد"); }, []);
  const toast = useToast();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = React.useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [range, setRange] = React.useState(() => presetRange("month"));
  const [userId, setUserId] = React.useState("");
  const [people, setPeople] = React.useState<any[]>([]);
  const [deptId, setDeptId] = React.useState("");
  const [scheduleId, setScheduleId] = React.useState("");
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [role, setRole] = React.useState<string | null>(null);
  const [sortK, setSortK] = React.useState<string>("rank");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [detail, setDetail] = React.useState<any>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [weights, setWeights] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    fetch(`${API}/auth/me`, { headers: h }).then(r => r.ok ? r.json() : null).then(d => setRole(d?.role ?? null)).catch(() => {});
    fetch(`${API}/users/brief`, { headers: h }).then(r => r.ok ? r.json() : []).then(u => setPeople((Array.isArray(u) ? u : []).map((x: any) => ({ id: x.id, name: `${x.firstName} ${x.lastName}` })))).catch(() => {});
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {});
    fetch(`${API}/attendance/schedules-lite`, { headers: h }).then(r => r.ok ? r.json() : []).then(d => setSchedules(Array.isArray(d) ? d : [])).catch(() => {});
  }, [h]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ from: range.from, to: range.to });
      if (userId) p.set("userId", userId);
      if (deptId) p.set("departmentId", deptId);
      if (scheduleId) p.set("scheduleId", scheduleId);
      const res = await fetch(`${API}/performance/scores?${p}`, { headers: h });
      if (!res.ok) { toast.error(await readError(res, "خطا در محاسبه امتیازها")); return; }
      const d = await res.json();
      setData(d); setWeights(d.weights);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [range, userId, deptId, scheduleId, h]);
  React.useEffect(() => { load(); }, [load]);

  async function saveWeights() {
    const res = await fetch(`${API}/performance/settings`, { method: "PATCH", headers: h, body: JSON.stringify({ weights }) });
    if (!res.ok) { toast.error(await readError(res, "ذخیره ناموفق بود")); return; }
    toast.success("وزن شاخص‌ها ذخیره شد");
    setSettingsOpen(false);
    load();
  }

  function thSort(k: string) {
    if (sortK === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortK(k); setSortDir(k === "rank" || k === "name" ? "asc" : "desc"); }
  }
  const arrow = (k: string) => sortK === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const rows = React.useMemo(() => {
    const list = [...(data?.rows || [])];
    const v = (r: any) => sortK === "rank" ? (r.rank ?? 1e9) : sortK === "name" ? r.name : sortK === "department" ? (r.department || "") : sortK === "score" ? (r.score ?? -1) : (r.components[sortK] ?? -1);
    return list.sort((a, b) => {
      const x = v(a), y = v(b);
      const c = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y), "fa");
      return sortDir === "asc" ? c : -c;
    });
  }, [data, sortK, sortDir]);
  const scored = (data?.rows || []).filter((r: any) => r.score != null);
  const avg = scored.length ? scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length : null;
  const wTotal = KEYS.reduce((s, k) => s + (+weights[k] || 0), 0);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><Trophy className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">امتیاز عملکرد</h1>
            <p className="text-sm text-theme-muted">امتیاز بازه‌ی انتخابی بر اساس گزارش کار، وقت‌شناسی، حضور، پاسخگویی تیکت و پوشش زمان کار</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <div className="w-48"><SearchSelect options={people} value={userId} onChange={setUserId} emptyLabel="همه افراد" placeholder="جستجوی شخص" /></div>
          <select className="input-theme text-sm !w-44" value={deptId} onChange={e => setDeptId(e.target.value)}>
            <option value="">همه دپارتمان‌ها</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input-theme text-sm !w-44" value={scheduleId} onChange={e => setScheduleId(e.target.value)}>
            <option value="">همه گروه‌های کاری</option>
            {schedules.map((s: any) => <option key={s.id} value={s.id}>{s.isDefault ? "پیش‌فرض سازمان" : s.name}</option>)}
          </select>
          {role === "ADMIN" && <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><Settings2 className="w-4 h-4" /> وزن شاخص‌ها</button>}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          <div className="bg-theme-card border border-theme rounded-2xl px-3 py-2.5"><div className="text-xs text-theme-muted">میانگین امتیاز</div><div className="text-2xl font-extrabold text-theme-primary">{avg == null ? "—" : faNum(Math.round(avg))}</div></div>
          {(["EXCELLENT", "GOOD", "FAIR", "POOR"] as const).map(g => (
            <div key={g} className="bg-theme-card border border-theme rounded-2xl px-3 py-2.5"><div className="text-xs text-theme-muted">{GRADE[g].label}</div><div className="text-2xl font-extrabold text-theme-primary">{faNum(scored.filter((r: any) => r.grade === g).length)}</div></div>
          ))}
          <div className="bg-theme-card border border-theme rounded-2xl px-3 py-2.5"><div className="text-xs text-theme-muted">بدون داده</div><div className="text-2xl font-extrabold text-theme-primary">{faNum((data.rows?.length || 0) - scored.length)}</div></div>
        </div>
      )}

      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30 text-xs">
                <th onClick={() => thSort("rank")} className="py-2 px-2 font-medium cursor-pointer">رتبه{arrow("rank")}</th>
                <th onClick={() => thSort("name")} className="text-right px-2 font-medium cursor-pointer">نام{arrow("name")}</th>
                <th onClick={() => thSort("department")} className="text-right px-2 font-medium cursor-pointer">دپارتمان{arrow("department")}</th>
                <th onClick={() => thSort("score")} className="px-2 font-medium cursor-pointer">امتیاز کل{arrow("score")}</th>
                {KEYS.map(k => <th key={k} onClick={() => thSort(k)} title={COMP[k].hint} className="px-2 font-medium cursor-pointer whitespace-nowrap">{COMP[k].label}{arrow(k)}<span className="block text-[10px] font-normal">وزن {faNum(data?.weights?.[k] ?? 0)}</span></th>)}
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-theme-muted">کسی یافت نشد</td></tr>}
                {rows.map((r: any) => (
                  <tr key={r.userId} onClick={() => setDetail(r)} className="border-b border-theme/40 hover:bg-theme-hover cursor-pointer">
                    <td className="py-2 px-2 text-center text-theme-muted">{r.rank == null ? "—" : faNum(r.rank)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">{r.name}{r.employeeType === "HOURLY" && <span className="mr-1 text-[10px] text-theme-muted">(ساعتی)</span>}</td>
                    <td className="px-2 text-theme-muted whitespace-nowrap">{r.department || "—"}</td>
                    <td className="px-2 text-center">{r.score == null ? <span className="text-theme-muted text-xs">بدون داده</span> : <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${GRADE[r.grade].cls}`}>{faNum(Math.round(r.score))} · {GRADE[r.grade].label}</span>}</td>
                    {KEYS.map(k => <td key={k} className="px-2"><Bar v={r.components[k]} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-theme-muted"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> شاخصی که برای فردی داده ندارد (مثلاً وقت‌شناسی برای کارکنان ساعتی یا تیکت برای دپارتمانی بدون تیکت) در امتیاز او حساب نمی‌شود و وزن بقیه‌ی شاخص‌ها به همان نسبت بیشتر می‌شود.</p>

      {/* Breakdown */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || ""} subtitle={detail ? `${detail.department || ""} — ${faDate(range.from)} تا ${faDate(range.to)}` : undefined} size="md"
        footer={<button onClick={() => setDetail(null)} className="btn-theme-secondary text-sm">بستن</button>}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between bg-theme-secondary/40 rounded-lg px-3 py-2">
              <span className="text-theme-muted">امتیاز کل</span>
              <span className="text-xl font-extrabold text-theme-primary">{detail.score == null ? "—" : faNum(Math.round(detail.score))}</span>
            </div>
            {KEYS.map(k => {
              const d = detail.details;
              const why = k === "report" ? `${faNum(d.report.submitted)} به‌موقع و ${faNum(d.report.late)} با تأخیر از ${faNum(d.report.required)} روز الزامی`
                : k === "punctuality" ? (detail.employeeType === "HOURLY" ? "کارمند ساعتی — محاسبه نمی‌شود" : d.attendance ? `${faNum(d.attendance.punctual)} روز بدون تاخیر/تعجیل از ${faNum(d.attendance.present)} روز حضور` : "داده‌ی حضور ندارد")
                : k === "attendance" ? (d.attendance ? `${faNum(d.attendance.absent)} روز غیبت از ${faNum(d.attendance.workingDays)} روز کاری` : "داده‌ی حضور ندارد")
                : k === "tickets" ? (d.tickets.total ? `${faNum(d.tickets.late)} تیکت با تأخیر از ${faNum(d.tickets.total)} تیکت در ${faNum(d.tickets.departments)} کارتابل` : "تیکتی در کارتابل‌های فرد ثبت نشده")
                : `${fmtH(d.coverage.loggedMinutes)} ثبت‌شده از ${fmtH(d.coverage.workedMinutes)} کارکرد`;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between gap-2"><span className="text-theme-primary font-medium">{COMP[k].label} <span className="text-[11px] text-theme-muted font-normal">(وزن {faNum(data?.weights?.[k] ?? 0)})</span></span><div className="w-40"><Bar v={detail.components[k]} /></div></div>
                  <div className="text-xs text-theme-muted mt-0.5">{why}</div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Weights (ADMIN) */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="وزن شاخص‌های امتیاز" size="md"
        footer={<><button onClick={() => setSettingsOpen(false)} className="btn-theme-secondary text-sm">انصراف</button><button onClick={saveWeights} className="btn-theme-primary text-sm flex items-center gap-1"><Save className="w-4 h-4" /> ذخیره</button></>}>
        <div className="space-y-3">
          {KEYS.map(k => (
            <div key={k} className="flex items-center gap-3">
              <div className="flex-1"><div className="text-sm text-theme-primary">{COMP[k].label}</div><div className="text-[11px] text-theme-muted">{COMP[k].hint}</div></div>
              <input type="number" min={0} max={100} dir="ltr" value={weights[k] ?? 0} onChange={e => setWeights(w => ({ ...w, [k]: +e.target.value }))} className="input-theme text-sm w-20" />
              {!weights[k] && <span title="غیرفعال" className="text-theme-muted"><X className="w-3.5 h-3.5" /></span>}
            </div>
          ))}
          <p className="text-xs text-theme-muted">جمع وزن‌ها: {faNum(wTotal)} — لازم نیست دقیقاً ۱۰۰ باشد؛ امتیاز به نسبت وزن‌ها محاسبه می‌شود. وزن صفر یعنی آن شاخص حساب نشود.</p>
        </div>
      </Modal>
    </div>
  );
}
