import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedSchemes } from '../database/seed';
import { matchScheme, recommendations, searchScheme } from '../lib/matching';
import {
  draftProfileSchema,
  profileSchema,
  schemeSchema,
} from '../lib/validation';
import { csvCell, recommendationsPdf } from '../services/reports';
import { PDFDocument } from 'pdf-lib';
export const profile = {
  businessName: 'Setu Engineering',
  businessType: 'Private Limited',
  industry: 'Manufacturing',
  subIndustry: 'Precision components',
  activity: 'Making precision parts',
  state: 'Maharashtra',
  district: 'Pune',
  city: 'Pune',
  stage: 'Growth',
  turnover: 2500000,
  investment: 1500000,
  revenue: 2500000,
  employees: 12,
  registrations: ['Udyam Registration', 'PAN', 'IEC'],
  objectives: [
    'Machinery purchase',
    'Export',
    'Digitalisation',
    'Green energy',
  ],
  exporting: false,
  exportMarkets: '',
  planningExport: true,
  planningExpansion: false,
  expansionLocation: '',
  step: 6,
  confirmed: true,
};
test('valid business profile and numeric validation', () => {
  assert.ok(profileSchema.safeParse(profile).success);
  assert.equal(
    profileSchema.safeParse({ ...profile, employees: -1 }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...profile, employees: 1.5 }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...profile, exporting: true }).success,
    false,
  );
});
test('wizard drafts allow empty objectives while confirmation still requires them', () => {
  const draft = {
    businessName: 'New business',
    businessType: 'Startup',
    industry: '',
    subIndustry: '',
    activity: '',
    state: '',
    district: '',
    city: '',
    stage: '',
    registrations: [],
    objectives: [],
    exporting: false,
    exportMarkets: '',
    planningExport: false,
    planningExpansion: false,
    expansionLocation: '',
    step: 1,
    confirmed: false,
  };
  assert.ok(draftProfileSchema.safeParse(draft).success);
  assert.equal(
    profileSchema.safeParse({ ...profile, objectives: [] }).success,
    false,
  );
  assert.equal(
    draftProfileSchema.safeParse({ ...draft, objectives: [123] }).success,
    false,
  );
});
test('required failure caps score and excludes recommendation', () => {
  const scheme = seedSchemes[0];
  assert.ok(matchScheme(profile, scheme).score >= 90);
  const fail = matchScheme({ ...profile, turnover: 100000001 }, scheme);
  assert.ok(fail.score < 50);
  assert.equal(fail.eligible, false);
  assert.equal(
    recommendations({ ...profile, turnover: 100000001 }, [scheme]).length,
    0,
  );
});
test('unknown ownership is not satisfied or eligible', () => {
  const s = seedSchemes.find((s) => s.id === 'demo-women')!;
  const m = matchScheme(profile, s);
  assert.equal(
    m.conditions.find((c) => c.label.includes('Women-owned'))?.status,
    'unknown',
  );
  assert.equal(m.eligible, false);
  assert.equal(m.needsVerification, true);
});
test('zero turnover is a valid known value', () => {
  assert.equal(
    matchScheme({ ...profile, turnover: 0 }, seedSchemes[0]).conditions.find(
      (c) => c.label.includes('turnover'),
    )?.status,
    'pass',
  );
});
test('empty rules and expired records do not qualify', () => {
  assert.equal(
    matchScheme(profile, { ...seedSchemes[0], rules: [] }).eligible,
    false,
  );
  const expired = matchScheme(profile, {
    ...seedSchemes[0],
    deadline: '2020-01-01',
  });
  assert.ok(expired.score < 50);
});
test('no demo is verified and records validate', () => {
  for (const s of seedSchemes) {
    assert.ok(s.demo);
    assert.equal(s.officialUrl, null);
    assert.ok(schemeSchema.safeParse(s).success, s.id);
  }
  assert.equal(
    schemeSchema.safeParse({ ...seedSchemes[0], status: 'Verified' }).success,
    false,
  );
});
test('search spans benefits tags and industries', () => {
  assert.ok(
    searchScheme(
      seedSchemes.find((s) => s.id === 'demo-green')!,
      'solar subsidy',
    ),
  );
  assert.ok(searchScheme(seedSchemes[1], 'software'));
  assert.equal(searchScheme(seedSchemes[0], 'unrelated'), false);
});
test('CSV neutralizes spreadsheet formulas and quotes', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('a,b'), '"a,b"');
});
test('PDF is valid and paginates many recommendations', async () => {
  const bytes = await recommendationsPdf(profile, seedSchemes);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 2);
});
