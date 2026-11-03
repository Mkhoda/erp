"use client";
import React from "react";
import {
  NotebookPen, Loader2, Eye, Plus, Pencil, Trash2, Save, Settings2, FolderTree, ClipboardList,
  CheckCircle2, Circle, Repeat, CalendarClock, X,
} from "lucide-react";
import { pageTitle } from "../../../../lib/branding";
import { readError } from "../../../../lib/http";
import JalaliDatePicker from "../../../components/ui/JalaliDatePicker";
import SearchSelect from "../../../components/ui/SearchSelect";
import Modal from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { DOW_FA, STATUS_FA, STATE_META, faNum, fmtMin, faTime, faDateTime, faDate } from "../../../components/work-log/meta";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Tab = "reports" | "catalog" | "settings";

export default function WorkLogReportsPage() {
  React.useEffect(() => { document.title = pageTitle("گزارش عملکرد کاربران"); }, []);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = React.useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [tab, setTab] = React.useState<Tab>("reports");
  const [role, setRole] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch(`${API}/auth/me`, { headers: h }).then(r => r.ok ? r.json() : null).then(d => setRole(d?.role ?? null)).catch(() => {});
    fetch(`${API}/users`, { headers: h }).then(r => r.ok ? r.json() : []).then(u => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
  }, [h]);

  const personOptions = users.map((u: any) => ({
    id: u.id, name: `${u.firstName} ${u.lastName}`,
    search: `${u.firstName} ${u.lastName} ${u.phone || ""} ${u.attendanceCardNo || ""}`,
  }));

  const tabs: Array<{ k: Tab; label: string; icon: any; show: boolean }> = [
    { k: "reports", label: "گزارش روزانه", icon: ClipboardList, show: true },
    { k: "catalog", label: "دسته‌ها و وظایف", icon: FolderTree, show: true },
    { k: "settings", label: "تنظیمات", icon: Settings2, show: role === "ADMIN" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><NotebookPen className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">گزارش عملکرد کاربران</h1>
            <p className="text-sm text-theme-muted">گزارش کار روزانه، وظایف و زمان ثبت‌شده در کنار حضور</p>
          </div>
        </div>
        <div className="flex bg-theme-secondary border border-theme p-1 rounded-xl">
          {tabs.filter(t => t.show).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.k ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted"}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "reports" && <ReportsTab h={h} personOptions={personOptions} departments={departments} />}
      {tab === "catalog" && <CatalogTab h={h} personOptions={personOptions} isAdmin={role === "ADMIN"} />}
      {tab === "settings" && role === "ADMIN" && <SettingsTab h={h} />}
    </div>
  );
}

// ═════════════════════════════ Daily reports ═════════════════════════════

type SortKey = "name" | "dept" | "date" | "attendance" | "worked" | "logged" | "tasks" | "state" | "submittedAt";

function ReportsTab({ h, personOptions, departments }: { h: any; personOptions: any[]; departments: any[] }) {
  const toast = useToast();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [deptId, setDeptId] = React.useState("");
  const [stateF, setStateF] = React.useState("");
  const [attF, setAttF] = React.useState("");
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<any>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [sortK, setSortK] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const pageSize = 50;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (userId) p.set("userId", userId);
      if (deptId) p.set("departmentId", deptId);
      const res = await fetch(`${API}/work-log/admin/days?${p}`, { headers: h });
      if (!res.ok) { toast.error(await readError(res, "خطا در دریافت گزارش‌ها")); return; }
      const d = await res.json();
      setData(d);
      // Show the range the server actually used (defaults to this month → today).
      if (!from) setFrom(d.from);
      if (!to) setTo(d.to);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [from, to, userId, deptId, h]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { setPage(1); }, [data, stateF, attF, sortK, sortDir]);

  function thSort(k: SortKey) {
    if (sortK === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortK(k); setSortDir(k === "date" || k === "submittedAt" ? "desc" : "asc"); }
  }
  const arrow = (k: SortKey) => sortK === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const rows = React.useMemo(() => {
    const list = ((data?.rows || []) as any[]).filter(r =>
      (!stateF || r.state === stateF) && (!attF || (attF === "_none" ? !r.attendance : r.attendance?.status === attF)));
    const val = (r: any): string | number => {
      switch (sortK) {
        case "name": return `${r.user.firstName} ${r.user.lastName}`;
        case "dept": return r.user.department?.name || "";
        case "date": return r.date;
        case "attendance": return r.attendance ? (STATUS_FA[r.attendance.status] || r.attendance.status) : "";
        case "worked": return r.attendance?.workedMinutes || 0;
        case "logged": return r.loggedMinutes;
        case "tasks": return r.taskCount;
        case "state": return STATE_META[r.state]?.label || r.state;
        case "submittedAt": return r.report?.submittedAt || "";
      }
    };
    return list.sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fa");
      return (sortDir === "asc" ? cmp : -cmp) || a.date.localeCompare(b.date);
    });
  }, [data, stateF, attF, sortK, sortDir]);

  async function openDetail(r: any) {
    setDetail({ loading: true, row: r });
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/work-log/admin/day?userId=${r.userId}&date=${r.date}`, { headers: h });
      if (!res.ok) { toast.error(await readError(res, "خطا در دریافت جزئیات")); setDetail(null); return; }
      setDetail({ row: r, ...(await res.json()) });
    } finally { setDetailLoading(false); }
  }

  const s = data?.summary;
  const cols: Array<{ k: SortKey; label: string }> = [
    { k: "name", label: "نام" }, { k: "dept", label: "دپارتمان" }, { k: "date", label: "تاریخ" },
    { k: "attendance", label: "حضور" }, { k: "worked", label: "کارکرد" }, { k: "logged", label: "زمان ثبت‌شده" },
    { k: "tasks", label: "وظایف" }, { k: "state", label: "گزارش روزانه" }, { k: "submittedAt", label: "زمان ثبت گزارش" },
  ];

  return (
    <>
      <div className="bg-theme-card border border-theme rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="lg:col-span-2 flex items-center gap-1 text-xs text-theme-muted"><span className="shrink-0">از</span><JalaliDatePicker value={from} onChange={v => v && setFrom(v)} /></div>
        <div className="lg:col-span-2 flex items-center gap-1 text-xs text-theme-muted"><span className="shrink-0">تا</span><JalaliDatePicker value={to} onChange={v => v && setTo(v)} /></div>
        <select className="input-theme text-sm" value={deptId} onChange={e => setDeptId(e.target.value)}>
          <option value="">همه دپارتمان‌ها</option>
          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <SearchSelect options={personOptions} value={userId} onChange={setUserId} searchKey="search" emptyLabel="همه افراد" placeholder="جستجوی شخص" />
        <select className="input-theme text-sm" value={stateF} onChange={e => setStateF(e.target.value)}>
          <option value="">همه وضعیت‌های گزارش</option>
          {Object.entries(STATE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="input-theme text-sm" value={attF} onChange={e => setAttF(e.target.value)}>
          <option value="">همه وضعیت‌های حضور</option>
          <option value="_none">بدون رکورد حضور</option>
          {Object.entries(STATUS_FA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          {[
            { l: "روزهای نیازمند گزارش", v: faNum(s.required), c: "text-theme-primary", f: "" },
            { l: "ثبت به‌موقع", v: faNum(s.submitted), c: "text-green-600", f: "SUBMITTED" },
            { l: "ثبت با تأخیر", v: faNum(s.late), c: "text-amber-600", f: "LATE" },
            { l: "ثبت نشده", v: faNum(s.missing), c: "text-red-600", f: "MISSING" },
            { l: "در انتظار (امروز)", v: faNum(s.pending), c: "text-blue-600", f: "PENDING" },
            { l: "کل زمان ثبت‌شده", v: fmtMin(s.loggedMinutes), c: "text-violet-600", f: null },
          ].map(c => (
            <button key={c.l} type="button" disabled={c.f === null} onClick={() => c.f !== null && setStateF(c.f)}
              className={`text-right bg-theme-card border rounded-2xl px-3 py-2.5 ${c.f !== null && stateF === c.f && c.f ? "border-blue-500" : "border-theme"} enabled:hover:border-blue-400/50`}>
              <div className="text-xs text-theme-muted">{c.l}</div>
              <div className={`text-lg font-extrabold ${c.c}`} dir="ltr">{c.v}</div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead><tr className="text-theme-muted border-b border-theme bg-theme-secondary/30">
                <th className="py-2 px-2 font-medium">#</th>
                {cols.map(c => <th key={c.k} onClick={() => thSort(c.k)} className="font-medium px-2 cursor-pointer select-none whitespace-nowrap hover:text-theme-primary">{c.label}{arrow(c.k)}</th>)}
                <th className="font-medium px-2">جزئیات</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={11} className="py-10 text-theme-muted">رکوردی یافت نشد</td></tr>
                ) : rows.slice((page - 1) * pageSize, page * pageSize).map((r, i) => (
                  <tr key={r.id} className="border-b border-theme/40 hover:bg-theme-hover cursor-pointer" onClick={() => openDetail(r)}>
                    <td className="py-1.5 px-2 text-theme-muted">{faNum((page - 1) * pageSize + i + 1)}</td>
                    <td className="px-2 text-theme-primary whitespace-nowrap">{r.user.firstName} {r.user.lastName}</td>
                    <td className="px-2 text-theme-muted whitespace-nowrap">{r.user.department?.name || "—"}</td>
                    <td className="px-2 whitespace-nowrap"><div className="text-xs text-theme-muted">{faDate(r.date)}</div><div className="text-[10px] text-theme-muted/70">{DOW_FA[r.dow]}</div></td>
                    <td className="px-2 text-xs text-theme-secondary">{r.attendance ? (STATUS_FA[r.attendance.status] || r.attendance.status) : "—"}</td>
                    <td className="px-2 text-theme-primary" dir="ltr">{r.attendance ? fmtMin(r.attendance.workedMinutes) : "—"}</td>
                    <td className="px-2 text-violet-600 font-medium" dir="ltr">{r.loggedMinutes ? fmtMin(r.loggedMinutes) : "—"}</td>
                    <td className="px-2 text-theme-muted">{r.taskCount ? faNum(r.taskCount) : "—"}</td>
                    <td className="px-2"><span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATE_META[r.state].cls}`}>{STATE_META[r.state].label}{r.report?.isLate ? ` (${faNum(r.report.lateDays)} روز)` : ""}</span></td>
                    <td className="px-2 text-xs text-theme-muted whitespace-nowrap">{r.report ? faDateTime(r.report.submittedAt) : "—"}</td>
                    <td className="px-2"><button onClick={e => { e.stopPropagation(); openDetail(r); }} className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-blue-500 hover:bg-blue-500/10"><Eye className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > pageSize && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-theme text-sm">
            <span className="text-theme-muted">{faNum(rows.length)} رکورد</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">قبلی</button>
              <span className="text-theme-muted">صفحه {faNum(page)} از {faNum(Math.ceil(rows.length / pageSize))}</span>
              <button disabled={page >= Math.ceil(rows.length / pageSize)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary disabled:opacity-40">بعدی</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg"
        title={detail ? `${detail.row.user.firstName} ${detail.row.user.lastName}` : ""}
        subtitle={detail ? `${DOW_FA[detail.row.dow]} ${faDate(detail.row.date)}` : undefined}
        footer={<button onClick={() => setDetail(null)} className="btn-theme-secondary text-sm">بستن</button>}>
        {detailLoading || detail?.loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : detail && <DayDetail d={detail} />}
      </Modal>
    </>
  );
}

function DayDetail({ d }: { d: any }) {
  const att = d.attendance;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-theme-secondary/30 rounded-lg px-3 py-2">
        <span className="text-theme-muted">حضور: <span className="text-theme-primary font-medium">{att ? (STATUS_FA[att.status] || att.status) : "ثبت نشده"}</span></span>
        {att && <>
          <span className="text-theme-muted">ورود: <span className="text-theme-primary" dir="ltr">{faTime(att.firstCheckIn)}</span></span>
          <span className="text-theme-muted">خروج: <span className="text-theme-primary" dir="ltr">{faTime(att.lastCheckOut)}</span></span>
          <span className="text-theme-muted">کارکرد: <span className="text-theme-primary" dir="ltr">{fmtMin(att.workedMinutes)}</span></span>
        </>}
        <span className="text-theme-muted">ثبت‌شده: <span className="text-violet-600 font-medium" dir="ltr">{fmtMin(d.loggedMinutes)}</span>{d.capacity != null && <> از <span dir="ltr">{fmtMin(d.capacity)}</span></>}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATE_META[d.state].cls}`}>{STATE_META[d.state].label}</span>
      </div>
      {d.punches?.length > 0 && (
        <div className="text-xs text-theme-muted">پانچ‌ها: {d.punches.map((p: any) => <span key={p.id} className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-theme-secondary/50 text-theme-primary" dir="ltr">{faTime(p.punchAt)}</span>)}</div>
      )}

      <div>
        <div className="font-semibold text-theme-primary mb-1.5">کارهای انجام‌شده</div>
        {d.entries.length === 0 ? <div className="text-theme-muted text-xs">زمانی ثبت نشده</div> : (
          <table className="w-full text-xs">
            <thead><tr className="text-theme-muted border-b border-theme"><th className="text-right py-1">وظیفه</th><th className="text-right">دسته</th><th>زمان</th><th className="text-right">شرح</th><th>ثبت</th></tr></thead>
            <tbody>
              {d.entries.map((e: any) => (
                <tr key={e.id} className="border-b border-theme/40">
                  <td className="py-1.5 text-theme-primary">{e.task.title}{e.task.recurring && <Repeat className="inline w-3 h-3 mr-1 text-theme-muted" />}</td>
                  <td className="text-theme-muted"><span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: e.task.category?.color || "#94a3b8" }} />{e.task.category?.name || "—"}</td>
                  <td className="text-center font-medium text-theme-primary" dir="ltr">{fmtMin(e.minutes)}</td>
                  <td className="text-theme-secondary">{e.note || "—"}</td>
                  <td className="text-center whitespace-nowrap">{e.isLate ? <span className="text-amber-600">با تأخیر ({faNum(e.lateDays)} روز)</span> : <span className="text-theme-muted">{faDateTime(e.createdAt)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {d.completedTasks?.length > 0 && (
        <div>
          <div className="font-semibold text-theme-primary mb-1">وظایف تکمیل‌شده در این روز</div>
          <ul className="flex flex-wrap gap-1.5">{d.completedTasks.map((t: any) => <li key={t.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700"><CheckCircle2 className="w-3 h-3" /> {t.title}</li>)}</ul>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-theme-primary">گزارش کار روزانه</span>
          {d.report && <span className="text-[11px] text-theme-muted">
            ثبت: {faDateTime(d.report.submittedAt)}{d.report.isLate && <span className="text-amber-600"> — با تأخیر ({faNum(d.report.lateDays)} روز)</span>}
            {d.report.editedAt && <> — ویرایش: {faDateTime(d.report.editedAt)}</>}
          </span>}
        </div>
        {d.report
          ? <div className="whitespace-pre-wrap leading-relaxed text-theme-secondary bg-theme-secondary/30 rounded-lg px-3 py-2">{d.report.content}</div>
          : <div className="text-xs text-red-600">{d.required ? "گزارشی ثبت نشده" : "برای این روز گزارش الزامی نیست"}</div>}
      </div>
    </div>
  );
}

// ═════════════════════════════ Categories & tasks ═════════════════════════════

const EMPTY_TASK = { title: "", description: "", categoryId: "", deadline: "", recurring: false, estimateH: "" };

function CatalogTab({ h, personOptions, isAdmin }: { h: any; personOptions: any[]; isAdmin: boolean }) {
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  // "" = global (عمومی) scope; otherwise items assigned to that user.
  const [scopeUser, setScopeUser] = React.useState("");
  const [includePersonal, setIncludePersonal] = React.useState(false);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [catForm, setCatForm] = React.useState<{ id?: string; name: string; color: string }>({ name: "", color: "#3b82f6" });
  const [taskModal, setTaskModal] = React.useState<any>(null);

  // Managers can't manage global items; push them into per-user scope.
  const canEditScope = isAdmin || !!scopeUser;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (scopeUser) p.set("userId", scopeUser);
      if (includePersonal) p.set("includePersonal", "1");
      const res = await fetch(`${API}/work-log/admin/catalog?${p}`, { headers: h });
      if (!res.ok) { toast.error(await readError(res, "خطا در دریافت فهرست")); return; }
      setData(await res.json());
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, [scopeUser, includePersonal, h]);
  React.useEffect(() => { load(); }, [load]);

  const inScope = (row: any) => scopeUser ? row.userId === scopeUser : row.userId == null;
  const categories = ((data?.categories || []) as any[]).filter(inScope);
  const tasks = ((data?.tasks || []) as any[]).filter(inScope);
  // Categories a task in this scope may use: global + the scoped user's.
  const usableCats = ((data?.categories || []) as any[]).filter(c => c.userId == null || (scopeUser && c.userId === scopeUser));

  async function call(url: string, method: string, body?: any, okMsg?: string) {
    const res = await fetch(`${API}${url}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { toast.error(await readError(res, "عملیات ناموفق بود")); return false; }
    if (okMsg) toast.success(okMsg);
    await load();
    return true;
  }

  async function saveCategory() {
    if (!catForm.name.trim()) { toast.warning("نام دسته را وارد کنید"); return; }
    const ok = catForm.id
      ? await call(`/work-log/admin/categories/${catForm.id}`, "PATCH", { name: catForm.name, color: catForm.color }, "دسته ویرایش شد")
      : await call("/work-log/admin/categories", "POST", { name: catForm.name, color: catForm.color, userId: scopeUser || null }, "دسته اضافه شد");
    if (ok) setCatForm({ name: "", color: "#3b82f6" });
  }

  async function saveTask() {
    if (!taskModal?.title?.trim()) { toast.warning("عنوان وظیفه را وارد کنید"); return; }
    const body = {
      title: taskModal.title, description: taskModal.description || "", categoryId: taskModal.categoryId || null,
      deadline: taskModal.deadline || null, recurring: !!taskModal.recurring && !taskModal.deadline,
      estimatedMinutes: taskModal.estimateH ? Math.round(+taskModal.estimateH * 60) : null,
    };
    const ok = taskModal.id
      ? await call(`/work-log/admin/tasks/${taskModal.id}`, "PATCH", body, "وظیفه ویرایش شد")
      : await call("/work-log/admin/tasks", "POST", { ...body, userId: scopeUser || null }, scopeUser ? "وظیفه تعریف و به کاربر اعلان شد" : "وظیفه‌ی عمومی تعریف شد");
    if (ok) setTaskModal(null);
  }

  return (
    <div className="space-y-4">
      {ConfirmDlg}
      <div className="bg-theme-card border border-theme rounded-xl p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-theme-secondary">محدوده:</span>
        {isAdmin && (
          <button onClick={() => setScopeUser("")} className={`text-sm px-3 py-1.5 rounded-lg border ${!scopeUser ? "bg-blue-600 text-white border-blue-600" : "border-theme text-theme-primary"}`}>عمومی (همه کاربران)</button>
        )}
        <div className="w-72"><SearchSelect options={personOptions} value={scopeUser} onChange={setScopeUser} searchKey="search" placeholder="یا انتخاب یک کاربر" /></div>
        {scopeUser && (
          <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer">
            <input type="checkbox" checked={includePersonal} onChange={e => setIncludePersonal(e.target.checked)} /> نمایش موارد شخصی کاربر (فقط مشاهده)
          </label>
        )}
      </div>

      {!canEditScope ? (
        <div className="bg-theme-card border border-theme rounded-xl p-6 text-center text-sm text-theme-muted">برای مدیریت دسته‌ها و وظایف، یک کاربر از دپارتمان خود را انتخاب کنید.</div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Categories */}
          <div className="bg-theme-card border border-theme rounded-xl p-3 space-y-3">
            <div className="text-sm font-semibold text-theme-primary">دسته‌بندی‌ها {scopeUser ? "ی این کاربر" : "ی عمومی"}</div>
            <div className="flex items-center gap-2">
              <input type="color" value={catForm.color} onChange={e => setCatForm(s => ({ ...s, color: e.target.value }))} className="w-9 h-9 rounded border border-theme bg-transparent" />
              <input placeholder="نام دسته" value={catForm.name} onChange={e => setCatForm(s => ({ ...s, name: e.target.value }))} className="input-theme text-sm flex-1" />
              <button onClick={saveCategory} className="btn-theme-primary text-xs">{catForm.id ? "ذخیره" : "افزودن"}</button>
              {catForm.id && <button onClick={() => setCatForm({ name: "", color: "#3b82f6" })} className="p-1 text-theme-muted"><X className="w-4 h-4" /></button>}
            </div>
            <ul className="divide-y divide-theme/50 border border-theme rounded-lg">
              {categories.length === 0 && <li className="px-3 py-4 text-center text-xs text-theme-muted">دسته‌ای تعریف نشده</li>}
              {categories.map(c => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ background: c.color || "#94a3b8" }} />
                  <span className="flex-1 text-theme-primary">{c.name}</span>
                  <span className="text-[11px] text-theme-muted">{faNum(c._count?.tasks || 0)} وظیفه</span>
                  {c.isAdminDefined ? <>
                    <button onClick={() => setCatForm({ id: c.id, name: c.name, color: c.color || "#3b82f6" })} className="p-1 text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={async () => { if (await confirm("حذف دسته", `دسته‌ی «${c.name}» حذف شود؟`)) call(`/work-log/admin/categories/${c.id}`, "DELETE", undefined, "حذف شد"); }} className="p-1 text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </> : <span className="text-[11px] text-theme-muted">شخصی</span>}
                </li>
              ))}
            </ul>
          </div>

          {/* Tasks */}
          <div className="lg:col-span-2 bg-theme-card border border-theme rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-theme">
              <span className="text-sm font-semibold text-theme-primary">وظایف {scopeUser ? "این کاربر" : "عمومی"}</span>
              <button onClick={() => setTaskModal({ ...EMPTY_TASK })} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-3.5 h-3.5" /> وظیفه جدید</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-theme-muted text-xs border-b border-theme bg-theme-secondary/30">
                  <th className="text-right py-2 px-3 font-medium">عنوان</th><th className="text-right font-medium">دسته</th><th className="font-medium">نوع / مهلت</th>
                  <th className="font-medium">زمان ثبت‌شده</th><th className="font-medium">{scopeUser ? "وضعیت" : "انجام‌داده"}</th><th className="font-medium">عملیات</th>
                </tr></thead>
                <tbody>
                  {tasks.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-xs text-theme-muted">وظیفه‌ای تعریف نشده</td></tr>}
                  {tasks.map(t => (
                    <tr key={t.id} className="border-b border-theme/40">
                      <td className="py-2 px-3"><div className="text-theme-primary">{t.title}</div>{t.description && <div className="text-[11px] text-theme-muted">{t.description}</div>}</td>
                      <td className="text-xs text-theme-muted"><span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: t.category?.color || "#94a3b8" }} />{t.category?.name || "—"}</td>
                      <td className="text-center text-xs">
                        {t.recurring ? <span className="inline-flex items-center gap-0.5 text-theme-muted"><Repeat className="w-3 h-3" /> مستمر</span>
                          : t.deadline ? <span className="inline-flex items-center gap-0.5 text-blue-600"><CalendarClock className="w-3 h-3" /> {faDate(t.deadline)}</span> : "—"}
                      </td>
                      <td className="text-center text-xs text-violet-600" dir="ltr">{t.totalMinutes ? fmtMin(t.totalMinutes) : "—"}</td>
                      <td className="text-center text-xs">
                        {t.recurring ? "—" : scopeUser
                          ? (t.done ? <span className="inline-flex items-center gap-0.5 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> {faDateTime(t.doneAt)}</span> : <span className="inline-flex items-center gap-0.5 text-theme-muted"><Circle className="w-3.5 h-3.5" /> باز</span>)
                          : `${faNum(t.doneCount)} نفر`}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        {t.isAdminDefined ? <>
                          <button onClick={() => setTaskModal({ ...t, categoryId: t.categoryId || "", deadline: t.deadline ? t.deadline.slice(0, 10) : "", estimateH: t.estimatedMinutes ? String(+(t.estimatedMinutes / 60).toFixed(2)) : "" })} className="p-1 text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={async () => { if (await confirm("حذف وظیفه", `وظیفه‌ی «${t.title}» حذف شود؟ زمان‌های ثبت‌شده در گزارش‌ها باقی می‌مانند.`)) call(`/work-log/admin/tasks/${t.id}`, "DELETE", undefined, "حذف شد"); }} className="p-1 text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </> : <span className="text-[11px] text-theme-muted">شخصی</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!taskModal} onClose={() => setTaskModal(null)} size="md"
        title={taskModal?.id ? "ویرایش وظیفه" : scopeUser ? "تعریف وظیفه برای کاربر" : "وظیفه‌ی عمومی جدید"}
        footer={<><button onClick={() => setTaskModal(null)} className="btn-theme-secondary text-sm">انصراف</button><button onClick={saveTask} className="btn-theme-primary text-sm flex items-center gap-1"><Save className="w-4 h-4" /> ذخیره</button></>}>
        {taskModal && (
          <div className="space-y-3">
            <div><label className="block mb-1 text-sm text-theme-secondary">عنوان *</label><input value={taskModal.title} onChange={e => setTaskModal((s: any) => ({ ...s, title: e.target.value }))} className="input-theme text-sm" /></div>
            <div><label className="block mb-1 text-sm text-theme-secondary">توضیحات</label><textarea rows={3} value={taskModal.description || ""} onChange={e => setTaskModal((s: any) => ({ ...s, description: e.target.value }))} className="input-theme text-sm resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm text-theme-secondary">دسته</label>
                <select value={taskModal.categoryId} onChange={e => setTaskModal((s: any) => ({ ...s, categoryId: e.target.value }))} className="input-theme text-sm">
                  <option value="">بدون دسته</option>
                  {usableCats.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.userId == null ? " (عمومی)" : ""}</option>)}
                </select>
              </div>
              <div><label className="block mb-1 text-sm text-theme-secondary">زمان تخمینی (ساعت)</label><input type="number" min={0} step={0.5} dir="ltr" value={taskModal.estimateH} onChange={e => setTaskModal((s: any) => ({ ...s, estimateH: e.target.value }))} className="input-theme text-sm" /></div>
            </div>
            <div>
              <label className="block mb-1 text-sm text-theme-secondary">مهلت انجام (اختیاری)</label>
              <div className="flex items-center gap-2">
                <div className="flex-1"><JalaliDatePicker value={taskModal.deadline} onChange={v => setTaskModal((s: any) => ({ ...s, deadline: v, recurring: v ? false : s.recurring }))} /></div>
                {taskModal.deadline && <button onClick={() => setTaskModal((s: any) => ({ ...s, deadline: "" }))} className="p-2 text-red-500"><X className="w-4 h-4" /></button>}
              </div>
            </div>
            <label className={`flex items-center gap-2 text-sm cursor-pointer w-fit ${taskModal.deadline ? "opacity-50" : "text-theme-primary"}`}>
              <input type="checkbox" disabled={!!taskModal.deadline} checked={!!taskModal.recurring} onChange={e => setTaskModal((s: any) => ({ ...s, recurring: e.target.checked }))} />
              وظیفه‌ی مستمر (هر روز قابل ثبت زمان، بدون تیک انجام)
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═════════════════════════════ Settings ═════════════════════════════

function SettingsTab({ h }: { h: any }) {
  const toast = useToast();
  const [s, setS] = React.useState<any>(null);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    fetch(`${API}/work-log/admin/settings`, { headers: h }).then(r => r.ok ? r.json() : null).then(setS).catch(() => {});
  }, [h]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/work-log/admin/settings`, { method: "PATCH", headers: h, body: JSON.stringify(s) });
      if (!res.ok) { toast.error(await readError(res, "ذخیره ناموفق بود")); return; }
      setS(await res.json());
      toast.success("تنظیمات ذخیره شد");
    } finally { setSaving(false); }
  }

  if (!s) return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
  const grace = +s.lateGraceMinutes || 0;
  return (
    <div className="bg-theme-card border border-theme rounded-xl p-4 space-y-5 max-w-2xl">
      <div>
        <label className="block mb-1 text-sm font-medium text-theme-primary">مهلت ثبت بدون تأخیر (دقیقه پس از نیمه‌شب)</label>
        <input type="number" min={0} dir="ltr" value={s.lateGraceMinutes} onChange={e => setS((x: any) => ({ ...x, lateGraceMinutes: e.target.value }))} className="input-theme text-sm w-40" />
        <p className="mt-1 text-xs text-theme-muted">
          {grace === 0 ? "ثبت گزارش یا زمان یک روز بعد از ساعت ۰۰:۰۰ همان شب «با تأخیر» محسوب می‌شود."
            : `ثبت تا ${fmtMin(grace)} بامداد روز بعد به‌موقع است؛ بعد از آن «با تأخیر» محسوب می‌شود.`}
          {" "}ویرایش فقط برای روزهای ماه جاری امکان‌پذیر است.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm text-theme-primary cursor-pointer">
        <input type="checkbox" className="mt-1" checked={!!s.capByAttendance} onChange={e => setS((x: any) => ({ ...x, capByAttendance: e.target.checked }))} />
        <span>جمع زمان ثبت‌شده در هر روز نتواند از کارکرد حضور همان روز بیشتر شود<span className="block text-xs text-theme-muted">کاربرانی که کارت حضور ندارند از این محدودیت مستثنی هستند.</span></span>
      </label>
      <label className="flex items-start gap-2 text-sm text-theme-primary cursor-pointer">
        <input type="checkbox" className="mt-1" checked={!!s.requireOnNonWorkingDays} onChange={e => setS((x: any) => ({ ...x, requireOnNonWorkingDays: e.target.checked }))} />
        <span>گزارش روزانه در روزهای تعطیل و آخر هفته هم الزامی باشد<span className="block text-xs text-theme-muted">در حالت عادی فقط در روزهای کاری (یا روزهای تعطیلی که فرد کار کرده) الزامی است.</span></span>
      </label>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-theme-primary text-sm flex items-center gap-1 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره</button>
      </div>
    </div>
  );
}
