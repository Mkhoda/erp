"use client";
import React from "react";
import {
  ListTodo, ChevronRight, ChevronLeft, Loader2, Plus, Pencil, Trash2, Clock, CheckCircle2, Circle,
  AlertTriangle, Lock, Save, FolderCog, Repeat, CalendarClock, X, ListChecks, Flag, RotateCcw,
} from "lucide-react";
import { pageTitle } from "../../../../lib/branding";
import { readError } from "../../../../lib/http";
import JalaliDatePicker from "../../../components/ui/JalaliDatePicker";
import Modal from "../../../components/ui/Modal";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { J_MONTHS, STATUS_FA, STATE_META, toFa, faNum, fmtMin, faTime, faDateTime, faDate } from "../../../components/work-log/meta";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
const shiftDate = (d: string, days: number) => new Date(Date.parse(d + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);

type Board = any;

export default function MyWorkLogPage() {
  React.useEffect(() => { document.title = pageTitle("عملکرد من"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [date, setDate] = React.useState<string>("");
  const [board, setBoard] = React.useState<Board | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [taskFilter, setTaskFilter] = React.useState<"open" | "done" | "all">("open");
  const [report, setReport] = React.useState("");
  const [savingReport, setSavingReport] = React.useState(false);
  // Inline "add time" form, keyed by task id.
  const [logFor, setLogFor] = React.useState<string | null>(null);
  const [logForm, setLogForm] = React.useState({ h: "", m: "", note: "" });
  const [logSaving, setLogSaving] = React.useState(false);
  const [editEntry, setEditEntry] = React.useState<any>(null);
  const [taskModal, setTaskModal] = React.useState<any>(null);
  const [catModal, setCatModal] = React.useState(false);
  // Edit mode: add global tasks to my list / finish (تموم شد) tasks I no longer have.
  const [editMode, setEditMode] = React.useState(false);
  const [catForm, setCatForm] = React.useState<{ id?: string; name: string; color: string }>({ name: "", color: "#3b82f6" });

  const load = React.useCallback(async (d?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/work-log/me/board${d ? `?date=${d}` : ""}`, { headers: h });
      if (!res.ok) { toast.error(await readError(res, "خطا در دریافت اطلاعات")); return; }
      const b = await res.json();
      setBoard(b);
      setDate(b.date);
      setReport(b.report?.content || "");
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const go = (d: string) => { if (d && d !== date) { setLogFor(null); load(d); } };

  async function call(url: string, method: string, body?: any, okMsg?: string) {
    const res = await fetch(`${API}${url}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { toast.error(await readError(res, "عملیات ناموفق بود")); return false; }
    if (okMsg) toast.success(okMsg);
    await load(date);
    return true;
  }

  async function addEntry(taskId: string) {
    const minutes = (+logForm.h || 0) * 60 + (+logForm.m || 0);
    if (minutes <= 0) { toast.warning("مدت زمان را وارد کنید"); return; }
    setLogSaving(true);
    try {
      if (await call("/work-log/me/entries", "POST", { taskId, date, minutes, note: logForm.note }, "زمان ثبت شد")) {
        setLogFor(null); setLogForm({ h: "", m: "", note: "" });
      }
    } finally { setLogSaving(false); }
  }

  async function saveEntryEdit() {
    if (!editEntry) return;
    const minutes = (+editEntry.h || 0) * 60 + (+editEntry.m || 0);
    if (minutes <= 0) { toast.warning("مدت زمان را وارد کنید"); return; }
    if (await call(`/work-log/me/entries/${editEntry.id}`, "PATCH", { minutes, note: editEntry.note }, "ویرایش شد")) setEditEntry(null);
  }

  async function removeEntry(id: string) {
    if (!(await confirm("حذف زمان ثبت‌شده", "این رکورد زمان حذف شود؟"))) return;
    await call(`/work-log/me/entries/${id}`, "DELETE", undefined, "حذف شد");
  }

  async function saveReport() {
    if (!report.trim()) { toast.warning("متن گزارش را وارد کنید"); return; }
    setSavingReport(true);
    try { await call("/work-log/me/report", "PUT", { date, content: report }, "گزارش روزانه ذخیره شد"); }
    finally { setSavingReport(false); }
  }

  async function saveTask() {
    if (!taskModal?.title?.trim()) { toast.warning("عنوان وظیفه را وارد کنید"); return; }
    const body = {
      title: taskModal.title, description: taskModal.description || "", categoryId: taskModal.categoryId || null,
      recurring: !!taskModal.recurring, estimatedMinutes: taskModal.estimateH ? Math.round(+taskModal.estimateH * 60) : null,
    };
    const ok = taskModal.id
      ? await call(`/work-log/me/tasks/${taskModal.id}`, "PATCH", body, "وظیفه ویرایش شد")
      : await call("/work-log/me/tasks", "POST", body, "وظیفه تعریف شد");
    if (ok) setTaskModal(null);
  }

  // "تموم شد": the task leaves my daily list (one-off: completed; recurring: I no longer do it).
  async function finishTask(t: any) {
    if (!(await confirm("تموم شد", `وظیفه‌ی «${t.title}» از فهرست شما خارج شود؟ زمان‌های ثبت‌شده‌ی آن باقی می‌ماند و بعداً می‌توانید آن را برگردانید.`, "warning"))) return;
    await call(`/work-log/me/tasks/${t.id}/done`, "POST", { done: true }, "از فهرست شما خارج شد");
  }

  async function removeTask(t: any) {
    if (!(await confirm("حذف وظیفه", `وظیفه‌ی «${t.title}» حذف شود؟ زمان‌های ثبت‌شده‌ی قبلی در گزارش‌ها باقی می‌مانند.`))) return;
    await call(`/work-log/me/tasks/${t.id}`, "DELETE", undefined, "وظیفه حذف شد");
  }

  async function saveCategory() {
    if (!catForm.name.trim()) { toast.warning("نام دسته را وارد کنید"); return; }
    const ok = catForm.id
      ? await call(`/work-log/me/categories/${catForm.id}`, "PATCH", { name: catForm.name, color: catForm.color })
      : await call("/work-log/me/categories", "POST", { name: catForm.name, color: catForm.color }, "دسته اضافه شد");
    if (ok) setCatForm({ name: "", color: "#3b82f6" });
  }

  async function removeCategory(c: any) {
    if (!(await confirm("حذف دسته", `دسته‌ی «${c.name}» حذف شود؟ وظایف آن بدون دسته می‌مانند.`))) return;
    await call(`/work-log/me/categories/${c.id}`, "DELETE", undefined, "دسته حذف شد");
  }

  const b = board;
  const editable = !!b?.editable;
  const cap = b?.capacity;
  const remaining = cap?.allowed == null ? null : Math.max(0, cap.allowed - cap.used);

  // Tasks grouped by category, filtered by done state.
  const groups = React.useMemo(() => {
    if (!b) return [];
    const tasks = (b.tasks as any[]).filter(t =>
      taskFilter === "all" ? true : taskFilter === "done" ? t.done : (!t.done || t.minutesOnDate > 0));
    const map = new Map<string, { cat: any; tasks: any[] }>();
    for (const t of tasks) {
      const key = t.category?.id || "_none";
      if (!map.has(key)) map.set(key, { cat: t.category, tasks: [] });
      map.get(key)!.tasks.push(t);
    }
    return [...map.values()].sort((a, c) => (a.cat ? 0 : 1) - (c.cat ? 0 : 1));
  }, [b, taskFilter]);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      {ConfirmDlg}
      {/* Header + date navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center"><ListTodo className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-theme-primary">عملکرد من</h1>
            <p className="text-sm text-theme-muted">ثبت وظایف، زمان صرف‌شده و گزارش کار روزانه</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => go(shiftDate(date, -1))} title="روز قبل" className="p-2 rounded-lg bg-theme-card border border-theme text-theme-primary"><ChevronRight className="w-4 h-4" /></button>
          <div className="w-64"><JalaliDatePicker value={date} onChange={v => go(v)} /></div>
          <button onClick={() => go(shiftDate(date, 1))} disabled={!b || date >= b.today} title="روز بعد" className="p-2 rounded-lg bg-theme-card border border-theme text-theme-primary disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          {b && date !== b.today && <button onClick={() => go(b.today)} className="text-sm px-3 py-2 rounded-lg bg-theme-card border border-theme text-theme-primary">امروز</button>}
        </div>
      </div>

      {loading && !b ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : b && (
        <>
          {/* Month strip */}
          <div className="bg-theme-card border border-theme rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-theme-primary">{J_MONTHS[b.jMonth - 1]} {toFa(String(b.jYear))}</span>
              <div className="flex flex-wrap gap-3 text-[11px] text-theme-muted">
                {["SUBMITTED", "LATE", "MISSING", "PENDING", "NOT_REQUIRED"].map(s => (
                  <span key={s} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${STATE_META[s].dot}`} />{STATE_META[s].label}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(b.days as any[]).map(d => (
                <button key={d.date} onClick={() => go(d.date)} title={`${STATE_META[d.state].label}${d.status ? ` — ${STATUS_FA[d.status] || d.status}` : ""}${d.loggedMinutes ? ` — ${fmtMin(d.loggedMinutes)}` : ""}`}
                  className={`relative w-10 h-11 rounded-lg border text-xs flex flex-col items-center justify-center transition-colors ${d.date === date ? "border-blue-500 ring-2 ring-blue-500/30" : "border-theme hover:bg-theme-hover"}`}>
                  <span className="text-theme-primary font-medium">{toFa(String(d.jDay))}</span>
                  <span className={`mt-1 w-2 h-2 rounded-full ${STATE_META[d.state].dot}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Day status */}
          <div className="bg-theme-card border border-theme rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-theme-muted">وضعیت حضور: <span className="text-theme-primary font-medium">{b.attendance ? (STATUS_FA[b.attendance.status] || b.attendance.status) : "ثبت نشده"}</span></span>
            {b.attendance && <>
              <span className="text-theme-muted">ورود: <span className="text-theme-primary" dir="ltr">{faTime(b.attendance.firstCheckIn)}</span></span>
              <span className="text-theme-muted">خروج: <span className="text-theme-primary" dir="ltr">{faTime(b.attendance.lastCheckOut)}</span></span>
              <span className="text-theme-muted">کارکرد: <span className="text-theme-primary" dir="ltr">{fmtMin(b.attendance.workedMinutes)}</span></span>
            </>}
            <span className="text-theme-muted">ثبت‌شده: <span className="text-theme-primary font-medium" dir="ltr">{fmtMin(cap.used)}</span>
              {cap.allowed != null && <> از <span dir="ltr">{fmtMin(cap.allowed)}</span></>}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATE_META[b.state].cls}`}>گزارش: {STATE_META[b.state].label}</span>
            {!editable && <span className="flex items-center gap-1 text-xs text-theme-muted"><Lock className="w-3.5 h-3.5" /> فقط مشاهده (ماه‌های گذشته قابل ویرایش نیستند)</span>}
            {editable && b.isLateNow && <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> ثبت برای این روز «با تأخیر» محسوب می‌شود</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Tasks */}
            <div className="lg:col-span-3 bg-theme-card border border-theme rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-theme">
                <div className="flex bg-theme-secondary border border-theme p-0.5 rounded-lg text-xs">
                  {([["open", "فهرست من"], ["done", "انجام‌شده / تمام‌شده"], ["all", "همه"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setTaskFilter(k)} className={`px-3 py-1 rounded-md ${taskFilter === k ? "bg-theme-card shadow text-theme-primary" : "text-theme-muted"}`}>{l}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditMode(v => !v)} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border ${editMode ? "bg-amber-500 border-amber-500 text-white" : "border-theme text-theme-primary"}`}>
                    <ListChecks className="w-3.5 h-3.5" /> {editMode ? "پایان ویرایش" : "ویرایش فهرست"}
                  </button>
                  {editMode && <button onClick={() => setCatModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-theme text-theme-primary"><FolderCog className="w-3.5 h-3.5" /> دسته‌ها</button>}
                  <button onClick={() => setTaskModal({ title: "", description: "", categoryId: "", recurring: false, estimateH: "" })} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-3.5 h-3.5" /> وظیفه جدید</button>
                </div>
              </div>
              {editMode && (
                <div className="px-3 py-2.5 border-b border-theme bg-amber-500/5">
                  <div className="text-xs font-semibold text-theme-secondary mb-1.5">افزودن از وظایف عمومی به فهرست من</div>
                  {(b.globalCatalog as any[]).length === 0 ? (
                    <div className="text-xs text-theme-muted">وظیفه‌ی عمومی تعریف نشده</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(b.globalCatalog as any[]).map(c => (
                        <button key={c.id} disabled={c.state === "IN_LIST"} onClick={() => call(`/work-log/me/tasks/${c.id}/adopt`, "POST", undefined, "به فهرست شما اضافه شد")}
                          title={c.description || ""}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${c.state === "IN_LIST" ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300 cursor-default" : "border-theme text-theme-primary hover:bg-theme-hover"}`}>
                          <span className="w-2 h-2 rounded-full" style={{ background: c.category?.color || "#94a3b8" }} />
                          {c.state === "IN_LIST" ? <CheckCircle2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {c.title}{c.state === "FINISHED" ? " (افزودن دوباره)" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-theme-muted mt-1.5">وظایف فهرست شما هر روز نمایش داده می‌شوند، چه زمانی برایشان ثبت کنید چه نکنید. برای حذف یک وظیفه از فهرست، «تموم شد» را بزنید؛ زمان‌های قبلی آن باقی می‌ماند.</p>
                </div>
              )}
              <div className="divide-y divide-theme/50">
                {groups.length === 0 && <div className="py-10 text-center text-sm text-theme-muted">{taskFilter === "open" ? "فهرست شما خالی است — از «ویرایش فهرست» وظیفه اضافه کنید" : "وظیفه‌ای وجود ندارد"}</div>}
                {groups.map(g => (
                  <div key={g.cat?.id || "_none"}>
                    <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-xs font-semibold text-theme-secondary">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.cat?.color || "#94a3b8" }} />
                      {g.cat?.name || "بدون دسته"}
                    </div>
                    {g.tasks.map((t: any) => (
                      <div key={t.id} className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          {t.recurring ? (
                            <span title="وظیفه‌ی مستمر" className="mt-0.5 text-theme-muted"><Repeat className="w-4 h-4" /></span>
                          ) : (
                            <button onClick={() => call(`/work-log/me/tasks/${t.id}/done`, "POST", { done: !t.done })} title={t.done ? "برگرداندن به باز" : "انجام شد"} className="mt-0.5">
                              {t.done ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-theme-muted hover:text-green-600" />}
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${t.done ? "line-through text-theme-muted" : "text-theme-primary"}`}>{t.title}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
                              {t.scope === "GLOBAL" && <span className="px-1.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-300">عمومی</span>}
                              {t.scope === "ASSIGNED" && <span className="px-1.5 rounded bg-violet-500/10 text-violet-600">از طرف مدیر{t.createdBy ? `: ${t.createdBy.firstName} ${t.createdBy.lastName}` : ""}</span>}
                              {t.deadline && <span className={`flex items-center gap-0.5 px-1.5 rounded ${t.overdue ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"}`}><CalendarClock className="w-3 h-3" /> مهلت {faDate(t.deadline)}{t.overdue ? " (گذشته)" : ""}</span>}
                              {t.done && t.doneAt && <span className="text-green-600">{t.recurring ? "تمام‌شده" : "انجام"}: {faDateTime(t.doneAt)}</span>}
                              <span className="text-theme-muted">کل: <span dir="ltr">{fmtMin(t.totalMinutes)}</span>{t.estimatedMinutes ? <> از <span dir="ltr">{fmtMin(t.estimatedMinutes)}</span></> : null}</span>
                              {t.minutesOnDate > 0 && <span className="text-blue-600">امروز: <span dir="ltr">{fmtMin(t.minutesOnDate)}</span></span>}
                            </div>
                            {t.description && <div className="text-xs text-theme-muted mt-0.5">{t.description}</div>}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {editable && !t.archived && (
                              <button onClick={() => { setLogFor(logFor === t.id ? null : t.id); setLogForm({ h: "", m: "", note: "" }); }} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-500/10"><Clock className="w-3.5 h-3.5" /> ثبت زمان</button>
                            )}
                            {editMode && !t.done && !t.archived && (
                              <button onClick={() => finishTask(t)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"><Flag className="w-3.5 h-3.5" /> تموم شد</button>
                            )}
                            {t.done && (
                              <button onClick={() => call(`/work-log/me/tasks/${t.id}/done`, "POST", { done: false })} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-theme-muted hover:bg-theme-hover"><RotateCcw className="w-3.5 h-3.5" /> برگرداندن</button>
                            )}
                            {editMode && t.editable && <>
                              <button onClick={() => setTaskModal({ ...t, categoryId: t.categoryId || "", estimateH: t.estimatedMinutes ? String(+(t.estimatedMinutes / 60).toFixed(2)) : "" })} title="ویرایش" className="p-1 rounded text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removeTask(t)} title="حذف کامل" className="p-1 rounded text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>}
                          </div>
                        </div>
                        {logFor === t.id && (
                          <div className="mt-2 mr-6 flex flex-wrap items-center gap-2 bg-theme-secondary/40 rounded-lg p-2">
                            <input type="number" min={0} max={23} dir="ltr" placeholder="ساعت" value={logForm.h} onChange={e => setLogForm(s => ({ ...s, h: e.target.value }))} className="input-theme text-sm w-20" />
                            <span className="text-theme-muted">:</span>
                            <input type="number" min={0} max={59} dir="ltr" placeholder="دقیقه" value={logForm.m} onChange={e => setLogForm(s => ({ ...s, m: e.target.value }))} className="input-theme text-sm w-20" />
                            <input placeholder="شرح کار (اختیاری)" value={logForm.note} onChange={e => setLogForm(s => ({ ...s, note: e.target.value }))} className="input-theme text-sm flex-1 min-w-40" />
                            <button onClick={() => addEntry(t.id)} disabled={logSaving} className="btn-theme-primary text-xs py-1.5 disabled:opacity-50">{logSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "ثبت"}</button>
                            {remaining != null && <span className="text-[11px] text-theme-muted w-full">حداکثر قابل ثبت برای این روز: <span dir="ltr">{fmtMin(remaining)}</span></span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Day entries + report */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-theme">
                  <span className="text-sm font-semibold text-theme-primary">کارهای این روز</span>
                  <span className="text-xs text-theme-muted">جمع: <span className="text-theme-primary font-medium" dir="ltr">{fmtMin(cap.used)}</span></span>
                </div>
                {(b.entries as any[]).length === 0 ? (
                  <div className="py-8 text-center text-sm text-theme-muted">هنوز زمانی برای این روز ثبت نشده</div>
                ) : (
                  <ul className="divide-y divide-theme/50">
                    {(b.entries as any[]).map(e => (
                      <li key={e.id} className="px-3 py-2 text-sm">
                        {editEntry?.id === e.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="number" min={0} dir="ltr" value={editEntry.h} onChange={ev => setEditEntry((s: any) => ({ ...s, h: ev.target.value }))} className="input-theme text-sm w-16" />
                            <span className="text-theme-muted">:</span>
                            <input type="number" min={0} max={59} dir="ltr" value={editEntry.m} onChange={ev => setEditEntry((s: any) => ({ ...s, m: ev.target.value }))} className="input-theme text-sm w-16" />
                            <input value={editEntry.note} onChange={ev => setEditEntry((s: any) => ({ ...s, note: ev.target.value }))} className="input-theme text-sm flex-1 min-w-32" />
                            <button onClick={saveEntryEdit} className="p-1.5 rounded text-green-600 hover:bg-green-500/10"><Save className="w-4 h-4" /></button>
                            <button onClick={() => setEditEntry(null)} className="p-1.5 rounded text-theme-muted"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <span className="w-2 h-2 mt-1.5 rounded-full shrink-0" style={{ background: e.task?.category?.color || "#94a3b8" }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-theme-primary">{e.task?.title}</div>
                              {e.note && <div className="text-xs text-theme-muted">{e.note}</div>}
                              {e.isLate && <span className="text-[11px] text-amber-600">ثبت با تأخیر ({faNum(e.lateDays)} روز)</span>}
                            </div>
                            <span className="font-medium text-theme-primary" dir="ltr">{fmtMin(e.minutes)}</span>
                            {editable && <>
                              <button onClick={() => setEditEntry({ id: e.id, h: String(Math.floor(e.minutes / 60)), m: String(e.minutes % 60), note: e.note || "" })} className="p-1 rounded text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removeEntry(e.id)} className="p-1 rounded text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-theme-card border border-theme rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-theme-primary">گزارش کار روزانه</span>
                  {b.report && (
                    <span className="text-[11px] text-theme-muted">
                      ثبت: {faDateTime(b.report.submittedAt)}
                      {b.report.isLate && <span className="text-amber-600"> — با تأخیر ({faNum(b.report.lateDays)} روز)</span>}
                      {b.report.editedAt && <> — ویرایش: {faDateTime(b.report.editedAt)}</>}
                    </span>
                  )}
                </div>
                <textarea rows={7} value={report} onChange={e => setReport(e.target.value)} disabled={!editable}
                  placeholder={editable ? "امروز چه کارهایی انجام دادید؟ (الزامی برای هر روز)" : "گزارشی ثبت نشده"}
                  className="input-theme text-sm resize-y disabled:opacity-70" />
                {editable && (
                  <div className="flex justify-end">
                    <button onClick={saveReport} disabled={savingReport} className="btn-theme-primary text-sm flex items-center gap-1 disabled:opacity-50">
                      {savingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {b.report ? "ذخیره تغییرات" : "ثبت گزارش"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Task create/edit */}
      <Modal open={!!taskModal} onClose={() => setTaskModal(null)} title={taskModal?.id ? "ویرایش وظیفه" : "وظیفه جدید"} size="md"
        footer={<><button onClick={() => setTaskModal(null)} className="btn-theme-secondary text-sm">انصراف</button><button onClick={saveTask} className="btn-theme-primary text-sm">ذخیره</button></>}>
        {taskModal && (
          <div className="space-y-3">
            <div><label className="block mb-1 text-sm text-theme-secondary">عنوان *</label><input value={taskModal.title} onChange={e => setTaskModal((s: any) => ({ ...s, title: e.target.value }))} className="input-theme text-sm" /></div>
            <div><label className="block mb-1 text-sm text-theme-secondary">توضیحات</label><textarea rows={3} value={taskModal.description || ""} onChange={e => setTaskModal((s: any) => ({ ...s, description: e.target.value }))} className="input-theme text-sm resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 text-sm text-theme-secondary">دسته</label>
                <select value={taskModal.categoryId} onChange={e => setTaskModal((s: any) => ({ ...s, categoryId: e.target.value }))} className="input-theme text-sm">
                  <option value="">بدون دسته</option>
                  {(b?.categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.scope === "GLOBAL" ? " (عمومی)" : ""}</option>)}
                </select>
              </div>
              <div><label className="block mb-1 text-sm text-theme-secondary">زمان تخمینی (ساعت)</label><input type="number" min={0} step={0.5} dir="ltr" value={taskModal.estimateH} onChange={e => setTaskModal((s: any) => ({ ...s, estimateH: e.target.value }))} className="input-theme text-sm" /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-theme-primary cursor-pointer w-fit">
              <input type="checkbox" checked={!!taskModal.recurring} onChange={e => setTaskModal((s: any) => ({ ...s, recurring: e.target.checked }))} />
              وظیفه‌ی مستمر (هر روز قابل ثبت زمان، بدون تیک انجام)
            </label>
          </div>
        )}
      </Modal>

      {/* Categories */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setCatForm({ name: "", color: "#3b82f6" }); }} title="دسته‌بندی‌ها" size="md"
        footer={<button onClick={() => setCatModal(false)} className="btn-theme-secondary text-sm">بستن</button>}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="color" value={catForm.color} onChange={e => setCatForm(s => ({ ...s, color: e.target.value }))} className="w-10 h-9 rounded border border-theme bg-transparent" />
            <input placeholder="نام دسته‌ی شخصی" value={catForm.name} onChange={e => setCatForm(s => ({ ...s, name: e.target.value }))} className="input-theme text-sm flex-1" />
            <button onClick={saveCategory} className="btn-theme-primary text-sm">{catForm.id ? "ذخیره" : "افزودن"}</button>
            {catForm.id && <button onClick={() => setCatForm({ name: "", color: "#3b82f6" })} className="p-2 text-theme-muted"><X className="w-4 h-4" /></button>}
          </div>
          <ul className="divide-y divide-theme/50 border border-theme rounded-lg">
            {(b?.categories || []).map((c: any) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ background: c.color || "#94a3b8" }} />
                <span className="flex-1 text-theme-primary">{c.name}</span>
                {c.editable ? <>
                  <button onClick={() => setCatForm({ id: c.id, name: c.name, color: c.color || "#3b82f6" })} className="p-1 text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeCategory(c)} className="p-1 text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </> : <span className="text-[11px] text-theme-muted">{c.scope === "GLOBAL" ? "عمومی" : "تعریف‌شده توسط مدیر"}</span>}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
