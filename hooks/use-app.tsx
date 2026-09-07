'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { WorkspaceSkeleton } from '@/components/workflow';
import type { AppData } from '@/types';
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error ?? 'Request failed. Please try again.');
  return data;
}
type Context = {
  data: AppData;
  reload: () => Promise<void>;
  act: (
    action: string,
    body?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  busy: boolean;
  notice: (message: string) => void;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw Error('Application context missing');
  return value;
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reload = useCallback(async () => {
    setData(await api<AppData>('data'));
    setError('');
  }, []);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  async function act(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const result = await api('action', { action, ...body });
      await reload();
      return result;
    } catch (e) {
      setMessage((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <main className="standalone panel">
        <h1>We couldn’t load YojanaSetu</h1>
        <p role="alert">{error}</p>
        <button
          className="button"
          onClick={() => reload().catch((e) => setError(e.message))}
        >
          Try again
        </button>
        <a className="button outline" href="/">
          Back home
        </a>
      </main>
    );
  if (!data) return <WorkspaceSkeleton />;
  return (
    <AppContext.Provider
      value={{ data, reload, act, busy, notice: setMessage }}
    >
      {children}
      {message && (
        <div role="status" className="toast">
          {message}
          <button aria-label="Dismiss message" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
