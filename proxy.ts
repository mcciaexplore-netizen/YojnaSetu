import { NextResponse, type NextRequest } from 'next/server';

// Exact aliases of the older, unconfigured project. Previews keep their backend.
const legacyHosts = new Set([
  'yojna-setu-nine.vercel.app',
  'yojna-setu-git-main-mccias-projects.vercel.app',
]);
const canonicalOrigin = 'https://yojna-setu-bg8g.vercel.app';
const pagePath = /^\/(?:auth|dashboard|profile|saved|schemes(?:\/[^/]+)?|applications|assistant|deadlines|enquiry|notifications|admin)?\/?$/;

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (
    process.env.VERCEL_ENV !== 'production' ||
    !['GET', 'HEAD'].includes(request.method) ||
    url.protocol !== 'https:' ||
    !legacyHosts.has(url.host) ||
    !pagePath.test(url.pathname)
  ) {
    return NextResponse.next();
  }

  // Verification/reset links and unknown queries stay on their issuing host.
  // Never forward credentials, callback codes, or user-supplied destinations.
  for (const [key, value] of url.searchParams) {
    if (
      url.pathname !== '/auth' ||
      key !== 'mode' ||
      !['login', 'signup', 'forgot'].includes(value)
    ) {
      return NextResponse.next();
    }
  }

  const destination = new URL(canonicalOrigin);
  destination.pathname = url.pathname;
  destination.search = url.search;
  // An explicit empty fragment prevents browsers carrying an old auth fragment.
  destination.hash = '#';
  const response = NextResponse.redirect(destination, 307);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export const config = {
  matcher: [
    '/',
    '/auth',
    '/dashboard',
    '/profile',
    '/saved',
    '/schemes/:path*',
    '/applications',
    '/assistant',
    '/deadlines',
    '/enquiry',
    '/notifications',
    '/admin',
  ],
};
