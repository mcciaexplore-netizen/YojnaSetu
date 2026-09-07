import type { Match, Profile, Scheme } from '@/types';
export function matchScheme(
  profile: Partial<Profile>,
  scheme: Scheme,
  now = new Date(),
): Match {
  const expired =
    scheme.status === 'Expired' ||
    !!(scheme.deadline && new Date(scheme.deadline + 'T23:59:59Z') < now);
  const conditions = scheme.rules.map((rule) => {
    const current = profile[rule.field];
    let status: 'pass' | 'fail' | 'unknown' = 'unknown';
    if (current !== undefined && current !== null && current !== '') {
      let pass = false;
      switch (rule.operator) {
        case 'in':
          pass =
            Array.isArray(rule.value) &&
            (rule.value as string[]).includes(String(current));
          break;
        case 'range':
          pass =
            typeof current === 'number' &&
            Array.isArray(rule.value) &&
            current >= Number(rule.value[0]) &&
            current <= Number(rule.value[1]);
          break;
        case 'all':
          pass =
            Array.isArray(current) &&
            Array.isArray(rule.value) &&
            (rule.value as string[]).every((v) =>
              (current as string[]).includes(v),
            );
          break;
        case 'any':
          pass =
            Array.isArray(current) &&
            Array.isArray(rule.value) &&
            (rule.value as string[]).some((v) =>
              (current as string[]).includes(v),
            );
          break;
        case 'equals':
          pass = current === rule.value;
      }
      status = pass ? 'pass' : 'fail';
    }
    return { label: rule.label, status, required: rule.required };
  });
  if (expired)
    conditions.push({
      label: 'Application window has expired',
      status: 'fail',
      required: true,
    });
  if (!scheme.rules.length)
    conditions.push({
      label: 'Eligibility rules have not been recorded',
      status: 'unknown',
      required: true,
    });
  const total = scheme.rules.reduce((n, r) => n + r.weight, 0);
  const passed = scheme.rules.reduce(
    (n, r, i) => n + (conditions[i].status === 'pass' ? r.weight : 0),
    0,
  );
  const failed = conditions.some((c) => c.required && c.status === 'fail');
  const unknown = conditions.some((c) => c.status === 'unknown');
  let score = total ? Math.round((passed / total) * 100) : 0;
  if (failed) score = Math.min(score, 49);
  return {
    scheme,
    score,
    classification:
      score >= 90
        ? 'Highly Relevant'
        : score >= 75
          ? 'Strong Match'
          : score >= 50
            ? 'Potential Match'
            : 'Low relevance',
    conditions,
    eligible: !failed && !unknown && scheme.rules.length > 0 && !expired,
    needsVerification: unknown || scheme.demo || scheme.status !== 'Verified',
  };
}
export function recommendations(profile: Partial<Profile>, schemes: Scheme[]) {
  return schemes
    .filter((s) => !['Draft', 'Archived', 'Expired'].includes(s.status))
    .map((s) => matchScheme(profile, s))
    .filter((m) => m.score >= 50)
    .sort((a, b) => b.score - a.score);
}
export function searchScheme(s: Scheme, query: string) {
  const haystack = [
    s.name,
    s.description,
    ...s.industries,
    s.benefit,
    ...s.tags,
    ...s.categories,
  ]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}
