export type AdminPlan = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  priceRub: number;
  tokens: number;
  featured?: boolean;
  badge?: string;
  grantsPartner: boolean;
};

export type GenerationModelConfig = {
  id: string;
  title: string;
  costPerPhoto: number;
  isDefault?: boolean;
};

export type AdminConfig = {
  plans: AdminPlan[];
  commissionsPct: { partner: number; parent: number };
  mlm?: {
    holdDays: number;
    ownerPartnerId?: string | null;
  };
  payout: { minWithdrawRub: number; slaText: string };
  costs: { 
    avatarTokens: number; 
    models?: GenerationModelConfig[];
  };
  astria?: {
    tuneBaseId: number;
    modelType: string;
    trainPreset?: string;
    className: string;
    tokenPrefix: string;
    tuneCallbackUrl?: string;
    promptCallbackUrl?: string;
    promptTimeoutMs: number;
    promptPollMs: number;
  };
  astriaCostsRub?: { standard: number; pro: number; monthlyApi: number };
};

export type UserModelRow = {
  userId: string;
  username: string;
  telegramId: number;
  plan: "Стандарт" | "PRO";
  createdAt: number;
  lastSeenAt: number;
  modelStatus: "none" | "training" | "ready" | "failed";
  astriaModelId?: string;
  lastTrainedAt?: number | null;
  isPartner?: boolean;
  tokensBalance: number;
  sessions: string[];
  spentRub: number;
  ordersCount: number;
};

export type AdminOrderRow = {
  orderId: string;
  userId: string;
  username: string;
  planId: "standard" | "pro";
  packId: number;
  packTitle: string;
  amountRub: number;
  status: "Не оплачен" | "Оплачен" | "Возврат" | "Проблема";
  createdAt: number;
  paidAt?: number;
  updatedAt?: number;
  partnerPublicId?: string;
  attributionKind?: string;
  commissionChain?: Array<{
    username: string;
    level: number;
    amount: number;
    percent: number;
  }>;
  imagesPlanned: number;

  flags: string[];
};

export type AdminPartner = {
  partnerId: string;
  userId: string;
  username: string;
  telegramId: number;
  status: "active" | "blocked";
  clientCode: string;
  teamCode: string;
  parentPartnerId: string;
  parentUsername?: string;
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
    earningsRub: number;
    turnoverRub?: number;
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
  status: "Ожидает" | "Одобрено" | "Отклонено" | "Выплачено";
  createdAt: number;
  reviewedAt?: number;
  clients: number;
  paid: number;
  risk: string[];
  signals: string[];
};

export type AdminPackRow = {
  packId: number;
  slug: string;
  title: string;
  description: string;
  status: "active" | "hidden";
  previewUrls: string[];
  estimatedImages: number;
  packObjectId?: string;
  promptsPerClass: number;
  costsPerClass: Record<string, number>;
  astriaPackHint: Record<string, any>;
  createdAt: number;
  updatedAt: number;
};

export type AdminPromoRow = {
  promoId: string;
  title: string;
  caption: string;
  kind: "text" | "photo" | "video";
  status: "active" | "hidden";
  coverUrl?: string;
  mediaUrls: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type AuditEvent = {
  id: string;
  at: number;
  actor: string;
  action: string;
  meta?: Record<string, any>;
};

export type AdminNav =
  | "overview"
  | "withdrawals"
  | "orders"
  | "packs"
  | "promos"
  | "partners"
  | "users"
  | "settings"
  | "debug"
  | "audit";

export type AdminState = {
  nav: AdminNav;
  config: AdminConfig;
  turnoverRub: number;
  partners: AdminPartner[];
  withdrawals: WithdrawalRow[];
  users: UserModelRow[];
  orders: AdminOrderRow[];
  packs: AdminPackRow[];
  promos: AdminPromoRow[];
  sessions: any[];
  audit: AuditEvent[];
};

export function formatRub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function computeFinance(state: Pick<AdminState, "turnoverRub" | "config" | "partners" | "withdrawals">) {
  const api = state.config.astriaCostsRub?.monthlyApi ?? 0;
  const debtPartners = state.partners.reduce((sum, p) => sum + p.balances.availableRub, 0);
  const pending = state.withdrawals
    .filter((w) => w.status === "Ожидает")
    .reduce((sum, w) => sum + w.amountRub, 0);
  const profit = state.turnoverRub - api - debtPartners;
  return {
    turnoverRub: state.turnoverRub,
    apiRub: api,
    debtRub: debtPartners,
    pendingRub: pending,
    profitRub: profit,
  };
}

export function makeAudit(action: AuditEvent["action"], meta: Record<string, unknown>): AuditEvent {
  return {
    id: `ev_${Math.random().toString(16).slice(2)}_${Date.now()}`,
    at: Date.now(),
    actor: "owner",
    action,
    meta,
  };
}
