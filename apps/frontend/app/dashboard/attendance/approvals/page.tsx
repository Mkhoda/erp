"use client";
import React from "react";
import { Loader2, CheckCircle2, XCircle, ClipboardCheck, ArrowLeftRight } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { pageTitle } from "../../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const STATUS_FA: Record<string,string> = { LEAVE:"مرخصی", MISSION:"ماموریت", REMOTE_WORK:"دورکاری" };
const TYPE_FA: Record<string,string> = { CHECK_IN_FIX:"اصلاح ورود", CHECK_OUT_FIX:"اصلاح خروج", FULL_DAY_FIX:"اصلاح ساعت", EXPLANATION:"توضیح", LEAVE:"مرخصی/ماموریت" };
const REQ_STATUS_FA: Record<string,string> = { PENDING:"در انتظار", APPROVED:"تایید شده", REJECTED:"رد شده" };
const faDate = (g: string) => new Date(g).toLocaleDateString("fa-IR", { timeZone:"UTC" });
const faTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("fa-IR", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tehran", hour12:false }) : "—";

export default function ApprovalsPage() {
  React.useEffect(() => { document.title = pageTitle("صف تایید حضور"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [rows, setRows] = React.useState<any[]>([]);
  const [statusF, setStatusF] = React.useState("PENDING");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<any>(null); // { req, day }
  const [note, setNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/attendance/requests?status=${statusF}`, { headers: h }).then(x => x.ok ? x.json() : []);
      setRows(Array.isArray(r) ? r : []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [statusF]);
  React.useEffect(() => { load(); }, [load]);

  async function openRow(q: any) {
    setNote(""); setSel({ req: q, day: null });
    const date = q.gregDate.slice(0, 10);
    const d = await fetch(`${API}/attendance/records/day?userId=${q.userId}&date=${date}`, { headers: h }).then(r => r.ok ? r.json() : null).catch(() => null);
    setSel({ req: q, day: d?.day || null });
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id);
    try {
      await fetch(`${API}/attendance/requests/${id}/decision`, { method: "PATCH", headers: h, body: JSON.stringify({ decision, note: note || undefined }) });
      setSel(null);
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
                  <tr key={q.id} onClick={() => openRow(q)} className="border-b border-theme/40 hover:bg-theme-hover cursor-pointer">
                    <td className="py-1.5 px-2 text-theme-primary whitespace-nowrap">{q.user ? `${q.user.firstName} ${q.user.lastName}` : "—"}</td>
                    <td className="px-2 text-theme-muted" dir="ltr">{faDate(q.gregDate)}</td>
                    <td className="px-2 text-theme-muted">{q.targetStatus ? STATUS_FA[q.targetStatus] : TYPE_FA[q.type] || q.type}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(q.requestedIn)}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{faTime(q.requestedOut)}</td>
                    <td className="px-2 text-theme-muted text-xs max-w-[180px] truncate" title={q.description}>{q.description || "—"}</td>
                    <td className="px-2"><span className={`text-xs px-2 py-0.5 rounded-full ${q.status === "APPROVED" ? "bg-green-500/15 text-green-600" : q.status === "REJECTED" ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"}`}>{REQ_STATUS_FA[q.status] || q.status}</span></td>
                    <td className="px-2">
                      <button onClick={(e) => { e.stopPropagation(); openRow(q); }} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-theme-secondary border border-theme text-theme-primary hover:bg-theme-hover">
                        <ArrowLeftRight className="w-3.5 h-3.5" /> بررسی
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review modal: current vs requested */}
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `بررسی درخواست — ${sel.req.user ? `${sel.req.user.firstName} ${sel.req.user.lastName}` : ""}` : ""}
        subtitle={sel ? faDate(sel.req.gregDate) : undefined}
        size="md"
        footer={sel && sel.req.status === "PENDING" && (
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => decide(sel.req.id, "REJECT")} disabled={busy === sel.req.id} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"><XCircle className="w-4 h-4" /> رد</button>
            <button onClick={() => decide(sel.req.id, "APPROVE")} disabled={busy === sel.req.id} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50">{busy === sel.req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} تایید</button>
          </div>
        )}
      >
        {sel && (
          <div className="space-y-4">
            <div className="text-sm text-theme-muted">نوع: <span className="text-theme-primary">{sel.req.targetStatus ? STATUS_FA[sel.req.targetStatus] : TYPE_FA[sel.req.type] || sel.req.type}</span></div>
            <div className="grid grid-cols-2 gap-3">
              {/* Current */}
              <div className="border border-theme rounded-lg p-3">
                <div className="text-xs font-semibold text-theme-secondary mb-2">وضعیت فعلی</div>
                <Row label="ورود" value={faTime(sel.day?.firstCheckIn)} />
                <Row label="خروج" value={faTime(sel.day?.lastCheckOut)} />
                <Row label="وضعیت" value={sel.day ? (STATUS_FA[sel.day.status] || sel.day.status) : "—"} />
              </div>
              {/* Requested */}
              <div className="border border-blue-500/40 bg-blue-500/5 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-600 mb-2">درخواست</div>
                <Row label="ورود" value={sel.req.requestedIn ? faTime(sel.req.requestedIn) : "بدون تغییر"} changed={!!sel.req.requestedIn} />
                <Row label="خروج" value={sel.req.requestedOut ? faTime(sel.req.requestedOut) : "بدون تغییر"} changed={!!sel.req.requestedOut} />
                <Row label="وضعیت" value={sel.req.targetStatus ? STATUS_FA[sel.req.targetStatus] : "بدون تغییر"} changed={!!sel.req.targetStatus} />
              </div>
            </div>
            {sel.req.description && <div className="text-sm"><span className="text-theme-muted">توضیح کارمند: </span><span className="text-theme-primary">{sel.req.description}</span></div>}
            {sel.req.status === "PENDING" ? (
              <div>
                <label className="block mb-1 text-theme-secondary text-xs">یادداشت تصمیم (اختیاری)</label>
                <input value={note} onChange={e => setNote(e.target.value)} className="input-theme text-sm" placeholder="مثلاً تایید شد / مدرک ناقص" />
              </div>
            ) : (
              <div className="text-sm text-theme-muted">این درخواست قبلاً {REQ_STATUS_FA[sel.req.status]} است{sel.req.decisionNote ? ` — ${sel.req.decisionNote}` : ""}.</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, changed }: { label: string; value: string; changed?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-theme-muted text-xs">{label}</span>
      <span className={changed ? "text-blue-600 font-medium" : "text-theme-primary"} dir="ltr">{value}</span>
    </div>
  );
}
