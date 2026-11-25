export const API = process.env.NEXT_PUBLIC_API_URL || "/api";

export type Caps = { image: boolean; file: boolean; audio: boolean; video: boolean; reasoning: boolean; stream: boolean; contextLength: number | null };
export type Provider = { id: string; name: string; type: string; model: string | null; capabilities?: Caps };
export type Category = "image" | "document" | "text" | "audio" | "video";
export type Att = {
  id: string; name: string; mime: string; category: Category; sizeBytes: number;
  width?: number | null; height?: number | null; url: string; thumbUrl?: string | null; hasText?: boolean;
};
export type Message = {
  id: string; role: "user" | "assistant"; content: string; reasoning?: string | null;
  latencyMs?: number | null; createdAt?: string; error?: boolean; stopped?: boolean;
  completionTokens?: number | null; attachments?: Att[];
  /** live-only */ streaming?: boolean; thinkingMs?: number;
};
export type CategoryPolicy = { enabled: boolean; maxMb: number; exts: string[] };
export type FilePolicy = { enabled: boolean; maxFilesPerMessage: number; dailyUploadMb: number; categories: Record<Category, CategoryPolicy> };

export const CATEGORY_LABEL: Record<Category, string> = { image: "تصویر", document: "سند", text: "متن", audio: "صوت", video: "ویدیو" };

export const fileUrl = (rel?: string | null) => (rel ? (/^https?:/.test(rel) ? rel : `${API.replace(/\/$/, "")}/${rel}`) : "");
export const authHeaders = (): Record<string, string> => ({ Authorization: `Bearer ${typeof window === "undefined" ? "" : localStorage.getItem("token") || ""}` });

const fa = (s: string) => s.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[+d]);
export function fmtSize(b: number) {
  if (b < 1024) return `${fa(String(b))} بایت`;
  if (b < 1024 * 1024) return `${fa((b / 1024).toFixed(0))} کیلوبایت`;
  return `${fa((b / 1024 / 1024).toFixed(1))} مگابایت`;
}

/** Which attachment categories a model can actually read (documents/text are always fine: text is extracted server-side). */
export function allowedCategories(policy: FilePolicy | null, caps?: Caps): Record<Category, { ok: boolean; reason?: string }> {
  const r = {} as Record<Category, { ok: boolean; reason?: string }>;
  (["image", "document", "text", "audio", "video"] as Category[]).forEach(c => {
    if (!policy?.enabled || !policy.categories[c]?.enabled) { r[c] = { ok: false, reason: "توسط مدیر غیرفعال شده" }; return; }
    if (c === "image" && caps && !caps.image) r[c] = { ok: false, reason: "این مدل تصویر نمی‌بیند" };
    else if (c === "audio" && caps && !caps.audio) r[c] = { ok: false, reason: "این مدل صدا نمی‌شنود" };
    else if (c === "video" && caps && !caps.video) r[c] = { ok: false, reason: "این مدل ویدیو نمی‌بیند" };
    else r[c] = { ok: true };
  });
  return r;
}

export function acceptString(policy: FilePolicy | null, ok: Record<Category, { ok: boolean }>) {
  if (!policy) return "";
  const exts: string[] = [];
  (Object.keys(policy.categories) as Category[]).forEach(c => { if (ok[c]?.ok) exts.push(...policy.categories[c].exts.map(e => `.${e}`)); });
  return exts.join(",");
}

export function categoryOfFile(policy: FilePolicy, name: string): Category | null {
  const ext = (name.split(".").pop() || "").toLowerCase().replace("jpeg", "jpg");
  for (const c of Object.keys(policy.categories) as Category[]) if (policy.categories[c].exts.includes(ext)) return c;
  return null;
}

/** Parses a fetch() Response body of Server-Sent Events. */
export async function readSSE(res: Response, on: (event: string, data: any) => void) {
  if (!res.body) throw new Error("پاسخ نامعتبر");
  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8");
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      let ev = "message"; const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      try { on(ev, JSON.parse(data.join("\n"))); } catch { /* ignore malformed block */ }
    }
  }
}

/** Uploads one file with progress (fetch has no upload progress, XHR does). */
export function uploadFile(file: File, onProgress: (p: number) => void): { promise: Promise<Att>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Att>((resolve, reject) => {
    xhr.open("POST", `${API}/chat-history/files`);
    xhr.setRequestHeader("Authorization", authHeaders().Authorization);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let body: any = null; try { body = JSON.parse(xhr.responseText); } catch { /* */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(Array.isArray(body?.message) ? body.message.join("، ") : body?.message || (xhr.status === 413 ? "حجم فایل بیش از حد مجاز است" : "بارگذاری ناموفق بود")));
    };
    xhr.onerror = () => reject(new Error("خطا در اتصال"));
    xhr.onabort = () => reject(new Error("لغو شد"));
    const fd = new FormData(); fd.append("file", file);
    xhr.send(fd);
  });
  return { promise, abort: () => xhr.abort() };
}
