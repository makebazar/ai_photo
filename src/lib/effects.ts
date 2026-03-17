import { readLocalStorage, writeLocalStorage } from "./storage";

export type EffectsMode = "full" | "lite";

const LS_KEY = "ai_photo_effects_mode_v1";

export function getInitialEffectsMode(): EffectsMode {
  const saved = readLocalStorage<EffectsMode | null>(LS_KEY, null);
  if (saved === "full" || saved === "lite") return saved;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hardwareConcurrency = typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined;
  const deviceMemory = typeof navigator !== "undefined" ? (navigator as any).deviceMemory : undefined;

  // Heuristic: on lower-end devices default to "lite" to reduce blur/shadows.
  if (prefersReducedMotion) return "lite";
  if (typeof deviceMemory === "number" && deviceMemory <= 4) return "lite";
  if (typeof hardwareConcurrency === "number" && hardwareConcurrency <= 4) return "lite";
  return "full";
}

export function persistEffectsMode(mode: EffectsMode) {
  writeLocalStorage(LS_KEY, mode);
}

