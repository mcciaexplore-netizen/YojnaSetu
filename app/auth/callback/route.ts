import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseConfigured, siteOrigin } from '@/services/auth';
import { anyNeonConfigured, neonConfigured } from '@/services/backend-config';
import { completeNeonAuthCallback } from '@/services/neon-auth';
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = siteOrigin(request);
  } catch {
    return NextResponse.json(
      { error: 'The application site URL is not configured correctly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (neonConfigured()) {
    try {
      return await completeNeonAuthCallback(request);
    } catch {
      return NextResponse.redirect(new URL('/auth?error=verification', origin));
    }
  }
  if (anyNeonConfigured()) {
    return NextResponse.redirect(new URL('/auth?error=configuration', origin));
  }
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const destination = next === '/auth?mode=reset' ? next : '/dashboard';
  const response = NextResponse.redirect(new URL(destination, origin));
  if (code && supabaseConfigured()) {
    const { error } = await supabase(
      request,
      response,
    ).auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(new URL('/auth?error=recovery', origin));
}
