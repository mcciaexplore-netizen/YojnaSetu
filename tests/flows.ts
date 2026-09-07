import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const health = await fetch(base + '/api/health').then((response) =>
  response.json(),
);
assert.equal(
  health.demo,
  true,
  'Flow tests require a local demo server; they must not create accounts in a live database.',
);
class Client {
  cookie = '';
  async request(path: string, body?: unknown) {
    const r = await fetch(base + '/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}),
        Cookie: this.cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const cookies = r.headers.getSetCookie();
    if (cookies.length)
      this.cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const data = await r.json();
    return { status: r.status, data };
  }
  async action(action: string, body: Record<string, unknown> = {}) {
    const r = await this.request('action', { action, ...body });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data;
  }
}
const profile = {
  businessName: 'Flow Test Business',
  businessType: 'Private Limited',
  industry: 'Manufacturing',
  subIndustry: 'Components',
  activity: 'Manufacturing components',
  state: 'Maharashtra',
  district: 'Pune',
  city: 'Pune',
  stage: 'Growth',
  turnover: 2500000,
  investment: 1500000,
  revenue: 2500000,
  employees: 12,
  registrations: ['Udyam Registration', 'PAN', 'IEC'],
  objectives: ['Machinery purchase', 'Export', 'Digitalisation'],
  exporting: false,
  exportMarkets: '',
  planningExport: true,
  planningExpansion: false,
  expansionLocation: '',
  step: 6,
  confirmed: true,
};
const a = new Client(),
  b = new Client();
const email = 'flow-' + Date.now() + '@example.test';
const password = 'Test-only-password-2026';
assert.equal(
  (await a.request('action', { action: 'profile', profile })).status,
  401,
);
assert.equal(
  (await a.request('auth', { action: 'signup', email, password })).status,
  200,
);
console.log('PASS signup and session');
await a.action('profile', {
  profile: {
    businessName: 'Draft business',
    businessType: 'LLP',
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
  },
});
assert.equal(
  (await a.request('data')).data.profile.businessName,
  'Draft business',
);
console.log('PASS draft save');
assert.deepEqual((await a.request('data')).data.profile.objectives, []);
assert.equal(
  (
    await a.request('action', {
      action: 'profile',
      profile: { ...profile, objectives: [] },
    })
  ).status,
  400,
);
await a.action('profile', { profile });
let state = (await a.request('data')).data;
assert.equal(state.profile.confirmed, true);
assert.ok(state.notifications.length);
assert.ok(state.schemes.length >= 14);
console.log('PASS profile confirmation and matching');
const id = 'demo-machinery';
await a.action('save', { schemeId: id });
await a.action('saved-notes', { schemeId: id, notes: 'Keep for next quarter' });
await a.action('checklist', { schemeId: id });
state = (await a.request('data')).data;
assert.equal(state.saved[0].notes, 'Keep for next quarter');
assert.equal(state.applications.length, 1);
const app = state.applications[0];
console.log('PASS saved schemes and checklist');
const invalid = await a.request('action', {
  action: 'application',
  id: app.id,
  application: { ...app, checklistStatus: 'Ready' },
});
assert.equal(invalid.status, 400);
const report = await fetch(base + '/api/export?format=pdf', {
  headers: { Cookie: a.cookie },
});
assert.equal(report.status, 200);
const bytes = Buffer.from(await report.arrayBuffer());
assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
await mkdir('tests/artifacts', { recursive: true });
await writeFile('tests/artifacts/recommendations.pdf', bytes);
const form = new FormData();
form.set(
  'file',
  new File([bytes], 'test-report.pdf', { type: 'application/pdf' }),
);
form.set('applicationId', app.id);
form.set('document', app.documents[0].name);
const upload = await fetch(base + '/api/upload', {
  method: 'POST',
  headers: { Origin: base, Cookie: a.cookie },
  body: form,
});
assert.equal(upload.status, 200, await upload.text());
state = (await a.request('data')).data;
const fileId = state.applications[0].documents[0].fileId;
assert.ok(fileId);
const downloaded = await fetch(base + '/api/file?id=' + fileId, {
  headers: { Cookie: a.cookie },
});
assert.equal(downloaded.status, 200);
assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
console.log('PASS PDF export and private upload/download');
await a.action('application', {
  id: app.id,
  application: {
    ...state.applications[0],
    documents: state.applications[0].documents.map((d: { name: string }) => ({
      name: d.name,
      complete: true,
    })),
    status: 'Application Submitted',
    checklistStatus: 'Submitted',
    applicationDate: '2026-09-05',
    reference: 'TEST-123',
  },
});
state = (await a.request('data')).data;
assert.equal(state.applications[0].history.length, 2);
console.log('PASS application tracking and timeline');
const csv = await fetch(base + '/api/export?format=csv', {
  headers: { Cookie: a.cookie },
});
assert.equal(csv.status, 200);
assert.ok((await csv.text()).includes('Keep for next quarter'));
await a.action('reminder', { schemeId: id });
await a.action('notification', { id: 'all' });
assert.ok(
  (await a.request('data')).data.notifications.every(
    (n: { read: boolean }) => n.read,
  ),
);
await a.action('enquiry', {
  schemeId: id,
  contact: email,
  question: 'Please help us understand the required documents.',
});
assert.match(
  (await a.action('assistant', { question: 'What machinery support exists?' }))
    .answer,
  /not available in the current verified database/,
);
console.log('PASS notifications, reminders, enquiry, grounded assistant');
assert.equal(
  (
    await b.request('auth', {
      action: 'signup',
      email: 'other-' + email,
      password,
    })
  ).status,
  200,
);
assert.equal((await b.request('data')).data.applications.length, 0);
assert.equal(
  (
    await fetch(base + '/api/file?id=' + fileId, {
      headers: { Cookie: b.cookie },
    })
  ).status,
  404,
);
assert.equal(
  (
    await b.request('action', {
      action: 'admin-scheme',
      scheme: state.schemes[0],
    })
  ).status,
  403,
);
const csrf = await fetch(base + '/api/action', {
  method: 'POST',
  headers: {
    Cookie: a.cookie,
    'Content-Type': 'application/json',
    Origin: 'https://attacker.example',
  },
  body: JSON.stringify({ action: 'save', schemeId: id }),
});
assert.equal(csrf.status, 400);
console.log('PASS account isolation, admin denial, CSRF rejection');
await a.request('auth', { action: 'logout' });
assert.equal((await a.request('data')).data.user, null);
assert.equal(
  (await a.request('auth', { action: 'login', email, password })).status,
  200,
);
assert.equal(
  (await a.request('data')).data.applications[0].reference,
  'TEST-123',
);
console.log('PASS logout/login persistence');
const admin = new Client();
let login = await admin.request('auth', {
  action: 'signup',
  email: 'admin@yojanasetu.local',
  password,
});
if (login.status !== 200)
  login = await admin.request('auth', {
    action: 'login',
    email: 'admin@yojanasetu.local',
    password,
  });
assert.equal(login.status, 200);
assert.equal((await admin.request('data')).data.user.role, 'admin');
const scheme = {
  ...state.schemes[0],
  id: 'demo-admin-test-' + Date.now(),
  name: 'Admin test record',
  status: 'Draft',
};
await admin.action('admin-scheme', { scheme });
assert.equal(
  (await b.request('data')).data.schemes.some(
    (s: { id: string }) => s.id === scheme.id,
  ),
  false,
);
await admin.action('admin-scheme', {
  scheme: { ...scheme, status: 'Needs Review' },
});
assert.ok(
  (await b.request('data')).data.schemes.some(
    (s: { id: string }) => s.id === scheme.id,
  ),
);
await admin.action('admin-scheme', {
  scheme: { ...scheme, status: 'Archived' },
});
assert.ok((await admin.request('data')).data.enquiries.length);
console.log('PASS admin create/edit/archive and enquiries');
for (const path of [
  '/',
  '/auth',
  '/dashboard',
  '/profile',
  '/schemes',
  '/schemes/demo-machinery',
  '/saved',
  '/applications',
  '/notifications',
  '/assistant',
  '/admin',
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
}
console.log('PASS all page routes');
