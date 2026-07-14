// System display name, configurable from /dashboard/settings ("عمومی" tab).
// Cached in localStorage so every page gets an instant synchronous value
// (no flash of the wrong name) while a fresh copy is fetched in the background.
export const DEFAULT_SYSTEM_NAME = "سامانه جامع ارزش";

const STORAGE_KEY = "systemOrgName";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";

let cached: string | null = null;

export function getSystemName(): string {
  if (cached) return cached;
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  }
  return DEFAULT_SYSTEM_NAME;
}

export function pageTitle(prefix: string): string {
  return `${prefix} | ${getSystemName()}`;
}

// Fetches the current name from the (unauthenticated) branding endpoint and
// updates the cache. Safe to call from any page — errors fall back silently.
export async function refreshSystemName(): Promise<string> {
  try {
    const res = await fetch(`${API}/branding`);
    if (res.ok) {
      const data = await res.json();
      const name = (data?.name || "").toString().trim() || DEFAULT_SYSTEM_NAME;
      cached = name;
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, name);
      return name;
    }
  } catch {
    // offline / backend unreachable — keep whatever we already have cached
  }
  return getSystemName();
}
