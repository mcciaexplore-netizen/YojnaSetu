import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;grant usage on schema auth,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
);
await db.exec(
  await readFile('supabase/migrations/202609050001_initial.sql', 'utf8'),
);
await db.exec(
  await readFile('supabase/migrations/202609050002_deadlines.sql', 'utf8'),
);
await db.exec(await readFile('supabase/seed.sql', 'utf8'));
const tables = await db.query<{ count: number }>(
  "select count(*)::int from pg_tables where schemaname='public' and rowsecurity",
);
assert.equal(tables.rows[0].count, 17);
const u1 = '00000000-0000-4000-8000-000000000001',
  u2 = '00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users values ($1,$2),($3,$4)', [
  u1,
  'a@example.test',
  u2,
  'b@example.test',
]);
await db.exec(
  `set role authenticated;select set_config('request.jwt.claim.sub','${u1}',false);`,
);
const data = {
  profile: { businessName: 'Protected Business', objectives: ['Export'] },
  saved: [],
  applications: [],
  notifications: [],
  preferences: { email: false, inApp: true },
  events: [],
};
await db.query('select public.commit_user_data($1::jsonb,0)', [
  JSON.stringify(data),
]);
assert.equal(
  (await db.query('select * from business_profiles')).rows.length,
  1,
);
await db.exec(`select set_config('request.jwt.claim.sub','${u2}',false)`);
assert.equal(
  (await db.query('select * from business_profiles')).rows.length,
  0,
);
assert.equal((await db.query('select * from users')).rows.length, 1);
await assert.rejects(() =>
  db.query("update users set role='admin' where id=$1", [u2]),
);
await assert.rejects(() => db.query('select admin_analytics()'));
await db.exec(`select set_config('request.jwt.claim.sub','${u1}',false)`);
await assert.rejects(() =>
  db.query('select commit_user_data($1::jsonb,0)', [JSON.stringify(data)]),
);
await db.exec(
  `reset role;update users set role='admin' where id='${u1}';set role authenticated;`,
);
assert.equal((await db.query('select * from users')).rows.length, 2);
assert.equal((await db.query('select admin_analytics()')).rows.length, 1);
console.log(
  'PASS migration executed, 17 tables with RLS, seed loaded, owner isolation, privilege escalation denied, stale writes rejected, admin access checked',
);
await db.close();
