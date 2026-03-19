import * as React from "react";
import type { Role } from "../roles/types";
import { getRoleFromStartParam } from "./tg";

export type AppRoute = "/client" | "/partner" | "/admin";

export function roleToRoute(role: Role): AppRoute {
  if (role === "partner") return "/partner";
  if (role === "admin") return "/admin";
  return "/client";
}

export function routeToRole(pathname: string): Role | null {
  const clean = normalizePathname(pathname);
  if (clean === "/client") return "client";
  if (clean === "/partner") return "partner";
  if (clean === "/admin") return "admin";
  return null;
}

export function normalizePathname(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  // Drop trailing slash, except root.
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.slice(0, -1);
  return trimmed;
}

export function navigate(path: string, opts?: { replace?: boolean }) {
  const next = normalizePathname(path);
  if (typeof window === "undefined") return;
  if (opts?.replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
}

function getSnapshot() {
  return normalizePathname(window.location.pathname);
}

export function usePathname() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => "/");
}

/**
 * Get initial role based on:
 * 1. URL pathname (/client, /partner, /admin)
 * 2. Telegram start_param (from WebApp initData)
 * 3. localStorage (last used role)
 * 4. Default to "client"
 */
export function getInitialRole(): Role {
  // 1. Check URL pathname first
  const pathname = getSnapshot();
  const roleFromPath = routeToRole(pathname);
  if (roleFromPath) return roleFromPath;

  // 2. Check Telegram start_param
  const roleFromTg = getRoleFromStartParam();
  if (roleFromTg) return roleFromTg;

  // 3. Fallback to localStorage
  const LS_LAST_ROLE_KEY = "ai_photo_last_role_v1";
  try {
    const stored = localStorage.getItem(LS_LAST_ROLE_KEY);
    if (stored === "client" || stored === "partner" || stored === "admin") {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }

  // 4. Default to client
  return "client";
}

