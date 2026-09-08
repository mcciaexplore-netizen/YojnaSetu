import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  identity,
  requireSameOrigin,
  supabase,
  liveConfigured,
  demoEnabled,
  siteOrigin,
} from '@/services/auth';
import {
  appData,
  catalogue,
  userData,
  saveUserData,
  saveScheme,
  saveEnquiry,
} from '@/services/repository';
import {
  demoTransaction,
  emptyData,
  hash,
  passwordHash,
  newApplication,
  newNotification,
} from '@/services/demo-store';
import {
  profileSchema,
  draftProfileSchema,
  schemeSchema,
  applicationStatuses,
} from '@/lib/validation';
import { matchScheme, recommendations, searchScheme } from '@/lib/matching';
import { recommendationsPdf, csvCell } from '@/services/reports';
import type { Profile, Scheme } from '@/types';
import {
  neonConfigured,
  anyNeonConfigured,
  neonConfigurationError,
  neonConfigurationChecks,
} from '@/services/backend-config';
import { handleNeonAuthAction } from '@/services/neon-auth';
import {
  saveNeonFile,
  readNeonFile,
  deleteNeonFile,
  saveNeonTaxonomy,
} from '@/services/neon-db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const limit = new Map<string, { count: number; until: number }>();
function rateLimit(key: string) {
  const now = Date.now();
  const bucket = limit.get(key);
  if (bucket && bucket.until > now) {
    if (++bucket.count > 30)
      throw Error('Too many attempts. Please try again in a minute.');
  } else limit.set(key, { count: 1, until: now + 60000 });
  if (limit.size > 5000)
    for (const [k, v] of limit) if (v.until < now) limit.delete(k);
}
function responseWithCookies(data: unknown, shell: NextResponse, status = 200) {
  const out = NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  shell.cookies.getAll().forEach((c) => out.cookies.set(c));
  return out;
}
async function handle(req: NextRequest) {
  const shell = NextResponse.json({});
  try {
    const path = req.nextUrl.pathname.replace(/^\/api\//, '');
    if (path === 'health')
      return NextResponse.json({
        ok: true,
        configured: liveConfigured(),
        demo: demoEnabled(),
        checks: anyNeonConfigured() ? neonConfigurationChecks() : undefined,
        provider: neonConfigured()
          ? 'neon'
          : demoEnabled()
            ? 'demo'
            : liveConfigured()
              ? 'supabase'
              : 'unconfigured',
      });
    if (
      (anyNeonConfigured() && !neonConfigured()) ||
      (!liveConfigured() && !demoEnabled())
    )
      return NextResponse.json(
        {
          error: anyNeonConfigured()
            ? neonConfigurationError()
            : 'Complete the database and authentication settings. See the setup instructions.',
        },
        { status: 503 },
      );
    if (req.method === 'POST') requireSameOrigin(req);
    if (path === 'auth' && req.method === 'POST' && neonConfigured()) {
      const body = await req.json();
      rateLimit(
        'auth:' +
          String(
            body?.email ?? req.headers.get('x-forwarded-for') ?? '',
          ).toLowerCase(),
      );
      return responseWithCookies(
        await handleNeonAuthAction(req, shell, body),
        shell,
      );
    }
    const user = await identity(req, shell);
    if (path === 'auth' && req.method === 'POST') {
      const body = await req.json();
      const action = z
        .enum(['login', 'signup', 'logout', 'forgot', 'reset'])
        .parse(body.action);
      if (action === 'logout') {
        if (liveConfigured()) await supabase(req, shell).auth.signOut();
        else {
          const tokenHash = await hash(
            req.cookies.get('ys_session')?.value ?? '',
          );
          await demoTransaction((db) => {
            db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
          });
        }
        shell.cookies.delete('ys_session');
        return responseWithCookies({ ok: true }, shell);
      }
      rateLimit('auth:' + String(body.email ?? '').toLowerCase());
      if (action === 'reset') {
        if (!liveConfigured() || !user)
          throw Error('Open the recovery link from your email first.');
        const password = z.string().min(12).max(128).parse(body.password);
        const { error } = await supabase(req, shell).auth.updateUser({
          password,
        });
        if (error)
          throw Error(
            'Password could not be updated. Request a new recovery link.',
          );
        return responseWithCookies({ ok: true }, shell);
      }
      const email = z.string().email().max(254).parse(body.email).toLowerCase();
      if (action === 'forgot') {
        if (!liveConfigured())
          throw Error(
            'Email recovery is unavailable in local demo mode. Connect live authentication for recovery.',
          );
        const { error } = await supabase(req, shell).auth.resetPasswordForEmail(
          email,
          {
            redirectTo: new URL(
              '/auth/callback?next=/auth?mode=reset',
              siteOrigin(req),
            ).href,
          },
        );
        if (error)
          throw Error(
            'The recovery request could not be processed. Try again later.',
          );
        return responseWithCookies(
          {
            message:
              'If an account exists, a recovery email has been requested.',
          },
          shell,
        );
      }
      const password = z.string().min(12).max(128).parse(body.password);
      if (liveConfigured()) {
        const client = supabase(req, shell);
        const result =
          action === 'signup'
            ? await client.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: new URL('/auth/callback', siteOrigin(req))
                    .href,
                },
              })
            : await client.auth.signInWithPassword({ email, password });
        if (result.error)
          throw Error(
            action === 'login'
              ? 'Email or password is incorrect.'
              : 'Account creation failed. Check your details and try again.',
          );
        return responseWithCookies(
          { ok: true, confirmation: !result.data.session },
          shell,
        );
      }
      const result = await demoTransaction(async (db) => {
        let account = db.users.find((u) => u.email === email);
        if (action === 'signup') {
          if (account)
            throw Error('An account with this email already exists.');
          const salt = crypto.randomUUID();
          account = {
            id: crypto.randomUUID(),
            email,
            role:
              process.env.DEMO_ADMIN_EMAIL?.toLowerCase() === email
                ? 'admin'
                : 'user',
            salt,
            passwordHash: await passwordHash(password, salt),
          };
          db.users.push(account);
          db.data[account.id] = emptyData();
        } else if (
          !account ||
          (await passwordHash(password, account.salt)) !== account.passwordHash
        )
          throw Error('Email or password is incorrect.');
        const token = crypto.randomUUID() + crypto.randomUUID();
        db.sessions = db.sessions.filter((s) => s.expires > Date.now());
        db.sessions.push({
          userId: account!.id,
          tokenHash: await hash(token),
          expires: Date.now() + 7 * 86400000,
        });
        return token;
      });
      shell.cookies.set('ys_session', result, {
        httpOnly: true,
        sameSite: 'strict',
        secure: req.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: 7 * 86400,
      });
      return responseWithCookies({ ok: true }, shell);
    }
    if (path === 'catalogue' && req.method === 'GET')
      return responseWithCookies(await catalogue(req, shell), shell);
    if (path === 'data' && req.method === 'GET')
      return responseWithCookies(await appData(req, shell, user), shell);
    if (path === 'scheme' && req.method === 'GET') {
      const s = (await catalogue(req, shell, user?.role === 'admin')).find(
        (s) => s.id === req.nextUrl.searchParams.get('id'),
      );
      return responseWithCookies(
        s ?? { error: 'Scheme not found.' },
        shell,
        s ? 200 : 404,
      );
    }
    if (!user)
      return responseWithCookies(
        { error: 'Please log in to continue.' },
        shell,
        401,
      );
    if (path === 'export' && req.method === 'GET') {
      const { data } = await userData(req, shell, user);
      const schemes = await catalogue(req, shell);
      if (req.nextUrl.searchParams.get('format') === 'csv') {
        const rows = [
          ['Scheme', 'Match', 'Benefit', 'Deadline', 'Data status', 'Notes'],
          ...data.saved.map((s) => {
            const scheme = schemes.find((t) => t.id === s.schemeId);
            return [
              scheme?.name,
              scheme ? matchScheme(data.profile, scheme).score : 0,
              scheme?.benefit,
              scheme?.deadline,
              scheme?.demo ? 'Demo' : scheme?.status,
              s.notes,
            ];
          }),
        ];
        return new NextResponse(
          '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'),
          {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="saved-schemes.csv"',
              'Cache-Control': 'no-store',
            },
          },
        );
      }
      const bytes = await recommendationsPdf(data.profile, schemes);
      return new NextResponse(bytes as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'attachment; filename="my-scheme-recommendations.pdf"',
          'Cache-Control': 'no-store',
        },
      });
    }
    if (path === 'upload' && req.method === 'POST') {
      if (
        Number(req.headers.get('content-length') ?? 0) >
        4 * 1024 * 1024 + 128 * 1024
      )
        throw Error('Choose a file smaller than 4 MB.');
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
        throw Error('Choose a PDF, JPEG, or PNG file under 4 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const magic =
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
          ? 'application/pdf'
          : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
            ? 'image/jpeg'
            : bytes[0] === 0x89 &&
                bytes[1] === 0x50 &&
                bytes[2] === 0x4e &&
                bytes[3] === 0x47
              ? 'image/png'
              : null;
      if (!magic || magic !== file.type)
        throw Error('The file content must be a valid PDF, JPEG, or PNG.');
      const { data, version } = await userData(req, shell, user);
      const app = data.applications.find(
        (a) => a.id === form.get('applicationId'),
      );
      const doc = app?.documents.find((d) => d.name === form.get('document'));
      if (!app || !doc) throw Error('Application document was not found.');
      const id = crypto.randomUUID();
      const previousFileId = doc.fileId;
      if (neonConfigured())
        await saveNeonFile(user, app.id, id, magic, file.name, bytes);
      else if (demoEnabled())
        await demoTransaction((db) => {
          db.files.push({
            id,
            userId: user.id,
            name: file.name,
            mime: magic,
            bytes: Buffer.from(bytes).toString('base64'),
          });
        });
      else {
        const { error } = await supabase(req, shell)
          .storage.from('application-documents')
          .upload(user.id + '/' + id, bytes, {
            contentType: magic,
            upsert: false,
          });
        if (error) throw Error('Document upload failed. Please try again.');
      }
      doc.fileId = id;
      doc.fileName = file.name;
      doc.complete = true;
      app.updatedAt = new Date().toISOString();
      try {
        await saveUserData(req, shell, user, data, version);
      } catch (error) {
        if (neonConfigured()) await deleteNeonFile(user, id).catch(() => {});
        throw error;
      }
      if (neonConfigured() && previousFileId)
        await deleteNeonFile(user, previousFileId).catch(() => {});
      return responseWithCookies({ ok: true }, shell);
    }
    if (path === 'file' && req.method === 'GET') {
      const id = z.string().uuid().parse(req.nextUrl.searchParams.get('id'));
      if (neonConfigured()) {
        const file = await readNeonFile(user, id);
        if (!file)
          return responseWithCookies(
            { error: 'Document not found.' },
            shell,
            404,
          );
        return new NextResponse(Buffer.from(file.bytes), {
          headers: {
            'Content-Type': file.mime,
            'Content-Disposition':
              'attachment; filename="' +
              file.name.replace(/[^a-zA-Z0-9. _-]/g, '_') +
              '"',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      if (demoEnabled()) {
        const f = await demoTransaction((db) =>
          db.files.find((f) => f.id === id && f.userId === user.id),
        );
        if (!f)
          return responseWithCookies(
            { error: 'Document not found.' },
            shell,
            404,
          );
        return new NextResponse(Buffer.from(f.bytes, 'base64'), {
          headers: {
            'Content-Type': f.mime,
            'Content-Disposition':
              'attachment; filename="' +
              f.name.replace(/[^a-zA-Z0-9. _-]/g, '_') +
              '"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      const { data, error } = await supabase(req, shell)
        .storage.from('application-documents')
        .createSignedUrl(user.id + '/' + id, 60, { download: true });
      if (error) throw Error('Document could not be opened.');
      return NextResponse.redirect(data.signedUrl);
    }
    if (path !== 'action' || req.method !== 'POST')
      return responseWithCookies({ error: 'Not found.' }, shell, 404);
    const body = await req.json();
    const action = z.string().max(50).parse(body.action);
    const { data, version } = await userData(req, shell, user);
    const schemes = await catalogue(req, shell, user.role === 'admin');
    const scheme = schemes.find((s) => s.id === body.schemeId);
    let answer: unknown = { ok: true };
    const now = new Date().toISOString();
    switch (action) {
      case 'profile': {
        data.profile = draftProfileSchema.parse(
          body.profile,
        ) as Partial<Profile>;
        if (body.profile.confirmed) {
          data.profile = profileSchema.parse(body.profile);
          const matches = recommendations(data.profile, schemes);
          data.events.push({ type: 'match', at: now });
          data.notifications.push(
            newNotification(
              'Your recommendations are ready',
              matches.length +
                ' potentially relevant schemes found. Review all eligibility conditions.',
              'match',
            ),
          );
        }
        break;
      }
      case 'save':
        if (data.saved.some((s) => s.schemeId === body.schemeId))
          data.saved = data.saved.filter((s) => s.schemeId !== body.schemeId);
        else {
          if (!scheme) throw Error('Scheme not found.');
          data.saved.push({ schemeId: scheme.id, notes: '' });
        }
        break;
      case 'saved-notes': {
        const s = data.saved.find((s) => s.schemeId === body.schemeId);
        if (!s) throw Error('Save this scheme first.');
        s.notes = z.string().max(5000).parse(body.notes);
        break;
      }
      case 'checklist':
        if (
          !scheme ||
          scheme.status === 'Archived' ||
          scheme.status === 'Expired' ||
          (scheme.deadline && scheme.deadline < now.slice(0, 10))
        )
          throw Error('This scheme is not accepting new applications.');
        if (!data.applications.some((a) => a.schemeId === scheme.id))
          data.applications.push(newApplication(scheme));
        break;
      case 'application': {
        const app = data.applications.find((a) => a.id === body.id);
        if (!app) throw Error('Application not found.');
        const changes = z
          .object({
            status: z.enum(applicationStatuses),
            checklistStatus: z.enum([
              'Not Started',
              'In Progress',
              'Ready',
              'Submitted',
            ]),
            notes: z.string().max(5000),
            reference: z.string().max(200),
            applicationDate: z
              .string()
              .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v)),
            documents: z
              .array(z.object({ name: z.string(), complete: z.boolean() }))
              .max(100),
          })
          .parse(body.application);
        if (
          changes.documents.length !== app.documents.length ||
          changes.documents.some((d, i) => d.name !== app.documents[i].name)
        )
          throw Error('Checklist does not match the scheme.');
        if (
          ['Ready', 'Submitted'].includes(changes.checklistStatus) &&
          changes.documents.some((d) => !d.complete)
        )
          throw Error(
            'Complete the document checklist before marking it ready.',
          );
        if (
          changes.status === 'Application Submitted' &&
          !changes.applicationDate
        )
          throw Error('Add the application date before marking submitted.');
        if (changes.status !== app.status) {
          app.history.push({ status: changes.status, at: now });
          data.notifications.push(
            newNotification(
              'Application status updated',
              (schemes.find((s) => s.id === app.schemeId)?.name ?? 'Scheme') +
                ': ' +
                changes.status,
              'application',
              app.schemeId,
            ),
          );
        }
        app.documents = app.documents.map((d, i) => ({
          ...d,
          complete: changes.documents[i].complete,
        }));
        Object.assign(app, {
          ...changes,
          documents: app.documents,
          updatedAt: now,
        });
        break;
      }
      case 'notification':
        data.notifications = data.notifications.map((n) =>
          body.id === 'all' || n.id === body.id ? { ...n, read: true } : n,
        );
        break;
      case 'preferences':
        data.preferences = z
          .object({ email: z.boolean(), inApp: z.boolean() })
          .parse(body.preferences);
        break;
      case 'reminder':
        if (!scheme) throw Error('Scheme not found.');
        if (!scheme.deadline)
          throw Error('This scheme has no recorded deadline.');
        if (
          !data.notifications.some(
            (n) => n.kind === 'reminder' && n.schemeId === scheme.id,
          )
        )
          data.notifications.push(
            newNotification(
              'Deadline reminder',
              scheme.name +
                ' … ' +
                scheme.deadline +
                '. Demo dates require verification.',
              'reminder',
              scheme.id,
            ),
          );
        break;
      case 'event':
        data.events.push({
          type: z.enum(['search', 'view']).parse(body.type),
          schemeId: body.schemeId
            ? z.string().max(100).parse(body.schemeId)
            : undefined,
          query: body.query ? z.string().max(200).parse(body.query) : undefined,
          at: now,
        });
        break;
      case 'enquiry':
        await saveEnquiry(req, shell, {
          id: crypto.randomUUID(),
          userId: user.id,
          business: data.profile.businessName ?? '',
          schemeId: scheme?.id ?? '',
          question: z.string().trim().min(10).max(5000).parse(body.question),
          contact: z.string().email().parse(body.contact),
          createdAt: now,
        });
        answer = {
          message:
            'Enquiry recorded for administrator review. No message has been sent externally.',
        };
        break;
      case 'assistant': {
        const question = z.string().min(2).max(1000).parse(body.question);
        const verified = schemes.filter(
          (s) => !s.demo && s.status === 'Verified',
        );
        const terms = question
          .toLowerCase()
          .split(/\W+/)
          .filter((t) => t.length > 3);
        const relevant = verified
          .filter((s) => terms.some((t) => searchScheme(s, t)))
          .slice(0, 3);
        answer = {
          answer: relevant.length
            ? relevant
                .map(
                  (s) =>
                    s.name +
                    ': ' +
                    (/document/i.test(question)
                      ? s.documents.join(', ')
                      : /why|eligib/i.test(question)
                        ? matchScheme(data.profile, s)
                            .conditions.map(
                              (c) =>
                                c.label +
                                ': ' +
                                (c.status === 'unknown'
                                  ? 'needs verification'
                                  : c.status === 'fail'
                                    ? 'does not match'
                                    : 'recorded condition matches'),
                            )
                            .join('; ')
                        : s.description + ' ' + s.benefit) +
                    ' Source: ' +
                    s.officialUrl,
                )
                .join('\n\n') +
              '\n\nVerify eligibility with the official authority or a qualified professional.'
            : 'This information is not available in the current verified database.',
          sources: relevant.map((s) => ({ id: s.id, name: s.name })),
        };
        break;
      }
      case 'admin-scheme':
        if (user.role !== 'admin')
          return responseWithCookies(
            { error: 'Administrator access is required.' },
            shell,
            403,
          );
        await saveScheme(
          req,
          shell,
          user,
          schemeSchema.parse(body.scheme) as Scheme,
        );
        return responseWithCookies({ ok: true }, shell);
      case 'taxonomy':
        if (user.role !== 'admin')
          return responseWithCookies(
            { error: 'Administrator access is required.' },
            shell,
            403,
          );
        {
          const kind = z
            .enum(['industries', 'states', 'categories'])
            .parse(body.kind);
          const values = z
            .array(z.string().trim().min(1).max(100))
            .min(1)
            .max(100)
            .parse(body.values);
          if (neonConfigured())
            await saveNeonTaxonomy(user, kind, [...new Set(values)]);
          else if (demoEnabled())
            await demoTransaction((db) => {
              db.taxonomy[kind] = [...new Set(values)];
            });
          else {
            const { error } = await supabase(req, shell)
              .from('taxonomy')
              .upsert({ kind, values: [...new Set(values)] });
            if (error) throw Error('Categories could not be saved.');
          }
        }
        return responseWithCookies({ ok: true }, shell);
      default:
        throw Error('This action is not supported.');
    }
    data.events = data.events.slice(-2000);
    await saveUserData(req, shell, user, data, version);
    return responseWithCookies(answer, shell);
  } catch (error) {
    if (error instanceof z.ZodError)
      return responseWithCookies(
        {
          error: error.issues
            .map(
              (i) =>
                (i.path.join('.') ? i.path.join('.') + ': ' : '') + i.message,
            )
            .slice(0, 3)
            .join(' '),
        },
        shell,
        400,
      );
    const known =
      error instanceof Error &&
      error.message.length < 200 &&
      !/sql|postgres|relation|fetch failed|token|key|ECONN|EPERM|EACCES|ENOENT|EBUSY|rename|partial\(/i.test(
        error.message,
      );
    return responseWithCookies(
      {
        error: known
          ? error.message
          : 'Something went wrong. Please try again.',
      },
      shell,
      400,
    );
  }
}
let mutationQueue: Promise<unknown> = Promise.resolve();
export async function POST(req: NextRequest) {
  if (demoEnabled()) {
    const p = mutationQueue.then(() => handle(req));
    mutationQueue = p.catch(() => {});
    return p;
  }
  return handle(req);
}
export const GET = handle;
