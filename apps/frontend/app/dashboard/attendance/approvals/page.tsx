"use client";
import React from "react";
import { Loader2, CheckCircle2, XCircle, ClipboardCheck, Clock } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const STATUS_FA: Record<string,string> = { LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری" };
const TYPE_FA: Record<string,string> = { CHECK_IN_FIX:"اصلاح ورود", CHECK_OUT_FIX:"اصلاح خروج", FULL_DAY_FIX:"اصلاح ساعت", EXPLANATION:"توضیح", LEAVE:"مرخصی/ماموریت" };
const REQ_STATUS_FA: Record<string,string> = { PENDING:"در انتظار", APPROVED:"تایید شده", REJECTED:"رد شده" };
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";

export default function ApprovalsPage() {
  React.useEffect(() => { document.title = "صف تایید حضور | Arzesh"; }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [statusF, setStatusF] = React.useState("PENDING");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/attendance/requests?status=${statusF}`, { headers: h }).then(x => x.ok ? x.json() : []);
      setRows(Array.isArray(r) ? r : []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [statusF]);
  React.useEffect(() => { load(); }, [load]);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id);
    try {
      await fetch(`${API}/attendance/requests/${id}/decision`, { method: "PATCH", headers: h, body: JSON.stringify({ decision }) });
      await load();
    } finally { setBusy(null); }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><ClipboardCheck className="w-5 h-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-theme-primary">صف تایید حضور</h1><p className="text-sm text-theme-muted">{rows.length.toLocaleString("fa-IR")} درخواست</p></div>
        </div>
        <select className="input-theme text-sm w-auto" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="PENDING">در انتظار</option>
          <option value="ALL">همه</option>
          <option value="APPROVED">تایید شده</option>
          <option value="REJECTED">رد شده</option>
        </select>
      </div>

      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-56"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30">
                <th className="py-2 px-2 font-medium">کارمند</th><th className="px-2 font-medium">تاریخ</th><th className="px-2 font-medium">نوع</th>
                <th className="px-2 font-medium">ورود</th><th className="px-2 font-medium">خروج</th><th className="px-2 font-medium">توضیح</th>
                <th className="px-2 font-medium">وضعیت</th><th className="px-2 font-medium">اقدام</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan={8} className="py-10 text-theme-muted">درخواستی نیست</td></tr> : rows.map(q => (
                  <tr key={q.id} className="border-b border-theme/40 hover:bg-theme-hover">
                    <td className="py-1.5 px-2 text-theme-primary whitespace-nowrap">{q.user ? `${q.user.firstName} ${q.user.lastName}` : "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{faDate(q.gregDate)}</td>
                    <td className="px-2 text-theme-muted">{q.targetStatus ? STATUS_FA[q.targetStatus] : TYPE_FA[q.type] || q.type}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(q.requestedIn)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(q.requestedOut)}</td>
                    <td className="px-2 text-theme-muted text-xs max-w-[180px] truncate" title={q.description}>{q.description || "—"}</td>
                    <td className="px-2"><span className={`text-xs px-2 py-0.5 rounded-full ${q.status === "APPROVED" ? "bg-green-500/15 text-green-600" : q.status === "REJECTED" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{REQ_STATUS_FA[q.status] || q.status}</span></td>
                    <td className="px-2">
                      {q.status === "PENDING" ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => decide(q.id, "APPROVE")} disabled={busy === q.id} title="تایید" className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-green-600 hover:bg-green-500/10 disabled:opacity-50">{busy === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}</button>
                          <button onClick={() => decide(q.id, "REJECT")} disabled={busy === q.id} title="رد" className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-600 hover:bg-red-500/10 disabled:opacity-50"><XCircle className="w-4 h-4" /></button>
                        </div>
                      ) : <span className="text-theme-muted text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
