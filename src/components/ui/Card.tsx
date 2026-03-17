import * as React from "react";
import { cn } from "../../lib/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-stroke bg-gradient-to-b from-white/6 to-white/3 backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

