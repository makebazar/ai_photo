/**
 * Client API - real backend integration
 */

import { getInitData, getCurrentRole } from "./tg";

const API_BASE = import.meta.env.VITE_API_BASE || "";

/**
 * Helper to get auth headers for Telegram
 */
function getAuthHeaders(includeContentType = true) {
  const initData = getInitData();
  const role = getCurrentRole();
  return {
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
    "X-Telegram-Preferred-Role": role,
  };
}

export type PlanId = string;

export type Order = {
  id: string;
  user_id: string;
  plan_id: PlanId;
  plan: PlanId;
  amount_rub: number;
  amountRub: number;
  status: "unpaid" | "paid";
  created_at: string;
  createdAt: string;
  paid_at?: string;
  paidAt?: string;
};

export type PhotoSession = {
  id: string;
  user_id: string;
  order_id?: string;
  mode: "pack" | "custom";
  pack_id?: number;
  title?: string;
  status: "queued" | "generating" | "done" | "failed" | "canceled";
  created_at: string;
  updated_at: string;
};

export type GeneratedPhoto = {
  id: string;
  session_id: string;
  url: string;
  label?: string;
  created_at: string;
};

export type StylePack = {
  id: number;
  slug: string;
  title: string;
  description: string;
  status: "active" | "hidden";
  preview_urls: string[];
  previewUrls?: string[];
  coverUrl?: string;
  estimated_images: number;
  estimatedImages?: number;
  vibe?: string;
  promptTemplates?: any[];
  costsPerClass?: Record<string, number>;
};

// ============ Orders ============

export async function createOrder(planId: PlanId, clientCode?: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/client/order`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ planId, clientCode }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.order;
}

export async function payOrder(orderId: string): Promise<{ paidAt: string }> {
  // In production, this would redirect to payment provider
  // For now, simulate payment
  const res = await fetch(`${API_BASE}/api/orders/${orderId}/mark-paid`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { paidAt: data.paidAt || new Date().toISOString() };
}

export type ClientProfile = {
  user: {
    id: string;
    tgId: number;
    username: string | null;
    tokensBalance: number;
    avatarAccessExpiresAt?: string | null;
    astriaStatus?: string;
  };
  partner: any | null;
  attribution: any | null;
  role: string;
};

export async function getProfile(): Promise<ClientProfile> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data;
}

// ============ Avatar / Training ============

export async function startAvatarTraining(photoUrls: string[], clientCode?: string): Promise<{
  userId: string;
  jobId: string;
}> {
  const res = await fetch(`${API_BASE}/api/client/avatar/start`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ photoUrls, clientCode }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data;
}

export async function getAvatarStatus(): Promise<{
  status: "none" | "training" | "ready" | "failed";
  astriaModelId?: string;
  lastTrainedAt?: string;
}> {
  const res = await fetch(`${API_BASE}/api/client/avatar`, {
    headers: getAuthHeaders(false),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.avatar;
}

// ============ Style Packs ============

export async function listPacks(): Promise<StylePack[]> {
  const res = await fetch(`${API_BASE}/api/packs`, {
    headers: getAuthHeaders(false),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.packs || [];
}

// ============ Photosessions ============

export async function createPhotosession(params: {
  plan: PlanId;
  styleId: string;
  prompt?: string;
  negative?: string;
  count?: number;
  aspectRatio?: string;
  enhance?: boolean;
}): Promise<PhotoSession> {
  const res = await fetch(`${API_BASE}/api/client/photosession`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.session;
}

export async function getPhotosession(sessionId: string): Promise<PhotoSession & { photos: GeneratedPhoto[] }> {
  const res = await fetch(`${API_BASE}/api/client/photosession/${sessionId}`, {
    headers: getAuthHeaders(false),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.session;
}

export async function listPhotosessions(): Promise<PhotoSession[]> {
  const res = await fetch(`${API_BASE}/api/client/photosessions`, {
    headers: getAuthHeaders(false),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.sessions || [];
}

// ============ Public Config ============

export async function getPublicConfig(): Promise<{
  planPricesRub: { standard: number; pro: number };
  planMeta: {
    standard: { title: string; badge?: string };
    pro: { title: string; badge?: string };
  };
  commissionsPct: { partner: number; parent: number };
  payout: { minWithdrawRub: number; slaText: string };
  packs: StylePack[];
  promos: any[];
}> {
  const res = await fetch(`${API_BASE}/api/config`, {
    headers: getAuthHeaders(false),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.config;
}
