import type {
  AdminConfig,
  AdminOrderRow,
  AdminPackRow,
  AdminPartner,
  AdminPromoRow,
  AdminSeed,
  AuditEvent,
  UserModelRow,
  WithdrawalRow,
} from "../../mock/admin";

export type AdminNav =
  | "overview"
  | "withdrawals"
  | "orders"
  | "packs"
  | "promos"
  | "partners"
  | "users"
  | "settings"
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
  const api = state.config.astriaCostsRub.monthlyApi;
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

export function seedToState(seed: AdminSeed): AdminState {
  return {
    nav: "overview",
    config: seed.config,
    turnoverRub: seed.turnoverRub,
    partners: seed.partners,
    withdrawals: seed.withdrawals,
    users: seed.users,
    orders: seed.orders,
    packs: seed.packs,
    promos: seed.promos,
    audit: seed.audit,
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
