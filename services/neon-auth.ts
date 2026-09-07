import 'server-only';
import {
  createAuthServer,
  NEON_AUTH_COOKIE_PREFIX,
  NEON_AUTH_SESSION_COOKIE_NAME,
  parseSetCookies,
  processAuthMiddleware,
  resolveNeonAuthLogging,
  type CookieOptions,
} from '@neondatabase/auth/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { User } from '@/types';
import { neonConfigured } from './backend-config';
import { ensureNeonUser } from './neon-db';

const DEV_COOKIE_PREFIX = 'ys_neon_dev';
const SESSION_VERIFIER = 'neon_auth_session_verifier';
const UPSTREAM_COOKIE_NAMES = new Set([
  NEON_AUTH_SESSION_COOKIE_NAME,
  `${NEON_AUTH_COOKIE_PREFIX}.session_challenge`,
  `${NEON_AUTH_COOKIE_PREFIX}.session_challange`,
]);
const quietLog = resolveNeonAuthLogging({ logLevel: 'silent' });

export function neonSiteOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === 'production' && !configured) {
    throw new Error(
      'Set the application site URL before enabling live authentication.',
    );
  }
  const url = new URL(configured || request.url);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  ) {
    throw new Error('Use the HTTPS application URL for live authentication.');
  }
  return url.origin;
}
function usesLocalCookies(request: NextRequest) {
  return (
    process.env.NODE_ENV !== 'production' &&
    request.nextUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname)
  );
}
function browserCookieName(request: NextRequest, name: string) {
  return usesLocalCookies(request)
    ? name.replace(NEON_AUTH_COOKIE_PREFIX, DEV_COOKIE_PREFIX)
    : name;
}
function writeCookie(
  request: NextRequest,
  response: NextResponse,
  name: string,
  value: string,
  options: CookieOptions,
) {
  if (!name.startsWith(NEON_AUTH_COOKIE_PREFIX + '.')) return;
  const browserName = browserCookieName(request, name);
  response.cookies.set(browserName, value, {
    ...options,
    domain: undefined,
    path: '/',
    httpOnly: true,
    secure: !usesLocalCookies(request),
    sameSite: 'lax',
  });
  // A second SDK call in the same request must see freshly issued cookies.
  if (options.maxAge === 0) request.cookies.delete(browserName);
  else request.cookies.set(browserName, value);
}
function upstreamCookies(request: NextRequest) {
  const prefix = usesLocalCookies(request)
    ? DEV_COOKIE_PREFIX
    : NEON_AUTH_COOKIE_PREFIX;
  return (
    request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith(prefix + '.'))
      .map(({ name, value }) => ({
        name: name.replace(prefix, NEON_AUTH_COOKIE_PREFIX),
        value,
      }))
      // Always verify sessions with Neon, including revoked sessions. Do not use
      // the SDK's locally signed session-data cache as application identity.
      .filter(({ name }) => UPSTREAM_COOKIE_NAMES.has(name))
      .map(({ name, value }) => `${name}=${value}`)
      .join('; ')
  );
}
function clearNeonCookies(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (
      name.startsWith(NEON_AUTH_COOKIE_PREFIX + '.') ||
      name.startsWith(DEV_COOKIE_PREFIX + '.')
    ) {
      response.cookies.set(name, '', {
        path: '/',
        maxAge: 0,
        httpOnly: true,
        sameSite: 'lax',
        secure: name.startsWith(NEON_AUTH_COOKIE_PREFIX),
      });
      request.cookies.delete(name);
    }
  }
}
function config() {
  if (!neonConfigured())
    throw new Error(
      'Complete the Neon database and authentication settings first.',
    );
  return {
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sameSite: 'lax' as const,
    log: quietLog,
  };
}

// Use the SDK's public server toolkit with the response owned by our route.
// This preserves all Set-Cookie updates when the route builds its JSON response.
export function neonRequestAuth(request: NextRequest, response: NextResponse) {
  return createAuthServer({
    ...config(),
    context: () => ({
      getCookies: () => upstreamCookies(request),
      setCookie: (name, value, options) =>
        writeCookie(request, response, name, value, options),
      getHeader: (name) => request.headers.get(name),
      getOrigin: () => neonSiteOrigin(request),
      getFramework: () => 'nextjs',
    }),
  });
}
function safeAuthError(
  error: { code?: string; status?: number; message?: string },
  fallback: string,
) {
  if (error.status === 429)
    return new Error('Too many attempts. Please try again in a minute.');
  if (
    error.code === 'EMAIL_NOT_VERIFIED' ||
    error.code === 'email_not_confirmed'
  )
    return new Error(
      'Confirm your email address using the verification email, then sign in.',
    );
  if (
    error.code?.includes('ORIGIN') ||
    /invalid origin|untrusted origin/i.test(error.message ?? '')
  )
    return new Error(
      'This application URL must be added to the Neon Auth trusted domains.',
    );
  if ((error.status ?? 0) >= 500)
    return new Error(
      'Authentication is temporarily unavailable. Please try again shortly.',
    );
  return new Error(fallback);
}
const verifiedSession = z.object({
  user: z.object({
    id: z.string().min(1).max(200),
    email: z.string().email().max(254),
  }),
  session: z.object({
    userId: z.string().min(1),
    expiresAt: z.union([z.string(), z.date()]),
  }),
});
export async function neonIdentity(
  request: NextRequest,
  response: NextResponse,
): Promise<User | null> {
  if (!upstreamCookies(request).includes(NEON_AUTH_SESSION_COOKIE_NAME + '=')) {
    clearNeonCookies(request, response);
    return null;
  }
  const { data, error } = await neonRequestAuth(request, response).getSession({
    query: { disableCookieCache: true },
  });
  if (error) {
    if (error.status === 401 || error.status === 403) {
      clearNeonCookies(request, response);
      return null;
    }
    throw safeAuthError(
      error,
      'Your session could not be verified. Please try again.',
    );
  }
  const parsed = verifiedSession.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.user.id !== parsed.data.session.userId ||
    !(new Date(parsed.data.session.expiresAt).getTime() > Date.now())
  ) {
    clearNeonCookies(request, response);
    return null;
  }
  // Never use a client-supplied ID or the auth provider's role for authorization.
  return ensureNeonUser(parsed.data.user.id, parsed.data.user.email);
}

const actionSchema = z.object({
  action: z.enum(['login', 'signup', 'logout', 'forgot', 'reset']),
  email: z.unknown().optional(),
  password: z.unknown().optional(),
  token: z.unknown().optional(),
});
export async function handleNeonAuthAction(
  request: NextRequest,
  response: NextResponse,
  input: unknown,
): Promise<{ ok?: boolean; confirmation?: boolean; message?: string }> {
  const body = actionSchema.parse(input);
  const auth = neonRequestAuth(request, response);
  if (body.action === 'logout') {
    const { error } = await auth.signOut();
    clearNeonCookies(request, response);
    response.cookies.delete('ys_session');
    if (error)
      throw safeAuthError(
        error,
        'Sign out could not be completed. Please try again.',
      );
    return { ok: true };
  }
  if (body.action === 'reset') {
    const token = z.string().min(1).max(4096).safeParse(body.token);
    if (!token.success)
      throw new Error('Open the recovery link from your email first.');
    const newPassword = z.string().min(12).max(128).parse(body.password);
    const { error } = await auth.resetPassword({
      token: token.data,
      newPassword,
    });
    if (error)
      throw safeAuthError(
        error,
        'That recovery link is invalid or expired. Request a new one.',
      );
    clearNeonCookies(request, response);
    return {
      ok: true,
      message: 'Password updated. Sign in with your new password.',
    };
  }
  const email = z
    .string()
    .trim()
    .email()
    .max(254)
    .parse(body.email)
    .toLowerCase();
  if (body.action === 'forgot') {
    const { error } = await auth.requestPasswordReset({
      email,
      redirectTo: new URL('/auth?mode=reset', neonSiteOrigin(request)).href,
    });
    if (error)
      throw safeAuthError(
        error,
        'The recovery request could not be processed. Try again later.',
      );
    return {
      ok: true,
      message: 'If an account exists, a recovery email has been requested.',
    };
  }
  const password = z.string().min(12).max(128).parse(body.password);
  const callbackURL = new URL('/auth/callback', neonSiteOrigin(request)).href;
  const result =
    body.action === 'signup'
      ? await auth.signUp.email({
          email,
          password,
          name: email.split('@')[0],
          callbackURL,
        })
      : await auth.signIn.email({ email, password, callbackURL });
  if (result.error)
    throw safeAuthError(
      result.error,
      body.action === 'login'
        ? 'Email or password is incorrect.'
        : 'Account creation failed. Check your details or try signing in.',
    );
  if (body.action === 'signup' && !result.data?.token)
    return { ok: true, confirmation: true };
  if (!(await neonIdentity(request, response)))
    throw new Error('Sign in could not establish a session. Please try again.');
  return { ok: true };
}

export async function completeNeonAuthCallback(request: NextRequest) {
  const origin = neonSiteOrigin(request);
  const response = NextResponse.redirect(new URL('/auth?verified=1', origin));
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  if (request.nextUrl.searchParams.has('error')) {
    response.headers.set(
      'Location',
      new URL('/auth?error=verification', origin).href,
    );
    return response;
  }
  const verifier = request.nextUrl.searchParams.get(SESSION_VERIFIER);
  if (verifier) {
    const callback = new URL('/auth/callback', origin);
    callback.searchParams.set(SESSION_VERIFIER, verifier);
    callback.searchParams.set('disableCookieCache', 'true');
    const headers = new Headers({ cookie: upstreamCookies(request), origin });
    const result = await processAuthMiddleware({
      ...config(),
      request: new Request(callback, { headers }),
      pathname: '/auth/callback',
      skipRoutes: ['/auth/callback'],
      loginUrl: '/auth/sign-in',
    });
    if (result.action !== 'redirect_oauth') {
      clearNeonCookies(request, response);
      response.headers.set(
        'Location',
        new URL('/auth?error=verification', origin).href,
      );
      return response;
    }
    for (const header of result.cookies) {
      for (const cookie of parseSetCookies(header)) {
        writeCookie(request, response, cookie.name, cookie.value, cookie);
      }
    }
  }
  const user = await neonIdentity(request, response);
  if (user)
    response.headers.set('Location', new URL('/dashboard', origin).href);
  return response;
}
