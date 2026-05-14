import { useEffect, useState, createContext, useContext, useCallback } from "react";
import type { ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const variantStyles: Record<ToastVariant, string> = {
    success: "bg-lime/10 border-lime/30 text-lime",
    error: "bg-coral/10 border-coral/30 text-coral",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    info: "bg-lavender/10 border-lavender/30 text-lavender",
  };

  const dotStyles: Record<ToastVariant, string> = {
    success: "bg-lime",
    error: "bg-coral",
    warning: "bg-amber-400",
    info: "bg-lavender",
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-sans shadow-xl transition-all duration-300 ${variantStyles[toast.variant]} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotStyles[toast.variant]}`} />
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-50 hover:opacity-100 transition-opacity shrink-0 text-xs"
      >
        ✕
      </button>
    </div>
  );
}
