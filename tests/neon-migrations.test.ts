import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { seedSchemes } from '../database/seed';
import { industries, states, objectives } from '../lib/validation';
import {
  applyNeonMigrations,
  migrationChecksum,
  NeonMigrationError,
  type MigrationConnection,
} from '../scripts/neon-migration-lib';

const connection = (db: PGlite): MigrationConnection => ({
  query: (sql, parameters) =>
    db.query<Record<string, unknown>>(sql, parameters),
  exec: (sql) => db.exec(sql),
});
const fixture = {
  name: '0001_fixture.sql',
  sql: `CREATE TABLE yojanasetu.schemes (id text PRIMARY KEY, payload jsonb NOT NULL);
        CREATE TABLE yojanasetu.taxonomy (kind text PRIMARY KEY, values jsonb NOT NULL);`,
};
const errorCode = (code: NeonMigrationError['code']) => (error: unknown) =>
  error instanceof NeonMigrationError && error.code === code;

// These tests use isolated, in-memory PostgreSQL. No environment files or live
// Neon endpoints are loaded; even the actual migration is executed only locally.
test('Neon migrations apply the actual schema once and preserve seeded catalog edits', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth.untouched (value text);
      INSERT INTO neon_auth.untouched VALUES ('auth-owned');
      CREATE TABLE public.untouched (value text);
      INSERT INTO public.untouched VALUES ('other-app');`);
    const migration = {
      name: '0001_application.sql',
      sql: await readFile(
        new URL('../neon/migrations/0001_application.sql', import.meta.url),
        'utf8',
      ),
    };
    const options = {
      schemes: seedSchemes,
      taxonomy: { industries, states, categories: objectives },
    };
    const first = await applyNeonMigrations(
      connection(db),
      [migration],
      options,
    );
    assert.deepEqual(first, {
      applied: ['0001_application.sql'],
      skipped: [],
      seededSchemes: 14,
      seededTaxonomy: 3,
    });
    const catalog = await db.query<{
      payload: { demo: boolean; status: string };
    }>('SELECT payload FROM yojanasetu.schemes');
    assert.equal(catalog.rows.length, 14);
    assert.ok(
      catalog.rows.every(
        ({ payload }) => payload.demo && payload.status === 'Needs Review',
      ),
    );
    await db.query(
      `UPDATE yojanasetu.schemes SET payload=jsonb_set(payload, '{description}', '"Edited by admin"') WHERE id=$1`,
      [seedSchemes[0].id],
    );
    await db.query(
      `UPDATE yojanasetu.taxonomy SET values='["Admin category"]'::jsonb WHERE kind='categories'`,
    );
    const second = await applyNeonMigrations(
      connection(db),
      [migration],
      options,
    );
    assert.deepEqual(second, {
      applied: [],
      skipped: ['0001_application.sql'],
      seededSchemes: 0,
      seededTaxonomy: 0,
    });
    assert.equal(
      (
        await db.query<{ description: string }>(
          `SELECT payload->>'description' AS description FROM yojanasetu.schemes WHERE id=$1`,
          [seedSchemes[0].id],
        )
      ).rows[0].description,
      'Edited by admin',
    );
    assert.deepEqual(
      (
        await db.query<{ values: string[] }>(
          `SELECT values FROM yojanasetu.taxonomy WHERE kind='categories'`,
        )
      ).rows[0].values,
      ['Admin category'],
    );
    assert.deepEqual(
      (
        await db.query(
          'SELECT name, checksum FROM yojanasetu.schema_migrations',
        )
      ).rows,
      [{ name: migration.name, checksum: migrationChecksum(migration.sql) }],
    );
    assert.equal(
      (
        await db.query<{ relrowsecurity: boolean }>(
          "SELECT relrowsecurity FROM pg_class WHERE oid='yojanasetu.schema_migrations'::regclass",
        )
      ).rows[0].relrowsecurity,
      true,
    );
    assert.deepEqual(
      (await db.query('SELECT * FROM neon_auth.untouched')).rows,
      [{ value: 'auth-owned' }],
    );
    assert.deepEqual((await db.query('SELECT * FROM public.untouched')).rows, [
      { value: 'other-app' },
    ]);
  } finally {
    await db.close();
  }
});

test('Neon migrations leave the scheme catalog empty without explicit demo seed', async () => {
  const db = new PGlite();
  try {
    await applyNeonMigrations(connection(db), [fixture], {
      taxonomy: { industries, states, categories: objectives },
    });
    assert.equal(
      (await db.query('SELECT id FROM yojanasetu.schemes')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('SELECT kind FROM yojanasetu.taxonomy')).rows.length,
      3,
    );
  } finally {
    await db.close();
  }
});

test('Neon migrations reject edited checksums and roll back earlier pending files', async () => {
  const db = new PGlite();
  try {
    const existing = { ...fixture, name: '0002_fixture.sql' };
    await applyNeonMigrations(connection(db), [existing]);
    await assert.rejects(
      applyNeonMigrations(connection(db), [
        {
          name: '0001_pending.sql',
          sql: 'CREATE TABLE yojanasetu.pending (id text)',
        },
        { ...existing, sql: `${existing.sql}\n-- changed` },
      ]),
      errorCode('CHECKSUM_MISMATCH'),
    );
    assert.equal(
      (
        await db.query<{ table_name: string | null }>(
          "SELECT to_regclass('yojanasetu.pending')::text AS table_name",
        )
      ).rows[0].table_name,
      null,
    );
    assert.deepEqual(
      (await db.query('SELECT name FROM yojanasetu.schema_migrations')).rows,
      [{ name: existing.name }],
    );
  } finally {
    await db.close();
  }
});

test('Neon migration failure rolls back schema, ledger, and all earlier statements', async () => {
  const db = new PGlite();
  try {
    await assert.rejects(
      applyNeonMigrations(connection(db), [
        {
          name: '0002_bad.sql',
          sql: 'SELECT missing_column FROM yojanasetu.schemes',
        },
        fixture,
      ]),
      errorCode('DATABASE_ERROR'),
    );
    assert.equal(
      (await db.query("SELECT 1 FROM pg_namespace WHERE nspname='yojanasetu'"))
        .rows.length,
      0,
    );
    const retry = await applyNeonMigrations(connection(db), [fixture]);
    assert.deepEqual(retry.applied, [fixture.name]);
  } finally {
    await db.close();
  }
});

test('Neon seed failure rolls back the migration batch and does not expose database error text', async () => {
  const db = new PGlite();
  try {
    await assert.rejects(
      applyNeonMigrations(connection(db), [fixture], {
        schemes: seedSchemes,
        taxonomy: { invalid: undefined as unknown as string[] },
      }),
      (error: unknown) => {
        assert.ok(error instanceof NeonMigrationError);
        assert.equal(error.code, 'DATABASE_ERROR');
        assert.ok(!error.message.includes('null value'));
        assert.ok(!error.message.includes('invalid'));
        return true;
      },
    );
    assert.equal(
      (await db.query("SELECT 1 FROM pg_namespace WHERE nspname='yojanasetu'"))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test('Neon migration names must be unique and cannot be paths', async () => {
  const db = new PGlite();
  try {
    await assert.rejects(
      applyNeonMigrations(connection(db), [fixture, fixture]),
      errorCode('INVALID_MIGRATIONS'),
    );
    await assert.rejects(
      applyNeonMigrations(connection(db), [
        { ...fixture, name: '../0001.sql' },
      ]),
      errorCode('INVALID_MIGRATIONS'),
    );
    assert.equal(
      (await db.query("SELECT 1 FROM pg_namespace WHERE nspname='yojanasetu'"))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
