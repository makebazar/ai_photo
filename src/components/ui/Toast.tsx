import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/cn";

type ToastVariant = "default" | "success" | "danger";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = { id, variant: "default", ...toast };
      setItems((prev) => [item, ...prev].slice(0, 4));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, 2600);
    },
    [setItems],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[60] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 space-y-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 22 }
              }
              className={cn(
                "rounded-2xl border border-stroke bg-graphite/95 px-4 py-3 shadow-neon backdrop-blur",
                t.variant === "success" &&
                  "shadow-[0_0_0_1px_rgba(56,189,248,0.18),0_0_28px_rgba(56,189,248,0.14)]",
                t.variant === "danger" &&
                  "shadow-[0_0_0_1px_rgba(239,68,68,0.18),0_0_28px_rgba(239,68,68,0.12)]",
              )}
            >
              <div className="text-sm font-semibold text-white/95">
                {t.title}
              </div>
              {t.description ? (
                <div className="mt-0.5 text-xs text-white/70">
                  {t.description}
                </div>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
