/**
 * Admin API client
 */

const API_BASE = import.meta.env.VITE_API_BASE || "";

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || "";

async function fetchAdmin<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": ADMIN_TOKEN,
      "X-Admin-Auth": "1", // Debug auth для прототипа
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data;
}

// ============ Users ============

export type AdminUser = {
  id: string;
  tg_id: number | null;
  username: string | null;
  created_at: string;
  last_seen_at: string | null;
  avatar_status?: string;
  astria_model_id?: string;
  last_trained_at?: string | null;
};

export async function getUsers(): Promise<AdminUser[]> {
  const data = await fetchAdmin<{ users: AdminUser[] }>("/api/admin/users");
  return data.users || [];
}

export async function deleteUser(userId: string): Promise<void> {
  await fetchAdmin(`/api/admin/users/${userId}`, { method: "DELETE" });
}

// ============ Orders ============

export type AdminOrder = {
  id: string;
  plan_id: "standard" | "pro";
  amount_rub: number;
  status: "unpaid" | "paid" | "refunded" | "chargeback";
  created_at: string;
  paid_at?: string | null;
  username?: string | null;
  tg_id?: number | null;
  partner_public_id?: string | null;
  attribution_kind?: string | null;
};

export async function getOrders(): Promise<AdminOrder[]> {
  const data = await fetchAdmin<{ orders: AdminOrder[] }>("/api/admin/orders");
  return data.orders || [];
}

export async function updateOrderStatus(orderId: string, status: AdminOrder["status"]): Promise<void> {
  await fetchAdmin(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ============ Partners ============

export type AdminPartner = {
  id: string;
  public_id: string;
  status: "active" | "blocked";
  client_code: string;
  team_code: string;
  parent_partner_id?: string | null;
  username?: string | null;
  tg_id?: number | null;
  created_at: string;
  available_rub: number;
  locked_rub: number;
  paid_out_rub: number;
};

export async function getPartners(): Promise<AdminPartner[]> {
  const data = await fetchAdmin<{ partners: AdminPartner[] }>("/api/admin/partners");
  return data.partners || [];
}

export async function blockPartner(publicId: string, blocked: boolean): Promise<void> {
  await fetchAdmin(`/api/admin/partners/${publicId}/block`, {
    method: "POST",
    body: JSON.stringify({ blocked }),
  });
}

export async function adjustPartnerBalance(publicId: string, deltaRub: number, reason: string): Promise<void> {
  await fetchAdmin(`/api/admin/partners/${publicId}/adjust-balance`, {
    method: "POST",
    body: JSON.stringify({ deltaRub, reason }),
  });
}

// ============ Withdrawals ============

export type AdminWithdrawal = {
  id: string;
  partner_id: string;
  partner_username?: string;
  amount_rub: number;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  reviewed_at?: string | null;
  note?: string | null;
};

export async function getWithdrawals(): Promise<AdminWithdrawal[]> {
  const data = await fetchAdmin<{ withdrawals: AdminWithdrawal[] }>("/api/admin/withdrawals");
  return data.withdrawals || [];
}

export async function approveWithdrawal(withdrawalId: string): Promise<void> {
  await fetchAdmin(`/api/admin/withdrawals/${withdrawalId}/approve`, { method: "POST" });
}

export async function rejectWithdrawal(withdrawalId: string, note?: string): Promise<void> {
  await fetchAdmin(`/api/admin/withdrawals/${withdrawalId}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

// ============ Config ============

export type AdminConfig = {
  planPricesRub: { standard: number; pro: number };
  planMeta: {
    standard: { title: string; badge?: string };
    pro: { title: string; badge?: string };
  };
  commissionsPct: { directClient: number; teamL1: number; teamL2: number };
  payout: { minWithdrawRub: number; slaText: string };
};

export async function getAdminConfig(): Promise<AdminConfig> {
  const data = await fetchAdmin<{ config: AdminConfig }>("/api/admin/config");
  return data.config;
}

export async function updateAdminConfig(patch: Partial<AdminConfig>): Promise<AdminConfig> {
  const data = await fetchAdmin<{ config: AdminConfig }>("/api/admin/config", {
    method: "PUT",
    body: JSON.stringify({ patch }),
  });
  return data.config;
}

// ============ Style Packs ============

export type AdminPack = {
  id: number;
  slug: string;
  title: string;
  description: string;
  status: "active" | "hidden";
  preview_urls: string[];
  estimated_images: number;
  pack_object_id?: string | null;
  prompts_per_class?: number | null;
  costs_per_class: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export async function getPacks(): Promise<AdminPack[]> {
  const data = await fetchAdmin<{ packs: AdminPack[] }>("/api/admin/packs");
  return data.packs || [];
}

export async function createPack(pack: Partial<AdminPack>): Promise<void> {
  await fetchAdmin("/api/admin/packs", {
    method: "POST",
    body: JSON.stringify(pack),
  });
}

export async function updatePack(packId: number, patch: Partial<AdminPack>): Promise<void> {
  await fetchAdmin(`/api/admin/packs/${packId}`, {
    method: "PATCH",
    body: JSON.stringify({ patch }),
  });
}

// ============ Promos ============

export type AdminPromo = {
  id: string;
  title: string;
  caption: string;
  kind: "text" | "photo" | "video";
  status: "active" | "hidden";
  cover_url?: string | null;
  media_urls: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export async function getPromos(): Promise<AdminPromo[]> {
  const data = await fetchAdmin<{ promos: AdminPromo[] }>("/api/admin/promos");
  return data.promos || [];
}

export async function createPromo(promo: Partial<AdminPromo>): Promise<void> {
  await fetchAdmin("/api/admin/promos", {
    method: "POST",
    body: JSON.stringify(promo),
  });
}

export async function updatePromo(promoId: string, patch: Partial<AdminPromo>): Promise<void> {
  await fetchAdmin(`/api/admin/promos/${promoId}`, {
    method: "PATCH",
    body: JSON.stringify({ patch }),
  });
}

export async function deletePromo(promoId: string): Promise<void> {
  await fetchAdmin(`/api/admin/promos/${promoId}`, { method: "DELETE" });
}

// ============ Sessions ============

export type AdminSession = {
  id: string;
  mode: "pack" | "custom";
  pack_id?: number | null;
  title?: string | null;
  status: "queued" | "generating" | "done" | "failed" | "canceled";
  created_at: string;
  updated_at: string;
  username?: string | null;
  tg_id?: number | null;
  order_id?: string | null;
};

export async function getSessions(): Promise<AdminSession[]> {
  const data = await fetchAdmin<{ sessions: AdminSession[] }>("/api/admin/sessions");
  return data.sessions || [];
}
