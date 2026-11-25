import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChatHistoryService } from './chat-history.service';

@UseGuards(JwtAuthGuard)
@Controller('chat-history')
export class ChatHistoryController {
  constructor(private readonly svc: ChatHistoryService) {}

  private uid(req: any): string {
    return req.user?.sub || req.user?.userId || req.user?.id;
  }

  // ── Conversations ──────────────────────────────────────────────
  @Get('conversations')
  list(@Req() req: any) { return this.svc.listConversations(this.uid(req)); }

  @Get('conversations/recent')
  recent(@Req() req: any, @Query('limit') limit?: string) {
    return this.svc.getRecentConversations(this.uid(req), limit ? +limit : 5);
  }

  @Post('conversations')
  create(@Req() req: any, @Body() body: { provider: string; model?: string }) {
    return this.svc.createConversation(this.uid(req), body.provider, body.model);
  }

  @Get('conversations/:id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.getConversation(this.uid(req), id);
  }

  @Delete('conversations/:id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteConversation(this.uid(req), id);
  }

  @Patch('conversations/:id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.svc.archiveConversation(this.uid(req), id);
  }

  @Patch('conversations/:id/rename')
  rename(@Req() req: any, @Param('id') id: string, @Body() body: { title: string }) {
    return this.svc.renameConversation(this.uid(req), id, body.title);
  }

  // ── Messaging ────────────────────────────────────────────────
  @Post('conversations/:id/send')
  send(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content: string; safeMode?: boolean; providerId?: string },
  ) {
    return this.svc.sendMessage(this.uid(req), id, body.content, body.safeMode ?? false, body.providerId);
  }

  /**
   * Streaming reply (Server-Sent Events): `start` (the stored user message), then `reasoning` / `delta`
   * text chunks as the model produces them, then `done` (or `error`). Closing the connection stops the model.
   */
  @Post('conversations/:id/stream')
  async stream(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
    @Body() body: { content?: string; attachmentIds?: string[]; safeMode?: boolean; providerId?: string; regenerate?: boolean; reasoning?: boolean },
  ) {
    const userId = this.uid(req);
    const ctx = await this.svc.beginStream(userId, id, body); // validation errors are ordinary HTTP errors
    const ctl = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ctl.abort(); });
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    const emit = (event: string, data: any) => { if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    const beat = setInterval(() => { if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n'); }, 15000);
    try {
      emit('start', { userMessage: ctx.userMsg, model: ctx.provider.model, provider: ctx.provider.name });
      await this.svc.runStream(ctx, userId, emit, ctl.signal);
    } catch (e: any) {
      emit('error', { message: e?.message || 'خطای ناشناخته' });
    } finally {
      clearInterval(beat);
      if (!res.writableEnded) res.end();
    }
  }

  @Post('conversations/:id/compact')
  compact(@Req() req: any, @Param('id') id: string) {
    return this.svc.compactConversation(this.uid(req), id);
  }

  @Post('conversations/:id/extract-memories')
  extractMemories(@Req() req: any, @Param('id') id: string) {
    return this.svc.extractMemories(this.uid(req), id);
  }

  // ── Memory ───────────────────────────────────────────────────
  @Get('memory')
  getMemory(@Req() req: any) { return this.svc.getMemories(this.uid(req)); }

  @Post('memory')
  addMemory(@Req() req: any, @Body() body: { content: string }) {
    return this.svc.addMemory(this.uid(req), body.content);
  }

  @Patch('memory/:id')
  updateMemory(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.svc.updateMemory(this.uid(req), id, body.content);
  }

  @Delete('memory/:id')
  deleteMemory(@Req() req: any, @Param('id') id: string) {
    return this.svc.deleteMemory(this.uid(req), id);
  }
}
