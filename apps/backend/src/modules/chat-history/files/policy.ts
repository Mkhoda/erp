// What the AI chat accepts. Defaults live here; the admin overrides them in ai-settings
// (AiChatSettings.policy). The server only ever accepts a file when its CONTENT is recognised
// (see sniff.ts) — the extension lists below can switch recognised formats off, never add new ones.
export type Category = 'image' | 'document' | 'text' | 'audio' | 'video';
export const CATEGORIES: Category[] = ['image', 'document', 'text', 'audio', 'video'];

/** Formats the sniffer can verify, per category (the most the admin can enable). */
export const SUPPORTED_EXTS: Record<Category, string[]> = {
  image: ['png', 'jpg', 'webp', 'gif'],
  document: ['pdf', 'docx', 'xlsx'],
  text: ['txt', 'md', 'csv', 'tsv', 'json', 'log', 'xml', 'yaml', 'yml'],
  audio: ['mp3', 'wav', 'm4a', 'ogg', 'flac'],
  video: ['mp4', 'mov', 'webm'],
};

export type CategoryPolicy = { enabled: boolean; maxMb: number; exts: string[] };
export type FilePolicy = {
  enabled: boolean;
  maxFilesPerMessage: number;
  dailyUploadMb: number; // per user, rolling 24h
  categories: Record<Category, CategoryPolicy>;
};

export const DEFAULT_POLICY: FilePolicy = {
  enabled: true,
  maxFilesPerMessage: 5,
  dailyUploadMb: 300,
  categories: {
    image: { enabled: true, maxMb: 10, exts: ['png', 'jpg', 'webp', 'gif'] },
    document: { enabled: true, maxMb: 25, exts: ['pdf', 'docx', 'xlsx'] },
    text: { enabled: true, maxMb: 2, exts: ['txt', 'md', 'csv', 'tsv', 'json', 'log', 'xml', 'yaml', 'yml'] },
    audio: { enabled: true, maxMb: 25, exts: ['mp3', 'wav', 'm4a', 'ogg', 'flac'] },
    video: { enabled: true, maxMb: 30, exts: ['mp4', 'mov', 'webm'] },
  },
};

/** Hard ceilings the admin cannot raise past (memory / provider request limits). */
export const HARD_MAX_MB: Record<Category, number> = { image: 20, document: 50, text: 5, audio: 50, video: 100 };

const num = (v: any, def: number, min: number, max: number) => {
  const n = v === '' || v == null ? NaN : +v;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : def;
};

export function normalizePolicy(raw: any): FilePolicy {
  const out: FilePolicy = JSON.parse(JSON.stringify(DEFAULT_POLICY));
  if (!raw || typeof raw !== 'object') return out;
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
  out.maxFilesPerMessage = Math.round(num(raw.maxFilesPerMessage, out.maxFilesPerMessage, 1, 10));
  out.dailyUploadMb = num(raw.dailyUploadMb, out.dailyUploadMb, 10, 5000);
  for (const c of CATEGORIES) {
    const r = raw.categories?.[c];
    if (!r) continue;
    const t = out.categories[c];
    if (typeof r.enabled === 'boolean') t.enabled = r.enabled;
    t.maxMb = num(r.maxMb, t.maxMb, 0.1, HARD_MAX_MB[c]);
    if (Array.isArray(r.exts)) t.exts = SUPPORTED_EXTS[c].filter((e) => r.exts.map((x: any) => String(x).toLowerCase().replace(/^\./, '')).includes(e));
  }
  return out;
}

export const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values',
  json: 'application/json', log: 'text/plain', xml: 'application/xml', yaml: 'application/yaml', yml: 'application/yaml',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};
