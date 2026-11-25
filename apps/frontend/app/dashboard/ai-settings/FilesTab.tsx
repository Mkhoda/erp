"use client";
import React from "react";
import { AlertCircle, Check, FileText, Film, Image as ImageIcon, Loader2, Music, ShieldCheck, Type } from "lucide-react";
import { readError } from "../../../lib/http";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Cat = "image" | "document" | "text" | "audio" | "video";
type CatPolicy = { enabled: boolean; maxMb: number; exts: string[] };
type Policy = { enabled: boolean; maxFilesPerMessage: number; dailyUploadMb: number; categories: Record<Cat, CatPolicy> };

const META: Record<Cat, { label: string; hint: string; Icon: any; hard: number }> = {
  image: { label: "تصویر", hint: "قبل از ذخیره دوباره ساخته می‌شود (حذف متادیتا و محتوای پنهان) و حداکثر ۲۰۴۸ پیکسل می‌شود", Icon: ImageIcon, hard: 20 },
  document: { label: "سند (PDF / Word / Excel)", hint: "PDF دارای اسکریپت و فایل‌های Office دارای ماکرو رد می‌شوند؛ متن Word/Excel برای مدل استخراج می‌شود", Icon: FileText, hard: 50 },
  text: { label: "فایل متنی", hint: "فقط متن واقعی؛ فایل‌های باینری با پسوند متنی رد می‌شوند", Icon: Type, hard: 5 },
  audio: { label: "صوت", hint: "فقط برای مدل‌هایی که ورودی صوتی دارند", Icon: Music, hard: 50 },
  video: { label: "ویدیو", hint: "فقط برای مدل‌هایی که ورودی ویدیو دارند؛ حجم زیاد هزینه‌بر است", Icon: Film, hard: 100 },
};
const ORDER: Cat[] = ["image", "document", "text", "audio", "video"];
const fa = (n: number) => n.toLocaleString("fa-IR");

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${on ? "bg-green-500" : "bg-theme-muted/30"}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? "right-0.5" : "right-[22px]"}`} />
    </button>
  );
}

export default function FilesTab() {
  const [policy, setPolicy] = React.useState<Policy | null>(null);
  const [supported, setSupported] = React.useState<Record<Cat, string[]> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const hdr = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}`, "Content-Type": "application/json" });

  React.useEffect(() => {
    fetch(`${API}/chat-history/files/policy`, { headers: hdr() }).then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setPolicy(d.policy); setSupported(d.supported); } });
  }, []);

  const save = async () => {
    if (!policy) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`${API}/chat-history/files/policy`, { method: "PATCH", headers: hdr(), body: JSON.stringify({ policy }) });
      if (!res.ok) throw new Error(await readError(res, "ذخیره نشد"));
      const d = await res.json(); setPolicy(d.policy); setMsg({ ok: true, text: "ذخیره شد" });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 4000); }
  };

  if (!policy || !supported) return <div className="h-48 rounded-xl bg-theme-hover animate-pulse" />;
  const setCat = (c: Cat, patch: Partial<CatPolicy>) => setPolicy({ ...policy, categories: { ...policy.categories, [c]: { ...policy.categories[c], ...patch } } });
  const toggleExt = (c: Cat, e: string) => {
    const has = policy.categories[c].exts.includes(e);
    setCat(c, { exts: has ? policy.categories[c].exts.filter(x => x !== e) : [...policy.categories[c].exts, e] });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-theme-secondary">
        <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="leading-7">
          نوع فایل از <b>محتوای واقعی آن</b> تشخیص داده می‌شود، نه پسوند یا نوع اعلام‌شده؛ فایل اجرایی، اسکریپت، HTML/SVG، آرشیو و فایل‌های جعلی همیشه رد می‌شوند.
          این‌جا فقط می‌توانید فرمت‌های شناخته‌شده را خاموش کنید یا حجم مجاز را کاهش دهید (افزودن فرمت جدید ممکن نیست). توانایی هر مدل (دیدن تصویر، شنیدن صدا، …) خودکار از OpenRouter خوانده می‌شود و دکمه‌های پیوست بر همان اساس فعال می‌شوند.
        </div>
      </div>

      <div className="bg-theme-card border border-theme rounded-xl p-4 grid gap-4 sm:grid-cols-3">
        <label className="flex items-center justify-between gap-3 sm:col-span-3">
          <span><span className="block text-sm font-semibold text-theme-primary">ارسال فایل در گفتگو</span><span className="text-xs text-theme-muted">با خاموش کردن، همه نوع پیوست متوقف می‌شود</span></span>
          <Toggle on={policy.enabled} onChange={v => setPolicy({ ...policy, enabled: v })} />
        </label>
        <label className="block">
          <span className="text-xs text-theme-muted">حداکثر فایل در هر پیام</span>
          <input type="number" min={1} max={10} value={policy.maxFilesPerMessage} dir="ltr" className="input-theme w-full mt-1 text-sm"
            onChange={e => setPolicy({ ...policy, maxFilesPerMessage: +e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-theme-muted">سقف بارگذاری روزانه هر کاربر (مگابایت)</span>
          <input type="number" min={10} max={5000} value={policy.dailyUploadMb} dir="ltr" className="input-theme w-full mt-1 text-sm"
            onChange={e => setPolicy({ ...policy, dailyUploadMb: +e.target.value })} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {ORDER.map(c => {
          const m = META[c], p = policy.categories[c];
          return (
            <div key={c} className={`bg-theme-card border border-theme rounded-xl p-4 transition-opacity ${p.enabled && policy.enabled ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center"><m.Icon className="w-4 h-4" /></span>
                <span className="font-semibold text-sm text-theme-primary flex-1">{m.label}</span>
                <Toggle on={p.enabled} onChange={v => setCat(c, { enabled: v })} />
              </div>
              <p className="text-[11px] text-theme-muted leading-5 mb-3">{m.hint}</p>
              <div className="flex flex-wrap gap-1.5 mb-3" dir="ltr">
                {supported[c].map(e => {
                  const on = p.exts.includes(e);
                  return (
                    <button key={e} type="button" onClick={() => toggleExt(c, e)}
                      className={`px-2 py-0.5 rounded-md text-xs font-mono border transition-colors ${on ? "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-300" : "border-theme text-theme-muted line-through"}`}>.{e}</button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs text-theme-muted">
                حداکثر حجم (مگابایت)
                <input type="number" min={0.1} max={m.hard} step={0.5} value={p.maxMb} dir="ltr" className="input-theme w-24 text-sm"
                  onChange={e => setCat(c, { maxMb: +e.target.value })} />
                <span>سقف سیستم: {fa(m.hard)}</span>
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} ذخیره تنظیمات
        </button>
        {msg && <span className={`flex items-center gap-1 text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{!msg.ok && <AlertCircle className="w-4 h-4" />}{msg.text}</span>}
      </div>
    </div>
  );
}
