"use client";
// Printable work-log report of one person (opened from the admin "داشبورد فرد" tab).
// Lives outside the dashboard layout so the print has no sidebar/header; the browser's
// "Save as PDF" turns it into the PDF, charts included.
import React from "react";
import PersonReport, { periodTitle, PERIOD_LABEL, type PeriodKind } from "../../components/work-log/PersonReport";
import { pageTitle } from "../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function PrintWorkLogPage() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const qs = window.location.search;
    const token = localStorage.getItem("token");
    fetch(`${API}/work-log/admin/user-report${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "دریافت گزارش ناموفق بود"); return r.json(); })
      .then(d => {
        setData(d);
        document.title = pageTitle(`گزارش عملکرد ${d.user ? `${d.user.firstName} ${d.user.lastName}` : ""}`);
        // Let the charts lay out before the print dialog opens.
        setTimeout(() => window.print(), 1200);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div dir="rtl" className="p-8 text-red-600">{error}</div>;
  if (!data) return <div dir="rtl" className="p-8 text-theme-muted">در حال آماده‌سازی گزارش…</div>;
  const name = data.user ? `${data.user.firstName} ${data.user.lastName}` : "";
  return (
    <div dir="rtl" className="mx-auto max-w-5xl p-6 bg-theme-primary text-theme-primary print:p-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="flex items-start justify-between gap-4 mb-4 border-b border-theme pb-3">
        <div>
          <h1 className="text-xl font-bold">گزارش عملکرد {name}</h1>
          <div className="text-sm text-theme-muted mt-1">
            {data.user?.department?.name ? `${data.user.department.name} · ` : ""}
            گزارش {PERIOD_LABEL[data.period as PeriodKind]} — {periodTitle(data.period, data.index, data.jYear)}
          </div>
        </div>
        <div className="text-xs text-theme-muted text-left">
          تاریخ تهیه: {new Date().toLocaleDateString("fa-IR")}
          <button onClick={() => window.print()} className="no-print block mt-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs">چاپ / ذخیره PDF</button>
        </div>
      </div>
      <PersonReport data={data} printMode />
    </div>
  );
}
