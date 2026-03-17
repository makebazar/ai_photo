import * as React from "react";
import { cn } from "../../lib/cn";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-stroke bg-white/6 px-2.5 py-1 text-xs font-medium text-white/90",
        className,
      )}
      {...props}
    />
  );
}

