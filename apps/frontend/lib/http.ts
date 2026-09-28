/** Extracts a user-facing message from a failed API response (NestJS `{ message }` shape). */
export async function readError(res: Response, fallback = "خطا در انجام عملیات"): Promise<string> {
  try {
    const body = await res.json();
    const m = body?.message;
    if (Array.isArray(m)) return m.join("، ");
    if (typeof m === "string" && m.trim()) return m;
  } catch {}
  if (res.status === 403) return "دسترسی لازم برای این عملیات را ندارید";
  return fallback;
}
