"use client";
import React from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
};

export default function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = "تأیید", cancelLabel = "انصراف",
  variant = "danger", loading = false,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="" size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-theme-secondary text-sm" disabled={loading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`text-sm disabled:opacity-50 ${variant === "danger" ? "btn-theme-danger" : "btn-theme-primary"}`}
          >
            {loading ? "در حال انجام..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${variant === "danger" ? "bg-red-100 dark:bg-red-950/40" : "bg-amber-100 dark:bg-amber-950/40"}`}>
          <AlertTriangle className={`w-6 h-6 ${variant === "danger" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
        </div>
        <div>
          <h3 className="font-semibold text-theme-primary text-base mb-1">{title}</h3>
          <p className="text-theme-muted text-sm">{message}</p>
        </div>
      </div>
    </Modal>
  );
}

// Hook for imperative confirm dialogs
export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    resolve?: (v: boolean) => void;
    variant?: "danger" | "warning";
  }>({ open: false, title: "", message: "" });

  const confirm = React.useCallback((title: string, message: string, variant: "danger" | "warning" = "danger"): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ open: true, title, message, variant, resolve });
    });
  }, []);

  const handleClose = () => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false }));
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false }));
  };

  const Dialog = (
    <ConfirmDialog
      open={state.open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      variant={state.variant}
    />
  );

  return { confirm, Dialog };
}
