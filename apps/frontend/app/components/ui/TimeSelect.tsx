"use client";
import React from "react";

interface Props {
  value: string;      // "HH:MM" or ""
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

// ── Clock geometry ─────────────────────────────────────────────────────────
const SIZE = 256, CX = SIZE / 2, CY = SIZE / 2;
const R_OUT = 96, R_IN = 64, R_SEL = 18;

function pt(deg: number, r: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}
function angleOf(dx: number, dy: number) {
  const d = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}

// Outer ring: 12, 1…11  |  Inner ring: 0, 13…23
const HOURS = [
  ...Array.from({ length: 12 }, (_, i) => ({ h: i === 0 ? 12 : i, a: i * 30, inner: false })),
  { h: 0, a: 0, inner: true },
  ...Array.from({ length: 11 }, (_, i) => ({ h: i + 13, a: (i + 1) * 30, inner: true })),
];
const MINS = Array.from({ length: 12 }, (_, i) => ({ m: i * 5, a: i * 30 }));

function parseTxt(v: string) {
  const [hh, mm] = (v || "").split(":");
  return {
    h: hh !== undefined && hh !== "" ? +hh : -1,
    m: mm !== undefined && mm !== "" ? +mm : -1,
  };
}

// ── Component ───────────────────────────────────────────────────────────────
export default function TimeSelect({ value, onChange, disabled, className = "input-theme text-sm" }: Props) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<"h" | "m">("h");
  const [h, setH] = React.useState(() => parseTxt(value).h);
  const [m, setM] = React.useState(() => parseTxt(value).m);
  // Separate text state so user can freely type in the header inputs
  const [hText, setHText] = React.useState(() => { const p = parseTxt(value); return p.h >= 0 ? String(p.h).padStart(2, "0") : ""; });
  const [mText, setMText] = React.useState(() => { const p = parseTxt(value); return p.m >= 0 ? String(p.m).padStart(2, "0") : ""; });
  const [dark, setDark] = React.useState(false);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const minuteRef = React.useRef<HTMLInputElement>(null);
  const dragging = React.useRef(false);
  // Refs so non-React window listeners always read fresh values (no stale closure)
  const phaseRef = React.useRef<"h" | "m">("h");
  const hLive = React.useRef(-1);

  function applyPhase(p: "h" | "m") { phaseRef.current = p; setPhase(p); }
  function applyH(n: number) { hLive.current = n; setH(n); }

  // Dark-mode observer
  React.useEffect(() => {
    const check = () => setDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Sync from parent value prop
  React.useEffect(() => {
    const p = parseTxt(value);
    applyH(p.h); setM(p.m);
    setHText(p.h >= 0 ? String(p.h).padStart(2, "0") : "");
    setMText(p.m >= 0 ? String(p.m).padStart(2, "0") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Keep header text in sync when clock changes h/m
  React.useEffect(() => { setHText(h >= 0 ? String(h).padStart(2, "0") : ""); }, [h]);
  React.useEffect(() => { setMText(m >= 0 ? String(m).padStart(2, "0") : ""); }, [m]);

  // Global mouseup/touchend — end drag even if pointer leaves the SVG
  React.useEffect(() => {
    if (!open) return;
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (phaseRef.current === "h" && hLive.current >= 0) {
        setTimeout(() => applyPhase("m"), 220);
      }
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
  }, [open]);

  // ── Clock interaction ─────────────────────────────────────────────────────
  function getClient(e: React.MouseEvent | React.TouchEvent) {
    if ("changedTouches" in e) {
      const t = (e as React.TouchEvent).changedTouches[0];
      return { cx: t.clientX, cy: t.clientY };
    }
    return { cx: (e as React.MouseEvent).clientX, cy: (e as React.MouseEvent).clientY };
  }

  function pickAt(clientX: number, clientY: number) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * SIZE;
    const sy = ((clientY - rect.top) / rect.height) * SIZE;
    const dx = sx - CX, dy = sy - CY;
    const ang = angleOf(dx, dy);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (phaseRef.current === "h") {
      const inner = dist < (R_OUT + R_IN) / 2;
      const snap = Math.round(ang / 30) * 30 % 360;
      const found = HOURS.find(p => p.inner === inner && p.a === snap);
      if (found) applyH(found.h);
    } else {
      setM(Math.round(ang / 6) % 60);
    }
  }

  function onDown(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    e.preventDefault();
    dragging.current = true;
    const { cx, cy } = getClient(e);
    pickAt(cx, cy);
  }

  function onMove(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    e.preventDefault();
    const { cx, cy } = getClient(e);
    pickAt(cx, cy);
  }

  function onUp(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    const { cx, cy } = getClient(e);
    pickAt(cx, cy);
    // Use refs so we always read the value that was just set above, not the pre-render state
    if (phaseRef.current === "h" && hLive.current >= 0) setTimeout(() => applyPhase("m"), 220);
  }

  // ── Header inputs ─────────────────────────────────────────────────────────
  function onHourChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHText(v);
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0 && n <= 23) {
      applyH(n);
      // Auto-advance to minute when 2 valid digits entered
      if (v.length === 2) setTimeout(() => { minuteRef.current?.focus(); minuteRef.current?.select(); }, 0);
    }
  }

  function onMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMText(v);
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0 && n <= 59) setM(n);
  }

  function onHourBlur() {
    const n = parseInt(hText, 10);
    if (isNaN(n) || n < 0 || n > 23) setHText(h >= 0 ? String(h).padStart(2, "0") : "");
    else { applyH(n); setHText(String(n).padStart(2, "0")); }
  }

  function onMinBlur() {
    const n = parseInt(mText, 10);
    if (isNaN(n) || n < 0 || n > 59) setMText(m >= 0 ? String(m).padStart(2, "0") : "");
    else { setM(n); setMText(String(n).padStart(2, "0")); }
  }

  // ── Confirm / cancel ──────────────────────────────────────────────────────
  function confirm() {
    // Flush any partially-typed text before confirming
    const hn = parseInt(hText, 10), mn = parseInt(mText, 10);
    const fh = !isNaN(hn) && hn >= 0 && hn <= 23 ? hn : h;
    const fm = !isNaN(mn) && mn >= 0 && mn <= 59 ? mn : (m >= 0 ? m : 0);
    if (fh < 0) { setOpen(false); return; }
    onChange(`${String(fh).padStart(2, "0")}:${String(fm).padStart(2, "0")}`);
    setOpen(false);
  }

  function cancel() {
    const p = parseTxt(value);
    applyH(p.h); setM(p.m);
    setOpen(false);
  }

  // ── Hand geometry ─────────────────────────────────────────────────────────
  const handAngle = phase === "h"
    ? (h < 0 ? 0 : h === 0 ? 0 : h <= 12 ? (h % 12) * 30 : (h - 12) * 30)
    : (m < 0 ? 0 : m * 6);
  const handInner = phase === "h" && (h === 0 || h > 12);
  const handR = handInner ? R_IN : R_OUT;
  const handEnd = pt(handAngle, handR - R_SEL);
  const handDot = pt(handAngle, handR);
  const showHand = phase === "h" ? h >= 0 : m >= 0;

  const clr = {
    face: dark ? "#374151" : "#E5E7EB",
    num:  dark ? "#F3F4F6" : "#1F2937",
    dim:  dark ? "#9CA3AF" : "#6B7280",
    accent: "#2563EB",
    sel: "#FFFFFF",
  };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => { if (!disabled) { applyPhase("h"); setOpen(true); } }}
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
        >
          <div
            className={`rounded-2xl shadow-2xl overflow-hidden w-72 ${dark ? "bg-gray-800" : "bg-white"}`}
            dir="ltr"
            onClick={e => e.stopPropagation()}
          >
            {/* Header — editable inputs for direct typing */}
            <div className="bg-blue-600 px-6 py-5">
              <div className="text-blue-200 text-xs tracking-widest mb-3 select-none">انتخاب زمان</div>
              <div className="flex items-center gap-0.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={hText}
                  placeholder="--"
                  onChange={onHourChange}
                  onBlur={onHourBlur}
                  onFocus={e => { applyPhase("h"); e.target.select(); }}
                  className={`text-5xl font-light w-16 text-center rounded-lg py-1 border-none outline-none bg-transparent transition-colors ${
                    phase === "h" ? "bg-blue-500/40 text-white" : "text-blue-200 hover:bg-blue-500/20"
                  }`}
                  style={{ caretColor: "white" }}
                />
                <span className="text-5xl font-light text-blue-300 mx-0.5 select-none">:</span>
                <input
                  ref={minuteRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={mText}
                  placeholder="--"
                  onChange={onMinChange}
                  onBlur={onMinBlur}
                  onFocus={e => { applyPhase("m"); e.target.select(); }}
                  className={`text-5xl font-light w-16 text-center rounded-lg py-1 border-none outline-none bg-transparent transition-colors ${
                    phase === "m" ? "bg-blue-500/40 text-white" : "text-blue-200 hover:bg-blue-500/20"
                  }`}
                  style={{ caretColor: "white" }}
                />
              </div>
            </div>

            {/* Clock face — drag or click */}
            <div className={`px-4 pt-4 pb-2 flex justify-center ${dark ? "bg-gray-900" : "bg-gray-50"}`}>
              <svg
                ref={svgRef}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                onMouseDown={onDown}
                onMouseMove={onMove}
                onMouseUp={onUp}
                onTouchStart={onDown}
                onTouchMove={onMove}
                onTouchEnd={onUp}
                style={{ cursor: "pointer", touchAction: "none", userSelect: "none" }}
              >
                {/* Background */}
                <circle cx={CX} cy={CY} r={SIZE / 2 - 4} fill={clr.face} />

                {/* Hand */}
                {showHand && <>
                  <line x1={CX} y1={CY} x2={handEnd.x} y2={handEnd.y} stroke={clr.accent} strokeWidth={2} strokeLinecap="round" />
                  <circle cx={handDot.x} cy={handDot.y} r={R_SEL} fill={clr.accent} />
                  <circle cx={CX} cy={CY} r={5} fill={clr.accent} />
                </>}
                {!showHand && <circle cx={CX} cy={CY} r={4} fill={clr.dim} />}

                {/* Hour phase: outer + inner rings */}
                {phase === "h" && <>
                  {HOURS.filter(p => !p.inner).map(p => {
                    const pos = pt(p.a, R_OUT), sel = h === p.h;
                    return (
                      <g key={p.h}>
                        {sel && <circle cx={pos.x} cy={pos.y} r={R_SEL} fill={clr.accent} />}
                        <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                          fontSize={15} fill={sel ? clr.sel : clr.num} fontWeight={sel ? 600 : 400}
                          style={{ pointerEvents: "none" }}>
                          {p.h}
                        </text>
                      </g>
                    );
                  })}
                  {HOURS.filter(p => p.inner).map(p => {
                    const pos = pt(p.a, R_IN), sel = h === p.h;
                    return (
                      <g key={p.h}>
                        {sel && <circle cx={pos.x} cy={pos.y} r={R_SEL - 5} fill={clr.accent} />}
                        <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                          fontSize={11} fill={sel ? clr.sel : clr.dim} fontWeight={sel ? 600 : 400}
                          style={{ pointerEvents: "none" }}>
                          {String(p.h).padStart(2, "0")}
                        </text>
                      </g>
                    );
                  })}
                </>}

                {/* Minute phase: 5-min marks; 1-min granularity on click/drag */}
                {phase === "m" && MINS.map(p => {
                  const pos = pt(p.a, R_OUT), sel = m === p.m;
                  return (
                    <g key={p.m}>
                      {sel && <circle cx={pos.x} cy={pos.y} r={R_SEL} fill={clr.accent} />}
                      <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                        fontSize={14} fill={sel ? clr.sel : clr.num} fontWeight={sel ? 600 : 400}
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
