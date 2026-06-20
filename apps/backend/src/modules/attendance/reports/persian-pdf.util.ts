import * as fs from 'fs';
import * as path from 'path';

// Persian/Arabic glyph shaping for pdfkit, which has no bidi/shaping of its own.
// Everything degrades gracefully: if the reshaper or font is unavailable the
// report still renders (just with disconnected glyphs / default font).

let reshaper: ((s: string) => string) | null | undefined;

function getReshaper(): ((s: string) => string) | null {
  if (reshaper !== undefined) return reshaper;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('arabic-reshaper');
    const fn = mod.convertArabic || mod.reshape || (mod.ArabicReshaper && mod.ArabicReshaper.convertArabic);
    reshaper = typeof fn === 'function' ? fn.bind(mod) : null;
  } catch {
    reshaper = null;
  }
  return reshaper ?? null;
}

const RTL_RE = /[؀-ۿ]/; // Arabic/Persian block

/**
 * Shape a string for visual RTL rendering in pdfkit. Joins Persian letters then
 * reverses word order so the line reads right-to-left. Numbers/Latin are left
 * intact within their token. Good enough for short tabular cells and headers.
 */
export function fa(text: string | number | null | undefined): string {
  const s = text == null ? '' : String(text);
  if (!s || !RTL_RE.test(s)) return s;
  const shape = getReshaper();
  const shaped = shape ? shape(s) : s;
  // Reverse the visual order (whole-string) for RTL; keep digit groups readable.
  return shaped.split('\n').map((line) => reverseRtl(line)).join('\n');
}

// Reverse for RTL while keeping runs of digits/Latin in their natural order.
function reverseRtl(line: string): string {
  const tokens = line.match(/[؀-ۿﭐ-﻿]+|[^؀-ۿﭐ-﻿]+/g) || [];
  return tokens
    .reverse()
    .map((t) => (RTL_RE.test(t) || /[ﭐ-﻿]/.test(t) ? [...t].reverse().join('') : t))
    .join('');
}

const FONT_CANDIDATES = [
  path.join(process.cwd(), 'apps/frontend/public/fonts/ttf/IRANSansWeb.ttf'),
  path.join(process.cwd(), '../frontend/public/fonts/ttf/IRANSansWeb.ttf'),
  path.join(__dirname, '../../../../../frontend/public/fonts/ttf/IRANSansWeb.ttf'),
];

export function findPersianFont(): string | null {
  for (const p of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}
