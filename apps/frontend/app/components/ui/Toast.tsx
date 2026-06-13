"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = React.createContext<ToastContextType | null>(null);

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-800", icon: "text-green-600 dark:text-green-400", text: "text-green-800 dark:text-green-200" },
  error: { bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800", icon: "text-red-600 dark:text-red-400", text: "text-red-800 dark:text-red-200" },
  warning: { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", icon: "text-amber-600 dark:text-amber-400", text: "text-amber-800 dark:text-amber-200" },
  info: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", icon: "text-blue-600 dark:text-blue-400", text: "text-blue-800 dark:text-blue-200" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const remove = (id: string) => setToasts(p => p.filter(t => t.id !== id));

  const show = React.useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => remove(id), 4000);
  }, []);

  const ctx: ToastContextType = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    warning: (m) => show(m, "warning"),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 left-4 z-[300] flex flex-col gap-2 pointer-events-none" dir="rtl">
        <AnimatePresence>
          {toasts.map(t => {
            const c = colors[t.type];
            const Icon = icons[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm min-w-64 max-w-sm ${c.bg} ${c.border}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${c.icon}`} />
                <span className={`flex-1 text-sm font-medium ${c.text}`}>{t.message}</span>
                <button
                  onClick={() => remove(t.id)}
                  className={`p-0.5 rounded hover:opacity-70 transition-opacity ${c.icon}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
