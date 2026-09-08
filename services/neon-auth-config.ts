type AuthUrlVariable = 'NEON_AUTH_BASE_URL' | 'VITE_NEON_AUTH_URL';

// Dashboard values are sometimes pasted as quoted .env assignments or links.
// Remove only complete wrappers; never guess a host, protocol, or database branch.
export function parseNeonAuthUrl(
  raw: string | undefined,
  key: AuthUrlVariable,
) {
  let value = raw?.trim() ?? '';
  for (let pass = 0; pass < 4; pass++) {
    const previous = value;
    if (value.startsWith(key + '=')) value = value.slice(key.length + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1).trim();
    const link = value.match(
      /^\[(https:\/\/[^\s[\]]+)\]\((https:\/\/[^\s()]+)\)$/,
    );
    if (link && link[1] === link[2]) value = link[2];
    if (value === previous) break;
  }
  if (
    !/^https:\/\/[^/]/i.test(value) ||
    /[\s\\?#]/.test(value) ||
    /\p{Cc}/u.test(value)
  )
    return undefined;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password) return undefined;
    return url.href.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

export function resolveNeonAuthUrl(primary?: string, integration?: string) {
  const candidates = [
    ['NEON_AUTH_BASE_URL', primary],
    ['VITE_NEON_AUTH_URL', integration],
  ] as const;
  for (const [source, raw] of candidates) {
    const baseUrl = parseNeonAuthUrl(raw, source);
    if (baseUrl) return { baseUrl, source };
  }
  return undefined;
}
