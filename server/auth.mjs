import { getTelegramUserOrThrow, validateInitData } from "./tgAuth.mjs";
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

function pickStartParam(req) {
  const h = req.headers["x-telegram-start-param"];
  if (h) {
    try {
      return decodeURIComponent(String(h));
    } catch {
      return String(h);
    }
  }
  const q = req.query?.startParam;
  if (q) return String(q);
  const b = req.body?.startParam;
  if (b) return String(b);
  return null;
}

function pickPreferredRole(req) {
  const h = req.headers["x-telegram-preferred-role"];
  if (h) return String(h);
  return null;
}

/**
 * Determine which bot token to use based on start_param or route
 */
function getBotTokenForRole(startParam, preferredRole) {
  const role = preferredRole || getRoleFromStartParam(startParam);
  if (role === "partner") {
    return process.env.TELEGRAM_PARTNER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  }
  return process.env.TELEGRAM_BOT_TOKEN;
}

/**
 * Determine role from start_param or preferred role
 */
function getRoleFromStartParam(startParam, preferredRole) {
  if (preferredRole === "partner" || preferredRole === "admin") return preferredRole;
  if (!startParam) return "client";
  if (startParam.startsWith("partner_") || startParam.startsWith("pt_") || startParam.startsWith("team_")) {
    return "partner";
  }
  return "client";
}

export function requireTelegramAuth(req, opts = {}) {
  const { requireRole } = opts;
  const initData = pickInitData(req);
  const startParam = pickStartParam(req);
  const preferredRole = pickPreferredRole(req);

  // Логирование для отладки
  console.log("[Telegram Auth] Request data:", {
    hasInitData: !!initData,
    initDataLength: initData?.length,
    initDataPreview: initData?.slice(0, 100) + "...",
    startParam,
    preferredRole,
    headers: {
      "x-telegram-init-data": req.headers["x-telegram-init-data"] ? "present" : "missing",
      "x-telegram-start-param": req.headers["x-telegram-start-param"] ? "present" : "missing",
      "x-telegram-preferred-role": req.headers["x-telegram-preferred-role"] || "missing",
    },
    // ...
  });

  if (initData) {
    // Determine which bot token to use
    let botToken = getBotTokenForRole(startParam, preferredRole);
    if (!botToken) {
      console.error("[Telegram Auth] Bot token is not configured");
      throw httpError(500, "Telegram bot token is not configured");
    }

    let result = validateInitData(initData, botToken, { maxAgeSeconds: 24 * 60 * 60 });
    
    // If validation failed and we didn't have an explicit preferredRole, try the other token
    if ((!result || !result.user) && !preferredRole) {
      const otherToken = botToken === process.env.TELEGRAM_BOT_TOKEN 
        ? process.env.TELEGRAM_PARTNER_BOT_TOKEN 
        : process.env.TELEGRAM_BOT_TOKEN;
      
      if (otherToken && otherToken !== botToken) {
        console.log("[Telegram Auth] Initial validation failed, trying alternative token...");
        result = validateInitData(initData, otherToken, { maxAgeSeconds: 24 * 60 * 60 });
        if (result && result.user) {
          botToken = otherToken;
          console.log("[Telegram Auth] Alternative token validation success");
        }
      }
    }

    if (!result || !result.user || !result.user.id) {
      console.error("[Telegram Auth] Invalid initData validation result");
      throw httpError(401, "Invalid Telegram initData");
    }

    // Prioritize start_param from initData (it's signed by Telegram)
    const effectiveStartParam = result.data?.start_param || startParam;

    const role = getRoleFromStartParam(effectiveStartParam, preferredRole);

    // If specific role is required, validate it
    if (requireRole && role !== requireRole) {
      throw httpError(403, `Access denied: ${role} cannot access ${requireRole} resources`);
    }

    console.log("[Telegram Auth] Success:", {
      userId: result.user.id,
      username: result.user.username,
      role,
      startParam: effectiveStartParam,
      preferredRole,
    });

    return {
      kind: "telegram",
      user: result.user,
      role,
      startParam: effectiveStartParam,
      preferredRole
    };
  }

  // Dev fallback: allow passing tgId without initData for local testing.
  if (isDev() && process.env.ALLOW_DEBUG_AUTH !== "0") {
    const tgId = Number(req.body?.tgId ?? req.query?.tgId);
    if (Number.isFinite(tgId)) {
      const username = req.body?.username ? String(req.body.username) : null;
      const role = requireRole || preferredRole || getRoleFromStartParam(startParam) || "client";
      console.log("[Telegram Auth] Debug auth:", { tgId, username, role });
      return { kind: "debug", user: { id: tgId, username }, role, startParam, preferredRole };
    }
  }

  console.error("[Telegram Auth] No auth data provided");
  throw httpError(401, "Auth required (Telegram initData)");
}

/**
 * Lightweight auth that returns user info without throwing
 * Returns null if not authenticated
 */
export function getTelegramUser(req) {
  try {
    const result = requireTelegramAuth(req);
    return result;
  } catch {
    return null;
  }
}

