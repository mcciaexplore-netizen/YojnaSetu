import { NextRequest, NextResponse } from 'next/server';
import { supabase, liveConfigured, siteOrigin } from '@/services/auth';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next');
  const destination = next === '/auth?mode=reset' ? next : '/dashboard';
  const response = NextResponse.redirect(
    new URL(destination, siteOrigin(request)),
  );
  if (code && liveConfigured()) {
    const { error } = await supabase(
      request,
      response,
    ).auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(
    new URL('/auth?error=recovery', siteOrigin(request)),
  );
}
