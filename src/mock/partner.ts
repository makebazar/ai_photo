export const partnerStats = {
  partnerId: "p_8472",
  balanceRub: 3500,
  clicks: 142,
  signups: 38,
  paid: 20,
  // Two different referral flows:
  // - clientLink: brings paying clients to the photosession flow
  // - teamLink: recruits partners (downline) for MLM
  clientReferralLink: "t.me/bot?start=client_8472",
  teamReferralLink: "t.me/bot?start=team_8472",
};

export const planPricesRub = {
  standard: 499,
  pro: 899,
} as const;

// Commission policy (prototype defaults). Keep it centralized so UI + future backend stay consistent.
export const partnerPayoutPolicy = {
  clientDirectPct: 30, // You invited a paying client
  teamLevel1Pct: 10, // Partner you invited (L1)
  teamLevel2Pct: 5, // Partner of your partner (L2)
  minWithdrawRub: 500,
  moderationEta: "1–6 часов",
  note:
    "Начисления считаются после успешной оплаты. При возвратах/фроде выплаты могут быть отменены.",
} as const;

export type PartnerClient = {
  id: string;
  telegramUsername: string;
  joinedAt: number;
  lastActivityAt: number;
  status: "registered" | "paid";
  plan?: "standard" | "pro";
  ordersCount: number;
  revenueRub: number;
  yourEarningsRub: number;
  level: 1 | 2;
};

export type PartnerNode = {
  id: string;
  telegramUsername: string;
  joinedAt: number;
  level: 1 | 2;
  referrals: {
    clicks: number;
    signups: number;
    paid: number;
  };
  turnoverRub: number;
  yourEarningsRub: number;
};

export type PromoItem = {
  id: string;
  title: string;
  caption: string;
  kind: "video" | "photo" | "text";
  coverUrl?: string;
  mediaUrls?: string[];
};

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

const daysAgo = (n: number) => Date.now() - n * 24 * 60 * 60 * 1000;

export const partnerClients: PartnerClient[] = [
  {
    id: "u_10241",
    telegramUsername: "@masha.design",
    joinedAt: daysAgo(3),
    lastActivityAt: daysAgo(0),
    status: "paid",
    plan: "pro",
    ordersCount: 2,
    revenueRub: 1798,
    yourEarningsRub: 540,
    level: 1,
  },
  {
    id: "u_10211",
    telegramUsername: "@ivan.koch",
    joinedAt: daysAgo(5),
    lastActivityAt: daysAgo(2),
    status: "paid",
    plan: "standard",
    ordersCount: 1,
    revenueRub: 499,
    yourEarningsRub: 150,
    level: 1,
  },
  {
    id: "u_10177",
    telegramUsername: "@katya_m",
    joinedAt: daysAgo(7),
    lastActivityAt: daysAgo(6),
    status: "registered",
    ordersCount: 0,
    revenueRub: 0,
    yourEarningsRub: 0,
    level: 1,
  },
  {
    id: "u_10003",
    telegramUsername: "@sergey.photo",
    joinedAt: daysAgo(10),
    lastActivityAt: daysAgo(1),
    status: "paid",
    plan: "pro",
    ordersCount: 1,
    revenueRub: 899,
    yourEarningsRub: 90,
    level: 2,
  },
  {
    id: "u_10010",
    telegramUsername: "@ann___k",
    joinedAt: daysAgo(12),
    lastActivityAt: daysAgo(4),
    status: "paid",
    plan: "standard",
    ordersCount: 1,
    revenueRub: 499,
    yourEarningsRub: 50,
    level: 2,
  },
];

export const partnerDownline: PartnerNode[] = [
  {
    id: "p_4001",
    telegramUsername: "@promo.nikita",
    joinedAt: daysAgo(14),
    level: 1,
    referrals: { clicks: 61, signups: 12, paid: 6 },
    turnoverRub: 5394,
    yourEarningsRub: 540,
  },
  {
    id: "p_4020",
    telegramUsername: "@arina.traffic",
    joinedAt: daysAgo(20),
    level: 1,
    referrals: { clicks: 42, signups: 10, paid: 4 },
    turnoverRub: 3196,
    yourEarningsRub: 320,
  },
  {
    id: "p_4500",
    telegramUsername: "@max.team",
    joinedAt: daysAgo(28),
    level: 2,
    referrals: { clicks: 19, signups: 6, paid: 2 },
    turnoverRub: 1398,
    yourEarningsRub: 70,
  },
];

export const promoItems: PromoItem[] = [
  {
    id: "p1",
    title: "Текст для Reels",
    caption:
      "Хочешь фотосессию как в кино без студии? Я сделал(а) ИИ-сет за 10 минут. Лови ссылку 👇",
    kind: "text",
  },
  {
    id: "p2",
    title: "Сторис (скрипт)",
    caption:
      "1) До/после 2) “Это не фотошоп” 3) “Нужны 15 селфи” 4) Свайп/ссылка на бота",
    kind: "text",
  },
  {
    id: "p3",
    title: "Превью видео",
    caption: "Вертикальное видео 9:16 — “Cinematic AI Photoshoot”",
    kind: "video",
    coverUrl: unsplash("photo-1520975890222-44e8c7c7f8ad"),
    mediaUrls: [
      unsplash("photo-1520975890222-44e8c7c7f8ad"),
      unsplash("photo-1520975916090-3105956dac38"),
      unsplash("photo-1520975682033-99c39b983d67"),
    ],
  },
  {
    id: "p4",
    title: "Превью поста",
    caption: "Квадрат 1:1 — “Digital twin”",
    kind: "photo",
    coverUrl: unsplash("photo-1520976070912-2d95f7b4b3c6"),
    mediaUrls: [
      unsplash("photo-1520976070912-2d95f7b4b3c6"),
      unsplash("photo-1520974735194-6c49ea3d1f5b"),
      unsplash("photo-1520975867597-0b2a283b9c1d"),
    ],
  },
];
