import * as React from "react";
import type { Role } from "../roles/types";

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

