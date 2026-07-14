"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Paperclip, X, PlusCircle } from "lucide-react";
import SearchSelect from "../../../components/ui/SearchSelect";
import { useToast } from "../../../components/ui/Toast";
import { pageTitle } from "../../../../lib/branding";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

const PRIORITY_FA = { LOW: "کم", MEDIUM: "متوسط", HIGH: "بالا", CRITICAL: "بحرانی" };
const OTHER_CATEGORY_NAME = "سایر";

export default function NewTicketPage() {
  React.useEffect(() => { document.title = pageTitle("تیکت جدید"); }, []);
  const router = useRouter();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const h = { Authorization: `Bearer ${token}` };
  const toast = useToast();

  const [loading, setLoading] = React.useState(false);
  const [deptConfigs, setDeptConfigs] = React.useState<any[]>([]);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [settings, setSettings] = React.useState<any>(null);

  const [deptId, setDeptId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [customTitle, setCustomTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [tags, setTags] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState("");

  // Load configs + settings
  React.useEffect(() => {
    Promise.all([
      fetch(`${API}/tickets/config/enabled`, { headers: h as any }).then(r => r.ok ? r.json() : []),
      fetch(`${API}/tickets/settings/global`, { headers: h as any }).then(r => r.ok ? r.json() : {}),
    ]).then(([cfgs, stg]) => {
      setDeptConfigs(cfgs);
      setSettings(stg);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!deptId) { setCategories([]); setCategoryId(""); return; }
    const cfg = deptConfigs.find((c: any) => c.department.id === deptId);
    setCategories(cfg?.categories ?? []);
    setCategoryId("");
    setCustomTitle("");
  }, [deptId, deptConfigs]);

  const deptOptions = deptConfigs.map((c: any) => ({ id: c.department.id, name: c.department.name }));
  const isOtherCategory = categories.find((c: any) => c.id === categoryId)?.name === OTHER_CATEGORY_NAME;

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const max = settings?.maxFileSizeMb ?? 10;
    const ok: File[] = [];
    Array.from(e.target.files).forEach(f => {
      if (f.size > max * 1024 * 1024) { toast.warning(`${f.name} بیش از ${max}MB است`); return; }
      ok.push(f);
    });
    setFiles(prev => [...prev, ...ok].slice(0, settings?.maxAttachments ?? 5));
    e.target.value = "";
  };

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, j) => j !== i));

  const submit = async () => {
    setError("");
    if (!deptId) { setError("لطفاً دپارتمان را انتخاب کنید"); return; }
    if (!categoryId) { setError("لطفاً دسته‌بندی را انتخاب کنید"); return; }
    if (isOtherCategory && !customTitle.trim()) { setError("برای موضوع «سایر» نوشتن عنوان الزامی است"); return; }
    if (!description.trim()) { setError("لطفاً توضیحات را وارد کنید"); return; }

    setLoading(true);
    try {
      const body: any = {
        departmentId: deptId, categoryId, description: description.trim(), priority,
        title: isOtherCategory ? customTitle.trim() : undefined,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };

      const res = await fetch(`${API}/tickets`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" } as any,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? "خطا در ثبت تیکت");
        return;
      }
      const ticket = await res.json();

      // Upload files
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`${API}/tickets/${ticket.id}/attachments`, { method: "POST", headers: h as any, body: fd });
      }

      toast.success("تیکت با موفقیت ثبت شد");
      router.push(`/dashboard/tickets/${ticket.id}`);
    } finally { setLoading(false); }
  };

  const allowPriority = settings?.allowUserPriority !== false;

  return (
    <div className="max-w-2xl mx-auto p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center shadow-lg shadow-green-500/30">
          <PlusCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-theme-primary">ثبت تیکت جدید</h1>
          <p className="text-sm text-theme-muted">درخواست یا مشکل خود را با پشتیبانی در میان بگذارید</p>
        </div>
      </div>

      <div className="bg-theme-card border border-theme rounded-xl p-5 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600">{error}</div>
        )}

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">دپارتمان <span className="text-red-500">*</span></label>
          <SearchSelect options={deptOptions} value={deptId} onChange={setDeptId}
            emptyLabel="انتخاب دپارتمان" placeholder="دپارتمان را انتخاب کنید" />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">دسته‌بندی <span className="text-red-500">*</span></label>
          <SearchSelect options={categories} value={categoryId} onChange={setCategoryId}
            emptyLabel="انتخاب دسته‌بندی" placeholder="ابتدا دپارتمان را انتخاب کنید"
            disabled={!deptId || categories.length === 0} />
          {deptId && categories.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">این دپارتمان دسته‌بندی فعالی ندارد</p>
          )}
        </div>

        {/* Custom title — only for "سایر" */}
        {isOtherCategory && (
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">عنوان <span className="text-red-500">*</span></label>
            <input className="input-theme text-sm w-full" placeholder="عنوان درخواست خود را بنویسید"
              value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
          </div>
        )}

        {/* Priority */}
        {allowPriority && (
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">اولویت</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PRIORITY_FA).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setPriority(k)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors
                    ${priority === k
                      ? k === "CRITICAL" ? "bg-red-600 border-red-600 text-white"
                        : k === "HIGH" ? "bg-amber-500 border-amber-500 text-white"
                        : k === "MEDIUM" ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-slate-500 border-slate-500 text-white"
                      : "border-theme text-theme-secondary hover:bg-theme-hover"
                    }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">توضیحات <span className="text-red-500">*</span></label>
          <textarea className="input-theme text-sm w-full resize-none" rows={5}
            placeholder="مشکل یا درخواست خود را با جزئیات کامل بنویسید..."
            value={description} onChange={e => setDescription(e.target.value)} />
          <div className="text-xs text-theme-muted mt-1 text-left" dir="ltr">{description.length}</div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">
            پیوست <span className="text-theme-muted text-xs">(حداکثر {settings?.maxAttachments ?? 5} فایل)</span>
          </label>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs bg-theme-secondary border border-theme px-2 py-1 rounded-lg">
                  <Paperclip className="w-3 h-3 text-theme-muted" />
                  <span className="max-w-32 truncate text-theme-secondary">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-theme-muted hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {files.length < (settings?.maxAttachments ?? 5) && (
            <label className="flex items-center gap-2 cursor-pointer w-fit text-sm text-blue-600 hover:text-blue-700">
              <Paperclip className="w-4 h-4" />
              افزودن فایل
              <input type="file" multiple className="hidden"
                accept={settings?.allowedExtensions ? settings.allowedExtensions.map((e: string) => `.${e}`).join(",") : undefined}
                onChange={addFiles} />
            </label>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-theme-secondary mb-1.5">
            برچسب‌ها <span className="text-theme-muted text-xs">(با کاما جدا کنید)</span>
          </label>
          <input className="input-theme text-sm w-full" placeholder="مثال: نرم‌افزار, شبکه, فوری"
            value={tags} onChange={e => setTags(e.target.value)} dir="rtl" />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-theme">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border border-theme text-theme-secondary text-sm hover:bg-theme-hover">
            انصراف
          </button>
          <button type="button" onClick={submit} disabled={loading}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            ثبت تیکت
          </button>
        </div>
      </div>
    </div>
  );
}
