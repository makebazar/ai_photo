import { cn } from "../../lib/cn";

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full border border-stroke bg-white/5", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-neonBlue/80 via-neonViolet/70 to-neonPink/60 transition-[width] duration-300",
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

