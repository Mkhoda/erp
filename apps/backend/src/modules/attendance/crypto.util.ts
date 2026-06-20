import * as crypto from 'crypto';

// AES-256-GCM encryption for at-rest secrets (e.g. SQL Server passwords).
// Key is derived from JWT_SECRET so no new secret needs provisioning.
// Encrypted values are tagged with the `enc:v1:` prefix; plaintext (legacy)
// values pass through decrypt() unchanged for backward compatibility.

const PREFIX = 'enc:v1:';

function key(): Buffer {
  const secret = process.env.JWT_SECRET || 'arzesh-dev-secret';
  // Fixed salt — deterministic key derivation across restarts.
  return crypto.scryptSync(secret, 'attendance-source-secret', 32);
}

export function encryptSecret(plain: string): string {
  if (plain == null || plain === '') return plain;
  if (plain.startsWith(PREFIX)) return plain; // already encrypted
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  try {
    // PREFIX ("enc:v1:") itself contains colons — strip it before splitting
    // the iv:tag:data payload, otherwise the parts misalign.
    const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function isEncrypted(v: string | null | undefined): boolean {
  return !!v && v.startsWith(PREFIX);
}
