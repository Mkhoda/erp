// Decides what an uploaded file REALLY is from its bytes, enforces the policy, and returns a safe,
// normalised version (images are decoded and re-encoded, Office files are read as text only).
// Anything unrecognised — executables, scripts, archives, HTML/SVG, disguised files — is refused.
import { BadRequestException } from '@nestjs/common';
import * as sharpModule from 'sharp';
import { Category, FilePolicy, MIME } from './policy';
import { assertNoActiveContent, docxText, listZip, officeKind, xlsxText } from './office';

const sharp: typeof sharpModule = ((sharpModule as any).default ?? sharpModule) as any;

export type Inspected = {
  category: Category; ext: string; mime: string; buffer: Buffer; thumb?: Buffer;
  width?: number; height?: number; extractedText?: string;
};

const ascii = (b: Buffer, from: number, to: number) => b.toString('latin1', from, to);
const MAX_IMAGE_SIDE = 2048;
const MAX_PIXELS = 80_000_000;
const TEXT_CAP = 120_000;

type Fmt = { ext: string; category: Category };

/** Recognise a binary format by its magic bytes; null when it is none we support. `hint` settles m4a-vs-mp4. */
export function sniffBinary(b: Buffer, hint: string, entries?: ReturnType<typeof listZip>): Fmt | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: 'png', category: 'image' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', category: 'image' };
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return { ext: 'gif', category: 'image' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { ext: 'webp', category: 'image' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { ext: 'wav', category: 'audio' };
  if (b.subarray(0, Math.min(b.length, 1024)).includes('%PDF-')) return { ext: 'pdf', category: 'document' };
  if (ascii(b, 0, 4) === 'OggS') return { ext: 'ogg', category: 'audio' };
  if (ascii(b, 0, 4) === 'fLaC') return { ext: 'flac', category: 'audio' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', category: 'audio' };
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (brand === 'qt  ') return { ext: 'mov', category: 'video' };
    if (brand === 'M4A ' || brand === 'M4B ' || (hint === 'm4a' && /^(mp42|isom|iso2)$/.test(brand))) return { ext: 'm4a', category: 'audio' };
    return { ext: 'mp4', category: 'video' };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return b.subarray(0, 64).includes('webm') ? { ext: 'webm', category: 'video' } : null;
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && entries) { const k = officeKind(entries); return k ? { ext: k, category: 'document' } : null; }
  return null;
}

/** UTF-8 first; Windows-1256 (Persian/Arabic ANSI "Notepad" files) as a fallback. null = binary junk. */
export function decodeText(b: Buffer): string | null {
  if (b.includes(0)) return null;
  const strip = (s: string) => s.replace(/^﻿/, '');
  try { return strip(new TextDecoder('utf-8', { fatal: true }).decode(b)); } catch { /* fall through */ }
  try {
    const s = new TextDecoder('windows-1256').decode(b);
    const odd = (s.match(/[\u0000-\u0008\u000e-\u001f�]/g) || []).length;
    return odd / Math.max(1, s.length) < 0.01 ? strip(s) : null;
  } catch { return null; }
}

const normExt = (e: string) => (e === 'jpeg' ? 'jpg' : e === 'yml' ? 'yml' : e);

export function cleanName(raw: string): string {
  // multer hands the multipart filename over as latin1 — re-decode so Persian names survive
  let n = raw || 'file';
  // (only when every char fits a byte, i.e. it really is mis-decoded UTF-8 — real Unicode names stay untouched)
  if (/^[\u0000-ÿ]*$/.test(n)) { try { const u = Buffer.from(n, 'latin1').toString('utf8'); if (!u.includes('�')) n = u; } catch { /* keep */ } }
  n = n.split(/[\\/]/).pop() || 'file';
  n = n.replace(/[\u0000-\u001f\u007f<>:"|?*‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  return n.length > 120 ? n.slice(0, 100) + n.slice(n.lastIndexOf('.') >= 0 && n.length - n.lastIndexOf('.') <= 6 ? n.lastIndexOf('.') : n.length) : n || 'file';
}

export async function inspect(buf: Buffer, rawName: string, policy: FilePolicy): Promise<Inspected> {
  if (!policy.enabled) throw new BadRequestException('ارسال فایل در گفتگو غیرفعال است');
  if (!buf.length) throw new BadRequestException('فایل خالی است');
  const declared = normExt((rawName.split('.').pop() || '').toLowerCase());
  const nameParts = rawName.toLowerCase().split('.');
  // "photo.png.exe"-style names: every dotted suffix after the first must itself be harmless
  if (nameParts.length > 2 && /^(exe|bat|cmd|com|scr|msi|dll|js|vbs|ps1|sh|jar|apk|php|html?|svg|hta|lnk)$/.test(nameParts[nameParts.length - 2])) throw new BadRequestException('نام فایل مشکوک است');

  let entries: ReturnType<typeof listZip> | undefined;
  if (buf[0] === 0x50 && buf[1] === 0x4b) { entries = listZip(buf); assertNoActiveContent(entries); }
  let fmt = sniffBinary(buf, declared, entries);
  let text: string | null = null;
  if (!fmt) {
    // not a known binary: acceptable only as plain text with an allowed text extension
    text = policy.categories.text.exts.includes(declared) ? decodeText(buf) : null;
    if (text == null || /^(#!|MZ|\x7fELF)/.test(text.slice(0, 4))) throw new BadRequestException('نوع این فایل پذیرفته نمی‌شود (فقط تصویر، PDF، Word، Excel، متن، صدا و ویدیو)');
    fmt = { ext: declared, category: 'text' };
  }
  const cat = policy.categories[fmt.category];
  if (!cat.enabled) throw new BadRequestException(`ارسال فایل‌های ${({ image: 'تصویری', document: 'سندی', text: 'متنی', audio: 'صوتی', video: 'ویدیویی' } as any)[fmt.category]} مجاز نیست`);
  if (!cat.exts.includes(fmt.ext)) throw new BadRequestException(`فرمت ${fmt.ext.toUpperCase()} مجاز نیست`);
  if (declared !== fmt.ext && !(fmt.category === 'text')) throw new BadRequestException('پسوند فایل با محتوای واقعی آن نمی‌خواند');
  if (buf.length > cat.maxMb * 1024 * 1024) throw new BadRequestException(`حجم فایل از ${cat.maxMb} مگابایت بیشتر است`);

  const out: Inspected = { category: fmt.category, ext: fmt.ext, mime: MIME[fmt.ext] || 'application/octet-stream', buffer: buf };

  if (fmt.category === 'image') {
    let meta: any;
    try { meta = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata(); } catch { throw new BadRequestException('تصویر خراب یا بیش‌ازحد بزرگ است'); }
    if (!meta.width || !meta.height) throw new BadRequestException('تصویر نامعتبر است');
    if (fmt.ext === 'gif') {
      if ((meta.pages || 1) > 600) throw new BadRequestException('GIF بیش از حد طولانی است');
      out.width = meta.width; out.height = meta.height;
    } else {
      // decode + re-encode: drops EXIF/ICC payloads and anything smuggled inside the file, and caps the size
      let img = sharp(buf, { limitInputPixels: MAX_PIXELS }).rotate();
      if (Math.max(meta.width, meta.height) > MAX_IMAGE_SIDE) img = img.resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true });
      const enc = fmt.ext === 'png' ? img.png({ compressionLevel: 8 }) : fmt.ext === 'webp' ? img.webp({ quality: 88 }) : img.jpeg({ quality: 88, mozjpeg: false });
      const { data, info } = await enc.toBuffer({ resolveWithObject: true });
      out.buffer = data; out.width = info.width; out.height = info.height;
    }
    try { out.thumb = await sharp(out.buffer, { animated: false, limitInputPixels: MAX_PIXELS }).resize(360, 360, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer(); } catch { /* optional */ }
    return out;
  }

  if (fmt.category === 'document') {
    if (fmt.ext === 'pdf') {
      // PDFs that carry launch actions or scripts are not something to relay
      const scan = buf.toString('latin1');
      if (/\/(Launch|JavaScript|JS)\b/.test(scan.slice(0, 2_000_000)) || /\/(Launch|JavaScript|JS)\b/.test(scan.slice(-500_000))) throw new BadRequestException('این PDF شامل اسکریپت یا عملیات اجرایی است و پذیرفته نمی‌شود');
    } else if (fmt.ext === 'docx') {
      out.extractedText = docxText(buf, entries!).slice(0, TEXT_CAP);
      if (!out.extractedText) throw new BadRequestException('فایل Word متنی ندارد');
    } else {
      out.extractedText = (await xlsxText(buf)).slice(0, TEXT_CAP);
      if (!out.extractedText) throw new BadRequestException('فایل Excel داده‌ای ندارد');
    }
    return out;
  }

  if (fmt.category === 'text') {
    out.extractedText = text!.slice(0, TEXT_CAP);
    if (!out.extractedText.trim()) throw new BadRequestException('فایل متنی خالی است');
    out.mime = `${MIME[fmt.ext] || 'text/plain'}; charset=utf-8`;
    return out;
  }
  return out; // audio / video: verified by signature and size; relayed to the model as-is
}
