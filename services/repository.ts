import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AppData, User, UserData, Scheme, Enquiry } from '@/types';
import { demoEnabled, supabase } from './auth';
import { demoTransaction, emptyData } from './demo-store';
import { industries, states, objectives } from '@/lib/validation';
export async function catalogue(
  req: NextRequest,
  res: NextResponse,
  admin = false,
): Promise<Scheme[]> {
  if (demoEnabled())
    return demoTransaction((db) =>
      db.schemes.filter(
        (s) => admin || !['Draft', 'Archived'].includes(s.status),
      ),
    );
  const client = supabase(req, res);
  const { data, error } = await client.from('schemes').select('payload');
  if (error) throw Error('The scheme catalogue is unavailable.');
  return (data ?? []).map((r) => r.payload);
}
export async function userData(
  req: NextRequest,
  res: NextResponse,
  user: User,
): Promise<{ data: UserData; version: number }> {
  if (demoEnabled())
    return demoTransaction((db) => ({
      data: db.data[user.id] ?? emptyData(),
      version: 0,
    }));
  const client = supabase(req, res);
  const [profile, saved, apps, notifications, prefs, events] =
    await Promise.all([
      client
        .from('business_profiles')
        .select('payload,version')
        .eq('user_id', user.id)
        .maybeSingle(),
      client.from('saved_schemes').select('payload').eq('user_id', user.id),
      client.from('applications').select('payload').eq('user_id', user.id),
      client.from('notifications').select('payload').eq('user_id', user.id),
      client.from('users').select('preferences').eq('id', user.id).single(),
      client.from('analytics_events').select('payload').eq('user_id', user.id),
    ]);
  if ([profile, saved, apps, notifications, prefs, events].some((r) => r.error))
    throw Error('Your account data could not be loaded.');
  return {
    data: {
      profile: profile.data?.payload ?? {},
      saved: saved.data?.map((r) => r.payload) ?? [],
      applications: apps.data?.map((r) => r.payload) ?? [],
      notifications: notifications.data?.map((r) => r.payload) ?? [],
      preferences: prefs.data?.preferences ?? { email: false, inApp: true },
      events: events.data?.map((r) => r.payload) ?? [],
    },
    version: profile.data?.version ?? 0,
  };
}
export async function saveUserData(
  req: NextRequest,
  res: NextResponse,
  user: User,
  data: UserData,
  version: number,
) {
  if (demoEnabled())
    return demoTransaction((db) => {
      db.data[user.id] = data;
      db.audit.push({
        userId: user.id,
        action: 'account.update',
        at: new Date().toISOString(),
      });
    });
  const { error } = await supabase(req, res).rpc('commit_user_data', {
    p_data: data,
    p_version: version,
  });
  if (error) throw Error('Changes could not be saved. Refresh and try again.');
}
export async function saveScheme(
  req: NextRequest,
  res: NextResponse,
  user: User,
  scheme: Scheme,
) {
  if (user.role !== 'admin') throw Error('Administrator access is required.');
  if (demoEnabled())
    return demoTransaction((db) => {
      const i = db.schemes.findIndex((s) => s.id === scheme.id);
      if (i >= 0) db.schemes[i] = scheme;
      else db.schemes.push(scheme);
      for (const d of Object.values(db.data)) {
        if (d.saved.some((s) => s.schemeId === scheme.id))
          d.notifications.push({
            id: crypto.randomUUID(),
            title: 'Saved scheme updated',
            body:
              scheme.name +
              ' has new information. Review the current conditions.',
            read: false,
            kind: 'scheme-updated',
            schemeId: scheme.id,
            createdAt: new Date().toISOString(),
          });
      }
      db.audit.push({
        userId: user.id,
        action: 'scheme.update:' + scheme.id,
        at: new Date().toISOString(),
      });
    });
  const { error } = await supabase(req, res).rpc('save_scheme', {
    p_scheme: scheme,
  });
  if (error)
    throw Error(
      'The scheme could not be saved. Check required fields and your access.',
    );
}
export async function saveEnquiry(
  req: NextRequest,
  res: NextResponse,
  enquiry: Enquiry,
) {
  if (demoEnabled())
    return demoTransaction((db) => {
      db.enquiries.push(enquiry);
    });
  const { error } = await supabase(req, res)
    .from('enquiries')
    .insert({ id: enquiry.id, user_id: enquiry.userId, payload: enquiry });
  if (error) throw Error('Your enquiry could not be saved.');
}
export async function appData(
  req: NextRequest,
  res: NextResponse,
  user: User | null,
): Promise<AppData> {
  const schemes = await catalogue(req, res, user?.role === 'admin');
  const data = user ? (await userData(req, res, user)).data : emptyData();
  let enquiries: Enquiry[] = [];
  let allUsers: User[] = [];
  let allData: UserData[] = [];
  let taxonomy: Record<string, string[]> = {
    industries,
    states,
    categories: objectives,
  };
  if (demoEnabled()) {
    await demoTransaction((db) => {
      taxonomy = db.taxonomy;
      if (user?.role === 'admin') {
        enquiries = db.enquiries;
        allUsers = db.users.map(({ id, email, role }) => ({ id, email, role }));
        allData = Object.values(db.data);
      }
    });
  } else {
    const client = supabase(req, res);
    const tax = await client.from('taxonomy').select('kind,values');
    if (tax.error) throw Error('Categories could not be loaded.');
    tax.data?.forEach((r) => (taxonomy[r.kind] = r.values));
    if (user?.role === 'admin') {
      const [e, u, a] = await Promise.all([
        client.from('enquiries').select('payload'),
        client.from('users').select('id,email,role'),
        client.rpc('admin_analytics'),
      ]);
      if (e.error || u.error || a.error)
        throw Error('Admin data could not be loaded.');
      enquiries = e.data?.map((r) => r.payload) ?? [];
      allUsers = u.data ?? [];
      return {
        ...data,
        user,
        schemes,
        mode: 'supabase',
        enquiries,
        users: allUsers,
        analytics: a.data,
        taxonomy,
      };
    }
  }
  const count = (values: string[]) =>
    values.reduce<Record<string, number>>(
      (out, key) => ((out[key] = (out[key] ?? 0) + 1), out),
      {},
    );
  const events = allData.flatMap((d) => d.events);
  return {
    ...data,
    user,
    schemes,
    mode: demoEnabled() ? 'demo' : 'supabase',
    enquiries,
    users: user?.role === 'admin' ? allUsers : undefined,
    taxonomy,
    analytics:
      user?.role === 'admin'
        ? {
            users: allUsers.length,
            searches: events.filter((e) => e.type === 'search').length,
            matches: events.filter((e) => e.type === 'match').length,
            started: allData.reduce((n, d) => n + d.applications.length, 0),
            submitted: allData
              .flatMap((d) => d.applications)
              .filter((a) =>
                a.history.some((h) => h.status === 'Application Submitted'),
              ).length,
            industries: count(
              allData.map((d) => d.profile.industry || 'Not specified'),
            ),
            objectives: count(
              allData.flatMap((d) => d.profile.objectives ?? []),
            ),
            popular: count(
              events.filter((e) => e.type === 'view').map((e) => e.schemeId!),
            ),
            saved: count(
              allData.flatMap((d) => d.saved.map((s) => s.schemeId)),
            ),
          }
        : undefined,
  };
}
