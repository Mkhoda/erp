import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Some clients/older SWs probe for this Next.js file; respond 200 with empty JSON to avoid noisy 404s
  if (pathname === '/_next/app-build-manifest.json') {
    return new NextResponse('{}', {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/(_next/app-build-manifest.json)'],
};
