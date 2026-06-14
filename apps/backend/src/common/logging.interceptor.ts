import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

const SKIP_PATHS = ['/health', '/favicon.ico'];
const MAX_BODY = 2000;

function truncate(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = typeof val === 'string' ? val : JSON.stringify(val);
  return s.length > MAX_BODY ? s.substring(0, MAX_BODY) + '…' : s;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const method = req.method as string;
    const path = (req.route?.path || req.url || '') as string;

    if (SKIP_PATHS.some(p => path.startsWith(p))) return next.handle();

    const userId = req.user?.sub || req.user?.userId || req.user?.id || null;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || null;
    const bodyStr = truncate(req.body);
    const start = Date.now();

    return next.handle().pipe(
      tap(async (responseBody) => {
        const latencyMs = Date.now() - start;
        const statusCode = res.statusCode;
        // Skip 2xx GET requests to keep logs useful (only log mutations + errors)
        if (method === 'GET' && statusCode < 400) return;
        try {
          await this.prisma.requestLog.create({
            data: { method, path, statusCode, userId, body: bodyStr, response: truncate(responseBody), latencyMs, ip },
          });
        } catch { /* don't crash on log failure */ }
      }),
      catchError(async (err) => {
        const latencyMs = Date.now() - start;
        const statusCode = err?.status || err?.statusCode || 500;
        const errorMsg = err?.message || String(err);
        try {
          await this.prisma.requestLog.create({
            data: { method, path, statusCode, userId, body: bodyStr, latencyMs, errorMsg, ip },
          });
        } catch { /* don't crash on log failure */ }
        return throwError(() => err);
      }),
    );
  }
}
