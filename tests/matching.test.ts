import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '../types';
import { seedSchemes } from '../database/seed';
import { matchScheme, recommendations, searchScheme } from '../lib/matching';
import { profileSchema, schemeSchema } from '../lib/validation';
import { csvCell, recommendationsPdf } from '../services/reports';
import { PDFDocument } from 'pdf-lib';

export const profile: Profile = {
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
  yearsOperating: 5,
  msmeClassification: 'Small',
  projectType: 'Brownfield',
  beneficiaryCategory: 'General',
  traditionalClusterParticipation: 'Yes',
  greenTechProject: 'Yes',
  ceProject: 'Yes',
  registrations: [
    'Udyam Registration',
    'GST Registration',
    'PAN',
    'Startup recognition',
  ],
  objectives: [
    'Working capital',
    'Machinery purchase',
    'Technology upgrade',
    'Green energy',
    'Skill development',
  ],
  exporting: false,
  exportMarkets: '',
  planningExport: true,
  planningExpansion: false,
  expansionLocation: '',
  step: 6,
  confirmed: true,
};

const byId = (id: string) => {
  const found = seedSchemes.find((s) => s.id === id);
  assert.ok(found, 'missing scheme ' + id);
  return found;
};

test('profile requires the eligibility facts used by the source catalogue', () => {
  assert.ok(profileSchema.safeParse(profile).success);
  assert.equal(profileSchema.safeParse({ ...profile, employees: -1 }).success, false);
  assert.equal(profileSchema.safeParse({ ...profile, yearsOperating: -1 }).success, false);
  assert.equal(profileSchema.safeParse({ ...profile, yearsOperating: undefined }).success, false);
  assert.equal(profileSchema.safeParse({ ...profile, exporting: true }).success, false);
});

test('catalogue has ten source-backed records and no illustrative schemes', () => {
  assert.equal(seedSchemes.length, 10);
  assert.equal(byId('cgtmse').maximumBenefit, 100000000);
  assert.equal(byId('interest-subvention-msme').maximumBenefit, 1000000000);
  for (const s of seedSchemes) {
    assert.equal(s.demo, false, s.id);
    assert.equal(s.status, 'Needs Review', s.id);
    assert.match(s.source, /Copy of Govt Schemes Updated\.pdf, page/);
    assert.ok(schemeSchema.safeParse(s).success, s.id);
  }
  assert.equal(schemeSchema.safeParse({ ...seedSchemes[0], status: 'Verified' }).success, false);
});

test('recommendations include only eligible, objective-relevant schemes', () => {
  const results = recommendations(profile, seedSchemes);
  assert.ok(results.length > 0);
  assert.ok(results.every((m) => m.eligible && m.score >= 50));
  assert.ok(results.some((m) => m.scheme.id === 'cgtmse'));
  assert.ok(results.some((m) => m.scheme.id === 'mse-spice'));
  assert.ok(!results.some((m) => m.scheme.id === 'pmegp'));
  assert.ok(!results.some((m) => m.scheme.id === 'startup-india'));
  assert.ok(!results.some((m) => m.scheme.id === 'stand-up-india'));
});

test('new business, greenfield and beneficiary category are checked against their source criteria', () => {
  const newBusiness: Profile = {
    ...profile,
    businessType: 'Individual',
    yearsOperating: 1,
    projectType: 'Greenfield',
    beneficiaryCategory: 'Women',
    objectives: ['Startup funding', 'Employment generation'],
  };
  assert.equal(matchScheme(newBusiness, byId('pmegp')).eligible, true);
  assert.equal(matchScheme(newBusiness, byId('startup-india')).eligible, true);
  assert.equal(matchScheme(newBusiness, byId('stand-up-india')).eligible, true);
  assert.equal(matchScheme(newBusiness, byId('mse-spice')).eligible, false);
});

test('unknown required information is not treated as eligible', () => {
  assert.equal(
    matchScheme({ ...profile, msmeClassification: 'Not sure' }, byId('cgtmse')).eligible,
    false,
  );
  assert.equal(
    matchScheme({ ...profile, yearsOperating: undefined }, byId('mudra')).eligible,
    false,
  );
  assert.equal(
    matchScheme({ ...profile, ceProject: 'Not sure' }, byId('mse-spice')).eligible,
    false,
  );
  assert.equal(
    recommendations(
      { ...profile, beneficiaryCategory: 'Not sure' },
      [byId('stand-up-india')],
    ).length,
    0,
  );
});

test('required failures are excluded even when other scheme conditions pass', () => {
  const medium = { ...profile, msmeClassification: 'Medium' as const };
  assert.equal(matchScheme(medium, byId('cgtmse')).eligible, false);
  assert.equal(recommendations(medium, [byId('cgtmse')]).length, 0);
});

test('business objectives affect relevance while required eligibility stays explicit', () => {
  const relevant = matchScheme(profile, byId('mse-gift'));
  assert.equal(relevant.eligible, true);
  assert.equal(
    relevant.conditions.find((c) => c.label.includes('objective'))?.status,
    'pass',
  );
  const unrelated = { ...profile, objectives: ['Export'] };
  assert.equal(matchScheme(unrelated, byId('mse-gift')).eligible, true);
  assert.equal(recommendations(unrelated, [byId('mse-gift')]).length, 0);
});

test('search spans scheme benefits, tags and industries', () => {
  assert.ok(searchScheme(byId('mse-gift'), 'green technology'));
  assert.ok(searchScheme(byId('mudra'), '20 lakh'));
  assert.equal(searchScheme(byId('mudra'), 'unrelated'), false);
});

test('CSV neutralizes spreadsheet formulas and quotes', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('a,b'), '"a,b"');
});

test('recommendation report produces a readable PDF', async () => {
  const bytes = await recommendationsPdf(profile, seedSchemes);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
});
