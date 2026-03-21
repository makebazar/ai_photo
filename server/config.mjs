const DEFAULT_CONFIG = {
  plans: [
    {
      id: "standard",
      slug: "standard",
      title: "Стандарт",
      tagline: "Быстро, красиво и натурально.",
      priceRub: 499,
      tokens: 30,
      photosCount: 20,
      grantsPartner: false,
    },
    {
      id: "pro",
      slug: "pro",
      title: "PRO / Кинематографичный",
      tagline: "Максимум деталей и “киношный” свет.",
      priceRub: 899,
      tokens: 100,
      photosCount: 30,
      featured: true,
      badge: "Хит",
      grantsPartner: true,
    },
  ],
  commissionsPct: { directClient: 30, teamL1: 10, teamL2: 5 },
  payout: { minWithdrawRub: 500, slaText: "Обычно 1–6 часов (анти‑фрод)" },
  costs: {
    avatarTokens: 50, // Cost to unlock avatar training/access
    photoTokens: 1,   // Cost per 1 generated photo
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

