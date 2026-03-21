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
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-graphite sm:px-3 sm:pt-10">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          "sm:rounded-[28px] sm:border sm:border-stroke sm:shadow-neon sm:backdrop-blur",
        )}
      >
        {!hideHeader ? (
          <div className="shrink-0 border-b border-stroke bg-white/3 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white/90">{title}</div>
                {subtitle ? (
                  <div className="mt-0.5 text-xs text-white/60">{subtitle}</div>
                ) : null}
              </div>
              {right ? <div className="pt-0.5">{right}</div> : null}
            </div>
          </div>
        ) : (
          <div className="shrink-0 pt-[env(safe-area-inset-top)]" />
        )}
        <div
          className={cn(
            "no-scrollbar flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
