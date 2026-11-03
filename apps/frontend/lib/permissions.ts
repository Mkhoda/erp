"use client";
import React from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export type PageFlags = { canRead: boolean; canCreate: boolean; canWrite: boolean; canDelete: boolean };
const NONE: PageFlags = { canRead: false, canCreate: false, canWrite: false, canDelete: false };

/**
 * The current user's flags on one page (ADMIN: everything), from GET /permissions/my.
 * Only decides what the UI offers — every action is still enforced by the API.
 * `null` while loading, so callers can avoid flashing buttons in and out.
 */
export function usePagePerms(page: string): PageFlags | null {
  const [flags, setFlags] = React.useState<PageFlags | null>(null);
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    let alive = true;
    fetch(`${API}/permissions/my?page=${encodeURIComponent(page)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : NONE))
      .then(f => { if (alive) setFlags({ ...NONE, ...f }); })
      .catch(() => { if (alive) setFlags(NONE); });
    return () => { alive = false; };
  }, [page]);
  return flags;
}
