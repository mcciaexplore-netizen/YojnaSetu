import { resolveNeonAuthUrl } from './neon-auth-config';

export function neonAuthUrl() {
  return resolveNeonAuthUrl(
    process.env.NEON_AUTH_BASE_URL,
    process.env.VITE_NEON_AUTH_URL,
  );
}

// Backend selection is shared by authentication and repository adapters.
export function anyNeonConfigured() {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.NEON_AUTH_BASE_URL ||
    process.env.VITE_NEON_AUTH_URL ||
    process.env.NEON_AUTH_COOKIE_SECRET,
  );
}
export function neonConfigurationError() {
  if (!process.env.DATABASE_URL)
    return 'Set DATABASE_URL in the deployment environment.';
  if (!neonAuthUrl())
    return 'Set NEON_AUTH_BASE_URL to the complete HTTPS Neon Auth address from your Neon project.';
  if ((process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) < 32)
    return 'Set NEON_AUTH_COOKIE_SECRET to at least 32 characters in the deployment environment.';
  return undefined;
}
export function neonConfigured() {
  return !neonConfigurationError();
}

// Deliberately expose only validation results, never connection URLs or secrets.
export function neonConfigurationChecks() {
  const auth = neonAuthUrl();
  return {
    databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    authUrlValid: Boolean(auth),
    authUrlSource: auth?.source ?? null,
    cookieSecretValid: (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
  };
}
