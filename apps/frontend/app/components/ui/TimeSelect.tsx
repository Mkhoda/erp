"use client";
import React from "react";

interface Props {
  value: string;      // "HH:MM" or ""
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

// ── Clock geometry ────────────────────────────────────────────────────────────
const SIZE = 256, CX = SIZE / 2, CY = SIZE / 2;
const R_OUT = 96, R_IN = 64, R_SEL = 18;

function pt(deg: number, r: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}
function angleOf(dx: number, dy: number) {
  let d = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}

// Outer ring: 12, 1 … 11  |  Inner ring: 0, 13 … 23
const HOURS = [
  ...Array.from({ length: 12 }, (_, i) => ({ h: i === 0 ? 12 : i, a: i * 30, inner: false })),
  { h: 0, a: 0, inner: true },
  ...Array.from({ length: 11 }, (_, i) => ({ h: i + 13, a: (i + 1) * 30, inner: true })),
];
const MINS = Array.from({ length: 12 }, (_, i) => ({ m: i * 5, a: i * 30 }));

// ── Component ─────────────────────────────────────────────────────────────────
export default function TimeSelect({ value, onChange, disabled, className = "input-theme text-sm" }: Props) {
  function parse(v: string) {
    const [hh, mm] = (v || "").split(":");
    return { h: hh !== undefined && hh !== "" ? +hh : -1, m: mm !== undefined && mm !== "" ? +mm : -1 };
  }

  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<"h" | "m">("h");
  const [h, setH] = React.useState(() => parse(value).h);
  const [m, setM] = React.useState(() => parse(value).m);
  const [dark, setDark] = React.useState(false);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Track dark-mode class on <html>
  React.useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Sync when parent changes value
  React.useEffect(() => {
    const p = parse(value);
    setH(p.h); setM(p.m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function openPicker() {
    if (disabled) return;
    setPhase("h");
    setOpen(true);
  }

  function confirm() {
    if (h < 0) { setOpen(false); return; }
    onChange(`${String(h).padStart(2, "0")}:${String(m < 0 ? 0 : m).padStart(2, "0")}`);
    setOpen(false);
  }

  function cancel() {
    const p = parse(value);
    setH(p.h); setM(p.m);
    setOpen(false);
  }

  function pick(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    let cx: number, cy: number;
    if ("changedTouches" in e) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = (e as React.MouseEvent).clientX;
      cy = (e as React.MouseEvent).clientY;
    }
    const sx = ((cx - rect.left) / rect.width) * SIZE;
    const sy = ((cy - rect.top) / rect.height) * SIZE;
    const dx = sx - CX, dy = sy - CY;
    const ang = angleOf(dx, dy);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (phase === "h") {
      const inner = dist < (R_OUT + R_IN) / 2;
      const snap = Math.round(ang / 30) * 30 % 360;
      const found = HOURS.find(p => p.inner === inner && p.a === snap);
      if (found) { setH(found.h); setTimeout(() => setPhase("m"), 220); }
    } else {
      setM(Math.round(ang / 6) % 60);
    }
  }

  // Hand geometry
  const ha = phase === "h"
    ? (h < 0 ? 0 : h === 0 ? 0 : h <= 12 ? (h % 12) * 30 : (h - 12) * 30)
    : (m < 0 ? 0 : m * 6);
  const handInner = phase === "h" && (h === 0 || h > 12);
  const handR = handInner ? R_IN : R_OUT;
  const hEnd = pt(ha, handR - R_SEL);
  const hDot = pt(ha, handR);
  const showHand = phase === "h" ? h >= 0 : m >= 0;

  const dH = h < 0 ? "--" : String(h).padStart(2, "0");
  const dM = m < 0 ? "--" : String(m).padStart(2, "0");

  // Theme-aware SVG colors
  const c = {
    face:    dark ? "#374151" : "#E5E7EB",
    num:     dark ? "#F3F4F6" : "#1F2937",
    numDim:  dark ? "#9CA3AF" : "#6B7280",
    accent:  "#2563EB",
    selText: "#FFFFFF",
  };

  return (
    <>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={`${className} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        dir="ltr"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-50">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{value || "--:--"}</span>
      </button>

      {/* ── Picker overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}
          onTouchEnd={e => { if (e.target === e.currentTarget) cancel(); }}
        >
          <div
            className={`rounded-2xl shadow-2xl overflow-hidden w-72 ${dark ? "bg-gray-800" : "bg-white"}`}
            dir="ltr"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-blue-600 px-6 py-5 select-none">
              <div className="text-blue-200 text-xs tracking-widest mb-3">انتخاب زمان</div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPhase("h")}
                  className={`text-5xl font-light w-16 text-center rounded-lg py-1 transition-colors ${phase === "h" ? "bg-blue-500/40 text-white" : "text-blue-200 hover:bg-blue-500/20"}`}
                >
                  {dH}
                </button>
                <span className="text-5xl font-light text-blue-300 mx-0.5">:</span>
                <button
                  onClick={() => setPhase("m")}
                  className={`text-5xl font-light w-16 text-center rounded-lg py-1 transition-colors ${phase === "m" ? "bg-blue-500/40 text-white" : "text-blue-200 hover:bg-blue-500/20"}`}
                >
                  {dM}
                </button>
              </div>
            </div>

            {/* Clock face */}
            <div className={`px-4 pt-4 pb-2 flex justify-center ${dark ? "bg-gray-900" : "bg-gray-50"}`}>
              <svg
                ref={svgRef}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                onClick={pick}
                onTouchEnd={pick}
                style={{ cursor: "pointer", touchAction: "none", userSelect: "none" }}
              >
                {/* Background */}
                <circle cx={CX} cy={CY} r={SIZE / 2 - 4} fill={c.face} />

                {/* Hand */}
                {showHand && (
                  <>
                    <line x1={CX} y1={CY} x2={hEnd.x} y2={hEnd.y} stroke={c.accent} strokeWidth={2} strokeLinecap="round" />
                    <circle cx={hDot.x} cy={hDot.y} r={R_SEL} fill={c.accent} />
                    <circle cx={CX} cy={CY} r={5} fill={c.accent} />
                  </>
                )}
                {!showHand && <circle cx={CX} cy={CY} r={4} fill={c.numDim} />}

                {/* Hour phase */}
                {phase === "h" && (
                  <>
                    {HOURS.filter(p => !p.inner).map(p => {
                      const pos = pt(p.a, R_OUT);
                      const sel = h === p.h;
                      return (
                        <g key={p.h}>
                          {sel && <circle cx={pos.x} cy={pos.y} r={R_SEL} fill={c.accent} />}
                          <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                            fontSize={15} fill={sel ? c.selText : c.num} fontWeight={sel ? 600 : 400}
                            style={{ pointerEvents: "none" }}>
                            {p.h}
                          </text>
                        </g>
                      );
                    })}
                    {HOURS.filter(p => p.inner).map(p => {
                      const pos = pt(p.a, R_IN);
                      const sel = h === p.h;
                      return (
                        <g key={p.h}>
                          {sel && <circle cx={pos.x} cy={pos.y} r={R_SEL - 5} fill={c.accent} />}
                          <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                            fontSize={11} fill={sel ? c.selText : c.numDim} fontWeight={sel ? 600 : 400}
                            style={{ pointerEvents: "none" }}>
                            {String(p.h).padStart(2, "0")}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}

                {/* Minute phase */}
                {phase === "m" && MINS.map(p => {
                  const pos = pt(p.a, R_OUT);
                  const sel = m === p.m;
                  return (
                    <g key={p.m}>
                      {sel && <circle cx={pos.x} cy={pos.y} r={R_SEL} fill={c.accent} />}
                      <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                        fontSize={14} fill={sel ? c.selText : c.num} fontWeight={sel ? 600 : 400}
                        style={{ pointerEvents: "none" }}>
                        {String(p.m).padStart(2, "0")}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-1 px-4 py-3 border-t ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
              <button onClick={cancel}  className="px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">لغو</button>
              <button onClick={confirm} className="px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">تأیید</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
