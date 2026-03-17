export type PlanId = "standard" | "pro";

export type PlanMeta = {
  title: string;
  tagline: string;
  photosCount: number;
  featured?: boolean;
  badge?: string;
};

export type AdminConfig = {
  planPricesRub: Record<PlanId, number>;
  planMeta: Record<PlanId, PlanMeta>;
  commissionsPct: {
    directClient: number; // partner -> own clients
    teamL1: number; // upline -> L1 partner turnover
    teamL2: number; // upline -> L2 partner turnover
  };
  astriaCostsRub: {
    monthlyApi: number;
  };
  payout: {
    minWithdrawRub: number;
    slaText: string;
  };
};

export type AdminOrderStatus =
  | "Оплачен"
  | "Аватар: обучение"
  | "Фотосессия: генерация"
  | "Готово"
  | "Ошибка"
  | "Возврат";

export type AdminPartner = {
  partnerId: string;
  username: string;
  status: "active" | "blocked";
  joinedAt: number;
  lastActivityAt: number;
  balances: {
    availableRub: number;
    lockedRub: number;
    paidOutRub: number;
  };
  stats: {
    clicks: number;
    signups: number;
    paid: number;
    turnoverRub: number;
    teamL1: number;
    teamL2: number;
  };
  links: {
    client: string;
    team: string;
  };
  riskFlags: string[];
};

export type WithdrawalRow = {
  requestId: string;
  partnerId: string;
  partnerUsername: string;
  amountRub: number;
  createdAt: number;
  clients: number;
  paid: number;
  risk: "low" | "med" | "high";
  signals: string[];
  status: "Ожидает" | "Одобрено" | "Отклонено";
  note?: string;
};

export type UserModelRow = {
  userId: string;
  username: string;
  plan: "Стандарт" | "PRO";
  modelStatus: "Обучена" | "В процессе" | "Нет модели";
  modelId?: string;
  lastSeenAt: number;
  createdAt: number;
  sessions: number;
  spentRub: number;
};

export type AdminOrderRow = {
  orderId: string;
  userId: string;
  username: string;
  planId: PlanId;
  amountRub: number;
  packId: number;
  packTitle: string;
  imagesPlanned: number;
  status: AdminOrderStatus;
  createdAt: number;
  updatedAt: number;
  attribution?: {
    partnerId: string;
    partnerUsername: string;
    kind: "client" | "team";
  };
  flags: string[];
};

export type AdminPackRow = {
  packId: number;
  slug: string;
  title: string;
  description: string;
  previewUrls: string[];
  estimatedImages: number;
  status: "active" | "hidden";
  createdAt: number;
  updatedAt: number;
  astriaPackHint: {
    packObjectId: string;
    promptsPerClass: number;
    costsPerClass: Record<string, number>;
  };
};

export type AdminPromoRow = {
  promoId: string;
  title: string;
  caption: string;
  kind: "text" | "photo" | "video";
  status: "active" | "hidden";
  coverUrl?: string;
  mediaUrls?: string[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
};

export type AuditEvent = {
  id: string;
  at: number;
  actor: "owner";
  action:
    | "withdrawal.approve"
    | "withdrawal.reject"
    | "partner.block"
    | "partner.unblock"
    | "partner.adjust_balance"
    | "user.delete_data"
    | "user.update_model_status"
    | "config.update"
    | "order.update_status"
    | "order.refund"
    | "pack.create"
    | "pack.update"
    | "pack.toggle"
    | "promo.create"
    | "promo.update"
    | "promo.toggle"
    | "promo.delete";
  meta: Record<string, unknown>;
};

export type AdminSeed = {
  config: AdminConfig;
  partners: AdminPartner[];
  withdrawals: WithdrawalRow[];
  users: UserModelRow[];
  orders: AdminOrderRow[];
  packs: AdminPackRow[];
  promos: AdminPromoRow[];
  audit: AuditEvent[];
  turnoverRub: number;
};

const daysAgo = (n: number) => Date.now() - n * 24 * 60 * 60 * 1000;

export const adminSeed: AdminSeed = {
  config: {
    planPricesRub: { standard: 499, pro: 899 },
    planMeta: {
      standard: {
        title: "Стандарт",
        tagline: "Быстро, красиво и натурально — для соцсетей и профиля.",
        photosCount: 20,
      },
      pro: {
        title: "PRO / Кинематографичный",
        tagline: "Максимум деталей и “киношный” свет — выглядит дороже и эффектнее.",
        photosCount: 30,
        featured: true,
        badge: "Хит",
      },
    },
    commissionsPct: { directClient: 30, teamL1: 10, teamL2: 5 },
    astriaCostsRub: { monthlyApi: 15000 },
    payout: { minWithdrawRub: 500, slaText: "Обычно 1–6 часов (анти‑фрод)" },
  },
  turnoverRub: 124500,
  partners: [
    {
      partnerId: "8472",
      username: "@promo.nikolay",
      status: "active",
      joinedAt: daysAgo(40),
      lastActivityAt: daysAgo(0),
      balances: { availableRub: 3500, lockedRub: 0, paidOutRub: 12200 },
      stats: { clicks: 142, signups: 38, paid: 20, turnoverRub: 28190, teamL1: 2, teamL2: 3 },
      links: {
        client: "t.me/bot?start=client_8472",
        team: "t.me/bot?start=team_8472",
      },
      riskFlags: [],
    },
    {
      partnerId: "5120",
      username: "@arina.traffic",
      status: "active",
      joinedAt: daysAgo(22),
      lastActivityAt: daysAgo(1),
      balances: { availableRub: 7800, lockedRub: 0, paidOutRub: 4500 },
      stats: { clicks: 610, signups: 124, paid: 45, turnoverRub: 56110, teamL1: 0, teamL2: 0 },
      links: {
        client: "t.me/bot?start=client_5120",
        team: "t.me/bot?start=team_5120",
      },
      riskFlags: ["Резкий рост оплат за 24ч"],
    },
    {
      partnerId: "0391",
      username: "@max.team",
      status: "active",
      joinedAt: daysAgo(12),
      lastActivityAt: daysAgo(3),
      balances: { availableRub: 1450, lockedRub: 0, paidOutRub: 0 },
      stats: { clicks: 88, signups: 19, paid: 7, turnoverRub: 10200, teamL1: 1, teamL2: 0 },
      links: {
        client: "t.me/bot?start=client_0391",
        team: "t.me/bot?start=team_0391",
      },
      riskFlags: ["Много регистраций без оплат"],
    },
  ],
  withdrawals: [
    {
      requestId: "wd_1001",
      partnerId: "8472",
      partnerUsername: "@promo.nikolay",
      amountRub: 2200,
      createdAt: daysAgo(0) - 60 * 60 * 1000,
      clients: 6,
      paid: 4,
      risk: "low",
      signals: ["Устройство стабильно", "Нет возвратов 30 дней"],
      status: "Ожидает",
    },
    {
      requestId: "wd_1002",
      partnerId: "5120",
      partnerUsername: "@arina.traffic",
      amountRub: 7800,
      createdAt: daysAgo(0) - 3 * 60 * 60 * 1000,
      clients: 18,
      paid: 12,
      risk: "med",
      signals: ["Резкий рост оплат", "Новые источники трафика"],
      status: "Ожидает",
    },
    {
      requestId: "wd_1003",
      partnerId: "0391",
      partnerUsername: "@max.team",
      amountRub: 1450,
      createdAt: daysAgo(1),
      clients: 3,
      paid: 2,
      risk: "high",
      signals: ["Много мультиаккаунтов", "IP/устройства совпадают"],
      status: "Ожидает",
    },
  ],
  users: [
    {
      userId: "10021",
      username: "@maria",
      plan: "PRO",
      modelStatus: "Обучена",
      modelId: "astria_model_aa12",
      createdAt: daysAgo(10),
      lastSeenAt: daysAgo(0),
      sessions: 3,
      spentRub: 2697,
    },
    {
      userId: "10055",
      username: "@danil",
      plan: "Стандарт",
      modelStatus: "В процессе",
      modelId: "astria_model_bb02",
      createdAt: daysAgo(3),
      lastSeenAt: daysAgo(1),
      sessions: 0,
      spentRub: 499,
    },
    {
      userId: "10103",
      username: "@kate",
      plan: "PRO",
      modelStatus: "В процессе",
      modelId: "astria_model_cc09",
      createdAt: daysAgo(1),
      lastSeenAt: daysAgo(0),
      sessions: 0,
      spentRub: 899,
    },
    {
      userId: "10144",
      username: "@alex",
      plan: "Стандарт",
      modelStatus: "Нет модели",
      createdAt: daysAgo(20),
      lastSeenAt: daysAgo(4),
      sessions: 1,
      spentRub: 499,
    },
  ],
  orders: [
    {
      orderId: "ord_7011",
      userId: "10021",
      username: "@maria",
      planId: "pro",
      amountRub: 899,
      packId: 260,
      packTitle: "Corporate Headshots",
      imagesPlanned: 30,
      status: "Готово",
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2) + 25 * 60 * 1000,
      attribution: { partnerId: "8472", partnerUsername: "@promo.nikolay", kind: "client" },
      flags: [],
    },
    {
      orderId: "ord_7012",
      userId: "10055",
      username: "@danil",
      planId: "standard",
      amountRub: 499,
      packId: 9993,
      packTitle: "Film Noir",
      imagesPlanned: 20,
      status: "Аватар: обучение",
      createdAt: daysAgo(0) - 6 * 60 * 60 * 1000,
      updatedAt: daysAgo(0) - 5 * 60 * 60 * 1000,
      attribution: { partnerId: "5120", partnerUsername: "@arina.traffic", kind: "client" },
      flags: ["Долгое обучение > 60 мин"],
    },
    {
      orderId: "ord_7013",
      userId: "10103",
      username: "@kate",
      planId: "pro",
      amountRub: 899,
      packId: 9991,
      packTitle: "Cinematic Neon",
      imagesPlanned: 30,
      status: "Фотосессия: генерация",
      createdAt: daysAgo(0) - 80 * 60 * 1000,
      updatedAt: daysAgo(0) - 10 * 60 * 1000,
      flags: ["Высокая нагрузка"],
    },
    {
      orderId: "ord_7014",
      userId: "10144",
      username: "@alex",
      planId: "standard",
      amountRub: 499,
      packId: 9992,
      packTitle: "Neutral Muse",
      imagesPlanned: 20,
      status: "Ошибка",
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9) + 12 * 60 * 1000,
      flags: ["Сбой генерации", "Нужен ретрай"],
    },
  ],
  packs: [
    {
      packId: 260,
      slug: "corporate-headshots",
      title: "Corporate Headshots",
      description: "Деловая фотосессия: чистый свет, аккуратный кадр, уверенный образ.",
      previewUrls: [
        "https://sdbooth2-production.s3.amazonaws.com/2bcwnrw4tlwbk8nao4yy8lx1s9h3",
        "https://sdbooth2-production.s3.amazonaws.com/5c5m4j1x1a2j5r5u1dg7wzj3kq8p",
        "https://sdbooth2-production.s3.amazonaws.com/3bpnm5d0v1n2w4k2p4c3y2m1x4z9",
      ],
      estimatedImages: 28,
      status: "active",
      createdAt: daysAgo(31),
      updatedAt: daysAgo(4),
      astriaPackHint: {
        packObjectId: "pack_260",
        promptsPerClass: 28,
        costsPerClass: { person: 1 },
      },
    },
    {
      packId: 9991,
      slug: "cinematic-neon",
      title: "Cinematic Neon",
      description: "Ночной неон и киношный свет: атмосферно, контрастно, как кадр из фильма.",
      previewUrls: [
        "https://sdbooth2-production.s3.amazonaws.com/mqqy8pkso90o8nab2g9j78mxkdsz",
        "https://sdbooth2-production.s3.amazonaws.com/pg6yksj8n6j8z8e7p4k1y3b2a9v0",
        "https://sdbooth2-production.s3.amazonaws.com/jh9xk2q7m1d8n6v4t3c1b8a2p5z0",
      ],
      estimatedImages: 30,
      status: "active",
      createdAt: daysAgo(24),
      updatedAt: daysAgo(2),
      astriaPackHint: {
        packObjectId: "pack_9991",
        promptsPerClass: 30,
        costsPerClass: { person: 1 },
      },
    },
    {
      packId: 9992,
      slug: "neutral-muse",
      title: "Neutral Muse",
      description: "Редакционный минимализм: мягкий свет, спокойные тона, модный журнал.",
      previewUrls: [
        "https://sdbooth2-production.s3.amazonaws.com/xgsoxkb3sh27ypt9ils82dbn5yf7",
        "https://sdbooth2-production.s3.amazonaws.com/uz0v1x2c3b4n5m6a7s8d9f0g1h2j",
        "https://sdbooth2-production.s3.amazonaws.com/ab1c2d3e4f5g6h7i8j9k0l1m2n3o",
      ],
      estimatedImages: 40,
      status: "hidden",
      createdAt: daysAgo(18),
      updatedAt: daysAgo(11),
      astriaPackHint: {
        packObjectId: "pack_9992",
        promptsPerClass: 40,
        costsPerClass: { person: 1 },
      },
    },
    {
      packId: 9993,
      slug: "film-noir",
      title: "Film Noir",
      description: "Черно‑белая драма: контраст, тени, характер и настроение.",
      previewUrls: [
        "https://sdbooth2-production.s3.amazonaws.com/xmcfwg94lozsd4ysyeotx12p7ugm",
        "https://sdbooth2-production.s3.amazonaws.com/zz1yy2xx3ww4vv5uu6tt7ss8rr9q",
        "https://sdbooth2-production.s3.amazonaws.com/qq1ww2ee3rr4tt5yy6uu7ii8oo9p",
      ],
      estimatedImages: 24,
      status: "active",
      createdAt: daysAgo(12),
      updatedAt: daysAgo(1),
      astriaPackHint: {
        packObjectId: "pack_9993",
        promptsPerClass: 24,
        costsPerClass: { person: 1 },
      },
    },
  ],
  promos: [
    {
      promoId: "promo_1001",
      title: "Текст для Reels",
      caption:
        "Хочешь фотосессию как в кино без студии? Я сделал(а) ИИ‑сет и получил(а) готовые фото уже сегодня. Лови ссылку 👇",
      kind: "text",
      status: "active",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(6),
      tags: ["instagram", "reels", "text"],
    },
    {
      promoId: "promo_1002",
      title: "Сторис (скрипт)",
      caption:
        "1) До/после 2) “Это не фотошоп” 3) “Нужны селфи” 4) “Выбираешь стиль” 5) “Получаешь фотосессию” 6) Свайп/ссылка",
      kind: "text",
      status: "active",
      createdAt: daysAgo(18),
      updatedAt: daysAgo(4),
      tags: ["stories", "script"],
    },
    {
      promoId: "promo_2001",
      title: "Видео‑превью (9:16)",
      caption: "Вертикальное превью под TikTok/Shorts.",
      kind: "video",
      status: "active",
      coverUrl: "https://images.unsplash.com/photo-1520975890222-44e8c7c7f8ad?auto=format&fit=crop&w=1200&q=80",
      mediaUrls: [
        "https://images.unsplash.com/photo-1520975890222-44e8c7c7f8ad?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1520975682033-99c39b983d67?auto=format&fit=crop&w=1200&q=80",
      ],
      createdAt: daysAgo(15),
      updatedAt: daysAgo(2),
      tags: ["tiktok", "shorts", "video"],
    },
    {
      promoId: "promo_2002",
      title: "Фото‑карусель (1:1)",
      caption: "Под пост/карусель в Instagram.",
      kind: "photo",
      status: "hidden",
      coverUrl: "https://images.unsplash.com/photo-1520976070912-2d95f7b4b3c6?auto=format&fit=crop&w=1200&q=80",
      mediaUrls: [
        "https://images.unsplash.com/photo-1520976070912-2d95f7b4b3c6?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1520974735194-6c49ea3d1f5b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1520975867597-0b2a283b9c1d?auto=format&fit=crop&w=1200&q=80",
      ],
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
      tags: ["instagram", "carousel", "photo"],
    },
  ],
  audit: [
    {
      id: "ev_1",
      at: daysAgo(1),
      actor: "owner",
      action: "config.update",
      meta: { field: "commissionsPct.directClient", value: 30 },
    },
  ],
};
