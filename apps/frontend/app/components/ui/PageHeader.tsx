"use client";
import React from "react";

type Action = {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string; // tailwind gradient classes e.g. "from-blue-500 to-blue-600"
  actions?: Action[];
  extra?: React.ReactNode; // anything to the right of primary actions
};

const variantCls: Record<string, string> = {
  primary: "btn-theme-primary",
  secondary: "btn-theme-secondary",
  danger: "btn-theme-danger",
};

export default function PageHeader({ title, subtitle, icon: Icon, iconColor = "from-blue-500 to-blue-600", actions = [], extra }: Props) {
  return (
    <div className="card-theme">
      <div className="card-theme-body py-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center bg-gradient-to-br ${iconColor} rounded-xl w-10 h-10 shadow-md`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-theme-primary text-xl leading-tight">{title}</h1>
              {subtitle && <p className="text-theme-muted text-sm mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {(actions.length > 0 || extra) && (
            <div className="flex items-center gap-2 flex-wrap">
              {extra}
              {actions.map((a, i) => (
                <button
                  key={i}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={`${variantCls[a.variant || "primary"]} text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {a.icon && <a.icon className="w-4 h-4" />}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
