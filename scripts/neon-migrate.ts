import nextEnv from '@next/env';
import { Client, neonConfig } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedSchemes } from '../database/seed';
import { industries, states, objectives } from '../lib/validation';
import { applyNeonMigrations, NeonMigrationError } from './neon-migration-lib';

let connectionVariable: 'DATABASE_URL_UNPOOLED' | 'DATABASE_URL' =
  'DATABASE_URL';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'Usage: npx tsx scripts/neon-migrate.ts [--seed-demo]\n' +
        'Run from the project folder. Reads .env.local; prefers DATABASE_URL_UNPOOLED over DATABASE_URL.\n' +
        'Applies neon/migrations/*.sql and baseline taxonomy atomically.\n' +
        '--seed-demo adds illustrative demo schemes; existing catalog rows are preserved.',
    );
    return;
  }
  if (args.some((arg) => arg !== '--seed-demo')) {
    console.error('Unknown option. Use --help for migration usage.');
    process.exitCode = 1;
    return;
  }

  // Suppress loader diagnostics: invalid environment files may contain secrets.
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
  connectionVariable = process.env.DATABASE_URL_UNPOOLED
    ? 'DATABASE_URL_UNPOOLED'
    : 'DATABASE_URL';
  const connectionString = process.env[connectionVariable];
  if (!connectionString) {
    console.error(
      'Set DATABASE_URL_UNPOOLED or DATABASE_URL in .env.local before running Neon migrations.',
    );
    process.exitCode = 1;
    return;
  }
  try {
    const parsed = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
      throw new Error();
    if (!parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
      throw new Error();
    }
  } catch {
    console.error(
      `${connectionVariable} must be a valid PostgreSQL connection URL.`,
    );
    process.exitCode = 1;
    return;
  }
  const directory = join(process.cwd(), 'neon', 'migrations');
  const names = (await readdir(directory)).filter((name) =>
    name.endsWith('.sql'),
  );
  if (!names.length) {
    console.error('No SQL migrations found in neon/migrations.');
    process.exitCode = 1;
    return;
  }
  const migrations = await Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(join(directory, name), 'utf8'),
    })),
  );
  neonConfig.webSocketConstructor = WebSocket;
  const client = new Client({
    connectionString,
    application_name: 'yojanasetu-migrations',
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
    lock_timeout: 30_000,
  });
  // Client error events must not print raw connection or database information.
  client.on('error', () => {});
  client.on('notice', () => {});
  try {
    await client.connect();
    const result = await applyNeonMigrations(
      {
        query: (sql, parameters) =>
          client.query<Record<string, unknown>>(sql, parameters),
      },
      migrations,
      {
        taxonomy: { industries, states, categories: objectives },
        ...(args.includes('--seed-demo') ? { schemes: seedSchemes } : {}),
      },
    );
    console.log(
      `Neon migrations complete: ${result.applied.length} applied, ` +
        `${result.skipped.length} already applied, ` +
        `${result.seededTaxonomy} taxonomy rows added, ` +
        `${result.seededSchemes} illustrative demo schemes added.`,
    );
  } finally {
    try {
      await client.end();
    } catch {
      // Query errors are reported by the safe, top-level handler below.
    }
  }
}

main().catch((error: unknown) => {
  if (error instanceof NeonMigrationError) {
    console.error(`Migration stopped (${error.code}). ${error.message}`);
  } else {
    console.error(
      `Migration could not complete. Check ${connectionVariable}, network access, ` +
        'database permissions, and the neon/migrations folder. Credentials are not logged.',
    );
  }
  process.exitCode = 1;
});
