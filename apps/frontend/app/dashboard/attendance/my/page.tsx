"use client";
import React from "react";
import { Loader2, Fingerprint, Pencil, AlertTriangle, Send, Hourglass } from "lucide-react";
import Modal from "../../../components/ui/Modal";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const J_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const STATUS_FA: Record<string,string> = { PRESENT:"حاضر", LATE:"تاخیر", EARLY_LEAVE:"تعجیل", ABSENT:"غیبت", INCOMPLETE:"ناقص", LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری", HOLIDAY:"تعطیل", COMPANY_HOLIDAY:"تعطیل شرکت", WEEKEND:"آخر هفته" };
const STATUS_CLS: Record<string,string> = { PRESENT:"bg-green-500/15 text-green-600", LATE:"bg-amber-500/15 text-amber-600", EARLY_LEAVE:"bg-yellow-500/15 text-yellow-600", ABSENT:"bg-red-500/15 text-red-600", INCOMPLETE:"bg-orange-500/15 text-orange-600", LEAVE:"bg-blue-500/15 text-blue-600", MISSION:"bg-violet-500/15 text-violet-600", REMOTE_WORK:"bg-cyan-500/15 text-cyan-600", HOLIDAY:"bg-slate-400/15 text-slate-500", COMPANY_HOLIDAY:"bg-slate-400/15 text-slate-500", WEEKEND:"bg-slate-300/20 text-slate-500" };
const REQ_STATUS_FA: Record<string,string> = { PENDING:"در انتظار", APPROVED:"تایید شده", REJECTED:"رد شده", MANAGER_APPROVED:"تایید مدیر", HR_APPROVED:"تایید HR" };
const faNum = (n: number) => (n ?? 0).toLocaleString("fa-IR");
const toFa = (s: string) => s.replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const fmtMin = (m: number) => toFa(`${Math.floor(Math.abs(m||0)/60)}:${String(Math.abs(m||0)%60).padStart(2,"0")}`);
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });

export default function MyAttendancePage() {
  React.useEffect(() => { document.title = "حضور من | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState<any>(null);
  const [periods, setPeriods] = React.useState<Array<{ jYear: number; jMonth: number }>>([]);
  const [myReqs, setMyReqs] = React.useState<any[]>([]);
  const [jYear, setJYear] = React.useState(0);
  const [jMonth, setJMonth] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState<any>(null); // { row }
  const [reqForm, setReqForm] = React.useState<any>({ kind: "FIX", fixIn: false, inTime: "", fixOut: false, outTime: "", description: "" });
  const [sending, setSending] = React.useState(false);

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
      const [d, s, r] = await Promise.all([
        fetch(`${API}/attendance/me/days?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : []),
        fetch(`${API}/attendance/me/summary?${qs()}`, { headers: h }).then(x => x.ok ? x.json() : null),
        fetch(`${API}/attendance/me/requests`, { headers: h }).then(x => x.ok ? x.json() : []),
      ]);
      setRows(Array.isArray(d) ? d : []); setSummary(s); setMyReqs(Array.isArray(r) ? r : []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [jYear, jMonth]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    fetch(`${API}/attendance/me/periods`, { headers: h }).then(r => r.ok ? r.json() : []).then((p) => setPeriods(Array.isArray(p) ? p : [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const yearOpts = [...new Set(periods.map(p => p.jYear))].sort((a, b) => b - a);
  const monthOpts = [...new Set(periods.filter(p => !jYear || p.jYear === jYear).map(p => p.jMonth))].sort((a, b) => a - b);

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

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <Sum label="روزها" value={faNum(summary.days)} />
          <Sum label="کارکرد" value={fmtMin(summary.workedMinutes)} />
          <Sum label="اضافه‌کار" value={fmtMin(summary.overtimeMinutes)} cls="text-violet-600" />
          <Sum label="تاخیر" value={fmtMin(summary.delayMinutes)} cls="text-amber-600" />
          <Sum label="تعجیل" value={fmtMin(summary.earlyLeaveMinutes)} cls="text-yellow-600" />
          <Sum label="شب‌کاری" value={fmtMin(summary.nightMinutes)} cls="text-slate-600" />
        </div>
      )}

      {(() => {
        const unresolved = rows.filter(r => (r.status === "INCOMPLETE" || r.status === "ABSENT") && !pendingDates.has(r.gregDate.slice(0, 10)));
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
                <th className="px-2 font-medium">کارکرد</th><th className="px-2 font-medium">اضافه‌کار</th><th className="px-2 font-medium">تاخیر</th>
                <th className="px-2 font-medium">وضعیت</th><th className="px-2 font-medium">درخواست</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={8} className="py-10 text-theme-muted">رکوردی نیست</td></tr> : rows.map(r => {
                  const needsResolve = r.status === "INCOMPLETE" || r.status === "ABSENT";
                  const isPending = pendingDates.has(r.gregDate.slice(0, 10));
                  return (
                    <tr key={r.id} className={`border-b border-theme/40 ${needsResolve && !isPending ? "bg-orange-500/5" : ""}`}>
                      <td className="py-1.5 px-2 text-theme-primary" dir="ltr">{faDate(r.gregDate)}</td>
                      <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.firstCheckIn)}</td>
                      <td className="px-2 text-theme-primary" dir="ltr">{faTime(r.lastCheckOut)}</td>
                      <td className="px-2 text-theme-primary" dir="ltr">{fmtMin(r.workedMinutes)}</td>
                      <td className="px-2 text-violet-600" dir="ltr">{r.overtimeMinutes ? fmtMin(r.overtimeMinutes) : "—"}</td>
                      <td className="px-2 text-amber-600" dir="ltr">{r.delayMinutes ? fmtMin(r.delayMinutes) : "—"}</td>
                      <td className="px-2"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] || ""}`}>{needsResolve && <AlertTriangle className="w-3 h-3" />}{STATUS_FA[r.status] || r.status}</span></td>
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
      </div>

      {/* My requests */}
      <div className="bg-theme-card border border-theme rounded-xl p-4">
        <h2 className="font-semibold text-theme-primary text-sm mb-3">درخواست‌های من</h2>
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
                <option value="LEAVE">مرخصی (کل روز)</option>
                <option value="MISSION">ماموریت (کل روز)</option>
                <option value="REMOTE_WORK">دورکاری (کل روز)</option>
                <option value="EXPLANATION">توضیح</option>
              </select>
            </div>
            {reqForm.kind === "FIX" && (
              <div className="space-y-2">
                <p className="text-[11px] text-theme-muted">فقط بخشی که می‌خواهید اصلاح شود را تیک بزنید؛ بخش بدون تیک دست‌نخورده می‌ماند.</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-theme-primary w-32 shrink-0">
                    <input type="checkbox" checked={reqForm.fixIn} onChange={e => setReqForm((s: any) => ({ ...s, fixIn: e.target.checked }))} /> اصلاح ورود
                  </label>
                  <input type="time" dir="ltr" disabled={!reqForm.fixIn} value={reqForm.inTime} onChange={e => setReqForm((s: any) => ({ ...s, inTime: e.target.value }))} className="input-theme text-sm disabled:opacity-50" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-theme-primary w-32 shrink-0">
                    <input type="checkbox" checked={reqForm.fixOut} onChange={e => setReqForm((s: any) => ({ ...s, fixOut: e.target.checked }))} /> اصلاح خروج
                  </label>
                  <input type="time" dir="ltr" disabled={!reqForm.fixOut} value={reqForm.outTime} onChange={e => setReqForm((s: any) => ({ ...s, outTime: e.target.value }))} className="input-theme text-sm disabled:opacity-50" />
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
