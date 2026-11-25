"use client";
import React from "react";
import Link from "next/link";
import { Trophy, Loader2, Settings2, Info } from "lucide-react";
import { pageTitle } from "../../../lib/branding";
import { readError } from "../../../lib/http";
import Modal from "../../components/ui/Modal";
import DateRangeFilter, { presetRange } from "../../components/ui/DateRangeFilter";
import SearchSelect from "../../components/ui/SearchSelect";
import { faDate } from "../../components/work-log/meta";
import { useToast } from "../../components/ui/Toast";
import { faNum } from "../../components/charts/ChartKit";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const GRADE: Record<string, { label: string; cls: string; bar: string }> = {
  EXCELLENT: { label: "عالی", cls: "bg-green-500/15 text-green-700 dark:text-green-300", bar: "bg-green-500" },
  GOOD: { label: "خوب", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
  FAIR: { label: "متوسط", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
  POOR: { label: "ضعیف", cls: "bg-red-500/15 text-red-700 dark:text-red-300", bar: "bg-red-500" },
};
const barCls = (v: number, g: any) => (v >= g.excellent ? GRADE.EXCELLENT.bar : v >= g.good ? GRADE.GOOD.bar : v >= g.fair ? GRADE.FAIR.bar : GRADE.POOR.bar);
const signed = (n: number, sign: string) => (n ? `${sign}${faNum(n)}` : "—");

function Bar({ v, g }: { v: number | null; g: any }) {
  if (v == null) return <span className="text-theme-muted text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-theme-secondary overflow-hidden"><div className={`h-full rounded-full ${barCls(v, g)}`} style={{ width: `${Math.max(2, v)}%` }} /></div>
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
      setData(await res.json());
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [range, userId, deptId, scheduleId, h]);
  React.useEffect(() => { load(); }, [load]);

  const g = data?.general || { excellent: 90, good: 75, fair: 60 };
  const base = ((data?.indicators || []) as any[]).filter(i => i.kind === "score");
  const totalW = base.reduce((s, i) => s + i.weight, 0);

  function thSort(k: string) {
    if (sortK === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortK(k); setSortDir(k === "rank" || k === "name" ? "asc" : "desc"); }
  }
  const arrow = (k: string) => sortK === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";
  const rows = React.useMemo(() => {
    const list = [...(data?.rows || [])];
    const num = (x: any) => (x == null ? -1 : x);
    const v = (r: any) => sortK === "rank" ? (r.rank ?? 1e9) : sortK === "name" ? r.name : sortK === "department" ? (r.department || "")
      : sortK === "score" || sortK === "bonus" || sortK === "penalty" ? num(r[sortK]) : num(r.items?.[sortK]?.value);
    return list.sort((a, b) => {
      const x = v(a), y = v(b);
      const c = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y), "fa");
      return sortDir === "asc" ? c : -c;
    });
  }, [data, sortK, sortDir]);
  const scored = (data?.rows || []).filter((r: any) => r.score != null);
  const avg = scored.length ? scored.reduce((s: number, r: any) => s + r.score, 0) / scored.length : null;
  const th = (k: string, label: React.ReactNode, hint?: string) => <th key={k} onClick={() => thSort(k)} title={hint} className="px-2 font-medium cursor-pointer whitespace-nowrap">{label}{arrow(k)}</th>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><Trophy className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">امتیاز عملکرد</h1>
            <p className="text-sm text-theme-muted">امتیاز بازه‌ی انتخابی؛ شاخص‌ها و وزن‌ها در پنل تنظیمات مدیر تعریف می‌شود</p>
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
          {role === "ADMIN" && <Link href="/dashboard/performance/settings" className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary hover:bg-theme-hover"><Settings2 className="w-4 h-4" /> تنظیم شاخص‌ها</Link>}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          <div className="bg-theme-card border border-theme rounded-2xl px-3 py-2.5"><div className="text-xs text-theme-muted">میانگین امتیاز</div><div className="text-2xl font-extrabold text-theme-primary">{avg == null ? "—" : faNum(Math.round(avg))}</div></div>
          {(["EXCELLENT", "GOOD", "FAIR", "POOR"] as const).map(k => (
            <div key={k} className="bg-theme-card border border-theme rounded-2xl px-3 py-2.5"><div className="text-xs text-theme-muted">{GRADE[k].label}</div><div className="text-2xl font-extrabold text-theme-primary">{faNum(scored.filter((r: any) => r.grade === k).length)}</div></div>
          ))}
          <div className="bg-theme-card border border-theme rounded-2xl px-3 py-2.5"><div className="text-xs text-theme-muted">بدون امتیاز</div><div className="text-2xl font-extrabold text-theme-primary">{faNum((data.rows?.length || 0) - scored.length)}</div></div>
        </div>
      )}

      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30 text-xs">
                {th("rank", "رتبه")}
                <th onClick={() => thSort("name")} className="text-right px-2 font-medium cursor-pointer">نام{arrow("name")}</th>
                <th onClick={() => thSort("department")} className="text-right px-2 font-medium cursor-pointer">دپارتمان{arrow("department")}</th>
                {th("score", "امتیاز کل")}
                {base.map(i => th(i.key, <>{i.label}<span className="block text-[10px] font-normal">{totalW ? faNum(Math.round((i.weight / totalW) * 100)) : 0}٪ وزن</span></>, i.description))}
                {th("bonus", "پاداش")}{th("penalty", "کسورات")}
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7 + base.length} className="py-10 text-center text-theme-muted">کسی یافت نشد</td></tr>}
                {rows.map((r: any) => (
                  <tr key={r.userId} onClick={() => setDetail(r)} className="border-b border-theme/40 hover:bg-theme-hover cursor-pointer">
                    <td className="py-2 px-2 text-center text-theme-muted">{r.rank == null ? "—" : faNum(r.rank)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">{r.name}{r.employeeType === "HOURLY" && <span className="mr-1 text-[10px] text-theme-muted">(ساعتی)</span>}</td>
                    <td className="px-2 text-theme-muted whitespace-nowrap">{r.department || "—"}</td>
                    <td className="px-2 text-center">{r.score == null ? <span className="text-theme-muted text-xs" title={r.note || ""}>بدون امتیاز</span> : <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${GRADE[r.grade].cls}`}>{faNum(Math.round(r.score))} · {GRADE[r.grade].label}</span>}</td>
                    {base.map(i => <td key={i.key} className="px-2"><Bar v={r.items?.[i.key]?.value ?? null} g={g} /></td>)}
                    <td className="px-2 text-center text-green-600 text-xs" dir="ltr">{signed(r.bonus, "+")}</td>
                    <td className="px-2 text-center text-red-600 text-xs" dir="ltr">{signed(r.penalty, "−")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-theme-muted"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> امتیاز کل = میانگین وزنی شاخص‌های اصلی + پاداش‌ها − کسورات (بین ۰ تا ۱۰۰). شاخصی که برای فردی داده ندارد از امتیاز او کنار گذاشته می‌شود و وزن بقیه به همان نسبت بیشتر می‌شود. روی هر نفر کلیک کنید تا محاسبه‌ی او را ببینید.</p>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name || ""} subtitle={detail ? `${detail.department || ""} — ${faDate(data?.from)} تا ${faDate(data?.to)}` : undefined} size="lg"
        footer={<button onClick={() => setDetail(null)} className="btn-theme-secondary text-sm">بستن</button>}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[["امتیاز کل", detail.score == null ? "—" : faNum(Math.round(detail.score)), "text-theme-primary"], ["امتیاز پایه", detail.base == null ? "—" : faNum(Math.round(detail.base)), "text-theme-primary"], ["پاداش", signed(detail.bonus, "+"), "text-green-600"], ["کسورات", signed(detail.penalty, "−"), "text-red-600"]].map(([l, v, c]) => (
                <div key={l} className="bg-theme-secondary/40 rounded-lg py-2"><div className="text-[11px] text-theme-muted">{l}</div><div className={`text-lg font-extrabold ${c}`} dir="ltr">{v}</div></div>
              ))}
            </div>
            {detail.note && <p className="text-xs text-amber-600">{detail.note}</p>}
            {(["score", "bonus", "penalty"] as const).map(kind => {
              const list = ((data?.indicators || []) as any[]).filter(i => i.kind === kind);
              if (!list.length) return null;
              return (
                <div key={kind} className="space-y-2">
                  <div className={`text-xs font-bold ${kind === "score" ? "text-blue-600" : kind === "bonus" ? "text-green-600" : "text-red-600"}`}>{kind === "score" ? "شاخص‌های اصلی" : kind === "bonus" ? "پاداش‌ها" : "کسورات"}</div>
                  {list.map(i => {
                    const it = detail.items?.[i.key];
                    return (
                      <div key={i.key} className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><div className="text-theme-primary">{i.label}{kind === "score" && <span className="text-[11px] text-theme-muted"> (وزن {faNum(i.weight)})</span>}</div><div className="text-xs text-theme-muted">{it?.text}</div></div>
                        {kind === "score" ? <div className="w-36 shrink-0"><Bar v={it?.value ?? null} g={g} /></div>
                          : <div className={`shrink-0 text-sm font-semibold ${it?.points ? (kind === "bonus" ? "text-green-600" : "text-red-600") : "text-theme-muted"}`} dir="ltr">{it?.points ? `${kind === "bonus" ? "+" : "−"}${faNum(it.points)}` : "۰"}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
