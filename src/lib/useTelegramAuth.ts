/**
 * Telegram Auth hook for client-side authentication
 */
import * as React from "react";
import { getInitData, getStartParam, isTelegramWebApp } from "./tg";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export type AuthUser = {
  id: number;
  tgId: number;
  username: string | null;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export type AuthPartner = {
  id: number;
  publicId: string;
  clientCode: string;
  teamCode: string;
  status: "active" | "blocked";
};

export type AuthAttribution = {
  partnerId: number;
  code: string;
};

export type AuthResult = {
  user: AuthUser;
  partner: AuthPartner | null;
  attribution: AuthAttribution | null;
  role: "client" | "partner";
};

export type AuthState = {
  user: AuthUser | null;
  partner: AuthPartner | null;
  role: "client" | "partner" | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
};

const LS_AUTH_KEY = "ai_photo_auth_v1";

function loadAuthFromStorage(): AuthResult | null {
  try {
    const stored = localStorage.getItem(LS_AUTH_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Validate structure
    if (!parsed.user || !parsed.user.tgId) return null;
    // Check if expired (24 hours)
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(LS_AUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveAuthToStorage(result: AuthResult) {
  try {
    const toStore = {
      ...result,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };
    localStorage.setItem(LS_AUTH_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

function clearAuthFromStorage() {
  try {
    localStorage.removeItem(LS_AUTH_KEY);
  } catch {
    // Ignore storage errors
  }
}

async function loginViaTelegram(preferredRole?: string): Promise<AuthResult> {
  const initData = getInitData();
  const startParam = getStartParam();

  console.log("[Telegram Auth] Client login attempt:", {
    hasInitData: !!initData,
    initDataLength: initData?.length,
    initDataPreview: initData?.slice(0, 50) + "...",
    startParam,
    preferredRole,
    apiBase: API_BASE,
  });

  if (!initData) {
    console.error("[Telegram Auth] No initData available");
    throw new Error("Telegram initData not available. Are you running inside Telegram?");
  }

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
      ...(startParam ? { "X-Telegram-Start-Param": encodeURIComponent(startParam) } : {}),
      ...(preferredRole ? { "X-Telegram-Preferred-Role": preferredRole } : {}),
    },
    body: JSON.stringify({}),
  });

  console.log("[Telegram Auth] Server response:", {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Telegram Auth] Server error:", error);
    throw new Error(error || `Auth failed: ${response.status}`);
  }

  const data = await response.json();
  console.log("[Telegram Auth] Success:", {
    userId: data.user?.id,
    username: data.user?.username,
    role: data.role,
    hasPartner: !!data.partner,
  });

  return {
    user: data.user,
    partner: data.partner,
    attribution: data.attribution,
    role: data.role,
  };
}

export function useTelegramAuth() {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    partner: null,
    role: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  const login = React.useCallback(async (force = false, role?: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // If we are NOT in Telegram, we can rely on storage.
      // If we ARE in Telegram, we should ALWAYS hit the server to ensure user exists (upsert)
      // and get fresh data, unless force is false and we just want to show UI quickly.
      
      const stored = loadAuthFromStorage();
      const inTelegram = isTelegramWebApp() && !!getInitData();

      if (!force && !inTelegram && stored) {
        setState({
          user: stored.user,
          partner: stored.partner,
          role: stored.role,
          isLoading: false,
          error: null,
          isAuthenticated: true,
        });
        return stored;
      }

      // If in Telegram, we'll call loginViaTelegram below even if we have stored data,
      // to ensure the backend upserts the user (in case they were deleted from admin).

      if (inTelegram) {
        const result = await loginViaTelegram(role);
        saveAuthToStorage(result);
        setState({
          user: result.user,
          partner: result.partner,
          role: result.role,
          isLoading: false,
          error: null,
          isAuthenticated: true,
        });
        return result;
      }

      // Not in Telegram and no stored data or force=true
      if (!stored && !inTelegram) {
        const error = new Error("Not running inside Telegram WebApp and no session found");
        setState({
          user: null,
          partner: null,
          role: null,
          isLoading: false,
          error: error.message,
          isAuthenticated: false,
        });
        throw error;
      }

      return stored!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false,
      }));
      throw error;
    }
  }, []);

  const logout = React.useCallback(() => {
    clearAuthFromStorage();
    setState({
      user: null,
      partner: null,
      role: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });
  }, []);

  // Auto-login on mount if inside Telegram
  React.useEffect(() => {
    // Determine role from path
    const pathname = window.location.pathname;
    const roleFromPath = pathname.startsWith("/partner") ? "partner" : pathname.startsWith("/admin") ? "admin" : "client";

    // Only auto-login if we have initData (inside Telegram)
    if (isTelegramWebApp() && getInitData()) {
      login(false, roleFromPath).catch(() => {
        // Ignore auto-login errors
      });
    } else {
      // Not in Telegram - check storage
      const stored = loadAuthFromStorage();
      if (stored) {
        setState({
          user: stored.user,
          partner: stored.partner,
          role: stored.role,
          isLoading: false,
          error: null,
          isAuthenticated: true,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
  }, [login]);

  return {
    ...state,
    login,
    logout,
  };
}

/**
 * Get current auth state synchronously (from storage)
 */
export function getCachedAuth(): AuthResult | null {
  return loadAuthFromStorage();
}

/**
 * Clear cached auth
 */
export function clearCachedAuth() {
  clearAuthFromStorage();
}
