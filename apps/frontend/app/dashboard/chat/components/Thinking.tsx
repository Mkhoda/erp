"use client";
import React from "react";
import { Brain, ChevronDown } from "lucide-react";

const fa = (n: number) => n.toLocaleString("fa-IR");

/** Collapsible "model is thinking" panel: live timer + shimmer while streaming, summary once done. */
export function Thinking({ text, active, ms }: { text: string; active: boolean; ms?: number }) {
  const [open, setOpen] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const start = React.useRef(Date.now());
  React.useEffect(() => {
    if (!active) return;
    start.current = Date.now() - (ms || 0);
    const t = setInterval(() => setElapsed(Date.now() - start.current), 250);
    return () => clearInterval(t);
  }, [active, ms]);
  const secs = Math.max(1, Math.round(((active ? elapsed : ms) || 0) / 1000));
  const known = active || !!ms;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (open && active && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [text, open, active]);
  if (!text && !active) return null;
  return (
    <div className="mb-2 rounded-xl border border-purple-300/40 dark:border-purple-500/20 bg-purple-50/60 dark:bg-purple-500/5 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-700 dark:text-purple-300">
        <Brain className={`w-3.5 h-3.5 ${active ? "animate-pulse" : ""}`} />
        <span className={active ? "thinking-shimmer font-medium" : "font-medium"}>{active ? "در حال فکر کردن…" : (known ? `فکر کرد · ${fa(secs)} ثانیه` : "فکر کرد")}</span>
        {active && <span className="text-purple-500/70">{fa(secs)} ث</span>}
        <ChevronDown className={`w-3.5 h-3.5 ms-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={bodyRef} className="px-3 pb-3 max-h-56 overflow-y-auto text-xs leading-6 text-theme-secondary whitespace-pre-wrap border-t border-purple-300/30 dark:border-purple-500/10 pt-2">
          {text || "…"}
        </div>
      )}
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="در حال نوشتن">
      {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
    </span>
  );
}
