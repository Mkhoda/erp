import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/_next/app-build-manifest.json') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      const loginUrl = new URL('/signin', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
