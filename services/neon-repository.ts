import 'server-only';
import type { AppData, User, UserData } from '../types';
import { industries, states, objectives } from '../lib/validation';
import { neonStore } from './neon-db';

const emptyData = (): UserData => ({
  profile: {},
  saved: [],
  applications: [],
  notifications: [],
  preferences: { email: false, inApp: true },
  events: [],
});
const count = (values: string[]) =>
  values.reduce<Record<string, number>>((out, value) => {
    out[value] = (out[value] ?? 0) + 1;
    return out;
  }, {});
export async function neonAppData(user: User | null): Promise<AppData> {
  const store = neonStore();
  const [schemes, account, taxonomy] = await Promise.all([
    store.catalogue(user),
    user
      ? store.userData(user)
      : Promise.resolve({ data: emptyData(), version: 0 }),
    store.taxonomy(),
  ]);
  const result: AppData = {
    ...account.data,
    user,
    schemes,
    mode: 'neon',
    enquiries: [],
    taxonomy: { industries, states, categories: objectives, ...taxonomy },
  };
  if (user?.role === 'admin') {
    const snapshot = await store.adminSnapshot(user);
    result.users = snapshot.users;
    result.enquiries = snapshot.enquiries;
    const accounts = snapshot.accounts;
    const events = accounts.flatMap((data) => data.events);
    const applications = accounts.flatMap((data) => data.applications);
    result.analytics = {
      users: snapshot.users.length,
      searches: events.filter((event) => event.type === 'search').length,
      matches: events.filter((event) => event.type === 'match').length,
      started: applications.length,
      submitted: applications.filter((application) =>
        application.history.some(
          (entry) => entry.status === 'Application Submitted',
        ),
      ).length,
      industries: count(
        accounts.map((data) => data.profile.industry || 'Not specified'),
      ),
      objectives: count(
        accounts.flatMap((data) => data.profile.objectives ?? []),
      ),
      popular: count(
        events
          .filter((event) => event.type === 'view' && event.schemeId)
          .map((event) => event.schemeId!),
      ),
      saved: count(
        accounts.flatMap((data) => data.saved.map((entry) => entry.schemeId)),
      ),
    };
  }
  return result;
}
