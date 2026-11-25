"use client";
// View-only drill-down behind each section of the management dashboard: filterable, sortable,
// paged rows that trace individual people, days, tickets and assets. Nothing here changes data.
import React from "react";
import { Loader2, Search } from "lucide-react";
import Modal from "../ui/Modal";
import DateRangeFilter, { type DateRange } from "../ui/DateRangeFilter";
import SearchSelect from "../ui/SearchSelect";
import { STATUS_FA, STATE_META, DOW_FA, faDate, faDateTime, faNum, fmtMin, faTime } from "../work-log/meta";
import { readError } from "../../../lib/http";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
export type Section = "attendance" | "worklog" | "tickets" | "assets" | "users";
export type Base = Record<string, string | undefined>;

const TICKET_FA: Record<string, string> = { OPEN: "باز", ASSIGNED: "ارجاع‌شده", IN_PROGRESS: "در حال انجام", WAITING_USER: "منتظر کاربر", USER_REPLIED: "پاسخ کاربر", RESOLVED: "حل‌شده", CLOSED: "بسته", CANCELLED: "لغوشده", REJECTED: "ردشده", REOPENED: "بازگشایی" };
const PRIORITY_FA: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "بالا", CRITICAL: "بحرانی" };
const AVAIL_FA: Record<string, string> = { AVAILABLE: "موجود", IN_USE: "در حال استفاده", CONSUMED: "مصرف‌شده", MAINTENANCE: "تعمیرات", RETIRED: "خارج از رده", LOST: "مفقود" };
const COND_FA: Record<string, string> = { NEW: "جدید", USED_GOOD: "استفاده‌شده سالم", DEFECTIVE: "معیوب" };
const ROLE_FA: Record<string, string> = { ADMIN: "مدیر ارشد", MANAGER: "مدیر", EXPERT: "کارشناس", USER: "کاربر" };
const EVENT_FA: Record<string, string> = { CREATED: "ثبت تیکت", ASSIGNED: "ارجاع", REASSIGNED: "ارجاع مجدد", TRANSFERRED: "انتقال", STATUS_CHANGED: "تغییر وضعیت", PRIORITY_CHANGED: "تغییر اولویت", COMMENT_ADDED: "پاسخ", INTERNAL_NOTE: "یادداشت داخلی", ATTACHMENT_ADDED: "پیوست", CLOSED: "بسته شد", REOPENED: "بازگشایی", SLA_BREACHED: "نقض SLA" };
const METRIC_FA: Record<string, string> = { workedMinutes: "کارکرد", overtimeMinutes: "اضافه‌کار", holidayOvertimeMinutes: "تعطیل‌کاری", delayMinutes: "تاخیر", earlyLeaveMinutes: "تعجیل", deficitMinutes: "کسری", nightMinutes: "شب‌کاری", leaveMinutes: "مرخصی", remoteMinutes: "دورکاری" };
const MIN = (m: number) => (m ? <bdi dir="ltr">{fmtMin(m)}</bdi> : <span className="text-theme-muted">—</span>);
const DASH = <span className="text-theme-muted">—</span>;
const money = (n: number | null) => (n == null ? "—" : `${faNum(Math.round(n))}`);

type Col = { k: string; label: string; sort?: string | false; cell?: (r: any) => React.ReactNode; cls?: string };
type Filter = { k: string; label: string; options?: Array<[string, string]>; type?: "number"; placeholder?: string };
type View = { k: string; label: string; cols: Col[]; filters: Filter[]; defaultSort: string; tiles: (t: any) => Array<[string, React.ReactNode]> };
type Cfg = { title: string; path: string; views: View[]; open?: (r: any) => { kind: "day" | "person" | "ticket" | "asset"; args: any } | null };

const opts = (m: Record<string, string>): Array<[string, string]> => Object.entries(m);
const yesno: Array<[string, string]> = [["1", "بله"], ["0", "خیر"]];
const dayCell = (r: any) => faDate(r.date);

const ATT_FILTERS: Filter[] = [
  { k: "status", label: "همه وضعیت‌ها", options: opts(STATUS_FA) },
  { k: "metric", label: "شاخص مقدار", options: opts(METRIC_FA) }, { k: "min", label: "حداقل (دقیقه)", type: "number" },
  { k: "override", label: "اصلاح دستی", options: [["1", "دارای اصلاح"], ["0", "بدون اصلاح"]] },
];
const attTiles = (t: any): Array<[string, React.ReactNode]> => [["رکورد", faNum(t.records)], ["کارکرد", MIN(t.workedMinutes)], ["اضافه‌کار", MIN(t.overtimeMinutes)], ["تاخیر", MIN(t.delayMinutes)], ["تعجیل", MIN(t.earlyLeaveMinutes)], ["کسری", MIN(t.deficitMinutes)]];
const wlTiles = (t: any): Array<[string, React.ReactNode]> => [["رکورد", faNum(t.records)], ["الزامی", faNum(t.required ?? 0)], ["به‌موقع", faNum(t.submitted ?? 0)], ["با تأخیر", faNum(t.late ?? 0)], ["ثبت‌نشده", faNum(t.missing ?? 0)], ["زمان ثبت‌شده", MIN(t.loggedMinutes)]];

const SECTIONS: Record<Section, Cfg> = {
  attendance: {
    title: "جزئیات حضور و غیاب", path: "attendance",
    open: r => (r.userId && r.date ? { kind: "day", args: { userId: r.userId, date: r.date } } : r.userId ? { kind: "person", args: { userId: r.userId } } : null),
    views: [
      { k: "days", label: "روز به روز", defaultSort: "gregDate", filters: ATT_FILTERS, tiles: attTiles, cols: [
        { k: "date", label: "تاریخ", sort: "gregDate", cell: dayCell }, { k: "name", label: "نام", sort: "name", cell: r => <PersonLink r={r} /> }, { k: "department", label: "دپارتمان", sort: "department" },
        { k: "status", label: "وضعیت", sort: "status", cell: r => STATUS_FA[r.status] || r.status },
        { k: "in", label: "ورود", sort: "firstCheckIn", cell: r => (r.firstCheckIn ? <bdi dir="ltr">{faTime(r.firstCheckIn)}</bdi> : DASH) }, { k: "out", label: "خروج", sort: "lastCheckOut", cell: r => (r.lastCheckOut ? <bdi dir="ltr">{faTime(r.lastCheckOut)}</bdi> : DASH) },
        ...(["workedMinutes", "overtimeMinutes", "delayMinutes", "earlyLeaveMinutes", "deficitMinutes", "leaveMinutes", "remoteMinutes"] as const).map(m => ({ k: m, label: METRIC_FA[m], sort: m, cell: (r: any) => MIN(r[m]), cls: "text-center" })),
        { k: "hasOverride", label: "اصلاح", sort: false, cell: r => (r.hasOverride ? <span className="text-amber-600">✎</span> : DASH), cls: "text-center" },
      ] },
      { k: "people", label: "جمع به تفکیک فرد", defaultSort: "workedMinutes", filters: ATT_FILTERS, tiles: attTiles, cols: [
        { k: "name", label: "نام", sort: "name", cell: r => <PersonLink r={r} /> }, { k: "department", label: "دپارتمان", sort: "department" },
        ...(["days", "present", "late", "absent", "leave", "remote", "mission", "incomplete"] as const).map(m => ({ k: m, label: { days: "روز", present: "حضور", late: "تاخیر", absent: "غیبت", leave: "مرخصی", remote: "دورکاری", mission: "ماموریت", incomplete: "ناقص" }[m], sort: m, cell: (r: any) => faNum(r[m]), cls: "text-center" })),
        ...(["workedMinutes", "overtimeMinutes", "delayMinutes", "earlyLeaveMinutes", "deficitMinutes"] as const).map(m => ({ k: m, label: METRIC_FA[m], sort: m, cell: (r: any) => MIN(r[m]), cls: "text-center" })),
      ] },
    ],
  },
  worklog: {
    title: "جزئیات عملکرد و گزارش کار", path: "work-log",
    open: r => (r.userId && r.date ? { kind: "day", args: { userId: r.userId, date: r.date } } : r.userId ? { kind: "person", args: { userId: r.userId } } : null),
    views: [
      { k: "days", label: "روز به روز", defaultSort: "date", tiles: wlTiles, filters: [
        { k: "state", label: "همه وضعیت‌های گزارش", options: [["SUBMITTED", "ثبت به‌موقع"], ["LATE", "با تأخیر"], ["MISSING", "ثبت‌نشده"], ["PENDING", "در انتظار"], ["NOT_REQUIRED", "الزامی نیست"]] },
        { k: "attStatus", label: "همه وضعیت‌های حضور", options: opts(STATUS_FA) }, { k: "below", label: "پوشش کمتر از ٪", type: "number" },
      ], cols: [
        { k: "date", label: "تاریخ", sort: "date", cell: dayCell }, { k: "name", label: "نام", sort: "name", cell: r => <PersonLink r={r} /> }, { k: "department", label: "دپارتمان", sort: "department" },
        { k: "status", label: "حضور", sort: "status", cell: r => (r.status ? STATUS_FA[r.status] || r.status : DASH) },
        { k: "worked", label: "کارکرد", sort: "workedMinutes", cell: r => MIN(r.workedMinutes), cls: "text-center" }, { k: "logged", label: "ثبت‌شده", sort: "loggedMinutes", cell: r => MIN(r.loggedMinutes), cls: "text-center" },
        { k: "coverage", label: "پوشش", sort: "coverage", cell: r => (r.coverage == null ? DASH : `${faNum(r.coverage)}٪`), cls: "text-center" }, { k: "tasks", label: "وظیفه", sort: "taskCount", cell: r => (r.taskCount ? faNum(r.taskCount) : DASH), cls: "text-center" },
        { k: "state", label: "گزارش", sort: "state", cell: r => <span className={`text-xs px-2 py-0.5 rounded-full ${STATE_META[r.state]?.cls || ""}`}>{STATE_META[r.state]?.label || r.state}{r.lateDays ? ` (${faNum(r.lateDays)} روز)` : ""}{r.lateWaived ? " ✓" : ""}</span> },
        { k: "len", label: "طول گزارش", sort: "length", cell: r => (r.length ? faNum(r.length) : DASH), cls: "text-center" }, { k: "at", label: "ثبت گزارش", sort: "submittedAt", cell: r => (r.submittedAt ? faDateTime(r.submittedAt) : DASH), cls: "whitespace-nowrap" },
      ] },
      { k: "entries", label: "زمان‌های ثبت‌شده", defaultSort: "date", tiles: wlTiles, filters: [
        { k: "late", label: "همه (به‌موقع و تأخیر)", options: [["1", "فقط با تأخیر"], ["0", "فقط به‌موقع"]] }, { k: "byAdmin", label: "ثبت‌کننده", options: [["1", "ثبت‌شده توسط مدیر"]] },
      ], cols: [
        { k: "date", label: "تاریخ", sort: "date", cell: dayCell }, { k: "name", label: "نام", sort: "name", cell: r => <PersonLink r={r} /> }, { k: "department", label: "دپارتمان", sort: false },
        { k: "task", label: "وظیفه", sort: "task" }, { k: "category", label: "دسته", sort: false, cell: r => (r.category ? <><span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: r.color || "#94a3b8" }} />{r.category}</> : DASH) },
        { k: "minutes", label: "زمان", sort: "minutes", cell: r => MIN(r.minutes), cls: "text-center" }, { k: "note", label: "شرح", sort: false, cell: r => r.note || DASH },
        { k: "late", label: "ثبت", sort: "lateDays", cell: r => (r.isLate ? <span className="text-amber-600">{faNum(r.lateDays)} روز تأخیر</span> : r.byAdmin ? <span className="text-violet-600">مدیر</span> : <span className="text-theme-muted">به‌موقع</span>) },
      ] },
      { k: "people", label: "جمع به تفکیک فرد", defaultSort: "loggedMinutes", tiles: wlTiles, filters: [{ k: "state", label: "همه وضعیت‌های گزارش", options: [["SUBMITTED", "ثبت به‌موقع"], ["LATE", "با تأخیر"], ["MISSING", "ثبت‌نشده"]] }], cols: [
        { k: "name", label: "نام", sort: "name", cell: r => <PersonLink r={r} /> }, { k: "department", label: "دپارتمان", sort: "department" },
        ...(["required", "submitted", "late", "missing"] as const).map(m => ({ k: m, label: { required: "الزامی", submitted: "به‌موقع", late: "با تأخیر", missing: "ثبت‌نشده" }[m], sort: m, cell: (r: any) => faNum(r[m]), cls: "text-center" })),
        { k: "rate", label: "نرخ ثبت", sort: "rate", cell: r => (r.rate == null ? DASH : `${faNum(r.rate)}٪`), cls: "text-center" },
        { k: "loggedMinutes", label: "ثبت‌شده", sort: "loggedMinutes", cell: r => MIN(r.loggedMinutes), cls: "text-center" }, { k: "workedMinutes", label: "کارکرد", sort: "workedMinutes", cell: r => MIN(r.workedMinutes), cls: "text-center" },
        { k: "coverage", label: "پوشش", sort: "coverage", cell: r => (r.coverage == null ? DASH : `${faNum(r.coverage)}٪`), cls: "text-center" },
      ] },
    ],
  },
  tickets: {
    title: "جزئیات تیکت‌ها", path: "tickets", open: r => ({ kind: "ticket", args: { id: r.id } }),
    views: [{ k: "list", label: "فهرست تیکت‌ها", defaultSort: "createdAt", tiles: t => [["تیکت", faNum(t.records)], ["باز", faNum(t.open)], ["دیرکرد SLA", faNum(t.overSla)]], filters: [
      { k: "dateField", label: "بازه بر اساس ثبت", options: [["resolved", "بازه بر اساس حل‌شدن"], ["now", "همه‌ی بازها (اکنون)"]] },
      { k: "status", label: "همه وضعیت‌ها", options: opts(TICKET_FA) }, { k: "priority", label: "همه اولویت‌ها", options: opts(PRIORITY_FA) },
      { k: "overSla", label: "نقض SLA", options: [["1", "فقط نقض‌شده"]] }, { k: "overdue", label: "مهلت", options: [["1", "باز و از مهلت گذشته"]] },
    ], cols: [
      { k: "number", label: "شماره", sort: "number", cell: r => `#${faNum(r.number)}` }, { k: "title", label: "عنوان", sort: false }, { k: "department", label: "دپارتمان", sort: false },
      { k: "status", label: "وضعیت", sort: "status", cell: r => TICKET_FA[r.status] || r.status }, { k: "priority", label: "اولویت", sort: "priority", cell: r => PRIORITY_FA[r.priority] || r.priority },
      { k: "requester", label: "درخواست‌کننده", sort: false, cell: r => <PersonLink r={{ userId: r.requesterId, name: r.requester }} /> }, { k: "assignee", label: "مسئول", sort: false, cell: r => (r.assignee ? <PersonLink r={{ userId: r.assigneeId, name: r.assignee }} /> : <span className="text-amber-600">بدون مسئول</span>) },
      { k: "createdAt", label: "ثبت", sort: "createdAt", cell: r => faDateTime(r.createdAt), cls: "whitespace-nowrap" }, { k: "dueAt", label: "مهلت", sort: "dueAt", cell: r => (r.dueAt ? faDateTime(r.dueAt) : DASH), cls: "whitespace-nowrap" },
      { k: "first", label: "پاسخ اول", sort: false, cell: r => (r.firstResponseMin == null ? DASH : MIN(r.firstResponseMin)), cls: "text-center" }, { k: "resolve", label: "زمان حل", sort: "resolvedAt", cell: r => (r.resolveMin == null ? DASH : MIN(r.resolveMin)), cls: "text-center" },
      { k: "sla", label: "SLA", sort: false, cell: r => (r.isOverSla ? <span className="text-red-600">نقض</span> : <span className="text-green-600">✓</span>), cls: "text-center" },
    ] }],
  },
  assets: {
    title: "جزئیات اموال", path: "assets", open: r => ({ kind: "asset", args: { id: r.id } }),
    views: [{ k: "list", label: "فهرست اموال", defaultSort: "createdAt", tiles: t => [["دارایی", faNum(t.records)], ["ارزش کل", money(t.cost)]], filters: [
      { k: "availability", label: "همه وضعیت‌ها", options: opts(AVAIL_FA) }, { k: "condition", label: "همه وضعیت‌های فیزیکی", options: opts(COND_FA) },
      { k: "assigned", label: "واگذاری", options: [["1", "واگذارشده"], ["0", "واگذارنشده"]] },
    ], cols: [
      { k: "name", label: "نام", sort: "name" }, { k: "barcode", label: "بارکد", sort: "barcode", cell: r => <bdi dir="ltr">{r.barcode}</bdi> }, { k: "type", label: "نوع", sort: false }, { k: "category", label: "دسته", sort: false }, { k: "owner", label: "تعلق", sort: false, cell: r => r.owner || DASH },
      { k: "availability", label: "وضعیت", sort: "availability", cell: r => AVAIL_FA[r.availability] || r.availability }, { k: "condition", label: "فیزیکی", sort: "condition", cell: r => COND_FA[r.condition] || r.condition },
      { k: "cost", label: "ارزش", sort: "cost", cell: r => money(r.cost), cls: "text-center" },
      { k: "holder", label: "در اختیار", sort: false, cell: r => (r.holder ? <PersonLink r={{ userId: r.holderId, name: r.holder }} /> : r.department || DASH) }, { k: "createdAt", label: "ثبت", sort: "createdAt", cell: r => faDate(String(r.createdAt).slice(0, 10)), cls: "whitespace-nowrap" },
    ] }],
  },
  users: {
    title: "جزئیات کاربران", path: "users", open: r => ({ kind: "person", args: { userId: r.userId } }),
    views: [{ k: "list", label: "فهرست کاربران", defaultSort: "lastSeenAt", tiles: t => [["کاربر", faNum(t.records)], ["آنلاین", faNum(t.online)], ["بدون کارت حضور", faNum(t.withoutCard)]], filters: [
      { k: "role", label: "همه نقش‌ها", options: opts(ROLE_FA) }, { k: "disabled", label: "فقط فعال", options: [["1", "فقط غیرفعال"], ["all", "همه"]] },
      { k: "card", label: "کارت حضور", options: [["1", "دارای کارت"], ["0", "بدون کارت"]] }, { k: "online", label: "وضعیت آنلاین", options: [["1", "فقط آنلاین"]] },
    ], cols: [
      { k: "name", label: "نام", sort: "name", cell: r => <>{r.online && <span className="inline-block w-2 h-2 rounded-full bg-green-500 ml-1" title="آنلاین" />}{r.name}{r.disabled && <span className="mr-1 text-[10px] text-red-500">(غیرفعال)</span>}</> },
      { k: "department", label: "دپارتمان", sort: "department" }, { k: "role", label: "نقش", sort: "role", cell: r => ROLE_FA[r.role] || r.role }, { k: "schedule", label: "گروه کاری", sort: "schedule" },
      { k: "cardNo", label: "کارت", sort: false, cell: r => (r.cardNo ? <bdi dir="ltr">{r.cardNo}</bdi> : DASH) }, { k: "lastSeenAt", label: "آخرین فعالیت", sort: "lastSeenAt", cell: r => (r.lastSeenAt ? faDateTime(r.lastSeenAt) : DASH), cls: "whitespace-nowrap" },
      { k: "assets", label: "اموال", sort: "assets", cell: r => (r.assets ? faNum(r.assets) : DASH), cls: "text-center" }, { k: "openTickets", label: "تیکت باز", sort: "openTickets", cell: r => (r.openTickets ? faNum(r.openTickets) : DASH), cls: "text-center" },
    ] }],
  },
};

// ── pieces ──────────────────────────────────────────────────────────────────
const OpenCtx = React.createContext<(k: "day" | "person" | "ticket" | "asset", a: any) => void>(() => {});
function PersonLink({ r }: { r: any }) {
  const open = React.useContext(OpenCtx);
  if (!r.userId) return <>{r.name || "—"}</>;
  return <button type="button" onClick={e => { e.stopPropagation(); open("person", { userId: r.userId }); }} className="text-blue-600 dark:text-blue-400 hover:underline text-right">{r.name}</button>;
}

function useGet(h: any) {
  return React.useCallback(async (path: string, params?: Record<string, any>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) if (v !== "" && v != null) p.set(k, String(v));
    const res = await fetch(`${API}/analytics/${path}${p.toString() ? `?${p}` : ""}`, { headers: h });
    if (!res.ok) throw new Error(await readError(res, "خطا در دریافت اطلاعات"));
    return res.json();
  }, [h]);
}

// Dashboard filters (range, department, person, groups, …) arrive as `base`; inside the modal
// the range, department and person stay adjustable.
export default function AnalyticsDetails({ open, onClose, section, base, initial }: { open: boolean; onClose: () => void; section: Section; base: Base; initial?: Record<string, string> }) {
  const h = React.useMemo(() => ({ Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("token") : ""}` }), []);
  const get = useGet(h);
  const cfg = SECTIONS[section];
  const [viewK, setViewK] = React.useState(cfg.views[0].k);
  const view = cfg.views.find(v => v.k === viewK) || cfg.views[0];
  const [range, setRange] = React.useState<DateRange>({ from: base.from || "", to: base.to || "" });
  const [f, setF] = React.useState<Record<string, string>>({});
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState(view.defaultSort);
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [people, setPeople] = React.useState<any[]>([]);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [stack, setStack] = React.useState<Array<{ kind: "day" | "person" | "ticket" | "asset"; args: any }>>([]);

  // Fresh state each time the modal opens (or its section changes).
  React.useEffect(() => {
    if (!open) return;
    setViewK(cfg.views[0].k); setSort(cfg.views[0].defaultSort); setDir("desc"); setPage(1); setSearch(""); setQ(""); setData(null);
    setRange({ from: base.from || "", to: base.to || "" }); setF({ departmentId: base.departmentId || "", userId: base.userId || "", ...(initial || {}) });
    // eslint-disable-next-line
  }, [open, section]);
  React.useEffect(() => {
    if (!open || people.length) return;
    fetch(`${API}/users/brief`, { headers: h }).then(r => r.ok ? r.json() : []).then(u => setPeople((Array.isArray(u) ? u : []).map((x: any) => ({ id: x.id, name: `${x.firstName} ${x.lastName}` })))).catch(() => {});
    fetch(`${API}/departments`, { headers: h }).then(r => r.ok ? r.json() : []).then(d => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
    // eslint-disable-next-line
  }, [open]);
  React.useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const params = React.useMemo(() => {
    const p: Record<string, any> = { ...base, ...f, search: q, view: view.k === "list" ? "" : view.k, sort, dir, page, pageSize: 50 };
    if (range.from) { p.from = range.from; p.to = range.to; } else { delete p.from; delete p.to; }
    // assets/tickets have no per-person view of the dashboard's group filter
    return p;
  }, [base, f, q, view.k, sort, dir, page, range]);
  const key = JSON.stringify(params);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true); setError("");
    get(`details/${section === "worklog" ? "work-log" : cfg.path}`, params)
      .then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [open, key]);

  const setFilter = (k: string, v: string) => { setF(s => ({ ...s, [k]: v })); setPage(1); };
  const changeView = (k: string) => { const v = cfg.views.find(x => x.k === k)!; setViewK(k); setSort(v.defaultSort); setDir("desc"); setPage(1); setData(null); };
  const thSort = (c: Col) => { if (c.sort === false) return; const s = c.sort || c.k; if (sort === s) setDir(d => (d === "asc" ? "desc" : "asc")); else { setSort(s); setDir("desc"); } setPage(1); };
  const openItem = React.useCallback((kind: any, args: any) => setStack(s => [...s, { kind, args }]), []);
  const pages = data ? Math.max(1, Math.ceil((data.total ?? data.rows.length) / (data.pageSize || 50))) : 1;
  const top = stack[stack.length - 1];

  return (
    <OpenCtx.Provider value={openItem}>
      <Modal open={open} onClose={onClose} size="full" title={cfg.title}
        subtitle={range.from ? `${faDate(range.from)} تا ${faDate(range.to)}` : "همه‌ی زمان‌ها"}
        footer={<span className="ml-auto text-[11px] text-theme-muted">فقط نمایش — از این بخش نمی‌توان چیزی را تغییر داد</span>}>
        <div className="space-y-3">
          {cfg.views.length > 1 && (
            <div className="flex bg-theme-secondary border border-theme p-0.5 rounded-lg text-xs w-fit">
              {cfg.views.map(v => <button key={v.k} onClick={() => changeView(v.k)} className={`px-3 py-1.5 rounded-md ${viewK === v.k ? "bg-theme-card shadow text-theme-primary font-medium" : "text-theme-muted"}`}>{v.label}</button>)}
            </div>
          )}
          <div className="bg-theme-secondary/30 border border-theme rounded-xl p-2.5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter allowAll={section === "assets"} value={range} onChange={r => { setRange(r); setPage(1); }} />
              <div className="relative w-56"><Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی نام، عنوان، بارکد…" className="input-theme text-sm py-1.5 pr-8" /></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input-theme text-sm !w-44" value={f.departmentId || ""} onChange={e => setFilter("departmentId", e.target.value)}><option value="">همه دپارتمان‌ها</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              {(section === "attendance" || section === "worklog") && <div className="w-48"><SearchSelect options={people} value={f.userId || ""} onChange={v => setFilter("userId", v)} emptyLabel="همه افراد" placeholder="شخص" /></div>}
              {view.filters.map(x => x.options ? (
                <select key={x.k} className="input-theme text-sm !w-44" value={f[x.k] || ""} onChange={e => setFilter(x.k, e.target.value)}><option value="">{x.label}</option>{x.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              ) : (
                <input key={x.k} type="number" dir="ltr" min={1} placeholder={x.label} value={f[x.k] || ""} onChange={e => setFilter(x.k, e.target.value)} className="input-theme text-sm !w-40 py-1.5" />
              ))}
              {Object.entries(f).some(([k, v]) => v && v !== (k === "departmentId" ? base.departmentId : k === "userId" ? base.userId : "") ) && <button onClick={() => { setF({ departmentId: base.departmentId || "", userId: base.userId || "" }); setSearch(""); setPage(1); }} className="text-xs text-red-600 hover:underline">حذف فیلترها</button>}
              {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            </div>
          </div>

          {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {data?.totals && <div className="flex flex-wrap gap-2">{view.tiles(data.totals).map(([l, v]) => <div key={l} className="bg-theme-card border border-theme rounded-xl px-3 py-1.5 min-w-24"><div className="text-[11px] text-theme-muted">{l}</div><div className="text-base font-bold text-theme-primary">{v}</div></div>)}</div>}

          <div className="border border-theme rounded-xl overflow-hidden bg-theme-card">
            <div className="overflow-x-auto max-h-[52vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-theme-secondary z-10"><tr className="text-theme-muted border-b border-theme">
                  {view.cols.map(c => <th key={c.k} onClick={() => thSort(c)} className={`px-2 py-2 font-medium whitespace-nowrap ${c.cls?.includes("text-center") ? "text-center" : "text-right"} ${c.sort === false ? "" : "cursor-pointer hover:text-theme-primary select-none"}`}>{c.label}{(c.sort || c.k) === sort && c.sort !== false ? (dir === "asc" ? " ↑" : " ↓") : ""}</th>)}
                </tr></thead>
                <tbody>
                  {data && data.rows.length === 0 && <tr><td colSpan={view.cols.length} className="py-10 text-center text-theme-muted">رکوردی با این فیلترها یافت نشد</td></tr>}
                  {(data?.rows || []).map((r: any, i: number) => {
                    const target = cfg.open?.(r);
                    return (
                      <tr key={r.id ?? r.userId + (r.date || "") + i} onClick={() => target && openItem(target.kind, target.args)} className={`border-b border-theme/40 ${target ? "hover:bg-theme-hover cursor-pointer" : ""}`}>
                        {view.cols.map(c => <td key={c.k} className={`px-2 py-1.5 text-theme-secondary ${c.cls || ""}`}>{c.cell ? c.cell(r) : (r[c.k] ?? DASH)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-theme text-sm">
              <span className="text-theme-muted text-xs">{data ? `${faNum(data.total ?? data.rows.length)} رکورد` : ""}</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary text-xs disabled:opacity-40">قبلی</button>
                <span className="text-theme-muted text-xs">صفحه {faNum(page)} از {faNum(pages)}</span>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg bg-theme-secondary border border-theme text-theme-primary text-xs disabled:opacity-40">بعدی</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {top?.kind === "person" && <PersonModal key={stack.length} args={top.args} range={range} get={get} base={base} onClose={() => setStack(s => s.slice(0, -1))} />}
      {top?.kind === "day" && <DayModal key={stack.length} args={top.args} get={get} onClose={() => setStack(s => s.slice(0, -1))} />}
      {top?.kind === "ticket" && <TicketModal key={stack.length} args={top.args} get={get} onClose={() => setStack(s => s.slice(0, -1))} />}
      {top?.kind === "asset" && <AssetModal key={stack.length} args={top.args} get={get} onClose={() => setStack(s => s.slice(0, -1))} />}
    </OpenCtx.Provider>
  );
}

// ── item modals ─────────────────────────────────────────────────────────────
function useLoad(fn: () => Promise<any>) {
  const [d, setD] = React.useState<any>(null);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { let alive = true; fn().then(x => alive && setD(x)).catch(e => alive && setErr(e.message)); return () => { alive = false; }; /* eslint-disable-next-line */ }, []);
  return { d, err };
}
const Spin = ({ err }: { err: string }) => err ? <div className="text-sm text-red-600">{err}</div> : <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
const KV = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="bg-theme-secondary/40 rounded-lg px-3 py-2"><div className="text-[11px] text-theme-muted">{l}</div><div className="text-sm font-semibold text-theme-primary">{v}</div></div>;
const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="text-sm font-semibold text-theme-primary mb-1.5">{t}</div>{children}</div>;

function PersonModal({ args, range, get, base, onClose }: { args: any; range: DateRange; get: any; base: Base; onClose: () => void }) {
  const open = React.useContext(OpenCtx);
  const { d, err } = useLoad(() => get("details/person", { userId: args.userId, ...(range.from ? { from: range.from, to: range.to } : {}) }));
  const [sub, setSub] = React.useState<Section | null>(null);
  return (
    <>
      <Modal open onClose={onClose} size="xl" title={d?.user?.name || "کاربر"} subtitle={d ? `${d.user.department || ""} — ${faDate(d.from)} تا ${faDate(d.to)}` : undefined}
        footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}>
        {!d ? <Spin err={err} /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-theme-muted">
              <span>نقش: <b className="text-theme-primary">{ROLE_FA[d.user.role] || d.user.role}</b></span>
              <span>نوع: <b className="text-theme-primary">{d.user.employeeType === "HOURLY" ? "ساعتی" : "تمام‌وقت"}</b></span>
              <span>گروه کاری: <b className="text-theme-primary">{d.user.schedule || "پیش‌فرض سازمان"}</b></span>
              <span>کارت: <b className="text-theme-primary" dir="ltr">{d.user.cardNo || "—"}</b></span>
              <span>آخرین فعالیت: <b className="text-theme-primary">{d.user.lastSeenAt ? faDateTime(d.user.lastSeenAt) : "—"}</b></span>
              {d.user.disabled && <span className="text-red-600">غیرفعال</span>}
            </div>
            <Sec t="حضور و غیاب"><div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <KV l="کارکرد" v={MIN(d.attendance.workedMinutes)} /><KV l="اضافه‌کار" v={MIN(d.attendance.overtimeMinutes)} /><KV l="تاخیر" v={MIN(d.attendance.delayMinutes)} /><KV l="تعجیل" v={MIN(d.attendance.earlyLeaveMinutes)} /><KV l="کسری" v={MIN(d.attendance.deficitMinutes)} /><KV l="دورکاری" v={MIN(d.attendance.remoteMinutes)} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">{Object.entries(d.attendance.statuses).map(([k, n]) => <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-theme-secondary text-theme-secondary">{STATUS_FA[k] || k}: {faNum(n as number)}</span>)}</div>
            <button onClick={() => setSub("attendance")} className="mt-2 text-xs text-blue-600 hover:underline">مشاهده روز به روز ←</button></Sec>
            <Sec t="عملکرد و گزارش کار"><div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <KV l="روز الزامی" v={faNum(d.workLog.required)} /><KV l="به‌موقع" v={faNum(d.workLog.submitted)} /><KV l="با تأخیر" v={faNum(d.workLog.late)} /><KV l="ثبت‌نشده" v={faNum(d.workLog.missing)} /><KV l="زمان ثبت‌شده" v={MIN(d.workLog.loggedMinutes)} /><KV l="کارکرد حضور" v={MIN(d.workLog.workedMinutes)} />
            </div><button onClick={() => setSub("worklog")} className="mt-2 text-xs text-blue-600 hover:underline">مشاهده روز به روز ←</button></Sec>
            <Sec t="تیکت‌ها"><div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <KV l="ثبت‌شده توسط او" v={faNum(d.tickets.created)} /><KV l="ارجاع‌شده به او" v={faNum(d.tickets.assigned)} /><KV l="باز در کارتابل" v={faNum(d.tickets.assignedOpen)} /><KV l="حل‌شده" v={faNum(d.tickets.resolved)} /><KV l="معوق" v={faNum(d.tickets.overdue)} />
            </div><button onClick={() => setSub("tickets")} className="mt-2 text-xs text-blue-600 hover:underline">مشاهده تیکت‌های ارجاع‌شده ←</button></Sec>
            <Sec t={`اموال در اختیار (${faNum(d.assets.length)})`}>
              {d.assets.length === 0 ? <div className="text-xs text-theme-muted">دارایی‌ای در اختیار ندارد</div> : <div className="flex flex-wrap gap-1.5">{d.assets.map((a: any) => <button key={a.id} onClick={() => open("asset", { id: a.id })} className="text-xs px-2 py-1 rounded-lg border border-theme text-theme-primary hover:bg-theme-hover">{a.name} <bdi dir="ltr" className="text-theme-muted">{a.barcode}</bdi></button>)}</div>}
            </Sec>
          </div>
        )}
      </Modal>
      {sub && d && <AnalyticsDetails open onClose={() => setSub(null)} section={sub} base={{ ...base, userId: sub === "tickets" ? undefined : args.userId, from: range.from, to: range.to }} initial={sub === "tickets" ? { assigneeId: args.userId } : { userId: args.userId }} />}
    </>
  );
}

function DayModal({ args, get, onClose }: { args: any; get: any; onClose: () => void }) {
  const { d, err } = useLoad(() => get("details/day", args));
  const a = d?.attendance;
  return (
    <Modal open onClose={onClose} size="xl" title={d ? `${d.name} — ${DOW_FA[new Date(d.date + "T00:00:00Z").getUTCDay()]} ${faDate(d.date)}` : "جزئیات روز"} subtitle={d?.department || undefined} footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}>
      {!d ? <Spin err={err} /> : (
        <div className="space-y-4 text-sm">
          {d.beforeStart && <p className="text-xs text-amber-600">این روز پیش از شروع ثبت عملکرد است و در آمار نمی‌آید.</p>}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-theme-secondary/30 rounded-lg px-3 py-2 text-xs">
            <span className="text-theme-muted">حضور: <b className="text-theme-primary">{a ? STATUS_FA[a.status] || a.status : "ثبت نشده"}</b></span>
            {a && <><span className="text-theme-muted">ورود: <b className="text-theme-primary" dir="ltr">{a.firstCheckIn ? faTime(a.firstCheckIn) : "—"}</b></span><span className="text-theme-muted">خروج: <b className="text-theme-primary" dir="ltr">{a.lastCheckOut ? faTime(a.lastCheckOut) : "—"}</b></span><span className="text-theme-muted">کارکرد: {MIN(a.workedMinutes)}</span><span className="text-theme-muted">اضافه‌کار: {MIN(a.overtimeMinutes)}</span><span className="text-theme-muted">تاخیر: {MIN(a.delayMinutes)}</span><span className="text-theme-muted">تعجیل: {MIN(a.earlyLeaveMinutes)}</span><span className="text-theme-muted">کسری: {MIN(a.deficitMinutes)}</span></>}
            <span className={`px-2 py-0.5 rounded-full ${STATE_META[d.state]?.cls || ""}`}>گزارش: {STATE_META[d.state]?.label || d.state}</span>{d.lateWaived && <span className="text-green-600">تأخیر بخشیده شده</span>}
          </div>
          {d.punches.length > 0 && <div className="text-xs text-theme-muted">پانچ‌ها: {d.punches.map((p: any) => <span key={p.id} className="inline-block mx-0.5 px-1.5 py-0.5 rounded bg-theme-secondary/50 text-theme-primary" dir="ltr">{faTime(p.punchAt)}</span>)}</div>}
          {d.overrides.length > 0 && <Sec t="اصلاح‌های دستی"><ul className="space-y-1 text-xs">{d.overrides.map((o: any) => <li key={o.id} className="text-theme-secondary">{faDateTime(o.createdAt)} — {o.by}: {o.newCheckIn && <>ورود <bdi dir="ltr">{faTime(o.newCheckIn)}</bdi> </>}{o.newCheckOut && <>خروج <bdi dir="ltr">{faTime(o.newCheckOut)}</bdi> </>}{o.forceStatus && <>وضعیت {STATUS_FA[o.forceStatus] || o.forceStatus} </>}{o.leaveMinutes ? <>مرخصی {fmtMin(o.leaveMinutes)} </> : null}<span className="text-theme-muted">({o.reason})</span></li>)}</ul></Sec>}
          {d.requests.length > 0 && <Sec t="درخواست‌ها"><ul className="space-y-1 text-xs text-theme-secondary">{d.requests.map((r: any) => <li key={r.id}>{faDateTime(r.createdAt)} — {r.type} — {r.status === "PENDING" ? "در انتظار" : r.status === "REJECTED" ? "ردشده" : "تأییدشده"}</li>)}</ul></Sec>}
          <Sec t={`کارهای ثبت‌شده — ${MIN(d.loggedMinutes)}`}>
            {d.entries.length === 0 ? <div className="text-xs text-theme-muted">زمانی ثبت نشده</div> : <table className="w-full text-xs"><tbody>{d.entries.map((e: any) => <tr key={e.id} className="border-b border-theme/40"><td className="py-1.5 text-theme-primary">{e.task}</td><td className="text-theme-muted"><span className="inline-block w-2 h-2 rounded-full ml-1" style={{ background: e.color || "#94a3b8" }} />{e.category || "—"}</td><td className="text-center">{MIN(e.minutes)}</td><td className="text-theme-secondary">{e.note || ""}</td><td className="text-amber-600">{e.isLate ? `${faNum(e.lateDays)} روز تأخیر` : ""}</td></tr>)}</tbody></table>}
          </Sec>
          <Sec t="گزارش کار روزانه">
            {!d.report ? <div className="text-xs text-theme-muted">گزارشی ثبت نشده</div> : <div className="space-y-1"><div className="text-[11px] text-theme-muted">ثبت: {faDateTime(d.report.submittedAt)}{d.report.isLate && <span className="text-amber-600"> — {faNum(d.report.lateDays)} روز تأخیر</span>}{d.report.editedAt && <> — ویرایش: {faDateTime(d.report.editedAt)}</>}</div>{d.report.content != null && <div className="whitespace-pre-wrap leading-relaxed text-theme-secondary bg-theme-secondary/30 rounded-lg px-3 py-2">{d.report.content}</div>}</div>}
          </Sec>
          {d.ticketEvents.length > 0 && <Sec t="فعالیت در تیکت‌ها"><ul className="space-y-1 text-xs text-theme-secondary">{d.ticketEvents.map((e: any) => <li key={e.id}><bdi dir="ltr" className="text-theme-muted">{faTime(e.createdAt)}</bdi> — {EVENT_FA[e.type] || e.type} — تیکت #{faNum(e.ticket.number)}</li>)}</ul></Sec>}
        </div>
      )}
    </Modal>
  );
}

function TicketModal({ args, get, onClose }: { args: any; get: any; onClose: () => void }) {
  const open = React.useContext(OpenCtx);
  const { d, err } = useLoad(() => get(`details/tickets/${args.id}`));
  return (
    <Modal open onClose={onClose} size="lg" title={d ? `#${faNum(d.number)} — ${d.title}` : "تیکت"} subtitle={d ? `${d.department} — ${d.category}` : undefined} footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}>
      {!d ? <Spin err={err} /> : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><KV l="وضعیت" v={TICKET_FA[d.status] || d.status} /><KV l="اولویت" v={PRIORITY_FA[d.priority] || d.priority} /><KV l="ثبت" v={faDateTime(d.createdAt)} /><KV l="مهلت" v={d.dueAt ? faDateTime(d.dueAt) : "—"} />
            <KV l="پاسخ اول" v={d.firstResponseAt ? faDateTime(d.firstResponseAt) : "—"} /><KV l="حل‌شده" v={d.resolvedAt ? faDateTime(d.resolvedAt) : "—"} /><KV l="درخواست‌کننده" v={<button className="text-blue-600 hover:underline" onClick={() => open("person", { userId: d.requesterId })}>{d.requester}</button>} /><KV l="مسئول" v={d.assigneeId ? <button className="text-blue-600 hover:underline" onClick={() => open("person", { userId: d.assigneeId })}>{d.assignee}</button> : "بدون مسئول"} /></div>
          {d.sla && <div className="text-xs text-theme-muted">SLA: پاسخ اول {d.sla.firstResponseBreached ? <b className="text-red-600">نقض‌شده</b> : "در مهلت"} · حل {d.sla.resolutionBreached ? <b className="text-red-600">نقض‌شده</b> : "در مهلت"} · انتظار برای کاربر {MIN(d.sla.waitingUserMinutes)} · انتظار برای دپارتمان {MIN(d.sla.waitingDeptMinutes)}</div>}
          {d.description != null && <Sec t="شرح"><div className="whitespace-pre-wrap text-theme-secondary bg-theme-secondary/30 rounded-lg px-3 py-2">{d.description}</div></Sec>}
          <Sec t="سابقه"><ol className="space-y-1.5 text-xs">{d.events.map((e: any) => <li key={e.id} className="flex gap-2"><span className="text-theme-muted whitespace-nowrap">{faDateTime(e.createdAt)}</span><span className="text-theme-primary">{EVENT_FA[e.type] || e.type}</span>{e.actor && <span className="text-theme-secondary">— {e.actor}</span>}{(e.from || e.to) && <span className="text-theme-muted">({TICKET_FA[e.from] || PRIORITY_FA[e.from] || e.from || "—"} ← {TICKET_FA[e.to] || PRIORITY_FA[e.to] || e.to || "—"})</span>}</li>)}</ol></Sec>
        </div>
      )}
    </Modal>
  );
}

function AssetModal({ args, get, onClose }: { args: any; get: any; onClose: () => void }) {
  const open = React.useContext(OpenCtx);
  const { d, err } = useLoad(() => get(`details/assets/${args.id}`));
  return (
    <Modal open onClose={onClose} size="lg" title={d?.name || "دارایی"} subtitle={d ? `${d.type} — ${d.category}` : undefined} footer={<button onClick={onClose} className="btn-theme-secondary text-sm">بستن</button>}>
      {!d ? <Spin err={err} /> : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><KV l="بارکد" v={<bdi dir="ltr">{d.barcode}</bdi>} /><KV l="سریال" v={d.serialNumber || "—"} /><KV l="وضعیت" v={AVAIL_FA[d.availability] || d.availability} /><KV l="فیزیکی" v={COND_FA[d.condition] || d.condition} /><KV l="تعلق" v={d.owner || "—"} /><KV l="ارزش" v={money(d.cost)} /><KV l="خرید" v={d.purchaseDate ? faDate(String(d.purchaseDate).slice(0, 10)) : "—"} /><KV l="ثبت" v={faDate(String(d.createdAt).slice(0, 10))} /></div>
          {d.description && <p className="text-xs text-theme-secondary">{d.description}</p>}
          <Sec t={`تاریخچه‌ی واگذاری (${faNum(d.assignments.length)})`}>
            {d.assignments.length === 0 ? <div className="text-xs text-theme-muted">واگذاری ثبت نشده</div> : <table className="w-full text-xs"><thead><tr className="text-theme-muted border-b border-theme"><th className="text-right py-1">به</th><th className="text-right">محل</th><th className="text-right">از</th><th className="text-right">تا</th><th className="text-right">توسط</th></tr></thead><tbody>{d.assignments.map((x: any) => <tr key={x.id} className="border-b border-theme/40"><td className="py-1.5">{x.userId ? <button className="text-blue-600 hover:underline" onClick={() => open("person", { userId: x.userId })}>{x.user}</button> : x.department || "—"}</td><td className="text-theme-muted">{x.place || "—"}</td><td className="whitespace-nowrap">{faDate(String(x.assignedAt).slice(0, 10))}</td><td className="whitespace-nowrap">{x.returnedAt ? faDate(String(x.returnedAt).slice(0, 10)) : <span className="text-green-600">فعال</span>}</td><td className="text-theme-muted">{x.by || "—"}</td></tr>)}</tbody></table>}
          </Sec>
          {d.maintenances.length > 0 && <Sec t="تعمیر و نگهداری"><ul className="space-y-1 text-xs text-theme-secondary">{d.maintenances.map((m: any) => <li key={m.id}>{faDate(String(m.startDate).slice(0, 10))}{m.endDate ? ` تا ${faDate(String(m.endDate).slice(0, 10))}` : " (جاری)"} — {m.description}{m.cost ? ` — ${money(m.cost)}` : ""}</li>)}</ul></Sec>}
        </div>
      )}
    </Modal>
  );
}
