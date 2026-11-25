"use client";
import React from "react";
import { AlertCircle, Brain, Loader2, Paperclip, Send, Square, X, Image as ImageIcon, Film, Music, FileText } from "lucide-react";
import { Att, Caps, Category, CATEGORY_LABEL, FilePolicy, acceptString, allowedCategories, categoryOfFile, fmtSize, uploadFile } from "../lib";
import { FileGlyph } from "./Media";

export type Pending = {
  key: string; name: string; size: number; category: Category | null; progress: number;
  status: "uploading" | "done" | "error"; error?: string; att?: Att; preview?: string; abort?: () => void;
};

/** Upload state for the composer: validates against the policy before any bytes leave the browser. */
export function useUploads(policy: FilePolicy | null, caps: Caps | undefined) {
  const [items, setItems] = React.useState<Pending[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);
  const ok = React.useMemo(() => allowedCategories(policy, caps), [policy, caps]);
  const itemsRef = React.useRef(items); itemsRef.current = items;

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(n => (n === m ? null : n)), 5000); };

  const addFiles = React.useCallback((files: File[]) => {
    if (!policy) return;
    if (!policy.enabled) return flash("ارسال فایل در گفتگو غیرفعال است");
    let count = itemsRef.current.filter(i => i.status !== "error").length;
    for (const f of files) {
      if (count >= policy.maxFilesPerMessage) { flash(`حداکثر ${policy.maxFilesPerMessage.toLocaleString("fa-IR")} فایل در هر پیام مجاز است`); break; }
      const cat = categoryOfFile(policy, f.name);
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fail = (error: string) => setItems(p => [...p, { key, name: f.name, size: f.size, category: cat, progress: 0, status: "error", error }]);
      if (!cat) { fail("این نوع فایل پذیرفته نمی‌شود"); continue; }
      if (!ok[cat].ok) { fail(`${CATEGORY_LABEL[cat]}: ${ok[cat].reason}`); continue; }
      if (f.size > policy.categories[cat].maxMb * 1024 * 1024) { fail(`حجم از ${policy.categories[cat].maxMb.toLocaleString("fa-IR")} مگابایت بیشتر است`); continue; }
      if (f.size === 0) { fail("فایل خالی است"); continue; }
      const preview = cat === "image" ? URL.createObjectURL(f) : undefined;
      const up = uploadFile(f, p => setItems(prev => prev.map(i => (i.key === key ? { ...i, progress: p } : i))));
      setItems(p => [...p, { key, name: f.name, size: f.size, category: cat, progress: 0, status: "uploading", preview, abort: up.abort }]);
      count++;
      up.promise.then(att => setItems(p => p.map(i => (i.key === key ? { ...i, status: "done", progress: 1, att } : i))))
        .catch(e => setItems(p => p.map(i => (i.key === key ? { ...i, status: "error", error: e.message } : i))));
    }
  }, [policy, ok]);

  const remove = React.useCallback((key: string) => {
    const it = itemsRef.current.find(i => i.key === key);
    if (!it) return;
    if (it.status === "uploading") it.abort?.();
    if (it.preview) URL.revokeObjectURL(it.preview);
    if (it.att) fetch(`${(process.env.NEXT_PUBLIC_API_URL || "/api")}/chat-history/files/${it.att.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } }).catch(() => {});
    setItems(p => p.filter(i => i.key !== key));
  }, []);

  /** After a successful send: the files now belong to the message — forget them without deleting. */
  const clear = React.useCallback(() => {
    itemsRef.current.forEach(i => i.preview && URL.revokeObjectURL(i.preview));
    setItems([]);
  }, []);

  return {
    items, notice, ok, addFiles, remove, clear,
    uploading: items.some(i => i.status === "uploading"),
    ready: items.filter(i => i.status === "done" && i.att).map(i => i.att!),
  };
}

export type Uploads = ReturnType<typeof useUploads>;

function Chip({ it, onRemove }: { it: Pending; onRemove: () => void }) {
  const pct = Math.round(it.progress * 100);
  const bad = it.status === "error";
  return (
    <div className={`relative flex items-center gap-2 rounded-xl border px-2 py-1.5 max-w-[230px] ${bad ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30" : "border-theme bg-theme-card"}`}>
      <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
        {it.preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={it.preview} alt="" className="w-full h-full object-cover" />
          : bad ? <AlertCircle className="w-4 h-4 text-red-500" /> : <FileGlyph att={{ name: it.name, category: it.category || "document", mime: "" }} className="w-4 h-4" />}
        {it.status === "uploading" && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[10px] text-white font-bold">{pct.toLocaleString("fa-IR")}٪</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-theme-primary truncate" dir="auto">{it.name}</div>
        <div className={`text-[10px] truncate ${bad ? "text-red-500" : "text-theme-muted"}`}>{bad ? it.error : it.status === "uploading" ? "در حال بارگذاری…" : fmtSize(it.size)}</div>
        {it.status === "uploading" && <div className="h-0.5 mt-1 bg-theme-hover rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} /></div>}
      </div>
      <button type="button" onClick={onRemove} className="text-theme-muted hover:text-red-500 shrink-0" aria-label="حذف"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

const CAP_ICON: Record<Category, any> = { image: ImageIcon, video: Film, audio: Music, document: FileText, text: FileText };

export function Composer(p: {
  value: string; onChange: (v: string) => void; onSend: () => void; onStop: () => void;
  streaming: boolean; uploads: Uploads; policy: FilePolicy | null; caps?: Caps;
  reasoning: boolean; onToggleReasoning: () => void; inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { uploads: u } = p;
  const canSend = (p.value.trim().length > 0 || u.ready.length > 0) && !u.uploading && !p.streaming;
  const accept = acceptString(p.policy, u.ok);
  const anyAttach = p.policy?.enabled && Object.values(u.ok).some(x => x.ok);

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length) { e.preventDefault(); u.addFiles(files); }
  };

  return (
    <div className="px-3 sm:px-6 pb-2 pt-3 shrink-0 bg-gradient-to-t from-theme-card via-theme-card to-transparent">
      <div className="max-w-3xl mx-auto">
        {u.notice && <div className="mb-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{u.notice}</div>}
        <div className="bg-theme-card border border-theme rounded-3xl shadow-[0_8px_30px_-12px_rgba(59,130,246,0.25)] focus-within:border-blue-500/60 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
          {u.items.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2.5 pb-0">
              {u.items.map(it => <Chip key={it.key} it={it} onRemove={() => u.remove(it.key)} />)}
            </div>
          )}
          <textarea
            ref={p.inputRef as any} value={p.value} rows={1} dir="auto"
            onChange={e => p.onChange(e.target.value)}
            onPaste={onPaste}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) p.onSend(); } }}
            onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; }}
            placeholder="پیام خود را بنویسید یا فایل را بکشید و رها کنید…"
            className="w-full bg-transparent outline-none resize-none text-theme-primary placeholder:text-theme-muted text-[15px] leading-7 px-5 pt-4 pb-1 min-h-[52px] max-h-[200px]"
          />
          <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
            <input ref={fileRef} type="file" multiple hidden accept={accept} onChange={e => { u.addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
            <button type="button" disabled={!anyAttach} onClick={() => fileRef.current?.click()} title={anyAttach ? "پیوست فایل" : "ارسال فایل در دسترس نیست"}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-theme text-xs text-theme-secondary hover:text-blue-500 hover:border-blue-500/40 hover:bg-blue-500/5 disabled:opacity-40 transition-colors">
              <Paperclip className="w-3.5 h-3.5" /> پیوست
            </button>
            {p.caps?.reasoning && (
              <button type="button" onClick={p.onToggleReasoning} title="نمایش فرایند فکر کردن مدل"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs transition-colors ${p.reasoning ? "bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300" : "border-theme text-theme-secondary hover:bg-theme-hover"}`}>
                <Brain className="w-3.5 h-3.5" /> تفکر
              </button>
            )}
            <div className="hidden sm:flex items-center gap-0.5 ms-1 px-2 py-1 rounded-full bg-theme-hover/60">
              {(["image", "document", "audio", "video"] as Category[]).map(c => {
                const I = CAP_ICON[c]; const on = u.ok[c]?.ok;
                return <span key={c} title={on ? `${CATEGORY_LABEL[c]}: مجاز` : `${CATEGORY_LABEL[c]}: ${u.ok[c]?.reason || ""}`} className={`p-1 rounded-md ${on ? "text-theme-secondary" : "text-theme-muted/40 line-through"}`}><I className="w-3.5 h-3.5" /></span>;
              })}
            </div>
            <div className="flex-1" />
            {p.streaming ? (
              <button type="button" onClick={p.onStop} title="توقف"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg hover:scale-105 transition-transform">
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button type="button" onClick={p.onSend} disabled={!canSend} title={u.uploading ? "صبر کنید تا بارگذاری تمام شود" : "ارسال"}
                className="flex items-center justify-center w-10 h-10 bg-ai-gradient hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-35 disabled:hover:scale-100 disabled:hover:shadow-none rounded-full text-white transition-all disabled:cursor-not-allowed">
                {u.uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 -scale-x-100" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
