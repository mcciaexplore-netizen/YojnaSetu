import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { User } from '@/types';
import { demoTransaction, hash } from './demo-store';
export const liveConfigured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
export const demoEnabled = () =>
  !liveConfigured() &&
  process.env.DEMO_MODE === 'true' &&
  process.env.NODE_ENV !== 'production';
export function siteOrigin(request: NextRequest) {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
}
export function supabase(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) =>
          items.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: siteOrigin(request).startsWith('https:'),
              sameSite: 'lax',
            });
          }),
      },
    },
  );
}
export async function identity(
  request: NextRequest,
  response: NextResponse,
): Promise<User | null> {
  if (liveConfigured()) {
    const client = supabase(request, response);
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;
    const { data, error } = await client
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (error) throw new Error('Account configuration is incomplete.');
    return { id: user.id, email: user.email!, role: data.role };
  }
  if (!demoEnabled()) return null;
  const token = request.cookies.get('ys_session')?.value;
  if (!token) return null;
  const tokenHash = await hash(token);
  return demoTransaction((db) => {
    const session = db.sessions.find(
      (s) => s.tokenHash === tokenHash && s.expires > Date.now(),
    );
    const user = db.users.find((u) => u.id === session?.userId);
    return user ? { id: user.id, email: user.email, role: user.role } : null;
  });
}
export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const expected = new URL(request.url);
  expected.host = request.headers.get('host') ?? expected.host;
  const trustedOrigin =
    process.env.NODE_ENV === 'production'
      ? siteOrigin(request)
      : expected.origin;
  if (!origin || origin !== trustedOrigin)
    throw new Error('Please refresh this page and try again.');
}
