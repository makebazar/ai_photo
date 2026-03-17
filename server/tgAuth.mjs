import crypto from "node:crypto";

function timingSafeEqualHex(a, b) {
  const ab = Buffer.from(String(a ?? ""), "hex");
  const bb = Buffer.from(String(b ?? ""), "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function parseInitData(initData) {
  const qs = String(initData ?? "").trim();
  const params = new URLSearchParams(qs);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function validateInitData(initData, botToken, opts = {}) {
  const maxAgeSeconds = typeof opts.maxAgeSeconds === "number" ? opts.maxAgeSeconds : 24 * 60 * 60;
  const data = parseInitData(initData);
  const gotHash = data.hash;
  if (!gotHash) return null;
  delete data.hash;

  // auth_date: prevent replay (optional but recommended)
  if (data.auth_date) {
    const authDate = Number(data.auth_date);
    if (!Number.isFinite(authDate)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (maxAgeSeconds > 0 && now - authDate > maxAgeSeconds) return null;
  }

  const pairs = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`);
  const dataCheckString = pairs.join("\n");

  // Telegram WebApp: secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calcHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!timingSafeEqualHex(calcHash, gotHash)) return null;

  const user = data.user ? safeJsonParse(data.user) : null;
  return { data, user };
}

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

export function getTelegramUserOrThrow(initData) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw Object.assign(new Error("TELEGRAM_BOT_TOKEN is not configured"), { statusCode: 500 });
  const res = validateInitData(initData, token, { maxAgeSeconds: 24 * 60 * 60 });
  if (!res || !res.user || !res.user.id) throw Object.assign(new Error("Invalid Telegram initData"), { statusCode: 401 });
  return res.user;
}

