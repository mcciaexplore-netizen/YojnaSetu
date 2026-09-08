import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNeonAuthUrl,
  resolveNeonAuthUrl,
} from '../services/neon-auth-config';

const address = 'https://example.neonauth.aws.neon.tech/neondb/auth';

test('normalizes complete copied wrappers without changing the Auth branch', () => {
  for (const value of [
    address,
    `  ${address}  `,
    `"${address}"`,
    `'${address}'`,
    `NEON_AUTH_BASE_URL="${address}"`,
    `[${address}](${address})`,
    `${address}/`,
  ]) {
    assert.equal(parseNeonAuthUrl(value, 'NEON_AUTH_BASE_URL'), address);
  }
});

test('rejects unsafe or ambiguous URL values instead of inventing an endpoint', () => {
  for (const value of [
    undefined,
    '',
    'example.neon.tech/auth',
    'http://example.test/auth',
    'https://user:secret@example.test/auth',
    'https://example.test/auth?token=private',
    'https://example.test/auth#fragment',
    'https://example.test/auth?',
    'https://example.test/auth#',
    `https://example.test/\nauth`,
    '[https://one.test/auth](https://two.test/auth)',
    'VITE_NEON_AUTH_URL=https://example.test/auth',
    'https:///example.test/auth',
    'https://example.test/auth another-value',
    'https://example.test/auth\u0000path',
    'https://example.test/auth\u007fpath',
  ]) {
    assert.equal(
      parseNeonAuthUrl(value, 'NEON_AUTH_BASE_URL'),
      undefined,
      value,
    );
  }
});

test('preserves explicit valid configuration and only falls back for an unusable primary', () => {
  const other = 'https://other.neonauth.aws.neon.tech/preview/auth';
  assert.deepEqual(resolveNeonAuthUrl(address, other), {
    baseUrl: address,
    source: 'NEON_AUTH_BASE_URL',
  });
  assert.deepEqual(resolveNeonAuthUrl('invalid', other), {
    baseUrl: other,
    source: 'VITE_NEON_AUTH_URL',
  });
  assert.deepEqual(
    resolveNeonAuthUrl(undefined, `VITE_NEON_AUTH_URL="${other}"`),
    { baseUrl: other, source: 'VITE_NEON_AUTH_URL' },
  );
  assert.equal(resolveNeonAuthUrl('invalid', 'also-invalid'), undefined);
});
