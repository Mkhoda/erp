import React from "react";
import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  count?: number;
  countLabel?: string;
  children?: React.ReactNode; // additional filters
};

export default function SearchBar({ value, onChange, placeholder = "جستجو...", count, countLabel = "مورد", children }: Props) {
  return (
    <div className="card-theme">
      <div className="card-theme-body py-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className="input-theme pr-10 text-sm"
            />
            {value && (
              <button
                onClick={() => onChange("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {children}
          {count !== undefined && (
            <span className="text-theme-muted text-xs shrink-0">
              {count.toLocaleString("fa-IR")} {countLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
