import type { PlanId } from "./clientFlow";
import type { MockPhoto } from "../../mock/photos";
import { generatedPhotos } from "../../mock/photos";
import { mockPacks, type StylePack } from "../../mock/packs";
import { loadPublicConfig } from "../../lib/publicConfig";

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export async function apiCreateOrder(plan: PlanId): Promise<Order> {
  await sleep(350);
  const cfg = loadPublicConfig();
  const amountRub = plan === "pro" ? cfg.planPricesRub.pro : cfg.planPricesRub.standard;
  return {
    id: makeId("ord"),
    plan,
    amountRub,
    status: "unpaid",
    createdAt: Date.now(),
  };
}

// In real life:
// - Telegram Payments: openInvoice / invoice link
// - Or redirect to provider (Stripe/YooKassa/etc.)
export async function apiPayOrder(orderId: string): Promise<{ paidAt: number }> {
  void orderId;
  await sleep(650);
  return { paidAt: Date.now() };
}

// Astria integration should be backend-only (token is secret).
// Here we simulate astria model creation + training job.
export async function apiStartAstriaTraining(): Promise<{ astriaModelId: string; jobId: string }> {
  await sleep(500);
  return { astriaModelId: makeId("astria_model"), jobId: makeId("job") };
}

export async function apiGetTrainingProgress(jobId: string): Promise<{ progress: number; etaMinutes: number }> {
  void jobId;
  await sleep(250);
  // the caller drives progress; this endpoint is here to show future shape
  return { progress: 0, etaMinutes: 10 };
}

export async function apiListPacks(): Promise<StylePack[]> {
  await sleep(250);
  const cfg = loadPublicConfig();
  const packs = (cfg.packs ?? [])
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.packId,
      slug: p.slug,
      title: p.title,
      description: p.description,
      previewUrls: p.previewUrls,
      estimatedImages: p.estimatedImages,
      vibe: "Готовый стиль",
      promptTemplates: [],
      costsPerClass: p.astriaPackHint.costsPerClass,
    }));

  return packs.length ? packs : mockPacks;
}

export async function apiGeneratePhotosFromPack(
  plan: PlanId,
  packId: string,
  opts?: { enhance?: boolean },
): Promise<MockPhoto[]> {
  await sleep(450);
  const cfg = loadPublicConfig();
  const count = cfg.planMeta?.[plan]?.photosCount ?? (plan === "pro" ? 30 : 20);
  void opts;
  return generatedPhotos.slice(0, count).map((p, idx) => ({
    ...p,
    id: `${packId}_${p.id}_${idx}`,
    label: `${p.label}`,
  }));
}

export async function apiGeneratePhotosCustom(args: {
  plan: PlanId;
  prompt: string;
  negative?: string;
  count: number;
  aspectRatio?: string;
  enhance?: boolean;
  cfgScale?: number;
  steps?: number;
  faceFix?: boolean;
}): Promise<MockPhoto[]> {
  await sleep(650);
  const cfg = loadPublicConfig();
  const max = cfg.planMeta?.[args.plan]?.photosCount ?? (args.plan === "pro" ? 30 : 20);
  const count = Math.max(1, Math.min(max, args.count));
  const tag = args.prompt.trim().slice(0, 24) || "custom";
  void args.negative;
  void args.aspectRatio;
  void args.enhance;
  void args.cfgScale;
  void args.steps;
  void args.faceFix;
  return generatedPhotos.slice(0, count).map((p, idx) => ({
    ...p,
    id: `custom_${idx}_${Date.now()}`,
    label: `${p.label} • ${tag}`,
  }));
}

type Order = {
  id: string;
  plan: PlanId;
  amountRub: number;
  status: "unpaid" | "paid";
  createdAt: number;
  paidAt?: number;
};
