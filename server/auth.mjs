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
  if (h) return String(h);
  const q = req.query?.startParam;
  if (q) return String(q);
  const b = req.body?.startParam;
  if (b) return String(b);
  return null;
}

/**
 * Determine which bot token to use based on start_param or route
 * - partner_/team_/pt_ → TELEGRAM_PARTNER_BOT_TOKEN
 * - client_/cl_ or default → TELEGRAM_BOT_TOKEN
 */
function getBotTokenForRole(startParam) {
  if (startParam && (startParam.startsWith("partner_") || startParam.startsWith("pt_") || startParam.startsWith("team_"))) {
    return process.env.TELEGRAM_PARTNER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  }
  return process.env.TELEGRAM_BOT_TOKEN;
}

/**
 * Determine role from start_param
 */
function getRoleFromStartParam(startParam) {
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
  
  if (initData) {
    // Determine which bot token to use
    const botToken = getBotTokenForRole(startParam);
    if (!botToken) {
      throw httpError(500, "Telegram bot token is not configured");
    }
    
    const result = validateInitData(initData, botToken, { maxAgeSeconds: 24 * 60 * 60 });
    if (!result || !result.user || !result.user.id) {
      throw httpError(401, "Invalid Telegram initData");
    }
    
    const role = getRoleFromStartParam(startParam);
    
    // If specific role is required, validate it
    if (requireRole && role !== requireRole) {
      throw httpError(403, `Access denied: ${role} cannot access ${requireRole} resources`);
    }
    
    return { 
      kind: "telegram", 
      user: result.user,
      role,
      startParam 
    };
  }

  // Dev fallback: allow passing tgId without initData for local testing.
  if (isDev() && process.env.ALLOW_DEBUG_AUTH !== "0") {
    const tgId = Number(req.body?.tgId ?? req.query?.tgId);
    if (Number.isFinite(tgId)) {
      const username = req.body?.username ? String(req.body.username) : null;
      const role = requireRole || getRoleFromStartParam(startParam) || "client";
      return { kind: "debug", user: { id: tgId, username }, role, startParam };
    }
  }

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

