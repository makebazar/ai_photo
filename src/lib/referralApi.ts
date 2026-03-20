/**
 * Referral Links API client
 */

import { getInitData } from "./tg";

const API_BASE = import.meta.env.VITE_API_BASE || "";

/**
 * Helper to get auth headers for Telegram
 */
function getAuthHeaders() {
  const initData = getInitData();
  return {
    "Content-Type": "application/json",
    ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
  };
}

export type ReferralLink = {
  id: string;
  kind: "client" | "team";
  code: string;
  name: string | null;
  description: string | null;
  status: "active" | "inactive" | "expired";
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  clicks: number;
  conversions: number;
  total_revenue_rub: number;
  total_earnings_rub: number;
  created_at: string;
  updated_at: string;
  url: string;
};

export type PartnerStats = {
  partner_id: string;
  public_id: number;
  user_id: string;
  parent_partner_id: string | null;
  status: string;
  direct_clients: number;
  direct_partners: number;
  level2_partners: number;
  direct_paid_orders: number;
  direct_revenue_rub: number;
  total_earnings_rub: number;
  pending_earnings_rub: number;
  available_balance_rub: number;
  last_client_order_at: string | null;
  partner_since: string;
};

export type DownlinePartner = {
  id: string;
  public_id: number;
  user_id: string;
  parent_partner_id: string | null;
  status: string;
  client_code: string;
  team_code: string;
  created_at: string;
  last_activity_at: string | null;
  username: string | null;
  tg_id: number | null;
  clients_count: number;
  revenue_rub: number;
  children?: DownlinePartner[];
};

export type ClientItem = {
  id: string;
  tg_id: number | null;
  username: string | null;
  created_at: string;
  last_seen_at: string | null;
  referred_at: string;
  orders_count: number;
  total_spent_rub: number;
};

export async function getReferralLinks(): Promise<ReferralLink[]> {
  const res = await fetch(`${API_BASE}/api/ref/links`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.links || [];
}

export async function createReferralLink(params: {
  kind: "client" | "team";
  name?: string;
  description?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  expiresAt?: string;
  maxUses?: number;
}): Promise<ReferralLink> {
  const res = await fetch(`${API_BASE}/api/ref/links`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.link;
}

export async function updateReferralLink(
  linkId: string,
  params: {
    name?: string | null;
    description?: string | null;
    status?: "active" | "inactive" | "expired";
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
  }
): Promise<ReferralLink> {
  const res = await fetch(`${API_BASE}/api/ref/links/${linkId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.link;
}

export async function deleteReferralLink(linkId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ref/links/${linkId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function getPartnerStats(): Promise<PartnerStats> {
  const res = await fetch(`${API_BASE}/api/partner/stats`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.stats;
}

export async function getDownline(): Promise<{ level1: DownlinePartner[] }> {
  const res = await fetch(`${API_BASE}/api/partner/downline`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data;
}

export async function getClients(): Promise<ClientItem[]> {
  const res = await fetch(`${API_BASE}/api/partner/clients`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.clients || [];
}

export async function trackReferralClick(params: {
  linkId?: string;
  code?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
}): Promise<{ linkId: string }> {
  const res = await fetch(`${API_BASE}/api/ref/click`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data;
}
