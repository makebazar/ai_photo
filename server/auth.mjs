import { getTelegramUserOrThrow } from "./tgAuth.mjs";
import { httpError, isDev } from "./http.mjs";

function pickInitData(req) {
  const h = req.headers["x-telegram-init-data"];
  if (h) return String(h);
  const q = req.query?.initData;
  if (q) return String(q);
  const b = req.body?.initData;
  if (b) return String(b);
  return null;
}

export function requireTelegramAuth(req) {
  const initData = pickInitData(req);
  if (initData) return { kind: "telegram", user: getTelegramUserOrThrow(initData) };

  // Dev fallback: allow passing tgId without initData for local testing.
  if (isDev() && process.env.ALLOW_DEBUG_AUTH !== "0") {
    const tgId = Number(req.body?.tgId ?? req.query?.tgId);
    if (Number.isFinite(tgId)) {
      const username = req.body?.username ? String(req.body.username) : null;
      return { kind: "debug", user: { id: tgId, username } };
    }
  }

  throw httpError(401, "Auth required (Telegram initData)");
}

