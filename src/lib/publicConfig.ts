import * as React from "react";
import { adminSeed } from "../mock/admin";
import { readLocalStorage, writeLocalStorage } from "./storage";

const LS_KEY = "ai_photo_public_config_v1";
const EVENT_NAME = "ai_photo_public_config_changed";

export type PublicConfig = {
  updatedAt: number;
  planPricesRub: {
    standard: number;
    pro: number;
  };
  planMeta: typeof adminSeed.config.planMeta;
  commissionsPct: {
    directClient: number;
    teamL1: number;
    teamL2: number;
  };
  payout: {
    minWithdrawRub: number;
    slaText: string;
  };
  packs: typeof adminSeed.packs;
  promos: typeof adminSeed.promos;
};

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  updatedAt: 0,
  planPricesRub: adminSeed.config.planPricesRub,
  planMeta: adminSeed.config.planMeta,
  commissionsPct: adminSeed.config.commissionsPct,
  payout: adminSeed.config.payout,
  packs: adminSeed.packs,
  promos: adminSeed.promos,
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
    planPricesRub: (persisted as any).planPricesRub
      ? { ...DEFAULT_PUBLIC_CONFIG.planPricesRub, ...(persisted as any).planPricesRub }
      : DEFAULT_PUBLIC_CONFIG.planPricesRub,
    planMeta: (persisted as any).planMeta
      ? { ...DEFAULT_PUBLIC_CONFIG.planMeta, ...(persisted as any).planMeta }
      : DEFAULT_PUBLIC_CONFIG.planMeta,
    commissionsPct: (persisted as any).commissionsPct
      ? { ...DEFAULT_PUBLIC_CONFIG.commissionsPct, ...(persisted as any).commissionsPct }
      : DEFAULT_PUBLIC_CONFIG.commissionsPct,
    payout: (persisted as any).payout
      ? { ...DEFAULT_PUBLIC_CONFIG.payout, ...(persisted as any).payout }
      : DEFAULT_PUBLIC_CONFIG.payout,
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
