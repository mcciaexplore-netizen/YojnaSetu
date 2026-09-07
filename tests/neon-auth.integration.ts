import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest, NextResponse } from 'next/server';
import {
  completeNeonAuthCallback,
  handleNeonAuthAction,
  neonIdentity,
  neonRequestAuth,
  neonSiteOrigin,
} from '../services/neon-auth';
import { demoEnabled, identity, liveConfigured } from '../services/auth';

const originalFetch = globalThis.fetch;
const keys = [
  'DATABASE_URL',
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET',
  'NEXT_PUBLIC_SITE_URL',
  'NODE_ENV',
  'DEMO_MODE',
];
const originalEnvironment = new Map(keys.map((key) => [key, process.env[key]]));
const fakeEnvironment = process.env as Record<string, string | undefined>;
beforeEach(() => {
  fakeEnvironment.NODE_ENV = 'test';
  fakeEnvironment.DEMO_MODE = 'true';
  fakeEnvironment.DATABASE_URL = 'postgresql://test:test@database.invalid/test';
  fakeEnvironment.NEON_AUTH_BASE_URL = 'https://auth.invalid/auth';
  fakeEnvironment.NEON_AUTH_COOKIE_SECRET =
    'local-test-cookie-secret-never-used-in-production';
  fakeEnvironment.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';
  globalThis.fetch = async () => {
    throw new Error('Unexpected network access during mocked auth test.');
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function request(cookie = '') {
  return new NextRequest('http://127.0.0.1:3000/api/auth', {
    method: 'POST',
    headers: { cookie, origin: 'http://127.0.0.1:3000' },
  });
}

test('partial Neon configuration fails closed even with local demo enabled', async () => {
  delete process.env.NEON_AUTH_COOKIE_SECRET;
  assert.equal(liveConfigured(), false);
  assert.equal(demoEnabled(), false);
  await assert.rejects(
    identity(request(), NextResponse.json({})),
    /Complete the Neon/,
  );
});

test('password recovery uses the configured site, ignores client callbacks and forwards the token', async () => {
  const calls: Array<{ url: URL; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: new URL(String(url)),
      body: JSON.parse(String(init?.body)),
    });
    return Response.json({ status: true });
  };
  await handleNeonAuthAction(request(), NextResponse.json({}), {
    action: 'forgot',
    email: 'Member@Example.com',
    callbackURL: 'https://attacker.invalid/',
  });
  assert.equal(calls[0].url.pathname, '/auth/request-password-reset');
  assert.deepEqual(calls[0].body, {
    email: 'member@example.com',
    redirectTo: 'http://127.0.0.1:3000/auth?mode=reset',
  });
  const result = await handleNeonAuthAction(request(), NextResponse.json({}), {
    action: 'reset',
    token: 'one-time-test-token',
    password: 'NewPassword12345!',
  });
  assert.equal(calls[1].url.pathname, '/auth/reset-password');
  assert.deepEqual(calls[1].body, {
    token: 'one-time-test-token',
    newPassword: 'NewPassword12345!',
  });
  assert.equal(result.ok, true);
  await assert.rejects(
    handleNeonAuthAction(request(), NextResponse.json({}), {
      action: 'reset',
      password: 'NewPassword12345!',
    }),
    /recovery link/,
  );
  assert.equal(calls.length, 2);
});

test('confirmation-only signup does not provision a synthetic or unverified account', async () => {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.callbackURL, 'http://127.0.0.1:3000/auth/callback');
    assert.equal(body.name, 'member');
    assert.equal(body.role, undefined);
    return Response.json({
      token: null,
      user: { id: 'synthetic-user', email: 'member@example.com' },
    });
  };
  assert.deepEqual(
    await handleNeonAuthAction(request(), NextResponse.json({}), {
      action: 'signup',
      email: 'member@example.com',
      password: 'SamplePassword123!',
      role: 'admin',
    }),
    { ok: true, confirmation: true },
  );
});

test('revoked sessions reach Neon and clear both session and signed cache cookies', async () => {
  const req = request(
    'ys_neon_dev.session_token=revoked; ys_neon_dev.local.session_data=pretend-signed; ys_neon_dev.injected=no; unrelated=private',
  );
  const response = NextResponse.json({});
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(
      new URL(String(url)).searchParams.get('disableCookieCache'),
      'true',
    );
    assert.equal(
      new Headers(init?.headers).get('cookie'),
      '__Secure-neon-auth.session_token=revoked',
    );
    return Response.json(null);
  };
  assert.equal(await neonIdentity(req, response), null);
  assert.equal(calls, 1);
  assert.equal(response.cookies.get('ys_neon_dev.session_token')?.maxAge, 0);
  assert.equal(
    response.cookies.get('ys_neon_dev.local.session_data')?.maxAge,
    0,
  );
});

test('expired and mismatched server sessions cannot become an application identity', async () => {
  for (const session of [
    { userId: 'test-user', expiresAt: '2000-01-01T00:00:00Z' },
    { userId: 'different-user', expiresAt: '2099-01-01T00:00:00Z' },
  ]) {
    globalThis.fetch = async () =>
      Response.json({
        user: { id: 'test-user', email: 'member@example.com' },
        session,
      });
    assert.equal(
      await neonIdentity(
        request('ys_neon_dev.session_token=token'),
        NextResponse.json({}),
      ),
      null,
    );
  }
});

test('SDK cookie updates propagate on HTTP loopback and remain Secure in production', async () => {
  globalThis.fetch = async () =>
    Response.json(
      { status: true },
      {
        headers: {
          'Set-Cookie':
            '__Secure-neon-auth.session_challenge=challenge; HttpOnly; Secure; Path=/; SameSite=None; Partitioned',
        },
      },
    );
  const local = NextResponse.json({});
  await neonRequestAuth(request(), local).requestPasswordReset({
    email: 'member@example.com',
  });
  assert.equal(
    local.cookies.get('ys_neon_dev.session_challenge')?.secure,
    false,
  );
  assert.equal(
    local.cookies.get('ys_neon_dev.session_challenge')?.httpOnly,
    true,
  );
  assert.equal(
    local.cookies.get('ys_neon_dev.session_challenge')?.sameSite,
    'lax',
  );
  fakeEnvironment.NODE_ENV = 'production';
  fakeEnvironment.NEXT_PUBLIC_SITE_URL = 'https://yojana.example';
  const production = NextResponse.json({});
  await neonRequestAuth(
    new NextRequest('https://yojana.example/api/auth'),
    production,
  ).requestPasswordReset({ email: 'member@example.com' });
  assert.equal(
    production.cookies.get('__Secure-neon-auth.session_challenge')?.secure,
    true,
  );
  assert.equal(
    production.cookies.get('ys_neon_dev.session_challenge'),
    undefined,
  );
});

test('callbacks remove tokens and cannot redirect to a supplied external URL', async () => {
  const response = await completeNeonAuthCallback(
    new NextRequest(
      'http://127.0.0.1:3000/auth/callback?error=expired&next=https://attacker.invalid&token=secret',
    ),
  );
  assert.equal(
    response.headers.get('location'),
    'http://127.0.0.1:3000/auth?error=verification',
  );
  const missingChallenge = await completeNeonAuthCallback(
    new NextRequest(
      'http://127.0.0.1:3000/auth/callback?neon_auth_session_verifier=untrusted&next=https://attacker.invalid',
    ),
  );
  assert.equal(
    missingChallenge.headers.get('location'),
    'http://127.0.0.1:3000/auth?error=verification',
  );
});

test('production auth requires a configured application origin', () => {
  fakeEnvironment.NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.throws(() => neonSiteOrigin(request()), /application site URL/);
});

test('verified session identity uses the database role instead of the auth-provider role', async () => {
  let databaseCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (new URL(String(url)).hostname === 'auth.invalid') {
      return Response.json({
        user: {
          id: 'trusted-user',
          email: 'member@example.com',
          role: 'admin',
        },
        session: { userId: 'trusted-user', expiresAt: '2099-01-01T00:00:00Z' },
      });
    }
    databaseCalls++;
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.params, ['trusted-user', 'member@example.com']);
    return Response.json({
      fields: ['id', 'email', 'role'].map((name) => ({ name, dataTypeID: 25 })),
      rows: [['trusted-user', 'member@example.com', 'user']],
      rowCount: 1,
      command: 'INSERT',
    });
  };
  assert.deepEqual(
    await neonIdentity(
      request('ys_neon_dev.session_token=valid'),
      NextResponse.json({}),
    ),
    {
      id: 'trusted-user',
      email: 'member@example.com',
      role: 'user',
    },
  );
  assert.equal(databaseCalls, 1);
});

test('email verification callback exchanges the challenge and propagates the new session', async () => {
  let exchangeCalls = 0;
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.hostname === 'auth.invalid') {
      const isExchange = parsed.searchParams.has('neon_auth_session_verifier');
      if (isExchange) exchangeCalls++;
      return Response.json(
        {
          user: {
            id: 'trusted-user',
            email: 'member@example.com',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          session: {
            userId: 'trusted-user',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
            expiresAt: '2099-01-01T00:00:00Z',
          },
        },
        isExchange
          ? {
              headers: {
                'Set-Cookie':
                  '__Secure-neon-auth.session_token=verified-token; Secure; HttpOnly; Path=/',
              },
            }
          : undefined,
      );
    }
    return Response.json({
      fields: ['id', 'email', 'role'].map((name) => ({ name, dataTypeID: 25 })),
      rows: [['trusted-user', 'member@example.com', 'user']],
      rowCount: 1,
      command: 'INSERT',
    });
  };
  const req = new NextRequest(
    'http://127.0.0.1:3000/auth/callback?neon_auth_session_verifier=valid-proof&next=https://attacker.invalid',
    {
      headers: { cookie: 'ys_neon_dev.session_challenge=challenge' },
    },
  );
  const response = await completeNeonAuthCallback(req);
  assert.equal(exchangeCalls, 1);
  assert.equal(
    response.headers.get('location'),
    'http://127.0.0.1:3000/dashboard',
  );
  assert.equal(
    response.cookies.get('ys_neon_dev.session_token')?.value,
    'verified-token',
  );
  assert.equal(
    response.cookies.get('ys_neon_dev.session_token')?.httpOnly,
    true,
  );
});
