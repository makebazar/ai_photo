import * as React from "react";
import { savePublicConfig } from "../../lib/publicConfig";
import { readLocalStorage, writeLocalStorage } from "../../lib/storage";
import { makeAudit, type AdminState } from "./adminModel";

const LS_KEY = "ai_photo_admin_state_v2";
const LS_LAST_FETCH_KEY = "ai_photo_admin_last_fetch_v1";

// Default empty state (no mock data)
function createEmptyState(): AdminState {
  return {
    nav: "overview",
    users: [],
    orders: [],
    partners: [],
    withdrawals: [],
    packs: [],
    promos: [],
    sessions: [],
    config: {
      plans: [
        {
          id: "standard",
          slug: "standard",
          title: "Standard",
          tagline: "Standard plan",
          priceRub: 2990,
          tokens: 30,
          grantsPartner: false,
        },
        {
          id: "pro",
          slug: "pro",
          title: "PRO",
          tagline: "Pro plan",
          priceRub: 4990,
          tokens: 100,
          grantsPartner: true,
          badge: "Выбор профи",
        },
      ],
      commissionsPct: { directClient: 40, teamL1: 10, teamL2: 5 },
      payout: { minWithdrawRub: 5000, slaText: "1-3 рабочих дня" },
      costs: { avatarTokens: 50, photoTokens: 1 },
      astriaCostsRub: { standard: 100, pro: 200, monthlyApi: 5000 },
    },
    turnoverRub: 0,
    audit: [],
  };
}

export type AdminAction =
  | { type: "nav"; nav: AdminState["nav"] }
  | { type: "load_data"; data: Partial<AdminState> }
  | { type: "withdrawal_status"; requestId: string; status: "Одобрено" | "Отклонено"; note?: string }
  | { type: "partner_block"; partnerId: string; blocked: boolean }
  | { type: "partner_adjust_balance"; partnerId: string; deltaRub: number; reason: string }
  | { type: "user_delete"; userId: string }
  | { type: "user_model_status"; userId: string; status: AdminState["users"][number]["modelStatus"] }
  | { type: "config_update"; patch: Partial<AdminState["config"]> }
  | { type: "turnover_set"; turnoverRub: number }
  | { type: "order_status"; orderId: string; status: AdminState["orders"][number]["status"]; note?: string }
  | { type: "order_refund"; orderId: string; reason: string }
  | { type: "pack_create"; pack: AdminState["packs"][number] }
  | { type: "pack_update"; packId: number; patch: Partial<AdminState["packs"][number]> }
  | { type: "pack_toggle"; packId: number; status: AdminState["packs"][number]["status"] }
  | { type: "promo_create"; promo: AdminState["promos"][number] }
  | { type: "promo_update"; promoId: string; patch: Partial<AdminState["promos"][number]> }
  | { type: "promo_toggle"; promoId: string; status: AdminState["promos"][number]["status"] }
  | { type: "promo_delete"; promoId: string }
  | { type: "reset_seed" };

export function loadAdminState(): AdminState {
  const persisted = readLocalStorage<Partial<AdminState> | null>(LS_KEY, null);
  const base = createEmptyState();
  if (!persisted) return base;
  return {
    ...base,
    ...persisted,
    partners: Array.isArray((persisted as any).partners) ? (persisted as any).partners : base.partners,
    withdrawals: Array.isArray((persisted as any).withdrawals) ? (persisted as any).withdrawals : base.withdrawals,
    users: Array.isArray((persisted as any).users) ? (persisted as any).users : base.users,
    orders: Array.isArray((persisted as any).orders) ? (persisted as any).orders : base.orders,
    packs: Array.isArray((persisted as any).packs) ? (persisted as any).packs : base.packs,
    promos: Array.isArray((persisted as any).promos) ? (persisted as any).promos : base.promos,
    audit: Array.isArray((persisted as any).audit) ? (persisted as any).audit : base.audit,
    config: (persisted as any).config ? { ...base.config, ...(persisted as any).config } : base.config,
    turnoverRub: typeof (persisted as any).turnoverRub === "number" ? (persisted as any).turnoverRub : base.turnoverRub,
    nav: (persisted as any).nav ?? "overview",
  };
}

export function persistAdminState(state: AdminState) {
  writeLocalStorage(LS_KEY, {
    nav: state.nav,
    config: state.config,
    turnoverRub: state.turnoverRub,
    partners: state.partners,
    withdrawals: state.withdrawals,
    users: state.users,
    orders: state.orders,
    packs: state.packs,
    promos: state.promos,
    audit: state.audit.slice(0, 200),
  });
}

export function adminReducer(state: AdminState, action: AdminAction): AdminState {
  switch (action.type) {
    case "nav":
      return { ...state, nav: action.nav };

    case "load_data":
      return { ...state, ...action.data };

    case "withdrawal_status": {
      const w = state.withdrawals.find((x) => x.requestId === action.requestId);
      if (!w || w.status !== "Ожидает") return state;

      let nextPartners = state.partners;
      if (action.status === "Одобрено") {
        nextPartners = state.partners.map((p) => {
          if (p.partnerId !== w.partnerId) return p;
          const available = p.balances.availableRub;
          const amount = Math.min(available, w.amountRub);
          return {
            ...p,
            balances: {
              ...p.balances,
              availableRub: Math.max(0, available - amount),
              paidOutRub: p.balances.paidOutRub + amount,
            },
          };
        });
      }

      return {
        ...state,
        partners: nextPartners,
        withdrawals: state.withdrawals.map((x) =>
          x.requestId === action.requestId ? { ...x, status: action.status, note: action.note } : x,
        ),
        audit: [
          makeAudit(action.status === "Одобрено" ? "withdrawal.approve" : "withdrawal.reject", {
            requestId: action.requestId,
            partnerId: w.partnerId,
            amountRub: w.amountRub,
            note: action.note,
          }),
          ...state.audit,
        ],
      };
    }

    case "partner_block": {
      const exists = state.partners.some((p) => p.partnerId === action.partnerId);
      if (!exists) return state;
      return {
        ...state,
        partners: state.partners.map((p) =>
          p.partnerId === action.partnerId ? { ...p, status: action.blocked ? "blocked" : "active" } : p,
        ),
        audit: [
          makeAudit(action.blocked ? "partner.block" : "partner.unblock", {
            partnerId: action.partnerId,
          }),
          ...state.audit,
        ],
      };
    }

    case "partner_adjust_balance": {
      const exists = state.partners.some((p) => p.partnerId === action.partnerId);
      if (!exists) return state;
      return {
        ...state,
        partners: state.partners.map((p) =>
          p.partnerId === action.partnerId
            ? {
                ...p,
                balances: { ...p.balances, availableRub: Math.max(0, p.balances.availableRub + action.deltaRub) },
              }
            : p,
        ),
        audit: [
          makeAudit("partner.adjust_balance", {
            partnerId: action.partnerId,
            deltaRub: action.deltaRub,
            reason: action.reason,
          }),
          ...state.audit,
        ],
      };
    }

    case "user_delete": {
      const u = state.users.find((x) => x.userId === action.userId);
      if (!u) return state;
      return {
        ...state,
        users: state.users.filter((x) => x.userId !== action.userId),
        audit: [
          makeAudit("user.delete_data", {
            userId: action.userId,
            username: u.username,
          }),
          ...state.audit,
        ],
      };
    }

    case "user_model_status": {
      const u = state.users.find((x) => x.userId === action.userId);
      if (!u) return state;
      return {
        ...state,
        users: state.users.map((x) =>
          x.userId === action.userId ? { ...x, modelStatus: action.status } : x,
        ),
        audit: [
          makeAudit("user.update_model_status", {
            userId: action.userId,
            from: u.modelStatus,
            to: action.status,
          }),
          ...state.audit,
        ],
      };
    }

    case "config_update": {
      return {
        ...state,
        config: { ...state.config, ...action.patch },
        audit: [
          makeAudit("config.update", { patch: action.patch }),
          ...state.audit,
        ],
      };
    }

    case "turnover_set": {
      const next = Math.max(0, Math.round(action.turnoverRub || 0));
      return {
        ...state,
        turnoverRub: next,
        audit: [makeAudit("config.update", { patch: { turnoverRub: next } }), ...state.audit],
      };
    }

    case "order_status": {
      const o = state.orders.find((x) => x.orderId === action.orderId);
      if (!o) return state;
      return {
        ...state,
        orders: state.orders.map((x) =>
          x.orderId === action.orderId ? { ...x, status: action.status, updatedAt: Date.now() } : x,
        ),
        audit: [
          makeAudit("order.update_status", {
            orderId: action.orderId,
            from: o.status,
            to: action.status,
            note: action.note,
          }),
          ...state.audit,
        ],
      };
    }

    case "order_refund": {
      const o = state.orders.find((x) => x.orderId === action.orderId);
      if (!o) return state;
      return {
        ...state,
        orders: state.orders.map((x) =>
          x.orderId === action.orderId ? { ...x, status: "Возврат", updatedAt: Date.now(), flags: [...x.flags, "Возврат"] } : x,
        ),
        audit: [
          makeAudit("order.refund", {
            orderId: action.orderId,
            reason: action.reason,
          }),
          ...state.audit,
        ],
      };
    }

    case "pack_create": {
      return {
        ...state,
        packs: [action.pack, ...state.packs],
        audit: [makeAudit("pack.create", { packId: action.pack.packId, slug: action.pack.slug }), ...state.audit],
      };
    }

    case "pack_update": {
      const exists = state.packs.some((p) => p.packId === action.packId);
      if (!exists) return state;
      return {
        ...state,
        packs: state.packs.map((p) =>
          p.packId === action.packId ? { ...p, ...action.patch, updatedAt: Date.now() } : p,
        ),
        audit: [
          makeAudit("pack.update", { packId: action.packId, patch: action.patch }),
          ...state.audit,
        ],
      };
    }

    case "pack_toggle": {
      const exists = state.packs.some((p) => p.packId === action.packId);
      if (!exists) return state;
      return {
        ...state,
        packs: state.packs.map((p) =>
          p.packId === action.packId ? { ...p, status: action.status, updatedAt: Date.now() } : p,
        ),
        audit: [
          makeAudit("pack.toggle", { packId: action.packId, status: action.status }),
          ...state.audit,
        ],
      };
    }

    case "promo_create": {
      return {
        ...state,
        promos: [action.promo, ...state.promos],
        audit: [makeAudit("promo.create", { promoId: action.promo.promoId }), ...state.audit],
      };
    }

    case "promo_update": {
      const exists = state.promos.some((p) => p.promoId === action.promoId);
      if (!exists) return state;
      return {
        ...state,
        promos: state.promos.map((p) =>
          p.promoId === action.promoId ? { ...p, ...action.patch, updatedAt: Date.now() } : p,
        ),
        audit: [
          makeAudit("promo.update", { promoId: action.promoId, patch: action.patch }),
          ...state.audit,
        ],
      };
    }

    case "promo_toggle": {
      const exists = state.promos.some((p) => p.promoId === action.promoId);
      if (!exists) return state;
      return {
        ...state,
        promos: state.promos.map((p) =>
          p.promoId === action.promoId ? { ...p, status: action.status, updatedAt: Date.now() } : p,
        ),
        audit: [
          makeAudit("promo.toggle", { promoId: action.promoId, status: action.status }),
          ...state.audit,
        ],
      };
    }

    case "promo_delete": {
      const exists = state.promos.some((p) => p.promoId === action.promoId);
      if (!exists) return state;
      return {
        ...state,
        promos: state.promos.filter((p) => p.promoId !== action.promoId),
        audit: [makeAudit("promo.delete", { promoId: action.promoId }), ...state.audit],
      };
    }

    case "reset_seed":
      return createEmptyState();

    default:
      return state;
  }
}

export function useAdminStore() {
  const [state, dispatch] = React.useReducer(adminReducer, undefined, loadAdminState);

  React.useEffect(() => {
    persistAdminState(state);
    savePublicConfig({
      updatedAt: Date.now(),
      plans: state.config.plans,
      commissionsPct: state.config.commissionsPct,
      payout: state.config.payout,
      costs: state.config.costs,
      packs: state.packs,
      promos: state.promos,
    });
  }, [state]);

  return { state, dispatch };
}
