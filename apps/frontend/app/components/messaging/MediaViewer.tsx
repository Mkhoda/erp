"use client";
import React from "react";
import { X, Download, ZoomIn, ZoomOut, RotateCw, ExternalLink, FileText } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  url: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  name: string;
  onClose: () => void;
};

export default function MediaViewer({ url, type, name, onClose }: Props) {
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const fullUrl = React.useMemo(
    () => (url.startsWith("http") ? url : `${typeof window !== "undefined" ? window.location.origin : ""}${url}`),
    [url],
  );

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (type === "IMAGE") {
        if (e.key === "+" || e.key === "=") setScale((s) => Math.min(4, s + 0.25));
        if (e.key === "-") setScale((s) => Math.max(0.25, s - 0.25));
        if (e.key === "0") setScale(1);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, type]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <span className="text-white text-sm font-medium truncate max-w-xs">{name}</span>
        <div className="flex items-center gap-1">
          {type === "IMAGE" && (
            <>
              <button
                onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="کوچک‌تر"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white/50 text-xs w-10 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale((s) => Math.min(4, s + 0.25))}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="بزرگ‌تر"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setScale(1); setRotation(0); }}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xs"
                title="اندازه اصلی"
              >
                1:1
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="چرخش"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/10 mx-1" />
            </>
          )}
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="باز در تب جدید"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={fullUrl}
            download={name}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="دانلود"
          >
            <Download className="w-4 h-4" />
          </a>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "IMAGE" && (
          <img
            src={fullUrl}
            alt={name}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: "center",
              transition: "transform 0.2s ease",
            }}
            className="max-w-full max-h-full object-contain select-none cursor-zoom-in"
            draggable={false}
            onClick={() => setScale((s) => (s === 1 ? 2 : 1))}
          />
        )}

        {type === "VIDEO" && (
          <video
            src={fullUrl}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            style={{ maxHeight: "80vh" }}
          />
        )}

        {type === "AUDIO" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-6" dir="rtl">
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-white font-medium text-center">{name}</p>
            <audio src={fullUrl} controls className="w-72" />
          </div>
        )}

        {type === "DOCUMENT" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 flex flex-col items-center gap-6 max-w-sm" dir="rtl">
            <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-white font-semibold text-center text-lg">{name}</p>
            <p className="text-white/50 text-sm text-center">برای مشاهده یا دانلود این فایل از دکمه‌های بالا استفاده کنید</p>
            <a
              href={fullUrl}
              download={name}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              دانلود فایل
            </a>
          </div>
        )}
      </div>

      {/* Hint */}
      {type === "IMAGE" && (
        <div className="text-center pb-3 text-white/20 text-xs select-none" onClick={(e) => e.stopPropagation()}>
          کلیک برای زوم — Escape برای بستن — +/- برای تغییر اندازه
        </div>
      )}
    </motion.div>
  );
}
