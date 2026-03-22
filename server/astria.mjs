const ASTRIA_BASE_URL = process.env.ASTRIA_BASE_URL || "https://api.astria.ai";
const ASTRIA_API_KEY = process.env.ASTRIA_API_KEY || "";
const ASTRIA_TUNE_BASE_ID = Number(process.env.ASTRIA_TUNE_BASE_ID || 1504944);
const ASTRIA_MODEL_TYPE = process.env.ASTRIA_MODEL_TYPE || "lora";
const ASTRIA_TRAIN_PRESET = process.env.ASTRIA_TRAIN_PRESET || "";

export function resolveAstriaOptions(input = {}) {
  return {
    tuneBaseId:
      input.tuneBaseId != null && Number.isFinite(Number(input.tuneBaseId))
        ? Number(input.tuneBaseId)
        : ASTRIA_TUNE_BASE_ID,
    modelType: input.modelType != null ? String(input.modelType) : ASTRIA_MODEL_TYPE,
    trainPreset: input.trainPreset != null ? String(input.trainPreset) : ASTRIA_TRAIN_PRESET,
  };
}

function authHeaders(extra = {}) {
  if (!ASTRIA_API_KEY) throw new Error("ASTRIA_API_KEY is required");
  return { Authorization: `Bearer ${ASTRIA_API_KEY}`, ...extra };
}

export function isAstriaEnabled() {
  return Boolean(ASTRIA_API_KEY);
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function astriaFetch(pathname, options = {}) {
  const url = `${ASTRIA_BASE_URL}${pathname}`;
  const res = await fetch(url, options);
  const body = await parseBody(res);
  if (!res.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Astria ${res.status} ${pathname}: ${detail}`);
  }
  return body;
}

function parseDataUrl(input) {
  const m = String(input).match(/^data:(.+?);base64,(.+)$/);
  if (!m) return null;
  const mimeType = m[1];
  const base64 = m[2];
  const buffer = Buffer.from(base64, "base64");
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  return { mimeType, buffer, ext };
}

export async function createTuneFromImages({ title, name, token, images, callback, tuneBaseId, modelType, trainPreset }) {
  if (!Array.isArray(images) || images.length < 4) throw new Error("At least 4 images required");
  const opts = resolveAstriaOptions({ tuneBaseId, modelType, trainPreset });

  const dataUrls = images.map((x) => parseDataUrl(x)).filter(Boolean);
  const useMultipart = dataUrls.length > 0;

  if (useMultipart) {
    const form = new FormData();
    form.append("tune[title]", String(title));
    form.append("tune[name]", String(name || "person"));
    form.append("tune[token]", String(token || "ohwx"));
    if (Number.isFinite(opts.tuneBaseId)) form.append("tune[base_tune_id]", String(opts.tuneBaseId));
    if (opts.modelType) form.append("tune[model_type]", String(opts.modelType));
    if (opts.trainPreset) form.append("tune[preset]", String(opts.trainPreset));
    if (callback) form.append("tune[callback]", String(callback));

    let idx = 0;
    for (const img of images) {
      const parsed = parseDataUrl(img);
      if (!parsed) continue;
      const blob = new Blob([parsed.buffer], { type: parsed.mimeType });
      form.append("tune[images][]", blob, `train_${idx}.${parsed.ext}`);
      idx += 1;
    }
    if (idx < 4) throw new Error("Need at least 4 base64 images for multipart tune create");

    return await astriaFetch("/tunes", {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
  }

  return await astriaFetch("/tunes", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      tune: {
        title: String(title),
        name: String(name || "person"),
        token: String(token || "ohwx"),
        base_tune_id: Number.isFinite(opts.tuneBaseId) ? opts.tuneBaseId : undefined,
        model_type: opts.modelType || undefined,
        preset: opts.trainPreset || undefined,
        image_urls: images.map((x) => String(x)),
        callback: callback ? String(callback) : undefined,
      },
    }),
  });
}

export async function getTune(tuneId) {
  return await astriaFetch(`/tunes/${encodeURIComponent(String(tuneId))}`, {
    headers: authHeaders(),
  });
}

export async function getTuneStatus(tuneId) {
  try {
    const tune = await getTune(tuneId);
    const s = String(tune?.status || "").toLowerCase();
    if (s.includes("fail") || s.includes("error")) return { status: "failed", tune };
    if (tune?.trained_at || s === "ready" || s === "done" || s === "completed") return { status: "ready", tune };
    return { status: "training", tune };
  } catch (err) {
    if (String(err?.message || "").includes("Astria 404")) return { status: "deleted", tune: null };
    throw err;
  }
}

export async function createPrompt({ tuneId, text, negativePrompt, numImages, callback, cfgScale, steps, aspectRatio, superResolution, faceCorrect }) {
  const form = new FormData();
  form.append("prompt[text]", String(text));
  if (negativePrompt) form.append("prompt[negative_prompt]", String(negativePrompt));
  if (numImages != null) form.append("prompt[num_images]", String(Math.max(1, Math.min(8, Number(numImages)))));
  if (callback) form.append("prompt[callback]", String(callback));
  if (cfgScale != null) form.append("prompt[cfg_scale]", String(cfgScale));
  if (steps != null) form.append("prompt[steps]", String(steps));
  if (aspectRatio) form.append("prompt[ar]", String(aspectRatio));
  if (superResolution != null) form.append("prompt[super_resolution]", String(Boolean(superResolution)));
  if (faceCorrect != null) form.append("prompt[face_correct]", String(Boolean(faceCorrect)));

  return await astriaFetch(`/tunes/${encodeURIComponent(String(tuneId))}/prompts`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
}

export async function getPrompt(promptId) {
  return await astriaFetch(`/prompts/${encodeURIComponent(String(promptId))}`, {
    headers: authHeaders(),
  });
}

export function extractPromptImages(prompt) {
  const out = [];
  const fromArray = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (!item) continue;
      if (typeof item === "string") out.push(item);
      if (typeof item === "object" && typeof item.url === "string") out.push(item.url);
    }
  };

  fromArray(prompt?.images);
  fromArray(prompt?.outputs);
  fromArray(prompt?.results);
  if (Array.isArray(prompt?.generations)) {
    for (const g of prompt.generations) {
      if (g?.url) out.push(g.url);
      fromArray(g?.images);
    }
  }
  return [...new Set(out.filter(Boolean))];
}

export async function waitForPrompt(promptId, { timeoutMs = 8 * 60 * 1000, pollMs = 5000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const prompt = await getPrompt(promptId);
    const status = String(prompt?.status || "").toLowerCase();
    if (status.includes("fail") || status.includes("error")) return { status: "failed", prompt, images: [] };
    const images = extractPromptImages(prompt);
    if (images.length > 0 || status === "completed" || status === "done" || status === "ready") {
      return { status: "ready", prompt, images };
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { status: "timeout", prompt: null, images: [] };
}
