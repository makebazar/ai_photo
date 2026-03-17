import * as React from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-stroke px-4 py-2 text-sm font-medium transition",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neonBlue/40",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" &&
          "bg-gradient-to-b from-white/10 to-white/5 hover:from-white/12 hover:to-white/6 shadow-[0_0_0_1px_rgba(56,189,248,0.10),0_0_26px_rgba(56,189,248,0.12)]",
        variant === "secondary" &&
          "bg-white/5 hover:bg-white/7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
        variant === "ghost" && "border-transparent hover:bg-white/6",
        variant === "danger" &&
          "bg-red-500/10 border-red-500/25 hover:bg-red-500/15 hover:border-red-500/35",
        className,
      )}
      {...props}
    />
  );
}

