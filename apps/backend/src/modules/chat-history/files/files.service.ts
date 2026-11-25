import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { FilePolicy, normalizePolicy, SUPPORTED_EXTS } from './policy';
import { cleanName, inspect } from './sniff';

const SIGNED_TTL_SEC = 3 * 3600;
const MAX_UNATTACHED = 20;

// Files sent in the AI chat live in private-uploads/ai-chat/<userId>/ — never under the public
// /uploads mount — and are only reachable through short-lived signed URLs minted for their owner.
@Injectable()
export class ChatFilesService {
  private readonly log = new Logger('ChatFiles');
  readonly root = join(process.cwd(), 'private-uploads', 'ai-chat');
  private get secret() { return process.env.JWT_SECRET || 'dev-secret'; }

  constructor(private readonly prisma: PrismaService) {}

  // ── policy ──────────────────────────────────────────────────────────────
  async policy(): Promise<FilePolicy> {
    const row = await this.prisma.aiChatSettings.findUnique({ where: { id: 'singleton' } }).catch(() => null);
    return normalizePolicy(row?.policy);
  }
  async policyView() { return { policy: await this.policy(), supported: SUPPORTED_EXTS }; }
  async savePolicy(dto: any) {
    const policy = normalizePolicy(dto?.policy ?? dto);
    await this.prisma.aiChatSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', policy: policy as any }, update: { policy: policy as any } });
    return this.policyView();
  }

  // ── signed urls ─────────────────────────────────────────────────────────
  private sig(id: string, exp: number) { return createHmac('sha256', this.secret).update(`${id}.${exp}`).digest('hex').slice(0, 40); }
  /** Relative to the API base (the page prefixes it): chat-history/files/<id>?exp=…&sig=… */
  url(id: string, thumb = false) {
    const exp = Math.floor(Date.now() / 1000) + SIGNED_TTL_SEC;
    return `chat-history/files/${id}?exp=${exp}&sig=${this.sig(id, exp)}${thumb ? '&thumb=1' : ''}`;
  }
  private verify(id: string, exp: number, sig: string) {
    if (!exp || exp < Date.now() / 1000 || !sig) return false;
    const a = Buffer.from(this.sig(id, exp)), b = Buffer.from(String(sig));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  view(a: any) {
    return {
      id: a.id, name: a.name, mime: a.mime, category: a.category, sizeBytes: a.sizeBytes, width: a.width ?? null, height: a.height ?? null,
      url: this.url(a.id), thumbUrl: a.category === 'image' ? this.url(a.id, true) : null, hasText: !!a.extractedText,
    };
  }

  // ── upload ──────────────────────────────────────────────────────────────
  async upload(userId: string, file: { originalname: string; buffer: Buffer }) {
    if (!file?.buffer) throw new BadRequestException('فایلی ارسال نشد');
    const policy = await this.policy();
    const [pending, today] = await Promise.all([
      this.prisma.conversationAttachment.count({ where: { userId, messageId: null } }),
      this.prisma.conversationAttachment.aggregate({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, _sum: { sizeBytes: true } }),
    ]);
    if (pending >= MAX_UNATTACHED) throw new BadRequestException('فایل‌های ارسال‌نشده زیاد است؛ ابتدا پیام‌های قبلی را بفرستید یا فایل‌ها را حذف کنید');
    if ((today._sum.sizeBytes ?? 0) + file.buffer.length > policy.dailyUploadMb * 1024 * 1024) throw new BadRequestException(`سقف بارگذاری روزانه (${policy.dailyUploadMb} مگابایت) پر شده است`);

    const name = cleanName(file.originalname);
    const res = await inspect(file.buffer, name, policy);
    const id = randomBytes(12).toString('hex');
    const storageKey = `${userId}/${id}.${res.ext}`;
    const path = join(this.root, storageKey);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, res.buffer, { mode: 0o640 });
    if (res.thumb) await fs.writeFile(path.replace(/\.[^.]+$/, '.thumb.webp'), res.thumb, { mode: 0o640 });
    const row = await this.prisma.conversationAttachment.create({
      data: {
        id, userId, name, mime: res.mime, category: res.category, sizeBytes: res.buffer.length, sha256: createHash('sha256').update(res.buffer).digest('hex'),
        storageKey, width: res.width, height: res.height, extractedText: res.extractedText ?? null,
      },
    });
    return this.view(row);
  }

  async remove(userId: string, id: string) {
    const a = await this.prisma.conversationAttachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.userId !== userId) throw new ForbiddenException();
    if (a.messageId) throw new BadRequestException('این فایل به یک پیام ارسال‌شده پیوست است');
    await this.unlink([a]);
    await this.prisma.conversationAttachment.delete({ where: { id } });
    return { ok: true };
  }

  // ── reading ─────────────────────────────────────────────────────────────
  async serve(id: string, q: { exp?: string; sig?: string; thumb?: string }, res: any) {
    if (!this.verify(id, +(q.exp || 0), q.sig || '')) throw new ForbiddenException('لینک نامعتبر یا منقضی است');
    const a = await this.prisma.conversationAttachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    const thumb = q.thumb === '1' && a.category === 'image';
    const abs = join(this.root, thumb ? a.storageKey.replace(/\.[^.]+$/, '.thumb.webp') : a.storageKey);
    const inline = a.category === 'image' || a.category === 'audio' || a.category === 'video' || a.mime === 'application/pdf';
    res.setHeader('Content-Type', thumb ? 'image/webp' : a.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.name)}`);
    await new Promise<void>((resolve) => res.sendFile(abs, { dotfiles: 'allow', acceptRanges: true }, (err: any) => { if (err && !res.headersSent) res.status(404).end(); resolve(); }));
  }

  /** Raw bytes of a stored file, as base64 (for handing to a model). */
  async base64(a: { storageKey: string }) { return (await fs.readFile(join(this.root, a.storageKey))).toString('base64'); }

  // ── housekeeping ────────────────────────────────────────────────────────
  async unlink(rows: Array<{ storageKey: string }>) {
    for (const a of rows) {
      const p = join(this.root, a.storageKey);
      await fs.rm(p, { force: true }).catch(() => undefined);
      await fs.rm(p.replace(/\.[^.]+$/, '.thumb.webp'), { force: true }).catch(() => undefined);
    }
  }
  /** Delete the files of everything about to be removed (a conversation's messages). */
  async unlinkForConversation(conversationId: string) {
    const rows = await this.prisma.conversationAttachment.findMany({ where: { message: { conversationId } }, select: { storageKey: true } });
    await this.unlink(rows);
  }

  // Files uploaded but never sent
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphans() {
    try {
      const rows = await this.prisma.conversationAttachment.findMany({ where: { messageId: null, createdAt: { lt: new Date(Date.now() - 6 * 3600_000) } }, select: { id: true, storageKey: true } });
      if (!rows.length) return;
      await this.unlink(rows);
      await this.prisma.conversationAttachment.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      this.log.log(`removed ${rows.length} unsent upload(s)`);
    } catch (e: any) { this.log.warn(`cleanup failed: ${e?.message}`); }
  }
}
