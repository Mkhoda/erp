"use client";
import React from "react";
import {
  Plus, Pencil, Trash2, FolderTree, ChevronDown, ChevronLeft, Users, GripVertical, Star, X, Search, Loader2, UserMinus,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { pageTitle } from "../../../lib/branding";
import { readError } from "../../../lib/http";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

type Member = { id: string; firstName: string; lastName: string; role: string; disabled: boolean; attendanceCardNo?: string | null; memberRole: string; isPrimary: boolean };
type Dept = { id: string; name: string; parentId: string | null; sortOrder: number; members: Member[] };
type Person = { id: string; firstName: string; lastName: string; role: string; disabled: boolean; attendanceCardNo?: string | null };

// Position of a person inside one department (independent of their system role).
const MEMBER_ROLE: Record<string, { label: string; cls: string }> = {
  MANAGER: { label: "مدیر", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
  DEPUTY: { label: "معاون", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  EXPERT: { label: "کارشناس", cls: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  MEMBER: { label: "عضو", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
};
const ROLE_ORDER = ["MANAGER", "DEPUTY", "EXPERT", "MEMBER"];

// Drag payloads: a person (from a department or the unassigned list) or a whole department.
type Drag = { kind: "person"; userId: string; fromDepartmentId: string | null } | { kind: "dept"; id: string };

export default function DepartmentsPage() {
  React.useEffect(() => { document.title = pageTitle("دپارتمان‌ها"); }, []);
  const toast = useToast();
  const { confirm, Dialog: ConfirmDlg } = useConfirm();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [depts, setDepts] = React.useState<Dept[]>([]);
  const [unassigned, setUnassigned] = React.useState<Person[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [drag, setDrag] = React.useState<Drag | null>(null);
  const [over, setOver] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id?: string; name: string; parentId: string } | null>(null);
  const [addTo, setAddTo] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/departments/tree`, { headers: h });
      if (!res.ok) { toast.error(await readError(res, "خطا در دریافت دپارتمان‌ها")); return; }
      const d = await res.json();
      setDepts(d.departments || []);
      setUnassigned(d.unassigned || []);
    } finally { setLoading(false); }
    // eslint-disable-next-line
  }, []);
  React.useEffect(() => { load(); }, [load]);

  async function call(url: string, method: string, body?: any, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch(`${API}${url}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { toast.error(await readError(res, "عملیات ناموفق بود")); return false; }
      if (okMsg) toast.success(okMsg);
      await load();
      return true;
    } finally { setBusy(false); }
  }

  const children = React.useMemo(() => {
    const m = new Map<string | null, Dept[]>();
    for (const d of depts) { const k = d.parentId ?? null; m.set(k, [...(m.get(k) || []), d]); }
    return m;
  }, [depts]);
  const allPeople = React.useMemo(() => {
    const m = new Map<string, Person>();
    for (const d of depts) for (const p of d.members) m.set(p.id, p);
    for (const p of unassigned) m.set(p.id, p);
    return [...m.values()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "fa"));
  }, [depts, unassigned]);
  const q = query.trim();
  const matches = (p: { firstName: string; lastName: string; attendanceCardNo?: string | null }) =>
    !q || `${p.firstName} ${p.lastName}`.includes(q) || (p.attendanceCardNo || "").includes(q);
  // A department stays visible while searching if it or anything below it has a match.
  const visible = React.useCallback((d: Dept): boolean => {
    if (!q) return true;
    if (d.name.includes(q) || d.members.some(matches)) return true;
    return (children.get(d.id) || []).some(visible);
    // eslint-disable-next-line
  }, [q, children]);

  // ── drag & drop ──
  function onDropOnDept(e: React.DragEvent, target: Dept | null) {
    e.preventDefault();
    setOver(null);
    const d = drag;
    setDrag(null);
    if (!d) return;
    if (d.kind === "person") {
      if (!target || target.id === d.fromDepartmentId) return;
      // Ctrl/⌘ while dropping = add as an extra membership; plain drop = move.
      const copy = e.ctrlKey || e.metaKey || !d.fromDepartmentId;
      call("/departments/move-member", "POST", { userId: d.userId, fromDepartmentId: d.fromDepartmentId, toDepartmentId: target.id, mode: copy ? "copy" : "move" },
        copy ? "به دپارتمان اضافه شد" : "جابه‌جا شد");
    } else {
      if (target?.id === d.id) return;
      call(`/departments/${d.id}`, "PATCH", { parentId: target?.id ?? null }, "ساختار به‌روز شد");
    }
  }
  const dropProps = (key: string, target: Dept | null) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = drag?.kind === "person" && (e.ctrlKey || e.metaKey) ? "copy" : "move"; if (over !== key) setOver(key); },
    onDragLeave: () => setOver(o => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => onDropOnDept(e, target),
  });

  async function saveDept() {
    if (!editing?.name.trim()) { toast.warning("نام دپارتمان را وارد کنید"); return; }
    const ok = editing.id
      ? await call(`/departments/${editing.id}`, "PATCH", { name: editing.name, parentId: editing.parentId || null }, "دپارتمان ویرایش شد")
      : await call("/departments", "POST", { name: editing.name, parentId: editing.parentId || null }, "دپارتمان ایجاد شد");
    if (ok) setEditing(null);
  }

  async function removeDept(d: Dept) {
    const sub = (children.get(d.id) || []).length;
    if (!(await confirm("حذف دپارتمان", `دپارتمان «${d.name}» حذف شود؟${sub ? ` ${sub.toLocaleString("fa-IR")} زیرمجموعه‌ی آن به یک سطح بالاتر منتقل می‌شوند.` : ""} عضویت‌های این دپارتمان هم حذف می‌شوند.`))) return;
    await call(`/departments/${d.id}`, "DELETE", undefined, "حذف شد");
  }

  function renderDept(d: Dept, depth: number): React.ReactNode {
    if (!visible(d)) return null;
    const kids = (children.get(d.id) || []).filter(visible);
    const isCollapsed = collapsed.has(d.id) && !q;
    const members = [...d.members].filter(matches).sort((a, b) => ROLE_ORDER.indexOf(a.memberRole) - ROLE_ORDER.indexOf(b.memberRole));
    const key = `dept:${d.id}`;
    return (
      <div key={d.id} style={{ marginRight: depth ? 20 : 0 }} className={depth ? "border-r border-dashed border-theme pr-3" : ""}>
        <div {...dropProps(key, d)}
          className={`rounded-xl border bg-theme-card mb-2 transition-colors ${over === key ? "border-blue-500 ring-2 ring-blue-500/30" : "border-theme"}`}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-theme/60">
            <span draggable onDragStart={e => { setDrag({ kind: "dept", id: d.id }); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDrag(null); setOver(null); }}
              title="برای تغییر والد، دپارتمان را بکشید" className="cursor-grab text-theme-muted"><GripVertical className="w-4 h-4" /></span>
            <button onClick={() => setCollapsed(s => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} className="text-theme-muted">
              {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <FolderTree className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-sm text-theme-primary flex-1">{d.name}</span>
            <span className="text-xs text-theme-muted">{d.members.length.toLocaleString("fa-IR")} نفر</span>
            <button onClick={() => setAddTo(d.id)} title="افزودن عضو" className="p-1 rounded text-theme-muted hover:text-blue-600"><Plus className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing({ id: undefined, name: "", parentId: d.id })} title="زیرمجموعه جدید" className="p-1 rounded text-theme-muted hover:text-blue-600"><FolderTree className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditing({ id: d.id, name: d.name, parentId: d.parentId || "" })} title="ویرایش" className="p-1 rounded text-theme-muted hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => removeDept(d)} title="حذف" className="p-1 rounded text-theme-muted hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {!isCollapsed && (
            <div className="flex flex-wrap gap-1.5 p-2.5 min-h-[44px]">
              {members.length === 0 && <span className="text-xs text-theme-muted px-1 py-1">{q ? "موردی یافت نشد" : "عضوی ندارد — کاربر را اینجا رها کنید"}</span>}
              {members.map(m => (
                <span key={m.id} draggable
                  onDragStart={e => { setDrag({ kind: "person", userId: m.id, fromDepartmentId: d.id }); e.dataTransfer.effectAllowed = "copyMove"; }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  className={`group inline-flex items-center gap-1 rounded-full border border-theme bg-theme-secondary/50 pr-1 pl-2 py-0.5 text-xs cursor-grab ${m.disabled ? "opacity-50" : ""}`}>
                  <GripVertical className="w-3 h-3 text-theme-muted" />
                  {m.isPrimary
                    ? <span title="دپارتمان اصلی"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /></span>
                    : <button title="تعیین به‌عنوان دپارتمان اصلی" onClick={() => call(`/departments/${d.id}/members/${m.id}/primary`, "POST", undefined, "دپارتمان اصلی تغییر کرد")}><Star className="w-3 h-3 text-theme-muted hover:text-amber-500" /></button>}
                  <span className="text-theme-primary">{m.firstName} {m.lastName}</span>
                  <select value={m.memberRole} onChange={e => call(`/departments/${d.id}/members/${m.id}`, "PATCH", { role: e.target.value })}
                    className={`rounded-full px-1.5 py-0 text-[10px] border-0 outline-none cursor-pointer ${MEMBER_ROLE[m.memberRole]?.cls || MEMBER_ROLE.MEMBER.cls}`}>
                    {ROLE_ORDER.map(r => <option key={r} value={r}>{MEMBER_ROLE[r].label}</option>)}
                  </select>
                  <button title="حذف از این دپارتمان" onClick={() => call(`/departments/${d.id}/members/${m.id}`, "DELETE", undefined, "از دپارتمان حذف شد")}
                    className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-600"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        {!isCollapsed && kids.map(k => renderDept(k, depth + 1))}
      </div>
    );
  }

  const roots = (children.get(null) || []).filter(visible);
  const addCandidates = addTo ? allPeople.filter(p => !depts.find(d => d.id === addTo)?.members.some(m => m.id === p.id)) : [];

  return (
    <div className="space-y-4" dir="rtl">
      {ConfirmDlg}
      <PageHeader title="دپارتمان‌ها" subtitle={loading ? undefined : `${depts.length.toLocaleString("fa-IR")} دپارتمان · ${unassigned.length.toLocaleString("fa-IR")} نفر بدون دپارتمان`}
        icon={FolderTree} iconColor="from-blue-500 to-blue-600"
        actions={[{ label: "دپارتمان جدید", icon: Plus, onClick: () => setEditing({ name: "", parentId: "" }) }]} />

      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-300">
        <span>کاربر را روی دپارتمان دیگر بکشید تا <b>منتقل</b> شود؛ با نگه داشتن <b>Ctrl</b> هنگام رها کردن، به آن دپارتمان <b>اضافه</b> می‌شود (عضویت چندگانه).</span>
        <span>دپارتمان را با دستگیره بکشید تا زیرمجموعه‌ی دپارتمان دیگری شود؛ روی «سطح اول» رها کنید تا به بالا برگردد.</span>
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" /> دپارتمان اصلی</span>
        {busy && <Loader2 className="w-4 h-4 animate-spin mr-auto" />}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجوی دپارتمان یا شخص…" className="input-theme pr-9 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          <div className="lg:col-span-3">
            {drag?.kind === "dept" && (
              <div {...dropProps("root", null)} className={`mb-2 rounded-xl border-2 border-dashed px-3 py-2 text-xs text-center ${over === "root" ? "border-blue-500 text-blue-600" : "border-theme text-theme-muted"}`}>
                رها کنید تا دپارتمان به سطح اول منتقل شود
              </div>
            )}
            {roots.length === 0 && <div className="rounded-xl border border-theme bg-theme-card py-10 text-center text-sm text-theme-muted">{q ? "موردی یافت نشد" : "هنوز دپارتمانی تعریف نشده"}</div>}
            {roots.map(d => renderDept(d, 0))}
          </div>

          {/* People in no department — drag from here into a department */}
          <div className="rounded-xl border border-theme bg-theme-card lg:sticky lg:top-4">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-theme text-sm font-medium text-theme-primary">
              <Users className="w-4 h-4 text-theme-muted" /> بدون دپارتمان ({unassigned.length.toLocaleString("fa-IR")})
            </div>
            <div className="p-2.5 flex flex-wrap gap-1.5 max-h-[60vh] overflow-auto">
              {unassigned.filter(matches).length === 0 && <span className="text-xs text-theme-muted">همه در دپارتمانی عضو هستند</span>}
              {unassigned.filter(matches).map(p => (
                <span key={p.id} draggable
                  onDragStart={e => { setDrag({ kind: "person", userId: p.id, fromDepartmentId: null }); e.dataTransfer.effectAllowed = "copy"; }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  className={`inline-flex items-center gap-1 rounded-full border border-theme bg-theme-secondary/50 px-2 py-0.5 text-xs cursor-grab ${p.disabled ? "opacity-50" : ""}`}>
                  <GripVertical className="w-3 h-3 text-theme-muted" /> {p.firstName} {p.lastName}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / edit department */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "ویرایش دپارتمان" : "دپارتمان جدید"} size="sm"
        footer={<><button onClick={() => setEditing(null)} className="btn-theme-secondary text-sm">انصراف</button><button onClick={saveDept} disabled={busy} className="btn-theme-primary text-sm">ذخیره</button></>}>
        {editing && (
          <div className="space-y-3">
            <div><label className="block mb-1 text-sm text-theme-secondary">نام</label><input autoFocus value={editing.name} onChange={e => setEditing(s => s && ({ ...s, name: e.target.value }))} className="input-theme text-sm" /></div>
            <div>
              <label className="block mb-1 text-sm text-theme-secondary">زیرمجموعه‌ی</label>
              <select value={editing.parentId} onChange={e => setEditing(s => s && ({ ...s, parentId: e.target.value }))} className="input-theme text-sm">
                <option value="">— سطح اول —</option>
                {depts.filter(d => d.id !== editing.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Add a member to one department */}
      <Modal open={!!addTo} onClose={() => setAddTo(null)} title={`افزودن عضو به «${depts.find(d => d.id === addTo)?.name || ""}»`} size="md"
        footer={<button onClick={() => setAddTo(null)} className="btn-theme-secondary text-sm">بستن</button>}>
        <AddMemberList people={addCandidates} onAdd={(userId, role) => addTo && call(`/departments/${addTo}/members`, "POST", { userId, role }, "عضو اضافه شد")} />
      </Modal>
    </div>
  );
}

function AddMemberList({ people, onAdd }: { people: Person[]; onAdd: (userId: string, role: string) => void }) {
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState("MEMBER");
  const list = people.filter(p => !q || `${p.firstName} ${p.lastName}`.includes(q) || (p.attendanceCardNo || "").includes(q)).slice(0, 100);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="جستجوی نام یا کارت…" className="input-theme text-sm flex-1" />
        <select value={role} onChange={e => setRole(e.target.value)} className="input-theme text-sm w-auto">
          {ROLE_ORDER.map(r => <option key={r} value={r}>{MEMBER_ROLE[r].label}</option>)}
        </select>
      </div>
      <ul className="max-h-80 overflow-auto divide-y divide-theme border border-theme rounded-lg">
        {list.length === 0 && <li className="px-3 py-4 text-center text-xs text-theme-muted">کسی یافت نشد</li>}
        {list.map(p => (
          <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className={p.disabled ? "text-theme-muted" : "text-theme-primary"}>{p.firstName} {p.lastName}{p.attendanceCardNo ? <span className="text-xs text-theme-muted mr-1" dir="ltr">#{p.attendanceCardNo}</span> : null}</span>
            <button onClick={() => onAdd(p.id, role)} className="text-xs px-2 py-1 rounded-lg text-blue-600 hover:bg-blue-500/10 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> افزودن</button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-theme-muted flex items-center gap-1"><UserMinus className="w-3 h-3" /> عضویت در این دپارتمان به عضویت‌های فعلی شخص اضافه می‌شود.</p>
    </div>
  );
}
