import nextEnv from '@next/env';
import { neonAuthUrl } from '../services/backend-config';
import { Client, neonConfig } from '@neondatabase/serverless';

const requiredTables = [
  'schema_migrations',
  'users',
  'user_data',
  'schemes',
  'saved_schemes',
  'applications',
  'notifications',
  'enquiries',
  'taxonomy',
  'private_files',
  'audit_logs',
];

function validUrl(value: string | undefined, protocols: string[]) {
  try {
    const url = new URL(value ?? '');
    return protocols.includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'Usage: npx tsx scripts/neon-check.ts\n' +
        'Run from the project folder. Reads .env.local, validates configuration,\n' +
        'and checks the connection and application tables in a read-only transaction.\n' +
        'It does not create tables, seed data, or contact the Neon Auth endpoint.',
    );
    return;
  }
  if (process.argv.length > 2) {
    console.error('Unknown option. Use --help for checker usage.');
    process.exitCode = 1;
    return;
  }
  let envError = false;
  nextEnv.loadEnvConfig(process.cwd(), false, {
    info() {},
    error() {
      envError = true;
    },
  });
  if (envError) {
    console.error(
      'Environment loading failed. Check the local environment files.',
    );
    process.exitCode = 1;
    return;
  }
  const connectionString = process.env.DATABASE_URL;
  const databaseUrlValid = validUrl(connectionString, [
    'postgres:',
    'postgresql:',
  ]);
  const checks: [string, boolean][] = [
    ['DATABASE_URL is a PostgreSQL URL', databaseUrlValid],
    ['Neon Auth has a valid HTTPS URL', Boolean(neonAuthUrl())],
    [
      'NEON_AUTH_COOKIE_SECRET contains at least 32 characters',
      (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
    ],
    [
      'NEXT_PUBLIC_SITE_URL is an HTTP or HTTPS URL',
      validUrl(process.env.NEXT_PUBLIC_SITE_URL, ['http:', 'https:']),
    ],
  ];
  for (const [label, passed] of checks) {
    console.log(`${passed ? 'PASS' : 'CHECK'} ${label}.`);
  }
  if (process.env.DEMO_MODE === 'true') {
    console.log(
      'INFO DEMO_MODE=true is ignored when Neon configuration is present.',
    );
  }
  if (checks.some(([, passed]) => !passed)) process.exitCode = 1;
  if (!databaseUrlValid) return;

  neonConfig.webSocketConstructor = WebSocket;
  const client = new Client({
    connectionString,
    application_name: 'yojanasetu-readonly-check',
    connectionTimeoutMillis: 15_000,
    statement_timeout: 15_000,
  });
  client.on('error', () => {});
  client.on('notice', () => {});
  let started = false;
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    started = true;
    await client.query('SELECT 1');
    console.log('PASS Database connection (read-only).');
    const tables = await client.query<{
      name: string;
      relation: string | null;
    }>(
      `SELECT name, to_regclass('yojanasetu.' || name)::text AS relation
       FROM unnest($1::text[]) AS expected(name)`,
      [requiredTables],
    );
    const missing = tables.rows.filter(({ relation }) => relation === null);
    if (missing.length) {
      console.log(
        `CHECK Missing application tables: ${missing.map(({ name }) => name).join(', ')}.`,
      );
      console.log(
        'Run npm run db:neon:setup to apply the application migrations.',
      );
      process.exitCode = 1;
    } else {
      console.log(
        'PASS All YojanaSetu application tables and migration ledger exist.',
      );
      const count = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM yojanasetu.schemes',
      );
      console.log(`Catalog contains ${count.rows[0].count} scheme records.`);
      if (count.rows[0].count === '0') {
        console.log(
          'The catalog is empty. Add reviewed schemes or explicitly use --seed-demo for illustrative test records.',
        );
      }
    }
    await client.query('ROLLBACK');
    started = false;
    console.log(
      'Read-only check complete. Neon Auth sign-in still requires a separate application flow test.',
    );
  } finally {
    if (started) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    try {
      await client.end();
    } catch {}
  }
}

main().catch(() => {
  console.error(
    'Database check could not complete. Check DATABASE_URL, network access, ' +
      'and database permissions. Credentials and raw database errors are not logged.',
  );
  process.exitCode = 1;
});
