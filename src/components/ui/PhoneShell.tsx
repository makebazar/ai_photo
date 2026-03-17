import * as React from "react";
import { cn } from "../../lib/cn";

export function PhoneShell({
  title,
  subtitle,
  right,
  children,
  hideHeader = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  hideHeader?: boolean;
}) {
  return (
    <div className="mx-auto h-[100dvh] w-full max-w-md px-0 pb-0 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-3 sm:pt-10">
      <div
        className={cn(
          "h-full",
          "rounded-none border-0 bg-graphite/60 shadow-none",
          "sm:min-h-0 sm:rounded-[28px] sm:border sm:border-stroke sm:shadow-neon sm:backdrop-blur",
        )}
      >
        <div className="flex h-full flex-col">
        {!hideHeader ? (
          <div className="flex items-start justify-between gap-3 border-b border-stroke bg-white/3 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white/90">{title}</div>
              {subtitle ? (
                <div className="mt-0.5 text-xs text-white/60">{subtitle}</div>
              ) : null}
            </div>
            {right ? <div className="pt-0.5">{right}</div> : null}
          </div>
        ) : null}
        <div
          className={cn(
            "no-scrollbar overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch]",
            hideHeader ? "h-full" : "flex-1",
          )}
        >
          {children}
        </div>
        </div>
      </div>
    </div>
  );
}
