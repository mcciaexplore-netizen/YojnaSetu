import 'server-only';
import { neon } from '@neondatabase/serverless';
import type { User } from '../types';
import { createNeonStore, type NeonQuery, type NeonStore } from './neon-store';
import { neonConfigured } from './backend-config';

let connectionUrl: string | undefined;
let store: NeonStore | undefined;

export function neonStore(): NeonStore {
  if (!neonConfigured())
    throw Error(
      'Neon setup is incomplete. Check the server environment settings.',
    );
  if (store && connectionUrl === process.env.DATABASE_URL) return store;
  try {
    const databaseUrl = process.env.DATABASE_URL!;
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw Error();
    const sql = neon(databaseUrl);
    const query: NeonQuery = async <Row>(
      statement: string,
      values: unknown[] = [],
    ) => {
      try {
        return (await sql.query(statement, values)) as Row[];
      } catch (error) {
        // Driver errors can include connection details; return only application-safe messages.
        const code = (error as { code?: string }).code;
        const message =
          code === '40001'
            ? 'Your account changed. Refresh and try again.'
            : code === '42501'
              ? 'You do not have permission to perform this action.'
              : code === '42P01' || code === '42883'
                ? 'The Neon application tables are not ready. Run the database setup command.'
                : 'The database request could not be completed. Please try again.';
        throw Object.assign(new Error(message), { code });
      }
    };
    store = createNeonStore(query);
    connectionUrl = databaseUrl;
    return store;
  } catch {
    throw Error('The Neon database connection is not configured correctly.');
  }
}

export const ensureNeonUser = (id: string, email: string) =>
  neonStore().ensureUser(id, email);
export const saveNeonTaxonomy = (user: User, kind: string, values: string[]) =>
  neonStore().saveTaxonomy(user, kind, values);
export const saveNeonFile = (
  user: User,
  applicationId: string,
  fileId: string,
  mime: string,
  name: string,
  bytes: Uint8Array,
) => neonStore().saveFile(user, applicationId, fileId, mime, name, bytes);
export const readNeonFile = (user: User, id: string) =>
  neonStore().readFile(user, id);
export const deleteNeonFile = (user: User, id: string) =>
  neonStore().deleteFile(user, id);
