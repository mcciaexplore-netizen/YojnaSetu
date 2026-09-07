import type { Enquiry, Scheme, User, UserData } from '../types';

// Pure query adapter; the runtime wrapper supplies a server-only Neon connection.
export type NeonQuery = <Row = Record<string, unknown>>(
  statement: string,
  values?: unknown[],
) => Promise<Row[]>;
export type NeonFile = {
  id: string;
  applicationId: string;
  mime: string;
  name: string;
  bytes: Uint8Array;
};
export type NeonAdminSnapshot = {
  users: User[];
  enquiries: Enquiry[];
  accounts: UserData[];
};
export function createNeonStore(query: NeonQuery) {
  const userId = (user: User) => {
    if (!user?.id || user.id.length > 200)
      throw Error('Authentication required.');
    return user.id;
  };
  return {
    async ensureUser(id: string, email: string): Promise<User> {
      if (!id || id.length > 200 || !email || email.length > 254)
        throw Error('The signed-in account is incomplete.');
      const rows = await query<User>(
        `insert into yojanasetu.users(id,email) values($1,$2)
         on conflict(id) do update set email=excluded.email
         returning id,email,role`,
        [id, email.toLowerCase()],
      );
      return rows[0];
    },
    async catalogue(user: User | null = null): Promise<Scheme[]> {
      const rows = await query<{ payload: Scheme }>(
        `select payload from yojanasetu.schemes
         where status not in ('Draft','Archived')
           or exists(select 1 from yojanasetu.users where id=$1 and role='admin')
         order by payload->>'createdAt',id`,
        [user?.id ?? null],
      );
      return rows.map((row) => row.payload);
    },
    async userData(user: User): Promise<{ data: UserData; version: number }> {
      const rows = await query<{
        account: { data: UserData; version: number };
      }>('select yojanasetu.read_user_data($1) as account', [userId(user)]);
      return rows[0].account;
    },
    async saveUserData(user: User, data: UserData, version: number) {
      if (!Number.isSafeInteger(version) || version < 0)
        throw Error('Changes could not be saved. Refresh and try again.');
      try {
        await query('select yojanasetu.commit_user_data($1,$2::jsonb,$3)', [
          userId(user),
          JSON.stringify(data),
          version,
        ]);
      } catch (error) {
        if ((error as { code?: string }).code === '40001')
          throw Error(
            'Your account changed in another window. Refresh and try again.',
            { cause: error },
          );
        throw Error('Changes could not be saved. Refresh and try again.', {
          cause: error,
        });
      }
    },
    async saveScheme(user: User, scheme: Scheme) {
      // Stored function checks the current database role, not a caller-provided role flag.
      await query('select yojanasetu.save_scheme($1,$2::jsonb)', [
        userId(user),
        JSON.stringify(scheme),
      ]);
    },
    async saveEnquiry(user: User, enquiry: Enquiry) {
      if (enquiry.userId !== userId(user))
        throw Error('Enquiry owner mismatch.');
      await query(
        'insert into yojanasetu.enquiries(id,user_id,payload) values($1,$2,$3::jsonb)',
        [enquiry.id, user.id, JSON.stringify(enquiry)],
      );
    },
    async taxonomy(): Promise<Record<string, string[]>> {
      const rows = await query<{ kind: string; values: string[] }>(
        'select kind,values from yojanasetu.taxonomy order by kind',
      );
      return Object.fromEntries(rows.map((row) => [row.kind, row.values]));
    },
    async saveTaxonomy(user: User, kind: string, values: string[]) {
      if (!['industries', 'states', 'categories'].includes(kind))
        throw Error('Unknown category list.');
      await query('select yojanasetu.save_taxonomy($1,$2,$3::jsonb)', [
        userId(user),
        kind,
        JSON.stringify(values),
      ]);
    },
    async adminSnapshot(user: User): Promise<NeonAdminSnapshot> {
      const rows = await query<{ snapshot: NeonAdminSnapshot }>(
        'select yojanasetu.admin_snapshot($1) as snapshot',
        [userId(user)],
      );
      return rows[0].snapshot;
    },
    async saveFile(
      user: User,
      applicationId: string,
      fileId: string,
      mime: string,
      name: string,
      bytes: Uint8Array,
    ) {
      if (
        !applicationId ||
        !fileId ||
        bytes.byteLength < 1 ||
        bytes.byteLength > 5 * 1024 * 1024
      )
        throw Error('Choose a document of up to 5 MB.');
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mime))
        throw Error('Choose a PDF, JPEG, or PNG document.');
      if (!name || name.length > 255)
        throw Error('Use a shorter document filename.');
      await query('select yojanasetu.save_private_file($1,$2,$3,$4,$5,$6)', [
        userId(user),
        applicationId,
        fileId,
        mime,
        name,
        Buffer.from(bytes).toString('base64'),
      ]);
    },
    async readFile(user: User, id: string): Promise<NeonFile | null> {
      const rows = await query<{
        id: string;
        application_id: string;
        mime: string;
        name: string;
        base64: string;
      }>(
        `select f.id,f.application_id,f.mime,f.name,encode(f.bytes,'base64') as base64
         from yojanasetu.private_files f
         where f.id=$1 and f.user_id=$2 and exists(
           select 1 from yojanasetu.applications a,
             lateral jsonb_array_elements(a.payload->'documents') d
           where a.id=f.application_id and a.user_id=$2 and d->>'fileId'=f.id
         )`,
        [id, userId(user)],
      );
      const file = rows[0];
      return file
        ? {
            id: file.id,
            applicationId: file.application_id,
            name: file.name,
            mime: file.mime,
            bytes: Buffer.from(file.base64, 'base64'),
          }
        : null;
    },
    async deleteFile(user: User, id: string) {
      // Cleanup is allowed only for this user's unreferenced files.
      await query(
        `delete from yojanasetu.private_files f where f.id=$1 and f.user_id=$2
         and not exists(
           select 1 from yojanasetu.applications a,
             lateral jsonb_array_elements(a.payload->'documents') d
           where a.id=f.application_id and a.user_id=$2 and d->>'fileId'=f.id
         )`,
        [id, userId(user)],
      );
    },
  };
}
export type NeonStore = ReturnType<typeof createNeonStore>;
