import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Turns Prisma constraint errors from the asset endpoints into readable 4xx
 * responses instead of opaque 500s (duplicate name/barcode, dangling foreign key,
 * record not found).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class AssetsPrismaErrorFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'خطای پایگاه داده';

    if (e.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      const target = String((e.meta as any)?.target ?? '');
      message = target.includes('barcode') ? 'این بارکد قبلاً ثبت شده است'
        : target.includes('name') ? 'رکوردی با این نام قبلاً ثبت شده است'
        : 'رکورد تکراری است';
    } else if (e.code === 'P2003') {
      status = HttpStatus.BAD_REQUEST;
      message = 'یکی از موارد انتخاب‌شده (کاربر، بخش، مکان، دسته یا نوع) معتبر نیست یا هنوز به رکوردهای دیگر وابسته است';
    } else if (e.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'رکورد مورد نظر یافت نشد';
    }

    res.status(status).json({ statusCode: status, message, code: e.code });
  }
}
