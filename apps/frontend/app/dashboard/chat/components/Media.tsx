"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, FileText, FileType2, Music, X, File as FileIcon } from "lucide-react";
import { Att, fileUrl, fmtSize } from "../lib";

export function FileGlyph({ att, className = "w-5 h-5" }: { att: Pick<Att, "name" | "category" | "mime">; className?: string }) {
  const ext = (att.name.split(".").pop() || "").toLowerCase();
  if (att.category === "audio") return <Music className={className} />;
  if (ext === "xlsx" || ext === "csv" || ext === "tsv") return <FileSpreadsheet className={className} />;
  if (ext === "pdf") return <FileType2 className={className} />;
  if (att.category === "document" || att.category === "text") return <FileText className={className} />;
  return <FileIcon className={className} />;
}

function Lightbox({ att, onClose }: { att: Att; onClose: () => void }) {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="absolute top-4 start-4 flex gap-2" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="بستن"><X className="w-5 h-5" /></button>
        <a href={fileUrl(att.url)} download={att.name} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="دانلود"><Download className="w-5 h-5" /></a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fileUrl(att.url)} alt={att.name} onClick={e => e.stopPropagation()} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
      <div className="absolute bottom-4 inset-x-0 text-center text-white/70 text-xs" dir="ltr">{att.name}</div>
    </div>,
    document.body,
  );
}

function ImageTile({ att, onOpen }: { att: Att; onOpen: () => void }) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const ratio = att.width && att.height ? Math.min(Math.max(att.width / att.height, 0.6), 2) : 1;
  return (
    <button type="button" onClick={onOpen} title={att.name}
      className="relative overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group"
      style={{ width: 200, aspectRatio: String(ratio) }}>
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-black/5 to-black/15 dark:from-white/5 dark:to-white/15" />}
      {failed
        ? <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] text-theme-muted gap-1"><FileIcon className="w-5 h-5" />پیش‌نمایش در دسترس نیست</div>
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={fileUrl(att.thumbUrl || att.url)} alt={att.name} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            className={`w-full h-full object-cover transition duration-300 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`} />}
    </button>
  );
}

function FileCard({ att }: { att: Att }) {
  return (
    <a href={fileUrl(att.url)} target="_blank" rel="noopener noreferrer" download={att.name}
      className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors px-3 py-2 w-[240px] max-w-full text-theme-primary">
      <span className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0"><FileGlyph att={att} /></span>
      <span className="min-w-0 flex-1 text-start">
        <span className="block text-xs font-medium truncate" dir="auto">{att.name}</span>
        <span className="block text-[10px] text-theme-muted mt-0.5">{fmtSize(att.sizeBytes)} · {(att.name.split(".").pop() || "").toUpperCase()}</span>
      </span>
      <Download className="w-3.5 h-3.5 text-theme-muted shrink-0" />
    </a>
  );
}

/** Renders a message's attachments: image tiles (lightbox), inline video/audio players, file cards. */
export function AttachmentGrid({ atts }: { atts: Att[] }) {
  const [open, setOpen] = React.useState<Att | null>(null);
  if (!atts?.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-2">
        {atts.map(a => {
          if (a.category === "image") return <ImageTile key={a.id} att={a} onOpen={() => setOpen(a)} />;
          if (a.category === "video") return (
            <div key={a.id} className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black w-[320px] max-w-full">
              <video src={fileUrl(a.url)} controls preload="metadata" playsInline className="w-full max-h-64" />
              <div className="px-2 py-1 text-[10px] text-white/70 bg-black truncate" dir="auto">{a.name} · {fmtSize(a.sizeBytes)}</div>
            </div>
          );
          if (a.category === "audio") return (
            <div key={a.id} className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-2 w-[300px] max-w-full">
              <div className="text-[11px] text-theme-secondary truncate mb-1" dir="auto">{a.name} · {fmtSize(a.sizeBytes)}</div>
              <audio src={fileUrl(a.url)} controls preload="metadata" className="w-full h-9" />
            </div>
          );
          return <FileCard key={a.id} att={a} />;
        })}
      </div>
      {open && <Lightbox att={open} onClose={() => setOpen(null)} />}
    </>
  );
}
