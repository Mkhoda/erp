"use client";
import React from "react";
import { Loader2, Fingerprint, Pencil, AlertTriangle, Send, Hourglass } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import TimeSelect from "../../../components/ui/TimeSelect";
import { pageTitle } from "../../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const STATUS_FA: Record<string,string> = { PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت", INCOMPLETE:"ناقص", LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته", WORKING:"در حال کار" };
const STATUS_CLS: Record<string,string> = { PRESENT:"bg-green-500/15 text-green-600", LATE:"bg-amber-500/15 text-amber-600", EARLY_LEAVE:"bg-yellow-500/15 text-yellow-600", ABSENT:"bg-red-500/15 text-red-600", INCOMPLETE:"bg-orange-500/15 text-orange-600", LEAVE:"bg-blue-500/15 text-blue-600", MISSION:"bg-violet-500/15 text-violet-600", REMOTE_WORK:"bg-cyan-500/15 text-cyan-600", HOLIDAY:"bg-slate-400/15 text-slate-500", COMPANY_HOLIDAY:"bg-slate-400/15 text-slate-500", WEEKEND:"bg-slate-300/20 text-slate-500", WORKING:"bg-teal-500/15 text-teal-600" };
const TODAY_ISO = new Date().toISOString().slice(0, 10);
function liveStatus(r: any): string {
  if (r.status === "INCOMPLETE" && r.firstCheckIn && !r.lastCheckOut && r.gregDate?.slice(0, 10) === TODAY_ISO) return "WORKING";
  return r.status;
}
const REQ_STATUS_FA: Record<string,string> = { PENDING:"در انتظار", APPROVED:"تایید شده", REJECTED:"رد شده", MANAGER_APPROVED:"تایید مدیر", HR_APPROVED:"تایید HR" };
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const fmtDH = (days: number) => { const d = Math.floor(days); const h = Math.round((days - d) * 8); return h > 0 ? `${faNum(d)} روز و ${faNum(h)} ساعت` : `${faNum(d)} روز`; };
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => toFa(`${Math.floor(Math.abs(m||0)/60)}:${String(Math.abs(m||0)%60).padStart(2,"0")}`);
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });
const faDOW  = (g: string) => new Date(g).toLocaleDateString("fa-IR", { weekday:"long", timeZone:"UTC" });
const J_MONTHS_NAMES = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
function toJalali(gy0: number, gm: number, gd: number) {
  const gdm = [0,31,59,90,120,151,181,212,243,273,304,334]; let jy: number, gy: number;
  if (gy0>1600){jy=979;gy=gy0-1600;}else{jy=0;gy=gy0-621;}
  const gy2=gm>2?gy+1:gy; let days=365*gy+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)-80+gd+gdm[gm-1];
  jy+=33*Math.floor(days/12053);days%=12053;jy+=4*Math.floor(days/1461);days%=1461;
  if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}
  const jm=days<186?1+Math.floor(days/31):7+Math.floor((days-186)/30);
  const jd=1+(days<186?days%31:(days-186)%30);return{jy,jm,jd};
}
function jalaliToGregorian(jy0: number, jm: number, jd: number) {
  let gy: number, jy: number;
  if(jy0>979){gy=1600;jy=jy0-979;}else{gy=621;jy=jy0;}
  let days=365*jy+Math.floor(jy/33)*8+Math.floor(((jy%33)+3)/4)+78+jd+(jm<7?(jm-1)*31:(jm-7)*30+186);
  gy+=400*Math.floor(days/146097);days%=146097;
  if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}
  gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}
  let gd=days+1;const sal=[0,31,(gy%4===0&&gy%100!==0)||gy%400===0?29:28,31,30,31,30,31,31,30,31,30,31];let gm=1;
  for(;gm<=12;gm++){if(gd<=sal[gm])break;gd-=sal[gm];}return{y:gy,m:gm,d:gd};
}
const jMonthLen=(jy:number,jm:number)=>(jm<=6?31:jm<=11?30:jy%4===3?30:29);
const todayJ=()=>{const t=new Date();return toJalali(t.getFullYear(),t.getMonth()+1,t.getDate());};

// Current Jalali year/month (Tehran) — used to default the filters on load.
function currentJalali() {
  const p = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).formatToParts(new Date());
  return { jYear: +(p.find(x => x.type === "year")?.value || 0), jMonth: +(p.find(x => x.type === "month")?.value || 0) };
}

export default function MyAttendancePage() {
  React.useEffect(() => { document.title = pageTitle("حضور من"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [periods, setPeriods] = React.useState<Array<{ jYear: number; jMonth: number }>>([]);
  const [myReqs, setMyReqs] = React.useState<any[]>([]);
  const [leave, setLeave] = React.useState<any>(null);
  const [jYear, setJYear] = React.useState(() => currentJalali().jYear);
  const [jMonth, setJMonth] = React.useState(() => currentJalali().jMonth);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  React.useEffect(() => { setPage(1); }, [jYear, jMonth, pageSize, rows.length]);
  const [modal, setModal] = React.useState<any>(null); // { row }
  const [reqForm, setReqForm] = React.useState<any>({ kind: "FIX", fixIn: false, inTime: "", fixOut: false, outTime: "", description: "" });
  const [sending, setSending] = React.useState(false);
  const [leaveModal, setLeaveModal] = React.useState(false);
  const [leaveForm, setLeaveForm] = React.useState({ jy: 0, jm: 0, jd: 0, type: "LEAVE", leaveHours: "", description: "" });
  const [leaveSending, setLeaveSending] = React.useState(false);

  // Days that already have an open (pending) request — block re-submitting.
  const pendingDates = React.useMemo(
    () => new Set(myReqs.filter((q: any) => q.status === "PENDING").map((q: any) => q.gregDate.slice(0, 10))),
    [myReqs],
  );
  const toHHmm = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran", hour12: false }) : "";

  const qs = () => { const p = new URLSearchParams(); if (jYear) p.set("jYear", String(jYear)); if (jMonth) p.set("jMonth", String(jMonth)); return p.toString(); };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [d, s, r, lb] = await Promise.all([
        fetch(`${API}/attendance/me/days?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : []),
        fetch(`${API}/attendance/me/summary?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : null),
        fetch(`${API}/attendance/me/requests`, { headers: h }).then(x => x.ok ? x.json() : []),
        fetch(`${API}/attendance/me/leave-balance${jYear ? `?jYear=${jYear}` : ""}`, { headers: h }).then(x => x.ok ? x.json() : null),
      ]);
      setRows(Array.isArray(d) ? d : []); setSummary(s); setMyReqs(Array.isArray(r) ? r : []); setLeave(lb);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [jYear, jMonth]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    fetch(`${API}/attendance/me/periods`, { headers: h }).then(r => r.ok ? r.json() : []).then((p) => setPeriods(Array.isArray(p) ? p : [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const yearOpts = [...new Set([...(jYear ? [jYear] : []), ...periods.map(p => p.jYear)])].sort((a, b) => b - a);
  const monthOpts = [...new Set([...(jMonth ? [jMonth] : []), ...periods.filter(p => !jYear || p.jYear === jYear).map(p => p.jMonth)])].sort((a, b) => a - b);

  function openLeaveModal() {
    const { jy, jm, jd } = todayJ();
    setLeaveForm({ jy, jm, jd, type: "LEAVE", leaveHours: "", description: "" });
    setLeaveModal(true);
  }

  async function submitLeaveRequest() {
    if (!leaveForm.jy || !leaveForm.jm || !leaveForm.jd) { alert("تاریخ را انتخاب کنید"); return; }
    setLeaveSending(true);
    try {
      const g = jalaliToGregorian(leaveForm.jy, leaveForm.jm, leaveForm.jd);
      const date = `${g.y}-${String(g.m).padStart(2, "0")}-${String(g.d).padStart(2, "0")}`;
      const body: any = { date, description: leaveForm.description };
      if (leaveForm.type === "HOURLY_LEAVE") {
        body.type = "LEAVE";
        body.leaveMinutes = Math.round((Number(leaveForm.leaveHours) || 0) * 60);
      } else {
        body.type = "LEAVE";
        body.targetStatus = leaveForm.type;
      }
      const res = await fetch(`${API}/attendance/me/requests`, { method: "POST", headers: h, body: JSON.stringify(body) });
      if (res.ok) { setLeaveModal(false); await load(); }
      else { const e = await res.json().catch(() => ({})); alert(e.message || "خطا در ثبت درخواست"); }
    } finally { setLeaveSending(false); }
  }

  function openRequest(row: any) {
    const hasIn = !!row.firstCheckIn, hasOut = !!row.lastCheckOut;
    setReqForm({
      kind: "FIX",
      // Pre-fill existing times; default to correcting the MISSING side.
      fixIn: !hasIn, inTime: toHHmm(row.firstCheckIn),
      fixOut: !hasOut, outTime: toHHmm(row.lastCheckOut),
      description: "",
    });
    setModal({ row });
  }

  async function submitRequest() {
    setSending(true);
    try {
      const k = reqForm.kind;
      const body: any = { date: modal.row.gregDate.slice(0, 10), description: reqForm.description };
      if (k === "FIX") {
        const inT = reqForm.fixIn ? reqForm.inTime : undefined;
        const outT = reqForm.fixOut ? reqForm.outTime : undefined;
        body.type = inT && outT ? "FULL_DAY_FIX" : outT ? "CHECK_OUT_FIX" : "CHECK_IN_FIX";
        body.inTime = inT; body.outTime = outT;
      } else if (k === "EXPLANATION") { body.type = "EXPLANATION"; }
      else if (k === "HOURLY_LEAVE") { body.type = "LEAVE"; body.leaveMinutes = Math.round((Number(reqForm.leaveHours) || 0) * 60); }
      else { body.type = "LEAVE"; body.targetStatus = k; } // LEAVE | MISSION | REMOTE_WORK
      const res = await fetch(`${API}/attendance/me/requests`, { method: "POST", headers: h, body: JSON.stringify(body) });
      if (res.ok) { setModal(null); await load(); }
      else { const e = await res.json().catch(() => ({})); alert(e.message || "خطا در ثبت درخواست"); }
    } finally { setSending(false); }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><Fingerprint className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-theme-primary">حضور من</h1><p className="text-sm text-theme-muted">کارکرد روزانه و درخواست اصلاح</p></div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-theme text-sm w-auto" value={jYear} onChange={e => { setJYear(+e.target.value); setJMonth(0); }}>
            <option value={0}>همه سال‌ها</option>
            {yearOpts.map(y => <option key={y} value={y}>سال {toFa(String(y))}</option>)}
          </select>
          <select className="input-theme text-sm w-auto" value={jMonth} onChange={e => setJMonth(+e.target.value)}>
            <option value={0}>همه ماه‌ها</option>
            {monthOpts.map(m => <option key={m} value={m}>{J_MONTHS[m-1]}</option>)}
          </select>
        </div>
      </div>

      {leave && (
        <div className="border border-blue-500/30 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20">
            <span className="text-theme-primary font-semibold text-sm">مرخصی سال {toFa(String(leave.jYear))}</span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600 font-bold">{fmtDH(leave.remainingDays)} مانده</span>
              <span className="text-theme-muted text-xs">از {faNum(leave.entitlement)} روز</span>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch bg-blue-500/5 text-xs">
            {([
              { lbl: "مرخصی روزانه", val: `${faNum(leave.fullDays)} روز`, cls: "text-blue-600" },
              { lbl: "مرخصی ساعتی", val: fmtMin(leave.hourlyLeaveMinutes), cls: "text-blue-600" },
              { lbl: "غیبت", val: `${faNum(leave.absentDays)} روز`, cls: "text-red-600" },
              { lbl: "کسر تاخیر/تعجیل", val: fmtMin(leave.tardyMinutes), cls: "text-amber-600" },
              { lbl: "مصرف کل", val: `${faNum(leave.usedDays)} روز`, cls: "text-orange-600" },
              { lbl: "ماموریت", val: `${faNum(leave.mission)} روز`, cls: "text-violet-600" },
              { lbl: "دورکاری", val: `${faNum(leave.remote)} روز`, cls: "text-cyan-600" },
            ] as { lbl: string; val: string; cls: string }[]).map((item, i) => (
              <React.Fragment key={item.lbl}>
                {i > 0 && <div className="w-px bg-blue-500/20 self-stretch" />}
                <div className="flex flex-col items-center justify-center px-3 py-2 text-center">
                  <span className="text-theme-muted whitespace-nowrap">{item.lbl}</span>
                  <span className={`font-semibold whitespace-nowrap mt-0.5 ${item.cls}`}>{item.val}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-8 gap-2">
          <Sum label="روزها" value={faNum(summary.days)} />
          <Sum label="کارکرد" value={fmtMin(summary.workedMinutes)} />
          <Sum label="تاخیر" value={fmtMin(summary.delayMinutes)} cls="text-amber-600" />
          <Sum label="تعجیل" value={fmtMin(summary.earlyLeaveMinutes)} cls="text-yellow-600" />
          <Sum label="کسری" value={fmtMin(summary.deficitMinutes || 0)} cls="text-orange-600" />
          <Sum label="اضافه‌کار عادی" value={fmtMin(summary.overtimeMinutes)} cls="text-violet-600" />
          <Sum label="تعطیل‌کاری" value={fmtMin(summary.holidayOvertimeMinutes)} cls="text-rose-600" />
          <Sum label="شب‌کاری" value={fmtMin(summary.nightMinutes)} cls="text-slate-600" />
        </div>
      )}

      {(() => {
        const unresolved = rows.filter(r => (liveStatus(r) === "INCOMPLETE" || liveStatus(r) === "ABSENT") && !pendingDates.has(r.gregDate.slice(0, 10)));
        return unresolved.length > 0 ? (
          <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-500/10 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{faNum(unresolved.length)} روز نیاز به تعیین وضعیت دارد (ناقص یا غیبت). با دکمه‌ی ✏️ روبه‌روی هر روز، اصلاح یا مرخصی/ماموریت ثبت کنید.</span>
          </div>
        ) : null;
      })()}

      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-56"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30">
                <th className="py-2 px-2 font-medium">تاریخ</th><th className="px-2 font-medium">ورود</th><th className="px-2 font-medium">خروج</th>
                <th className="px-2 font-medium">کارکرد</th><th className="px-2 font-medium">تاخیر</th><th className="px-2 font-medium">تعجیل</th>
                <th className="px-2 font-medium">کسری</th><th className="px-2 font-medium">اضافه‌کار</th><th className="px-2 font-medium">تعطیل‌کاری</th>
                <th className="px-2 font-medium">وضعیت</th><th className="px-2 font-medium">درخواست</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={11} className="py-10 text-theme-muted">رکوردی نیست</td></tr> : rows.slice((page-1)*pageSize, page*pageSize).map(r => {
                  const ls = liveStatus(r);
                  const needsResolve = (ls === "INCOMPLETE" || ls === "ABSENT");
                  const isPending = pendingDates.has(r.gregDate.slice(0, 10));
                  return (
                    <tr key={r.id} className={`border-b border-theme/40 ${needsResolve && !isPending ? "bg-orange-500/5" : ""}`}>
                      <td className="py-1.5 px-2">
                        <div className="text-theme-primary text-xs" dir="ltr">{faDate(r.gregDate)}</div>
                        <div className="text-[10px] text-theme-muted">{faDOW(r.gregDate)}</div>
                      </td>
                      <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.firstCheckIn)}</td>
                      <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.lastCheckOut)}</td>
                      <td className="px-2 text-theme-primary" dir="ltr">{fmtMin(r.workedMinutes)}</td>
                      <td className="px-2 text-amber-600" dir="ltr">{r.delayMinutes ? fmtMin(r.delayMinutes) : "—"}</td>
                      <td className="px-2 text-yellow-600" dir="ltr">{r.earlyLeaveMinutes ? fmtMin(r.earlyLeaveMinutes) : "—"}</td>
                      <td className="px-2 text-orange-600 font-medium" dir="ltr">{r.deficitMinutes ? fmtMin(r.deficitMinutes) : "—"}</td>
                      <td className="px-2 text-violet-600" dir="ltr">{r.overtimeMinutes ? fmtMin(r.overtimeMinutes) : "—"}</td>
                      <td className="px-2 text-rose-600" dir="ltr">{r.holidayOvertimeMinutes ? fmtMin(r.holidayOvertimeMinutes) : "—"}</td>
                      <td className="px-2"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[ls] || ""}`}>{needsResolve && <AlertTriangle className="w-3 h-3" />}{STATUS_FA[ls] || r.status}</span></td>
                      <td className="px-2">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="درخواست در حال بررسی"><Hourglass className="w-3.5 h-3.5" /> در انتظار</span>
                        ) : (
                          <button onClick={() => openRequest(r)} title={needsResolve ? "نیاز به تعیین وضعیت" : "درخواست اصلاح/مرخصی"}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${needsResolve ? "text-orange-600 hover:bg-orange-500/10" : "text-blue-500 hover:bg-blue-500/10"}`}>
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-theme text-sm">
            <div className="flex items-center gap-2 text-theme-muted">
              <span>نمایش</span>
              <select value={pageSize} onChange={e => setPageSize(+e.target.value)} className="input-theme text-sm w-auto py-1">
                {[25, 50, 100, 200].map(n => <option key={n} value={n}>{faNum(n)}</option>)}
              </select>
              <span>از {faNum(rows.length)} رکورد</span>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">قبلی</button>
              <span className="text-theme-muted">صفحه {faNum(page)} از {faNum(Math.max(1, Math.ceil(rows.length / pageSize)))}</span>
              <button disabled={page >= Math.ceil(rows.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">بعدی</button>
            </div>
          </div>
        )}
      </div>

      {/* My requests */}
      <div className="bg-theme-card border border-theme rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-theme-primary text-sm">درخواست‌های من</h2>
          <button onClick={openLeaveModal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs">
            <Send className="w-3.5 h-3.5" /> ثبت مرخصی جدید
          </button>
        </div>
        {myReqs.length === 0 ? <p className="text-theme-muted text-sm">درخواستی ثبت نکرده‌اید</p> : (
          <div className="space-y-2">
            {myReqs.map(q => (
              <div key={q.id} className="flex items-center justify-between text-sm border border-theme rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span dir="ltr" className="text-theme-primary">{faDate(q.gregDate)}</span>
                  <span className="text-theme-muted">{q.targetStatus ? STATUS_FA[q.targetStatus] : "اصلاح ساعت"}</span>
                  {q.description && <span className="text-theme-muted text-xs">— {q.description}</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${q.status === "APPROVED" ? "bg-green-500/15 text-green-600" : q.status === "REJECTED" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{REQ_STATUS_FA[q.status] || q.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New leave request modal (for upcoming days) */}
      <Modal
        open={leaveModal}
        onClose={() => setLeaveModal(false)}
        title="ثبت مرخصی / ماموریت جدید"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setLeaveModal(false)} className="btn-theme-secondary text-sm">انصراف</button>
            <button onClick={submitLeaveRequest} disabled={leaveSending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
              {leaveSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} ثبت درخواست
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-theme-secondary text-xs">تاریخ مرخصی</label>
            <div className="flex gap-2" dir="ltr">
              {(() => {
                const { jy: ty } = todayJ();
                const years = Array.from({ length: 5 }, (_, i) => ty - 1 + i);
                const toFaN = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
                const upd = (ny: number, nm: number, nd: number) => {
                  if (!ny || !nm || !nd) return;
                  setLeaveForm(s => ({ ...s, jy: ny, jm: nm, jd: Math.min(nd, jMonthLen(ny, nm)) }));
                };
                return (
                  <>
                    <select value={leaveForm.jy || ""} onChange={e => upd(+e.target.value, leaveForm.jm, leaveForm.jd || 1)}
                      className="input-theme text-sm text-center flex-1">
                      {!leaveForm.jy && <option value="">سال</option>}
                      {years.map(y => <option key={y} value={y}>{toFaN(y)}</option>)}
                    </select>
                    <select value={leaveForm.jm || ""} onChange={e => upd(leaveForm.jy, +e.target.value, leaveForm.jd || 1)}
                      className="input-theme text-sm text-center flex-1">
                      {!leaveForm.jm && <option value="">ماه</option>}
                      {J_MONTHS_NAMES.map((name, i) => <option key={i+1} value={i+1}>{name}</option>)}
                    </select>
                    <select value={leaveForm.jd || ""} onChange={e => upd(leaveForm.jy, leaveForm.jm, +e.target.value)}
                      className="input-theme text-sm text-center flex-1">
                      {!leaveForm.jd && <option value="">روز</option>}
                      {Array.from({ length: leaveForm.jy && leaveForm.jm ? jMonthLen(leaveForm.jy, leaveForm.jm) : 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{toFaN(d)}</option>)}
                    </select>
                  </>
                );
              })()}
            </div>
          </div>
          <div>
            <label className="block mb-1 text-theme-secondary text-xs">نوع درخواست</label>
            <select value={leaveForm.type} onChange={e => setLeaveForm(s => ({ ...s, type: e.target.value }))} className="input-theme text-sm">
              <option value="LEAVE">مرخصی (کل روز)</option>
              <option value="HOURLY_LEAVE">مرخصی ساعتی</option>
              <option value="MISSION">ماموریت (کل روز)</option>
              <option value="REMOTE_WORK">دورکاری (کل روز)</option>
            </select>
          </div>
          {leaveForm.type === "HOURLY_LEAVE" && (
            <div>
              <label className="block mb-1 text-theme-secondary text-xs">مدت مرخصی (ساعت)</label>
              <input type="number" step="0.5" min="0.5" max="24" dir="ltr" value={leaveForm.leaveHours}
                onChange={e => setLeaveForm(s => ({ ...s, leaveHours: e.target.value }))}
                className="input-theme text-sm" placeholder="مثلاً 2" />
              <p className="mt-1 text-[11px] text-theme-muted">بیشتر از ۳ ساعت = کل روز مرخصی</p>
            </div>
          )}
          <div>
            <label className="block mb-1 text-theme-secondary text-xs">توضیحات</label>
            <textarea value={leaveForm.description} onChange={e => setLeaveForm(s => ({ ...s, description: e.target.value }))}
              className="input-theme text-sm" rows={2} placeholder="دلیل یا توضیح درخواست..." />
          </div>
        </div>
      </Modal>

      {/* Request modal (unified full-screen Modal) */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `درخواست برای ${faDate(modal.row.gregDate)}` : ""}
        subtitle={modal ? `وضعیت فعلی: ${STATUS_FA[modal.row.status] || modal.row.status} · ورود ${faTime(modal.row.firstCheckIn)} · خروج ${faTime(modal.row.lastCheckOut)}` : undefined}
        size="md"
        footer={modal && (
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-theme-secondary text-sm">انصراف</button>
            <button onClick={submitRequest} disabled={sending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} ثبت درخواست
            </button>
          </div>
        )}
      >
        {modal && (
          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-theme-secondary text-xs">نوع درخواست</label>
              <select value={reqForm.kind} onChange={e => setReqForm((s: any) => ({ ...s, kind: e.target.value }))} className="input-theme text-sm">
                <option value="FIX">اصلاح ساعت ورود/خروج</option>
                <option value="HOURLY_LEAVE">مرخصی ساعتی</option>
                <option value="LEAVE">مرخصی (کل روز)</option>
                <option value="MISSION">ماموریت (کل روز)</option>
                <option value="REMOTE_WORK">دورکاری (کل روز)</option>
                <option value="EXPLANATION">توضیح</option>
              </select>
            </div>
            {reqForm.kind === "HOURLY_LEAVE" && (
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">مدت مرخصی (ساعت)</label>
                <input type="number" step="0.5" min="0" dir="ltr" value={reqForm.leaveHours ?? ""} onChange={e => setReqForm((s: any) => ({ ...s, leaveHours: e.target.value }))} className="input-theme text-sm" placeholder="مثلاً 2" />
                <p className="mt-1 text-[11px] text-theme-muted">بیشتر از ۳ ساعت = کل روز مرخصی و ساعات حضور اضافه‌کار محاسبه می‌شود.</p>
              </div>
            )}
            {reqForm.kind === "FIX" && (
              <div className="space-y-2">
                <p className="text-[11px] text-theme-muted">فقط بخشی که می‌خواهید اصلاح شود را تیک بزنید؛ بخش بدون تیک دست‌نخورده می‌ماند.</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-theme-primary w-32 shrink-0">
                    <input type="checkbox" checked={reqForm.fixIn} onChange={e => setReqForm((s: any) => ({ ...s, fixIn: e.target.checked }))} /> اصلاح ورود
                  </label>
                  <TimeSelect disabled={!reqForm.fixIn} value={reqForm.inTime} onChange={v => setReqForm((s: any) => ({ ...s, inTime: v }))} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-theme-primary w-32 shrink-0">
                    <input type="checkbox" checked={reqForm.fixOut} onChange={e => setReqForm((s: any) => ({ ...s, fixOut: e.target.checked }))} /> اصلاح خروج
                  </label>
                  <TimeSelect disabled={!reqForm.fixOut} value={reqForm.outTime} onChange={v => setReqForm((s: any) => ({ ...s, outTime: v }))} />
                </div>
              </div>
            )}
            <div>
              <label className="block mb-1 text-theme-secondary text-xs">توضیحات</label>
              <textarea value={reqForm.description} onChange={e => setReqForm((s: any) => ({ ...s, description: e.target.value }))} className="input-theme text-sm" rows={2} placeholder="دلیل درخواست..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Sum({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-3 text-center">
      <div className={`text-lg font-bold ${cls || "text-theme-primary"}`} dir="ltr">{value}</div>
      <div className="text-[11px] text-theme-muted">{label}</div>
    </div>
  );
}
