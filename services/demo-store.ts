import type {
  Application,
  Enquiry,
  Notification,
  Scheme,
  User,
  UserData,
} from '@/types';
import { seedSchemes } from '@/database/seed';
import { industries, states, objectives } from '@/lib/validation';
export const emptyData = (): UserData => ({
  profile: {},
  saved: [],
  applications: [],
  notifications: [],
  preferences: { email: false, inApp: true },
  events: [],
});
export type DemoDatabase = {
  users: (User & { passwordHash: string; salt: string })[];
  sessions: { tokenHash: string; userId: string; expires: number }[];
  data: Record<string, UserData>;
  schemes: Scheme[];
  enquiries: Enquiry[];
  taxonomy: Record<string, string[]>;
  audit: { userId: string; action: string; at: string }[];
  files: {
    id: string;
    userId: string;
    name: string;
    mime: string;
    bytes: string;
  }[];
};
let pending: Promise<unknown> = Promise.resolve();
export async function demoTransaction<T>(
  fn: (db: DemoDatabase) => Promise<T> | T,
): Promise<T> {
  if (process.env.DEMO_MODE !== 'true' || process.env.NODE_ENV === 'production')
    throw new Error('Demo mode is unavailable.');
  const task = pending.then(async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = path.resolve(process.cwd(), '.data');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'demo.json');
    let db: DemoDatabase;
    try {
      db = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      db = {
        users: [],
        sessions: [],
        data: {},
        schemes: seedSchemes,
        enquiries: [],
        audit: [],
        files: [],
        taxonomy: { industries, states, categories: objectives },
      };
    }
    const result = await fn(db);
    await fs.writeFile(file + '.tmp', JSON.stringify(db), { mode: 0o600 });
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(file + '.tmp', file);
        break;
      } catch (error) {
        if (
          attempt >= 5 ||
          !['EPERM', 'EACCES', 'EBUSY'].includes(
            (error as NodeJS.ErrnoException).code ?? '',
          )
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
    return result;
  });
  pending = task.catch(() => {});
  return task;
}
export async function hash(text: string) {
  return Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  ).toString('hex');
}
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return Buffer.from(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(salt),
        iterations: 210000,
      },
      key,
      256,
    ),
  ).toString('hex');
}
export function newNotification(
  title: string,
  body: string,
  kind: string,
  schemeId?: string,
): Notification {
  return {
    id: crypto.randomUUID(),
    title,
    body,
    kind,
    schemeId,
    read: false,
    createdAt: new Date().toISOString(),
  };
}
export function newApplication(scheme: Scheme): Application {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    schemeId: scheme.id,
    status: 'Interested',
    checklistStatus: 'Not Started',
    notes: '',
    reference: '',
    applicationDate: '',
    documents: scheme.documents.map((name) => ({ name, complete: false })),
    history: [{ status: 'Interested', at: now }],
    updatedAt: now,
  };
}
