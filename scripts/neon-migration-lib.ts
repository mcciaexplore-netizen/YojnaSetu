import { createHash } from 'node:crypto';

/** A single, pinned PostgreSQL connection; never pass a pool directly. */
export type MigrationConnection = {
  query: (
    sql: string,
    parameters?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
  /** PGlite uses exec for raw, multi-statement migration files. */
  exec?: (sql: string) => Promise<unknown>;
};

export type NeonMigration = { name: string; sql: string };
export type NeonSeedScheme = { id: string };
export type NeonMigrationOptions = {
  /** Omit to leave the scheme catalog empty or retain its existing contents. */
  schemes?: readonly NeonSeedScheme[];
  taxonomy?: Record<string, readonly string[]>;
};
export type NeonMigrationResult = {
  applied: string[];
  skipped: string[];
  seededSchemes: number;
  seededTaxonomy: number;
};

export class NeonMigrationError extends Error {
  constructor(
    readonly code:
      | 'INVALID_MIGRATIONS'
      | 'CHECKSUM_MISMATCH'
      | 'DATABASE_ERROR',
    readonly migrationName?: string,
  ) {
    super(
      code === 'CHECKSUM_MISMATCH'
        ? 'An applied migration has changed. Restore it and add a new migration.'
        : code === 'INVALID_MIGRATIONS'
          ? 'Migration names must be unique, safe SQL filenames.'
          : 'The database migration did not complete. No credentials are included in this error.',
    );
    this.name = 'NeonMigrationError';
  }
}

export const migrationChecksum = (sql: string) =>
  createHash('sha256').update(sql, 'utf8').digest('hex');

/**
 * Applies the entire batch and optional seeds atomically. SQL files must not
 * contain transaction control; this runner owns BEGIN / COMMIT / ROLLBACK.
 * The advisory lock serializes runs on the same database. Only YojanaSetu's
 * isolated schema is managed here; migrations are trusted, reviewed SQL files.
 */
export async function applyNeonMigrations(
  connection: MigrationConnection,
  migrations: readonly NeonMigration[],
  options: NeonMigrationOptions = {},
): Promise<NeonMigrationResult> {
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name));
  if (
    ordered.some(({ name }) => !/^[0-9][a-zA-Z0-9_-]*\.sql$/.test(name)) ||
    new Set(ordered.map(({ name }) => name)).size !== ordered.length
  ) {
    throw new NeonMigrationError('INVALID_MIGRATIONS');
  }
  const result: NeonMigrationResult = {
    applied: [],
    skipped: [],
    seededSchemes: 0,
    seededTaxonomy: 0,
  };
  let started = false;
  try {
    await connection.query('BEGIN');
    started = true;
    // Stable application-specific keys; the lock is released at transaction end.
    await connection.query(
      'SELECT pg_advisory_xact_lock(1929376801, 1667392871)',
    );
    await connection.query('CREATE SCHEMA IF NOT EXISTS yojanasetu');
    await connection.query(`CREATE TABLE IF NOT EXISTS yojanasetu.schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await connection.query(
      'ALTER TABLE yojanasetu.schema_migrations ENABLE ROW LEVEL SECURITY',
    );
    await connection.query(
      'REVOKE ALL ON yojanasetu.schema_migrations FROM PUBLIC',
    );
    const { rows } = await connection.query(
      'SELECT name, checksum FROM yojanasetu.schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    for (const migration of ordered) {
      const checksum = migrationChecksum(migration.sql);
      if (applied.has(migration.name)) {
        if (applied.get(migration.name) !== checksum) {
          throw new NeonMigrationError('CHECKSUM_MISMATCH', migration.name);
        }
        result.skipped.push(migration.name);
        continue;
      }
      if (connection.exec) await connection.exec(migration.sql);
      else await connection.query(migration.sql);
      await connection.query(
        'INSERT INTO yojanasetu.schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, checksum],
      );
      result.applied.push(migration.name);
    }
    for (const scheme of options.schemes ?? []) {
      const inserted = await connection.query(
        `INSERT INTO yojanasetu.schemes (id, payload) VALUES ($1, $2::jsonb)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [scheme.id, JSON.stringify(scheme)],
      );
      result.seededSchemes += inserted.rows.length;
    }
    for (const [kind, values] of Object.entries(options.taxonomy ?? {})) {
      const inserted = await connection.query(
        `INSERT INTO yojanasetu.taxonomy (kind, values) VALUES ($1, $2::jsonb)
         ON CONFLICT (kind) DO NOTHING RETURNING kind`,
        [kind, JSON.stringify(values)],
      );
      result.seededTaxonomy += inserted.rows.length;
    }
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    if (started) {
      try {
        await connection.query('ROLLBACK');
      } catch {
        // Preserve a safe error even if a disconnected client cannot roll back.
      }
    }
    if (error instanceof NeonMigrationError) throw error;
    throw new NeonMigrationError('DATABASE_ERROR');
  }
}
