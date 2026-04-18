"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const duration = t.duration ?? 4500;
    const leaveTimer = setTimeout(() => setLeaving(true), duration - 300);
    const removeTimer = setTimeout(() => onDismiss(t.id), duration);
    return () => { clearTimeout(leaveTimer); clearTimeout(removeTimer); };
  }, [t, onDismiss]);

  const icons = {
    success: <CheckCircle2 size={18} className="text-success-DEFAULT" />,
    error:   <XCircle size={18} className="text-danger" />,
    warning: <AlertTriangle size={18} className="text-warning-DEFAULT" />,
    info:    <Info size={18} className="text-primary-400" />,
  };

  const borders = {
    success: "border-l-success-DEFAULT",
    error:   "border-l-danger",
    warning: "border-l-warning-DEFAULT",
    info:    "border-l-primary-500",
  };

  return (
    <div
      className={`
        flex items-start gap-3 min-w-[300px] max-w-[380px] p-4 rounded-lg
        bg-ink-800 border border-ink-600 border-l-4 ${borders[t.type]}
        shadow-xl transition-all duration-300
        ${leaving ? "opacity-0 translate-x-full" : "animate-toast-in"}
      `}
    >
      <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-100">{t.title}</p>
        {t.message && <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{t.message}</p>}
      </div>
      <button
        onClick={() => onDismiss(t.id)}
        className="shrink-0 text-ink-500 hover:text-ink-200 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]);
  }, []);

  const success = useCallback((title: string, message?: string) => toast({ type: "success", title, message }), [toast]);
  const error   = useCallback((title: string, message?: string) => toast({ type: "error", title, message }), [toast]);
  const warning = useCallback((title: string, message?: string) => toast({ type: "warning", title, message }), [toast]);
  const info    = useCallback((title: string, message?: string) => toast({ type: "info", title, message }), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
