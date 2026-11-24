"use client";
// Paper version of one person's work-log report. A document of its own (not the dashboard
// widgets): light colors only, plain HTML/CSS charts and real tables, so it prints the same in
// dark mode and breaks cleanly across pages. Page margins come from the outer table's repeating
// header/footer, with @page margin 0 so the browser adds no URL/date lines.
import React from "react";
import { getSystemName } from "../../../lib/branding";
import { PERIOD_LABEL, periodTitle, type PeriodKind } from "./PersonReport";
import { J_MONTHS, STATE_META, STATUS_FA, DOW_FA, faDate, faDateTime, faNum, fmtMin } from "./meta";

const CSS = `
@page { size: A4 portrait; margin: 0; }
html, body { background: #e5e7eb !important; color-scheme: light !important; margin: 0; }
.wl-doc, .wl-doc * { box-sizing: border-box; }
.wl-doc { width: 210mm; max-width: 100%; margin: 16px auto; background: #fff; color: #1f2937; font-size: 10.5px; line-height: 1.75; box-shadow: 0 2px 16px rgba(0,0,0,.15); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.wl-page { width: 100%; border-collapse: collapse; table-layout: fixed; }
.wl-page > thead td, .wl-page > tfoot td { height: 12mm; padding: 0; }
.wl-page > tbody > tr > td { padding: 0 12mm; vertical-align: top; }
.wl-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 12px; }
.wl-head h1 { font-size: 18px; font-weight: 800; margin: 0; color: #111827; }
.wl-head .sub { color: #4b5563; font-size: 11px; }
.wl-head .meta { color: #6b7280; font-size: 10px; text-align: left; white-space: nowrap; }
.wl-kpis { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; margin-bottom: 14px; break-inside: avoid; }
.wl-kpis > div { padding: 6px 10px; border-left: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
.wl-kpis > div:nth-child(4n) { border-left: 0; }
.wl-kpis > div:nth-child(n+5) { border-bottom: 0; }
.wl-kpis .l { color: #6b7280; font-size: 9.5px; }
.wl-kpis .v { font-size: 14px; font-weight: 800; color: #111827; }
.wl-sec { margin-bottom: 14px; }
.wl-sec > h2 { font-size: 12px; font-weight: 700; color: #111827; margin: 0 0 6px; padding-right: 7px; border-right: 3px solid #1d4ed8; line-height: 1.4; break-after: avoid; }
.wl-sec > h2 small { font-weight: 400; color: #6b7280; font-size: 9.5px; margin-right: 6px; }
.wl-keep { break-inside: avoid; }
.wl-t { width: 100%; border-collapse: collapse; table-layout: fixed; }
.wl-t thead { display: table-header-group; }
.wl-t th { background: #f3f4f6; color: #374151; font-weight: 700; text-align: right; padding: 4px 6px; border: 1px solid #d1d5db; font-size: 9.5px; }
.wl-t td { padding: 3px 6px; border: 1px solid #e5e7eb; text-align: right; vertical-align: top; overflow-wrap: anywhere; }
.wl-t tr { break-inside: avoid; }
.wl-t .c { text-align: center; white-space: nowrap; }
.wl-t tr.tot td { background: #f9fafb; font-weight: 700; }
.wl-t tr.off td { color: #9ca3af; }
.wl-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-left: 4px; }
.wl-bar { height: 8px; background: #eef2f7; border-radius: 2px; overflow: hidden; margin-top: 4px; }
.wl-bar > i { display: block; height: 100%; background: #2a78d6; }
.wl-chart { display: flex; align-items: flex-end; gap: 2px; height: 110px; border-bottom: 1px solid #9ca3af; }
.wl-chart > div { flex: 1; min-width: 0; display: flex; align-items: flex-end; justify-content: center; gap: 1px; height: 100%; }
.wl-chart i { display: block; width: 42%; max-width: 14px; border-radius: 2px 2px 0 0; }
.wl-axis { display: flex; gap: 2px; }
.wl-axis > span { flex: 1; min-width: 0; text-align: center; font-size: 8px; color: #6b7280; white-space: nowrap; }
.wl-legend { display: flex; gap: 14px; font-size: 9.5px; color: #4b5563; margin-bottom: 4px; }
.wl-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-left: 4px; }
.wl-rep { border: 1px solid #e5e7eb; border-radius: 5px; padding: 6px 9px; margin-bottom: 6px; }
.wl-rep .h { display: flex; flex-wrap: wrap; gap: 10px; font-size: 9.5px; color: #6b7280; border-bottom: 1px dashed #e5e7eb; margin-bottom: 3px; padding-bottom: 2px; break-after: avoid; }
.wl-rep .h b { color: #111827; }
.wl-rep .b { white-space: pre-wrap; overflow-wrap: anywhere; orphans: 3; widows: 3; }
.wl-late { color: #b45309; } .wl-miss { color: #b91c1c; } .wl-ok { color: #15803d; } .wl-mute { color: #9ca3af; }
.wl-empty { color: #9ca3af; text-align: center; padding: 10px; border: 1px dashed #d1d5db; border-radius: 5px; }
.wl-tools { position: sticky; top: 0; z-index: 5; display: flex; justify-content: center; gap: 8px; padding: 10px; background: #e5e7eb; }
.wl-tools button { padding: 7px 18px; border-radius: 8px; background: #2563eb; color: #fff; font-size: 13px; }
@media print {
  html, body { background: #fff !important; }
  .wl-doc { width: 100%; margin: 0; box-shadow: none; }
  .wl-tools { display: none !important; }
}`;

const DAY = 86400000;
const pctOf = (a: number, b: number) => (b ? `${faNum(Math.round((a / b) * 100))}٪` : "—");
const T = ({ m }: { m: number }) => <bdi dir="ltr">{fmtMin(m)}</bdi>;
const dowOf = (iso: string) => DOW_FA[new Date(iso + "T00:00:00Z").getUTCDay()];
const stateCls: Record<string, string> = { SUBMITTED: "wl-ok", LATE: "wl-late", MISSING: "wl-miss", PENDING: "", NOT_REQUIRED: "wl-mute" };
const jParts = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).formatToParts(new Date(iso + "T00:00:00Z"));
  const g = (t: string) => +(p.find(x => x.type === t)?.value || 0);
  return { jMonth: g("month"), jDay: g("day") };
};

export default function PrintReport({ data }: { data: any }) {
  const s = data.summary || { required: 0, submitted: 0, late: 0, missing: 0, pending: 0 };
  const entries = data.entries as any[], reports = data.reports as any[], rows = data.daily as any[];
  const logged = entries.reduce((t, e) => t + e.minutes, 0);
  const worked = rows.reduce((t, d) => t + (d.workedMinutes || 0), 0);
  const name = data.user ? `${data.user.firstName} ${data.user.lastName}` : "";
  const byDate = new Map<string, any>(rows.map(d => [d.date, d]));

  // Every day of the period (the API omits days with nothing to show); one bar per month when it's long.
  const days: { date: string; jMonth: number; jDay: number; logged: number; worked: number }[] = [];
  for (let t = Date.parse(data.from + "T00:00:00Z"); t <= Date.parse(data.to + "T00:00:00Z"); t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10), r = byDate.get(date);
    days.push({ date, ...jParts(date), logged: r?.loggedMinutes || 0, worked: r?.workedMinutes || 0 });
  }
  const monthly = data.period !== "month";
  const months = [...new Set(days.map(d => d.jMonth))];
  const bars = monthly
    ? months.map(m => { const x = days.filter(d => d.jMonth === m); return { key: `m${m}`, label: J_MONTHS[m - 1], logged: x.reduce((a, d) => a + d.logged, 0), worked: x.reduce((a, d) => a + d.worked, 0) }; })
    : days.map(d => ({ key: d.date, label: faNum(d.jDay), logged: d.logged, worked: d.worked }));
  const max = Math.max(1, ...bars.map(b => Math.max(b.logged, b.worked)));

  const tasks = (data.byTask as any[]).slice(0, 15), restTasks = (data.byTask as any[]).slice(15);
  const rest = restTasks.reduce((t, x) => t + x.minutes, 0);
  const monthRows = months.map(m => {
    const x = rows.filter(r => r.jMonth === m), st = (k: string) => x.filter(r => r.state === k).length;
    return { m, logged: x.reduce((a, r) => a + r.loggedMinutes, 0), worked: x.reduce((a, r) => a + (r.workedMinutes || 0), 0), ok: st("SUBMITTED"), late: st("LATE"), miss: st("MISSING") };
  });
  const kpis: [string, React.ReactNode][] = [
    ["روزهای نیازمند گزارش", faNum(s.required)], ["نرخ ثبت گزارش", pctOf(s.submitted + s.late, s.required)],
    ["ثبت به‌موقع", faNum(s.submitted)], ["ثبت با تأخیر", faNum(s.late)], ["ثبت‌نشده", faNum(s.missing)],
    ["زمان ثبت‌شده", <T key="l" m={logged} />], ["کارکرد حضور", <T key="w" m={worked} />], ["پوشش زمان", pctOf(logged, worked)],
  ];

  return (
    <div className="wl-doc" dir="rtl">
      <style>{CSS}</style>
      <div className="wl-tools"><button type="button" onClick={() => window.print()}>چاپ / ذخیره PDF</button></div>
      <table className="wl-page">
        <thead><tr><td /></tr></thead>
        <tfoot><tr><td /></tr></tfoot>
        <tbody><tr><td>
          <header className="wl-head">
            <div>
              <h1>گزارش عملکرد {name}</h1>
              <div className="sub">{data.user?.department?.name ? `${data.user.department.name}  |  ` : ""}گزارش {PERIOD_LABEL[data.period as PeriodKind]}: {periodTitle(data.period, data.index, data.jYear)}</div>
            </div>
            <div className="meta"><div>{getSystemName()}</div><div>بازه: {faDate(data.from)} تا {faDate(data.to)}</div><div>تاریخ تهیه: {new Date().toLocaleDateString("fa-IR")}</div></div>
          </header>

          <div className="wl-kpis">{kpis.map(([l, v]) => <div key={l}><div className="l">{l}</div><div className="v">{v}</div></div>)}</div>

          <section className="wl-sec wl-keep">
            <h2>زمان ثبت‌شده در برابر کارکرد حضور <small>{monthly ? "به تفکیک ماه" : "به تفکیک روز"}</small></h2>
            {logged + worked === 0 ? <div className="wl-empty">داده‌ای وجود ندارد</div> : <>
              <div className="wl-legend"><span><i style={{ background: "#2a78d6" }} />زمان ثبت‌شده</span><span><i style={{ background: "#c3c9d2" }} />کارکرد حضور</span><span>بیشترین: <T m={max} /></span></div>
              <div className="wl-chart">{bars.map(b => <div key={b.key}><i style={{ height: `${(b.logged / max) * 100}%`, background: "#2a78d6" }} /><i style={{ height: `${(b.worked / max) * 100}%`, background: "#c3c9d2" }} /></div>)}</div>
              <div className="wl-axis">{bars.map(b => <span key={b.key}>{b.label}</span>)}</div>
            </>}
          </section>

          {(data.byCategory as any[]).length > 0 && (
            <section className="wl-sec">
              <h2>زمان به تفکیک دسته</h2>
              <table className="wl-t">
                <colgroup><col style={{ width: "34%" }} /><col /><col style={{ width: "13%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /></colgroup>
                <thead><tr><th>دسته</th><th /><th className="c">زمان</th><th className="c">سهم</th><th className="c">رکورد</th></tr></thead>
                <tbody>{(data.byCategory as any[]).map((c, i) => (
                  <tr key={i}><td><span className="wl-dot" style={{ background: c.color || "#94a3b8" }} />{c.name}</td><td><div className="wl-bar"><i style={{ width: `${logged ? (c.minutes / logged) * 100 : 0}%` }} /></div></td><td className="c"><T m={c.minutes} /></td><td className="c">{pctOf(c.minutes, logged)}</td><td className="c">{faNum(c.entries)}</td></tr>
                ))}</tbody>
              </table>
            </section>
          )}

          {tasks.length > 0 && (
            <section className="wl-sec">
              <h2>زمان به تفکیک وظیفه</h2>
              <table className="wl-t">
                <colgroup><col /><col style={{ width: "24%" }} /><col style={{ width: "13%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /></colgroup>
                <thead><tr><th>وظیفه</th><th>دسته</th><th className="c">زمان</th><th className="c">سهم</th><th className="c">روز</th></tr></thead>
                <tbody>
                  {tasks.map((t, i) => <tr key={i}><td>{t.title}</td><td>{t.category}</td><td className="c"><T m={t.minutes} /></td><td className="c">{pctOf(t.minutes, logged)}</td><td className="c">{faNum(t.days)}</td></tr>)}
                  {rest > 0 && <tr><td colSpan={2}>سایر ({faNum(restTasks.length)} وظیفه)</td><td className="c"><T m={rest} /></td><td className="c">{pctOf(rest, logged)}</td><td className="c">—</td></tr>}
                  <tr className="tot"><td colSpan={2}>جمع</td><td className="c"><T m={logged} /></td><td className="c" /><td className="c" /></tr>
                </tbody>
              </table>
            </section>
          )}

          <section className="wl-sec">
            <h2>{monthly ? "خلاصه‌ی ماه‌ها" : "خلاصه‌ی روزها"}</h2>
            {rows.length === 0 ? <div className="wl-empty">روزی برای نمایش نیست</div> : monthly ? (
              <table className="wl-t">
                <thead><tr><th>ماه</th><th className="c">کارکرد حضور</th><th className="c">زمان ثبت‌شده</th><th className="c">پوشش</th><th className="c">به‌موقع</th><th className="c">با تأخیر</th><th className="c">ثبت‌نشده</th></tr></thead>
                <tbody>{monthRows.map(r => <tr key={r.m}><td>{J_MONTHS[r.m - 1]}</td><td className="c"><T m={r.worked} /></td><td className="c"><T m={r.logged} /></td><td className="c">{pctOf(r.logged, r.worked)}</td><td className="c">{faNum(r.ok)}</td><td className="c">{faNum(r.late)}</td><td className="c">{faNum(r.miss)}</td></tr>)}</tbody>
              </table>
            ) : (
              <table className="wl-t">
                <thead><tr><th>تاریخ</th><th>روز</th><th>حضور</th><th className="c">کارکرد حضور</th><th className="c">زمان ثبت‌شده</th><th className="c">گزارش روزانه</th></tr></thead>
                <tbody>{rows.map(r => <tr key={r.date} className={r.state === "NOT_REQUIRED" ? "off" : ""}><td>{faDate(r.date)}</td><td>{dowOf(r.date)}</td><td>{r.status ? STATUS_FA[r.status] || r.status : "—"}</td><td className="c">{r.workedMinutes ? <T m={r.workedMinutes} /> : "—"}</td><td className="c">{r.loggedMinutes ? <T m={r.loggedMinutes} /> : "—"}</td><td className={`c ${stateCls[r.state] || ""}`}>{STATE_META[r.state]?.label || r.state}</td></tr>)}</tbody>
              </table>
            )}
          </section>

          <section className="wl-sec">
            <h2>جزئیات کارها <small>{faNum(entries.length)} رکورد</small></h2>
            {entries.length === 0 ? <div className="wl-empty">زمانی ثبت نشده است</div> : (
              <table className="wl-t">
                <colgroup><col style={{ width: "13%" }} /><col style={{ width: "25%" }} /><col style={{ width: "16%" }} /><col style={{ width: "8%" }} /><col /><col style={{ width: "12%" }} /></colgroup>
                <thead><tr><th>تاریخ</th><th>وظیفه</th><th>دسته</th><th className="c">زمان</th><th>شرح</th><th className="c">ثبت</th></tr></thead>
                <tbody>{entries.map(e => <tr key={e.id}><td>{faDate(e.date)}</td><td>{e.task}</td><td><span className="wl-dot" style={{ background: e.color || "#94a3b8" }} />{e.category}</td><td className="c"><T m={e.minutes} /></td><td>{e.note || "—"}</td><td className={`c ${e.isLate ? "wl-late" : "wl-ok"}`}>{e.isLate ? `${faNum(e.lateDays)} روز تأخیر` : "به‌موقع"}</td></tr>)}</tbody>
              </table>
            )}
          </section>

          <section className="wl-sec">
            <h2>گزارش‌های کار روزانه <small>{faNum(reports.length)} گزارش</small></h2>
            {reports.length === 0 ? <div className="wl-empty">گزارشی ثبت نشده است</div> : reports.map(r => {
              const st = byDate.get(r.date)?.status;
              return (
                <article key={r.date} className={`wl-rep ${r.content.length < 1200 ? "wl-keep" : ""}`}>
                  <div className="h"><b>{dowOf(r.date)} {faDate(r.date)}</b>{st && <span>{STATUS_FA[st] || st}</span>}<span>ثبت: <bdi>{faDateTime(r.submittedAt)}</bdi></span>{r.isLate && <span className="wl-late">{faNum(r.lateDays)} روز تأخیر</span>}</div>
                  <div className="b">{r.content}</div>
                </article>
              );
            })}
          </section>
        </td></tr></tbody>
      </table>
    </div>
  );
}
