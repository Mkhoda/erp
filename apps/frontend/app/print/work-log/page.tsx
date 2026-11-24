"use client";
// Printable work-log report of one person (opened from the admin "داشبورد فرد" tab).
// Lives outside the dashboard layout; the browser's "Save as PDF" turns it into the PDF.
import React from "react";
import PrintReport from "../../components/work-log/PrintReport";
import { periodTitle } from "../../components/work-log/PersonReport";
import { readError } from "../../../lib/http";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function PrintWorkLogPage() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/work-log/admin/user-report${window.location.search}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { if (!r.ok) throw new Error(await readError(r, "دریافت گزارش ناموفق بود")); return r.json(); })
      .then(d => {
        // The title is the suggested PDF file name.
        document.title = `گزارش عملکرد ${d.user ? `${d.user.firstName} ${d.user.lastName}` : ""} - ${periodTitle(d.period, d.index, d.jYear)}`;
        setData(d);
      })
      .catch(e => setError(e.message || "دریافت گزارش ناموفق بود"));
  }, []);

  // Print once the report is on screen and its fonts are loaded.
  React.useEffect(() => {
    if (!data) return;
    let t: any, alive = true;
    document.fonts.ready.then(() => { if (alive) t = setTimeout(() => window.print(), 300); });
    return () => { alive = false; clearTimeout(t); };
  }, [data]);

  if (error) return <div dir="rtl" className="p-8 text-red-600">{error}</div>;
  if (!data) return <div dir="rtl" className="p-8 text-theme-muted">در حال آماده‌سازی گزارش…</div>;
  return <PrintReport data={data} />;
}
