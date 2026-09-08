import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, proxy } from '../proxy';

const legacy = 'https://yojna-setu-nine.vercel.app';
const canonical = 'https://yojna-setu-bg8g.vercel.app';

function productionEnvironment(t: TestContext) {
  const previous = process.env.VERCEL_ENV;
  t.after(() => {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  });
  process.env.VERCEL_ENV = 'production';
}

test('duplicate production pages lead to the configured site before authentication', (t) => {
  productionEnvironment(t);
  for (const origin of [legacy, 'https://yojna-setu-git-main-mccias-projects.vercel.app']) {
    for (const method of ['GET', 'HEAD']) {
      for (const path of ['/', '/auth', '/auth?mode=login', '/dashboard', '/schemes/example']) {
        const request = new NextRequest(origin + path, {
          method,
          headers: { cookie: 'session=must-not-be-copied' },
        });
        const response = proxy(request);
        assert.equal(response.status, 307);
        assert.equal(response.headers.get('location'), canonical + path + '#');
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(response.headers.get('set-cookie'), null);
      }
    }
  }
});

test('login submissions and verification links stay on their issuing deployment', (t) => {
  productionEnvironment(t);
  for (const path of [
    '/auth/callback?code=private',
    '/auth?mode=reset',
    '/auth?token=private',
    '/auth?code=private',
    '/auth?neon_auth_session_verifier=private',
    '/auth?mode=login&state=private',
    '/auth?next=https://unrelated.example',
    '/dashboard?token=private',
    '/api/auth',
    '/api/health',
    '/_next/static/app.js',
    '/favicon.ico',
    '//unrelated.example/auth',
  ]) {
    assert.equal(proxy(new NextRequest(legacy + path)).headers.get('location'), null, path);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = proxy(new NextRequest(legacy + '/auth', { method }));
    assert.equal(response.headers.get('location'), null, method);
  }
});

test('canonical, local, unknown and preview deployments retain their configuration', (t) => {
  productionEnvironment(t);
  for (const origin of [
    canonical,
    'http://127.0.0.1:3000',
    'https://yojna-setu-2m5v.vercel.app',
    'https://yojna-setu-preview-mccias-projects.vercel.app',
    'https://yojna-setu-nine.vercel.app.unrelated.example',
    'http://yojna-setu-nine.vercel.app',
  ]) {
    assert.equal(proxy(new NextRequest(origin + '/auth')).headers.get('location'), null, origin);
  }
  for (const environment of ['preview', 'development', '']) {
    process.env.VERCEL_ENV = environment;
    assert.equal(proxy(new NextRequest(legacy + '/auth')).headers.get('location'), null, environment);
  }
});

test('Next routes only app pages through the migration', () => {
  for (const path of ['/', '/auth', '/profile', '/schemes/example']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: legacy + path }), true, path);
  }
  for (const path of ['/api/auth', '/auth/callback', '/_next/static/app.js', '/mccia-logo.png']) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: legacy + path }), false, path);
  }
});

test('browser fragments cannot carry old auth tokens onto the canonical site', (t) => {
  productionEnvironment(t);
  const response = proxy(new NextRequest(legacy + '/auth#access_token=private'));
  assert.equal(response.headers.get('location'), canonical + '/auth#');
});
