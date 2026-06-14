import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Some clients/older SWs probe for this Next.js file; respond 200 with empty JSON
  if (pathname === '/_next/app-build-manifest.json') {
    return NextResponse.next();
  }

  // Dashboard routes require authentication
  if (pathname.startsWith('/dashboard')) {
    // We can't read localStorage in middleware (it's server-side).
    // Instead, check for a token cookie OR rely on the layout's auth check.
    // The safest approach: always let the page load but the layout handles redirect.
    // However, to prevent the flash, we set a cookie-check header.
    const token = req.cookies.get('token')?.value;
    if (!token) {
      // No cookie token — redirect to login immediately (prevents flash)
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
