"use client";
// One person's work-log report for a Jalali period — the admin "داشبورد فرد" tab
// (the printable PDF has its own layout: PrintReport).
import React from "react";
import { Search } from "lucide-react";
import { Tile, ChartCard, HBars, DailyLines, faNum, hrs, fmtH, pct, faDay } from "../charts/ChartKit";
import { J_MONTHS, STATE_META, STATUS_FA, faDate, faDateTime, fmtMin } from "./meta";

export type PeriodKind = "month" | "quarter" | "half" | "year";
export const PERIOD_LABEL: Record<PeriodKind, string> = { month: "ماهانه", quarter: "فصلی", half: "شش‌ماهه", year: "سالانه" };
export const periodTitle = (period: PeriodKind, index: number, jYear: number) => {
  const y = jYear.toLocaleString("fa-IR", { useGrouping: false });
  if (period === "month") return `${J_MONTHS[index - 1]} ${y}`;
  if (period === "quarter") return `فصل ${["اول", "دوم", "سوم", "چهارم"][index - 1]} ${y}`;
  if (period === "half") return `نیمه ${index === 1 ? "اول" : "دوم"} ${y}`;
  return `سال ${y}`;
};
export const periodCount = (p: PeriodKind) => ({ month: 12, quarter: 4, half: 2, year: 1 }[p]);

type SortK = "date" | "task" | "category" | "minutes";

export default function PersonReport({ data }: { data: any }) {
  const [q, setQ] = React.useState("");
  const [sortK, setSortK] = React.useState<SortK>("date");
  const [dir, setDir] = React.useState<"asc" | "desc">("asc");
  const s = data.summary;
  const done = s ? s.submitted + s.late : 0;
  const worked = (data.daily as any[]).reduce((t, d) => t + (d.workedMinutes || 0), 0);
  const logged = (data.entries as any[]).reduce((t, e) => t + e.minutes, 0);
  // Long periods: plot weekly-ish detail is too dense day by day only for a year — still daily, labels thin out.
  const daily = (data.daily as any[]).map(d => ({ date: d.date, logged: hrs(d.loggedMinutes), worked: hrs(d.workedMinutes) }));

  const rows = React.useMemo(() => {
    const term = q.trim();
    const list = (data.entries as any[]).filter(e => !term || e.task.includes(term) || e.category.includes(term) || (e.note || "").includes(term));
    const v = (e: any) => sortK === "minutes" ? e.minutes : sortK === "date" ? e.date : e[sortK];
    return [...list].sort((a, b) => {
      const x = v(a), y = v(b);
      const c = typeof x === "number" ? x - (y as number) : String(x).localeCompare(String(y), "fa");
      return dir === "asc" ? c : -c;
    });
  }, [data, q, sortK, dir]);
  const th = (k: SortK, label: string) => (
    <th onClick={() => { if (sortK === k) setDir(d => d === "asc" ? "desc" : "asc"); else { setSortK(k); setDir("asc"); } }}
      className="text-right py-1.5 px-2 font-medium cursor-pointer select-none hover:text-theme-primary">
      {label}{sortK === k ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <Tile label="روزهای نیازمند گزارش" value={faNum(s?.required || 0)} />
        <Tile label="نرخ ثبت گزارش" value={pct(done, s?.required || 0)} sub={`${faNum(done)} روز ثبت شده`} />
        <Tile label="ثبت به‌موقع" value={faNum(s?.submitted || 0)} />
        <Tile label="ثبت با تأخیر" value={faNum(s?.late || 0)} />
        <Tile label="ثبت‌نشده" value={faNum(s?.missing || 0)} />
        <Tile label="زمان ثبت‌شده" value={fmtH(logged)} sub={`${faNum((data.entries as any[]).length)} رکورد`} />
        <Tile label="کارکرد حضور" value={fmtH(worked)} sub={worked ? `${pct(logged, worked)} آن ثبت شده` : undefined} />
      </div>

      <ChartCard title="زمان ثبت‌شده در برابر کارکرد حضور" subtitle="ساعت در روز"
        table={{ head: ["روز", "ثبت‌شده (ساعت)", "کارکرد (ساعت)", "وضعیت گزارش"], rows: (data.daily as any[]).map(d => [faDate(d.date), hrs(d.loggedMinutes), hrs(d.workedMinutes), STATE_META[d.state]?.label || d.state]) }}>
        <DailyLines data={daily} series={[{ key: "logged", label: "زمان ثبت‌شده" }, { key: "worked", label: "کارکرد حضور" }]} height={240} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="زمان به تفکیک دسته" subtitle="ساعت" table={{ head: ["دسته", "ساعت", "رکورد"], rows: (data.byCategory as any[]).map(c => [c.name, hrs(c.minutes), c.entries]) }}>
          <HBars data={(data.byCategory as any[]).map(c => ({ name: c.name, value: hrs(c.minutes) }))} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} />
        </ChartCard>
        <ChartCard title="بیشترین زمان به تفکیک وظیفه" subtitle="ساعت" table={{ head: ["وظیفه", "دسته", "ساعت", "روز", "رکورد"], rows: (data.byTask as any[]).map(t => [t.title, t.category, hrs(t.minutes), t.days, t.entries]) }}>
          <HBars data={(data.byTask as any[]).map(t => ({ name: t.title, value: hrs(t.minutes) }))} valueLabel="ساعت" fmt={v => `${faNum(v)} ساعت`} limit={12} />
        </ChartCard>
      </div>

      {/* Entries grid */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-theme">
          <span className="text-sm font-semibold text-theme-primary">جزئیات کارها ({faNum(rows.length)})</span>
            <div className="relative w-64 max-w-full">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو در وظیفه، دسته یا شرح…" className="input-theme text-xs py-1.5 pr-8" />
            </div>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-theme-card"><tr className="text-theme-muted border-b border-theme">
              {th("date", "تاریخ")}{th("task", "وظیفه")}{th("category", "دسته")}{th("minutes", "زمان")}
              <th className="text-right py-1.5 px-2 font-medium">شرح</th><th className="text-right py-1.5 px-2 font-medium">ثبت</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-theme-muted">رکوردی نیست</td></tr>}
              {rows.map(e => (
                <tr key={e.id} className="border-b border-theme/40">
                  <td className="py-1.5 px-2 whitespace-nowrap text-theme-muted">{faDate(e.date)}</td>
                  <td className="px-2 text-theme-primary">{e.task}</td>
                  <td className="px-2 text-theme-secondary whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: e.color || "#94a3b8" }} />{e.category}</td>
                  <td className="px-2 font-medium text-theme-primary" dir="ltr">{fmtMin(e.minutes)}</td>
                  <td className="px-2 text-theme-secondary">{e.note || "—"}</td>
                  <td className="px-2 whitespace-nowrap">{e.isLate ? <span className="text-amber-600">با تأخیر ({faNum(e.lateDays)} روز)</span> : <span className="text-theme-muted">به‌موقع</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily reports */}
      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        <div className="px-3 py-2.5 border-b border-theme text-sm font-semibold text-theme-primary">گزارش‌های کار روزانه ({faNum((data.reports as any[]).length)})</div>
        <div className="divide-y divide-theme max-h-[32rem] overflow-auto">
          {(data.reports as any[]).length === 0 && <div className="py-6 text-center text-xs text-theme-muted">گزارشی ثبت نشده</div>}
          {(data.reports as any[]).map(r => {
            const day = (data.daily as any[]).find(d => d.date === r.date);
            return (
              <div key={r.date} className="px-3 py-2.5 text-sm break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                  <span className="font-medium text-theme-primary">{faDate(r.date)}</span>
                  {day?.status && <span className="text-theme-muted">{STATUS_FA[day.status] || day.status}</span>}
                  <span className="text-theme-muted">ثبت: {faDateTime(r.submittedAt)}</span>
                  {r.isLate && <span className="text-amber-600">با تأخیر ({faNum(r.lateDays)} روز)</span>}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-theme-secondary">{r.content}</div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-theme-muted">روز {faDay(data.from)} تا {faDay(data.to)} — فقط روزهایی که گزارش الزامی بوده یا داده‌ای دارند در آمار آمده‌اند.</p>
    </div>
  );
}
