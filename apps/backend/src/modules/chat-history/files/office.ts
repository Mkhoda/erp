// Minimal, dependency-free reading of OOXML packages (docx / xlsx). The central directory is parsed
// and size-checked BEFORE anything is inflated, so a zip bomb or a path-traversal archive is rejected
// up front instead of being handed to a library.
import { inflateRawSync } from 'zlib';
import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export type ZipEntry = { name: string; method: number; compSize: number; size: number; offset: number };
const MAX_ENTRIES = 3000;
const MAX_TOTAL_UNCOMPRESSED = 150 * 1024 * 1024;
const MAX_RATIO = 120;

export function listZip(buf: Buffer): ZipEntry[] {
  const bad = () => new BadRequestException('ساختار فایل معتبر نیست');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw bad();
  const total = buf.readUInt16LE(eocd + 10), cdSize = buf.readUInt32LE(eocd + 12), cdOff = buf.readUInt32LE(eocd + 16);
  if (total === 0xffff || cdOff === 0xffffffff || total > MAX_ENTRIES || cdOff + cdSize > buf.length) throw bad();
  const out: ZipEntry[] = [];
  let p = cdOff, sum = 0;
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw bad();
    const method = buf.readUInt16LE(p + 10), compSize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), offset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || compSize === 0xffffffff || size === 0xffffffff) throw bad();
    sum += size;
    if (sum > MAX_TOTAL_UNCOMPRESSED || (compSize > 0 && size / compSize > MAX_RATIO && size > 1024 * 1024)) throw new BadRequestException('فایل فشرده‌ی مشکوک (حجم باز‌شده بیش از حد)');
    out.push({ name, method, compSize, size, offset });
    p += 46 + nl + el + cl;
  }
  return out;
}

export function readEntry(buf: Buffer, e: ZipEntry, maxOut = 30 * 1024 * 1024): Buffer {
  if (e.offset + 30 > buf.length || buf.readUInt32LE(e.offset) !== 0x04034b50) throw new BadRequestException('ساختار فایل معتبر نیست');
  const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
  const data = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return data;
  if (e.method === 8) { try { return inflateRawSync(data, { maxOutputLength: maxOut }); } catch { throw new BadRequestException('ساختار فایل معتبر نیست'); } }
  throw new BadRequestException('روش فشرده‌سازی فایل پشتیبانی نمی‌شود');
}

const XML_ENT: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const unxml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (m, n, d, h) => (n ? XML_ENT[m.toLowerCase()] : String.fromCodePoint(d ? +d : parseInt(h, 16))));

/** 'docx' | 'xlsx' | null — decided by the package's required parts, not by the file name. */
export function officeKind(entries: ZipEntry[]): 'docx' | 'xlsx' | null {
  const has = (n: string) => entries.some((e) => e.name === n);
  if (!has('[Content_Types].xml')) return null;
  if (has('word/document.xml')) return 'docx';
  if (has('xl/workbook.xml')) return 'xlsx';
  return null;
}

/** Macro-enabled or embedded-object packages are refused outright. */
export function assertNoActiveContent(entries: ZipEntry[]) {
  if (entries.some((e) => /vbaProject\.bin$|\/embeddings\/|\/activeX\//i.test(e.name))) throw new BadRequestException('فایل دارای ماکرو یا شیء توکار است و پذیرفته نمی‌شود');
}

export function docxText(buf: Buffer, entries: ZipEntry[]): string {
  const xml = readEntry(buf, entries.find((e) => e.name === 'word/document.xml')!).toString('utf8');
  const out: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<\/w:p>|<w:tab\/>|<w:br\/>|<\/w:tc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] != null) out.push(unxml(m[1]));
    else if (m[0] === '</w:p>' || m[0] === '<w:br/>') out.push('\n');
    else if (m[0] === '</w:tc>') out.push(' | ');
    else out.push('\t');
  }
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function xlsxText(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as any); } catch { throw new BadRequestException('فایل اکسل خوانده نشد'); }
  const parts: string[] = [];
  let budget = 200_000;
  for (const ws of wb.worksheets) {
    if (budget <= 0) break;
    parts.push(`# برگه: ${ws.name}`);
    const cols = Math.min(ws.actualColumnCount || 0, 60);
    let rows = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows++ >= 5000 || budget <= 0) return;
      const cells: string[] = [];
      for (let c = 1; c <= cols; c++) {
        const t = String(row.getCell(c).text ?? '').replace(/[\r\n\t]+/g, ' ').replace(/"/g, '""');
        cells.push(/[,"]/.test(t) ? `"${t}"` : t);
      }
      const line = cells.join(',').replace(/,+$/, '');
      budget -= line.length + 1;
      parts.push(line);
    });
  }
  return parts.join('\n').trim();
}
