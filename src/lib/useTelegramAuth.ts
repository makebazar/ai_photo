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

async function loginViaTelegram(): Promise<AuthResult> {
  const initData = getInitData();
  const startParam = getStartParam();

  if (!initData) {
    throw new Error("Telegram initData not available. Are you running inside Telegram?");
  }

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
      ...(startParam ? { "X-Telegram-Start-Param": startParam } : {}),
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Auth failed: ${response.status}`);
  }

  const data = await response.json();
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

  const login = React.useCallback(async (force = false) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check storage first
      if (!force) {
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
          return stored;
        }
      }

      // Only attempt Telegram login if running inside Telegram WebApp
      if (!isTelegramWebApp()) {
        const error = new Error("Not running inside Telegram WebApp");
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

      const result = await loginViaTelegram();
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
    // Only auto-login if we have initData (inside Telegram)
    if (isTelegramWebApp() && getInitData()) {
      login().catch(() => {
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
