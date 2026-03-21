import * as React from "react";
import { readLocalStorage, writeLocalStorage } from "./storage";

const LS_KEY = "ai_photo_public_config_v1";
const EVENT_NAME = "ai_photo_public_config_changed";

export type PublicPlan = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  priceRub: number;
  tokens: number;
  featured?: boolean;
  badge?: string;
  grantsPartner: boolean;
  grantsFreeAvatar?: boolean;
};

export type PublicGenerationModel = {
  id: string;
  title: string;
  costPerPhoto: number;
  isDefault?: boolean;
};

export type PublicConfig = {
  updatedAt: number;
  plans: PublicPlan[];
  commissionsPct: {
    directClient: number;
    teamL1: number;
    teamL2: number;
  };
  payout: {
    minWithdrawRub: number;
    slaText: string;
  };
  costs: {
    avatarTokens: number;
    models?: PublicGenerationModel[];
  };
  packs: any[];
  promos: any[];
};

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  updatedAt: 0,
  plans: [
    {
      id: "standard",
      slug: "standard",
      title: "Стандарт",
      tagline: "Быстро, красиво и натурально.",
      priceRub: 499,
      tokens: 499,
      grantsPartner: false,
    },
    {
      id: "pro",
      slug: "pro",
      title: "PRO",
      tagline: "Максимум деталей и “киношный” свет.",
      priceRub: 899,
      tokens: 899,
      grantsPartner: true,
      badge: "Хит",
      featured: true,
    },
  ],
  commissionsPct: {
    directClient: 30,
    teamL1: 10,
    teamL2: 5,
  },
  payout: {
    minWithdrawRub: 500,
    slaText: "Обычно 1–6 часов (анти‑фрод)",
  },
  costs: {
    avatarTokens: 250,
    models: [
      { id: "sdxl", title: "SDXL", costPerPhoto: 1, isDefault: true },
      { id: "flux", title: "Flux (Pro)", costPerPhoto: 3 },
      { id: "ultra", title: "Ultra Realism", costPerPhoto: 5 },
    ],
  },
  packs: [],
  promos: [],
};

let cached: { updatedAt: number; cfg: PublicConfig } | null = null;

export function loadPublicConfig(): PublicConfig {
  const persisted = readLocalStorage<Partial<PublicConfig> | null>(LS_KEY, null);
  if (!persisted) return DEFAULT_PUBLIC_CONFIG;

  const updatedAt = typeof (persisted as any).updatedAt === "number" ? (persisted as any).updatedAt : 0;
  if (cached && cached.updatedAt === updatedAt) return cached.cfg;

  const cfg: PublicConfig = {
    ...DEFAULT_PUBLIC_CONFIG,
    ...persisted,
    updatedAt,
    plans: Array.isArray((persisted as any).plans) ? (persisted as any).plans : DEFAULT_PUBLIC_CONFIG.plans,
    commissionsPct: (persisted as any).commissionsPct
      ? { ...DEFAULT_PUBLIC_CONFIG.commissionsPct, ...(persisted as any).commissionsPct }
      : DEFAULT_PUBLIC_CONFIG.commissionsPct,
    payout: (persisted as any).payout
      ? { ...DEFAULT_PUBLIC_CONFIG.payout, ...(persisted as any).payout }
      : DEFAULT_PUBLIC_CONFIG.payout,
    costs: (persisted as any).costs
      ? { ...DEFAULT_PUBLIC_CONFIG.costs, ...(persisted as any).costs }
      : DEFAULT_PUBLIC_CONFIG.costs,
    packs: Array.isArray((persisted as any).packs) ? ((persisted as any).packs as any) : DEFAULT_PUBLIC_CONFIG.packs,
    promos: Array.isArray((persisted as any).promos) ? ((persisted as any).promos as any) : DEFAULT_PUBLIC_CONFIG.promos,
  };

  cached = { updatedAt, cfg };
  return cfg;
}

export function savePublicConfig(cfg: PublicConfig) {
  writeLocalStorage(LS_KEY, { ...cfg, updatedAt: Date.now() });
  cached = null;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT_NAME));
}

/**
 * Load config from server API
 */
export async function fetchPublicConfig(): Promise<PublicConfig> {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const cfg: PublicConfig = {
    ...DEFAULT_PUBLIC_CONFIG,
    ...data.config,
    updatedAt: Date.now(),
    plans: Array.isArray(data.config.plans) ? data.config.plans : DEFAULT_PUBLIC_CONFIG.plans,
  };
  
  savePublicConfig(cfg);
  return cfg;
}

export function usePublicConfig() {
  const subscribe = React.useCallback((cb: () => void) => {
    const onEvent = () => cb();
    window.addEventListener(EVENT_NAME, onEvent);
    window.addEventListener("storage", onEvent);
    return () => {
      window.removeEventListener(EVENT_NAME, onEvent);
      window.removeEventListener("storage", onEvent);
    };
  }, []);

  const getSnapshot = React.useCallback(() => loadPublicConfig(), []);

  return React.useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PUBLIC_CONFIG);
}
