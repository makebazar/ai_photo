// Astria API types (subset) to keep frontend/back-end contract explicit.
// Note: In production the Astria token must live on the backend only.
//
// Sources (docs): "Packs", "Pack object", "Create a tune from a pack", "Create a prompt".

export type AstriaId = number | string;

export type AstriaPackListItem = {
  id: number;
  slug: string;
  title?: string;
  name?: string;
  cover_image_url?: string | null;
  description?: string | null;
  num_images?: number | null;
  // Packs can contain class-based prompt sets (e.g. "person", "product", etc.)
  prompts_per_class?: Record<string, AstriaPackPrompt[]> | null;
  costs_per_class?: Record<string, number> | null;
};

export type AstriaPackPrompt = {
  id: number;
  text?: string | null;
  negative_prompt?: string | null;
  // Often includes a preview image.
  image_url?: string | null;
};

export type AstriaTune = {
  id: number;
  name?: string | null;
  status?: "queued" | "training" | "ready" | "failed" | string;
  token?: string | null;
  created_at?: string;
};

export type AstriaPrompt = {
  id: number;
  tune_id: number;
  status?: "queued" | "processing" | "ready" | "failed" | string;
  num_images?: number;
  images?: Array<{ id: number; url: string }>;
};

export type AstriaCreateTuneRequest = {
  // Usually: "images" is an array of urls or uploaded assets (backend responsibility).
  // We keep it abstract in the prototype.
  images: unknown[];
  name?: string;
  // Other training parameters exist; keep them backend-owned.
};

export type AstriaCreateTuneFromPackRequest = {
  // When provided, Astria can create pack prompts for an existing tune without retraining.
  // This maps nicely to our product idea: train the avatar once, then generate packs later.
  tune_ids?: number[];
  // Otherwise: creating a tune from a pack may require training params + images.
  images?: unknown[];
  name?: string;
};

export type AstriaCreatePromptRequest = {
  tune_id: number;
  prompt: string;
  negative_prompt?: string;
  num_images?: number; // usually 1..8
  seed?: number;
  // A few commonly-used flags. Exact availability depends on Astria config/model.
  super_resolution?: boolean;
  inpaint_faces?: boolean;
  hires_fix?: boolean;
  aspect_ratio?: "1:1" | "2:3" | "3:2" | "9:16" | "16:9";
};

