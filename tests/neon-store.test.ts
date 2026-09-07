import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createNeonStore, type NeonQuery } from '../services/neon-store';
import { seedSchemes } from '../database/seed';
import type { Application, UserData } from '../types';

const initial = await readFile(
  new URL('../neon/migrations/0001_application.sql', import.meta.url),
  'utf8',
);
const example = seedSchemes[0];
const empty = (): UserData => ({
  profile: {},
  saved: [],
  applications: [],
  notifications: [],
  preferences: { email: false, inApp: true },
  events: [],
});
const application = (id: string, schemeId = example.id): Application => ({
  id,
  schemeId,
  status: 'Documents Pending',
  checklistStatus: 'In Progress',
  notes: '',
  reference: '',
  applicationDate: '',
  documents: [{ name: 'Certificate', complete: false }],
  history: [{ status: 'Interested', at: '2026-09-01T00:00:00.000Z' }],
  updatedAt: '2026-09-01T00:00:00.000Z',
});
async function fixture() {
  const db = new PGlite();
  await db.exec(initial);
  await db.query(
    'insert into yojanasetu.schemes(id,payload) values($1,$2::jsonb)',
    [example.id, JSON.stringify(example)],
  );
  const query: NeonQuery = async <Row>(sql: string, params: unknown[] = []) =>
    (await db.query<Row>(sql, params)).rows;
  const store = createNeonStore(query);
  const alice = await store.ensureUser('neon-user-alice', 'alice@example.test');
  const bob = await store.ensureUser('neon-user-bob', 'bob@example.test');
  return { db, store, alice, bob };
}

test('Neon identities are text IDs, provision safely, and never self-promote', async () => {
  const { db, store, alice } = await fixture();
  try {
    assert.equal(alice.role, 'user');
    assert.equal(
      (await store.ensureUser(alice.id, 'ALICE2@example.test')).email,
      'alice2@example.test',
    );
    assert.equal(
      (await store.ensureUser(alice.id, 'alice@example.test')).role,
      'user',
    );
    await assert.rejects(
      store.saveScheme({ ...alice, role: 'admin' }, example),
      /Administrator/,
    );
    await assert.rejects(
      store.saveTaxonomy({ ...alice, role: 'admin' }, 'states', [
        'Maharashtra',
      ]),
      /Administrator/,
    );
    await assert.rejects(
      store.adminSnapshot({ ...alice, role: 'admin' }),
      /Administrator/,
    );
    await db.query("update yojanasetu.users set role='admin' where id=$1", [
      alice.id,
    ]);
    assert.equal(
      (await store.ensureUser(alice.id, 'alice@example.test')).role,
      'admin',
    );
    // The stored role is authoritative even when the caller's role field is stale.
    await store.saveTaxonomy(alice, 'states', ['Maharashtra']);
    assert.deepEqual(await store.taxonomy(), { states: ['Maharashtra'] });
  } finally {
    await db.close();
  }
});

test('public catalogue hides drafts and archives even for a forged admin role', async () => {
  const { db, store, alice } = await fixture();
  try {
    for (const status of ['Draft', 'Archived']) {
      const scheme = { ...example, id: status.toLowerCase(), status };
      await db.query(
        'insert into yojanasetu.schemes(id,payload) values($1,$2::jsonb)',
        [scheme.id, JSON.stringify(scheme)],
      );
    }
    const incompleteVerified = {
      ...example,
      id: 'invalid-verified',
      status: 'Verified',
      demo: undefined,
    };
    await assert.rejects(
      db.query(
        'insert into yojanasetu.schemes(id,payload) values($1,$2::jsonb)',
        [incompleteVerified.id, JSON.stringify(incompleteVerified)],
      ),
    );
    assert.equal((await store.catalogue()).length, 1);
    assert.equal(
      (await store.catalogue({ ...alice, role: 'admin' })).length,
      1,
    );
    await db.query("update yojanasetu.users set role='admin' where id=$1", [
      alice.id,
    ]);
    assert.equal((await store.catalogue(alice)).length, 3);
    assert.equal((await store.catalogue()).length, 1);
  } finally {
    await db.close();
  }
});

test('account persistence is isolated, atomic, and rejects stale competing writes', async () => {
  const { db, store, alice, bob } = await fixture();
  try {
    const first = {
      ...empty(),
      profile: { businessName: 'First edit', objectives: [] },
    };
    const second = {
      ...empty(),
      profile: { businessName: 'Second edit', objectives: [] },
    };
    const results = await Promise.allSettled([
      store.saveUserData(alice, first, 0),
      store.saveUserData(alice, second, 0),
    ]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter((result) => result.status === 'rejected').length,
      1,
    );
    const current = await store.userData(alice);
    assert.equal(current.version, 1);
    assert.deepEqual((await store.userData(bob)).data, empty());
    await assert.rejects(
      store.saveUserData(
        alice,
        { ...first, saved: [{ schemeId: 'missing', notes: '' }] },
        1,
      ),
    );
    assert.deepEqual(await store.userData(alice), current);
    await assert.rejects(
      store.userData({
        id: 'unknown',
        email: 'unknown@example.test',
        role: 'user',
      }),
      /Authentication/,
    );
  } finally {
    await db.close();
  }
});

test('application and notification identifiers cannot be claimed across accounts', async () => {
  const { db, store, alice, bob } = await fixture();
  try {
    const owner = empty();
    owner.applications.push(application('alice-application'));
    owner.notifications.push({
      id: 'alice-notification',
      title: 'Private',
      body: 'Only Alice',
      read: false,
      kind: 'test',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    await store.saveUserData(alice, owner, 0);
    await assert.rejects(
      store.saveUserData(
        bob,
        { ...empty(), applications: owner.applications },
        0,
      ),
    );
    await assert.rejects(
      store.saveUserData(
        bob,
        { ...empty(), notifications: owner.notifications },
        0,
      ),
    );
    assert.deepEqual((await store.userData(bob)).data, empty());
    assert.equal(
      (await store.userData(alice)).data.notifications[0].body,
      'Only Alice',
    );
  } finally {
    await db.close();
  }
});

test('private files enforce owner and application association and survive profile saves', async () => {
  const { db, store, alice, bob } = await fixture();
  try {
    const owner = empty();
    owner.applications.push(application('alice-application'));
    await store.saveUserData(alice, owner, 0);
    const bytes = Buffer.from('%PDF-1.7\nprivate document');
    await assert.rejects(
      store.saveFile(
        bob,
        'alice-application',
        'stolen',
        'application/pdf',
        'a.pdf',
        bytes,
      ),
      /not found/,
    );
    await store.saveFile(
      alice,
      'alice-application',
      'private-file',
      'application/pdf',
      'a.pdf',
      bytes,
    );
    assert.equal(
      await store.readFile(alice, 'private-file'),
      null,
      'Unattached uploads are not downloadable',
    );
    owner.applications[0].documents[0] = {
      name: 'Certificate',
      complete: true,
      fileId: 'private-file',
      fileName: 'a.pdf',
    };
    await store.saveUserData(alice, owner, 1);
    assert.deepEqual(
      (await store.readFile(alice, 'private-file'))?.bytes,
      bytes,
    );
    assert.equal(await store.readFile(bob, 'private-file'), null);
    await store.deleteFile(bob, 'private-file');
    await store.deleteFile(alice, 'private-file');
    assert.ok(
      await store.readFile(alice, 'private-file'),
      'Referenced files cannot be deleted by cleanup',
    );
    const bad = { ...empty(), applications: [application('bob-application')] };
    bad.applications[0].documents[0].fileId = 'private-file';
    await assert.rejects(store.saveUserData(bob, bad, 0));
    const wrongApplication = structuredClone(owner);
    wrongApplication.applications[0].id = 'another-alice-application';
    await assert.rejects(store.saveUserData(alice, wrongApplication, 2));
    owner.profile = { businessName: 'Updated business' };
    await store.saveUserData(alice, owner, 2);
    assert.deepEqual(
      (await store.readFile(alice, 'private-file'))?.bytes,
      bytes,
    );
    owner.applications[0].documents[0] = {
      name: 'Certificate',
      complete: false,
    };
    await store.saveUserData(alice, owner, 3);
    await store.deleteFile(alice, 'private-file');
    assert.equal(
      (await db.query('select id from yojanasetu.private_files')).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test('scheme updates notify subscribers and invalidate old account versions', async () => {
  const { db, store, alice, bob } = await fixture();
  try {
    await db.query("update yojanasetu.users set role='admin' where id=$1", [
      alice.id,
    ]);
    const data = { ...empty(), saved: [{ schemeId: example.id, notes: '' }] };
    await store.saveUserData(bob, data, 0);
    await store.saveScheme(alice, {
      ...example,
      description: 'Updated test description',
    });
    await assert.rejects(store.saveUserData(bob, data, 1), /another window/);
    const current = await store.userData(bob);
    assert.equal(current.version, 2);
    assert.equal(current.data.notifications[0].kind, 'scheme-updated');
    await store.saveUserData(bob, current.data, current.version);
    assert.equal((await store.userData(bob)).data.notifications.length, 1);
    const snapshot = await store.adminSnapshot(alice);
    assert.equal(snapshot.users.length, 2);
    assert.equal(
      snapshot.accounts.flatMap((account) => account.saved).length,
      1,
    );
  } finally {
    await db.close();
  }
});

test('enquiries use the verified owner and cannot overwrite another enquiry', async () => {
  const { db, store, alice, bob } = await fixture();
  try {
    const enquiry = {
      id: 'enquiry-1',
      userId: alice.id,
      business: 'Example',
      schemeId: example.id,
      question: 'Help',
      contact: 'alice@example.test',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    await assert.rejects(store.saveEnquiry(bob, enquiry), /owner mismatch/);
    await store.saveEnquiry(alice, enquiry);
    await assert.rejects(
      store.saveEnquiry(bob, { ...enquiry, userId: bob.id }),
    );
    assert.equal(
      (
        await db.query<{ user_id: string }>(
          'select user_id from yojanasetu.enquiries',
        )
      ).rows[0].user_id,
      alice.id,
    );
  } finally {
    await db.close();
  }
});

test('database clients have no public schema/table/function access or permissive RLS policies', async () => {
  const { db } = await fixture();
  try {
    await db.exec('create role untrusted_browser; set role untrusted_browser;');
    await assert.rejects(
      db.query('select * from yojanasetu.users'),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select yojanasetu.read_user_data('neon-user-alice')"),
      /permission denied/,
    );
    await db.exec('reset role;');
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int from pg_tables where schemaname='yojanasetu' and not rowsecurity",
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int from pg_policies where schemaname='yojanasetu'",
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});
