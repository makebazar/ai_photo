const DEFAULT_CONFIG = {
  plans: [
    {
      id: "standard",
      slug: "standard",
      title: "Стандарт",
      tagline: "Быстро, красиво и натурально.",
      priceRub: 499,
      tokens: 30,
      grantsPartner: false,
    },
    {
      id: "pro",
      slug: "pro",
      title: "PRO / Кинематографичный",
      tagline: "Максимум деталей и “киношный” свет.",
      priceRub: 899,
      tokens: 100,
      featured: true,
      badge: "Хит",
      grantsPartner: true,
    },
  ],
  commissionsPct: { partner: 20, parent: 10 },
    mlm: { holdDays: 14 },
  payout: { minWithdrawRub: 500, slaText: "Обычно 1–6 часов (анти‑фрод)" },
  costs: {
    avatarTokens: 50, // Cost to unlock avatar training/access
    models: [
      { id: "sdxl", title: "SDXL", costPerPhoto: 1, isDefault: true },
      { id: "flux", title: "Flux (Pro)", costPerPhoto: 3 },
      { id: "ultra", title: "Ultra Realism", costPerPhoto: 5 },
    ],
  },
};

export function getDefaultConfig() {
  return DEFAULT_CONFIG;
}

export async function ensureConfigRow(db) {
  await db.query(
    "insert into app_config (id, config) values (1, $1::jsonb) on conflict (id) do nothing",
    [JSON.stringify(DEFAULT_CONFIG)],
  );
}

export async function readConfig(db) {
  const { rows } = await db.query("select config from app_config where id = 1");
  const cfg = rows?.[0]?.config;
  if (!cfg) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    plans: Array.isArray(cfg.plans) ? cfg.plans : DEFAULT_CONFIG.plans,
    commissionsPct: { ...DEFAULT_CONFIG.commissionsPct, ...(cfg.commissionsPct ?? {}) },
    payout: { ...DEFAULT_CONFIG.payout, ...(cfg.payout ?? {}) },
  };
}

