// Backend selection is shared by authentication and repository adapters.
export function anyNeonConfigured() {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.NEON_AUTH_BASE_URL ||
    process.env.NEON_AUTH_COOKIE_SECRET,
  );
}
export function neonConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.NEON_AUTH_BASE_URL &&
    (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
  );
}
