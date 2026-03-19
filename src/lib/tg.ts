/**
 * Telegram WebApp integration utilities
 */

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type TelegramInitData = {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: {
    id: number;
    type: "group" | "supergroup" | "channel";
    username?: string;
    title?: string;
  };
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date?: number;
  hash?: string;
};

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: TelegramInitData;
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  isVerticalSwipesEnabled: boolean;
  BackButton: { isVisible: boolean; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void; show: () => void; hide: () => void };
  MainButton: { isVisible: boolean; text: string; color: string; text_color: string; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void; show: () => void; hide: () => void; showProgress: (show: boolean) => void; hideProgress: () => void; enable: () => void; disable: () => void };
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  switchInlineQuery: (query: string, chooseChatTypes?: Array<"users" | "bots" | "groups" | "channels">) => void;
  shareUrl: (url: string, text?: string) => void;
  copyText: (text: string) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  enableVerticalSwipes: () => void;
  disableVerticalSwipes: () => void;
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
  sendData: (data: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

/**
 * Check if running inside Telegram WebApp
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp;
}

/**
 * Get Telegram WebApp instance
 */
export function getWebApp(): TelegramWebApp | null {
  if (!isTelegramWebApp()) return null;
  return window.Telegram!.WebApp;
}

/**
 * Get initDataUnsafe (parsed Telegram init data)
 * Contains user info, start_param, etc.
 */
export function getInitDataUnsafe(): TelegramInitData | null {
  const tg = getWebApp();
  if (!tg) return null;
  return tg.initDataUnsafe || null;
}

/**
 * Get raw initData string for server-side validation
 */
export function getInitData(): string | null {
  const tg = getWebApp();
  if (!tg) return null;
  return tg.initData || null;
}

/**
 * Get Telegram user from init data
 */
export function getTelegramUser(): TelegramUser | null {
  const data = getInitDataUnsafe();
  return data?.user || null;
}

/**
 * Get start_param from Telegram (used for referral/role routing)
 * When user opens bot via t.me/bot?start=CODE, this returns CODE
 */
export function getStartParam(): string | null {
  const data = getInitDataUnsafe();
  return data?.start_param || null;
}

/**
 * Determine role based on start_param
 * - start_param starts with "client_" or is a client referral code → client
 * - start_param starts with "partner_" or is a team referral code → partner
 * - No start_param → use last role from localStorage or default to client
 */
export function getRoleFromStartParam(): "client" | "partner" | null {
  const startParam = getStartParam();
  if (!startParam) return null;

  // Explicit role prefixes
  if (startParam.startsWith("client_") || startParam.startsWith("cl_")) {
    return "client";
  }
  if (startParam.startsWith("partner_") || startParam.startsWith("pt_") || startParam.startsWith("team_")) {
    return "partner";
  }

  // Referral code detection (base64-like codes from database)
  // Client codes and team codes have different formats
  // For now, default to client if it looks like a referral code
  if (/^[a-zA-Z0-9_-]+$/.test(startParam)) {
    // Could be either client or team code - will be resolved on server
    // Default to client for unknown codes
    return "client";
  }

  return null;
}

/**
 * Initialize Telegram WebApp
 */
export function initTelegramWebApp() {
  const tg = getWebApp();
  if (!tg) return;

  tg.ready();
  tg.expand();

  // Set colors to match app theme
  tg.setHeaderColor("#0a0a0a");
  tg.setBackgroundColor("#0a0a0a");

  // Enable gestures
  tg.enableVerticalSwipes();
}

/**
 * Close Telegram WebApp
 */
export function closeWebApp() {
  const tg = getWebApp();
  if (tg) {
    tg.close();
  }
}

/**
 * Open external link
 */
export function openLink(url: string) {
  const tg = getWebApp();
  if (tg) {
    tg.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

/**
 * Copy text to clipboard via Telegram
 */
export function copyText(text: string) {
  const tg = getWebApp();
  if (tg) {
    tg.copyText(text);
  } else {
    navigator.clipboard.writeText(text);
  }
}

/**
 * Send data back to Telegram bot (via answerWebAppQuery)
 */
export function sendData(data: unknown) {
  const tg = getWebApp();
  if (tg) {
    tg.sendData(typeof data === "string" ? data : JSON.stringify(data));
  }
}
