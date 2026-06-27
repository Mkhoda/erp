"use client";
import React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, Check, Search } from "lucide-react";

export type SearchSelectProps = {
  options: any[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Field used as the visible label. */
  displayKey?: string;
  /** Field used as the option value. */
  valueKey?: string;
  /** Optional field with extra searchable text (e.g. phone / card number). */
  searchKey?: string;
  /** When set, an entry that clears the selection (value "") is shown and used as the empty-state label. */
  emptyLabel?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

/**
 * Searchable dropdown (Select2-style combobox). The panel is rendered through a
 * portal to <body> with fixed positioning, so it always sits above grids/cards
 * regardless of parent stacking contexts or overflow. Keyboard: ↑/↓/Enter/Esc.
 */
export default function SearchSelect({
  options, value, onChange, placeholder,
  displayKey = "name", valueKey = "id", searchKey,
  emptyLabel, className, buttonClassName, disabled,
}: SearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const place = React.useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Close on outside click (button + portal panel are the "inside").
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Keep the panel anchored to the button while open (scroll/resize).
  React.useEffect(() => {
    if (!open) return;
    place();
    const on = () => place();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on, true); window.removeEventListener("resize", on); };
  }, [open, place]);

  React.useEffect(() => { if (open) { setQ(""); setActive(0); } }, [open]);

  const selected = options.find(o => String(o[valueKey]) === String(value));
  const hasValue = value !== undefined && value !== null && value !== "";

  const textOf = (o: any) => `${o[displayKey] ?? ""} ${searchKey ? (o[searchKey] ?? "") : ""}`.toLowerCase();
  const filtered = options.filter(o => textOf(o).includes(q.toLowerCase()));

  const rows: Array<{ key: string; label: string; val: string; clear?: boolean }> = [
    ...(emptyLabel ? [{ key: "__empty__", label: emptyLabel, val: "", clear: true }] : []),
    ...filtered.map(o => ({ key: String(o[valueKey]), label: String(o[displayKey]), val: String(o[valueKey]) })),
  ];

  React.useEffect(() => { setActive(a => Math.min(a, Math.max(0, rows.length - 1))); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!open) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (val: string) => { onChange(val); setOpen(false); };
  const toggle = () => { if (disabled) return; if (!open) place(); setOpen(o => !o); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows[active]) pick(rows[active].val); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  const buttonLabel = selected
    ? String(selected[displayKey])
    : (hasValue ? "" : (emptyLabel || placeholder || "انتخاب کنید"));

  const panel = open && pos && typeof document !== "undefined" ? createPortal(
    <div ref={panelRef} dir="rtl"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-theme-primary shadow-2xl border border-theme rounded-xl overflow-hidden">
      <div className="p-2 border-theme border-b relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted pointer-events-none" />
        <input autoFocus placeholder="جستجو..." value={q}
          onChange={e => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
          className="input-theme text-xs py-1.5 pr-8" />
      </div>
      <ul ref={listRef} className="max-h-56 overflow-auto text-sm">
        {rows.map((row, i) => {
          const isActive = i === active;
          const isSelected = row.clear ? !hasValue : row.val === String(value);
          return (
            <li key={row.key}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(row.val)}
                className={`flex w-full items-center gap-1.5 px-3 py-2 text-right transition-colors
                  ${isActive ? "bg-theme-hover" : ""}
                  ${isSelected ? "text-blue-700 dark:text-blue-300 font-medium" : row.clear ? "text-theme-muted" : "text-theme-secondary"}`}>
                {row.clear ? <X className="w-3.5 h-3.5 shrink-0" /> : <Check className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />}
                <span className="truncate">{row.label}</span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-3 py-3 text-theme-muted text-xs text-center">موردی یافت نشد</li>}
      </ul>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`relative ${className || ""}`}>
      <button ref={btnRef} type="button" disabled={disabled} onClick={toggle}
        className={`input-theme flex justify-between items-center gap-1 text-sm disabled:opacity-50 ${buttonClassName || ""}`}>
        <span className={`truncate text-right ${selected ? "" : "text-theme-muted"}`}>{buttonLabel}</span>
        <span className="flex items-center gap-0.5 shrink-0">
          {hasValue && !disabled && (
            <span role="button" tabIndex={-1} aria-label="پاک کردن"
              onClick={e => { e.stopPropagation(); onChange(""); }}
              className="p-0.5 rounded hover:bg-theme-hover text-theme-muted hover:text-red-500 transition-colors">
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-theme-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {panel}
    </div>
  );
}
