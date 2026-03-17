import * as React from "react";
import { cn } from "../../lib/cn";

const gradients = [
  "from-neonBlue/35 via-neonViolet/25 to-neonPink/20",
  "from-neonViolet/30 via-neonBlue/20 to-white/5",
  "from-neonPink/25 via-neonViolet/18 to-neonBlue/20",
];

export function SmartImage({
  src,
  alt,
  className,
  fallbackSeed = 0,
  fit = "cover",
  frame = true,
  loading = "lazy",
}: {
  src?: string;
  alt: string;
  className?: string;
  fallbackSeed?: number;
  fit?: "cover" | "contain";
  frame?: boolean;
  loading?: "lazy" | "eager";
}) {
  const [broken, setBroken] = React.useState(false);
  const gradient = gradients[Math.abs(fallbackSeed) % gradients.length];

  if (!src || broken) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-stroke bg-gradient-to-br",
          gradient,
          className,
        )}
      >
        <div className="absolute inset-0 bg-sheen opacity-80" />
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-white/8 blur-2xl" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        frame ? "rounded-2xl border border-stroke" : "border-0 rounded-none",
        // Ensure there's always something visible while the image is loading.
        // This avoids the "black screen" feel on slow networks.
        "bg-gradient-to-br",
        gradient,
        fit === "cover" ? "object-cover" : "object-contain",
        className,
      )}
      onError={() => setBroken(true)}
      loading={loading}
      decoding="async"
    />
  );
}
