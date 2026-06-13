import React from "react";
import { Plus } from "lucide-react";

type Props = {
  icon: React.ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  colSpan?: number;
};

export function EmptyStateRow({ icon: Icon, title, description, actionLabel, onAction, colSpan = 6 }: Props) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-theme-secondary border border-theme flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-theme-muted" />
          </div>
          <p className="font-semibold text-theme-primary text-sm mb-1">{title}</p>
          {description && <p className="text-theme-muted text-xs max-w-xs">{description}</p>}
          {actionLabel && onAction && (
            <button onClick={onAction} className="btn-theme-primary text-xs mt-4 gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {actionLabel}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function EmptyStateBox({ icon: Icon, title, description, actionLabel, onAction }: Omit<Props, "colSpan">) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center col-span-full">
      <div className="w-14 h-14 rounded-2xl bg-theme-secondary border border-theme flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-theme-muted" />
      </div>
      <p className="font-semibold text-theme-primary text-sm mb-1">{title}</p>
      {description && <p className="text-theme-muted text-xs max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-theme-primary text-xs mt-4 gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
