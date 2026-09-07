'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { McciaBrand } from '@/components/mccia-brand';
import { api } from '@/hooks/use-app';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export function Auth() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState(
    params.get('mode') === 'reset' ? 'reset' : 'login',
  );
  const [message, setMessage] = useState(
    params.get('error')
      ? 'That sign-in link is invalid or expired. Request a new one.'
      : '',
  );
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <McciaBrand />
        <h1>
          Find government schemes
          <br />
          <span>that fit your business.</span>
        </h1>
        <p>
          Discover relevant government schemes, subsidies, incentives and
          support opportunities based on your business profile.
        </p>
        <ul className="auth-features">
          <li>
            <ShieldCheck />
            Personalized scheme matching
          </li>
          <li>
            <ShieldCheck />
            Eligibility-based recommendations
          </li>
          <li>
            <ShieldCheck />
            Central & state government opportunities
          </li>
        </ul>
        <a
          className="auth-mccia"
          href="https://www.mcciapune.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/assets/mccia-logo.png"
            alt="MCCIA"
            width="96"
            height="26"
          />
          <span>An MCCIA Digital Initiative</span>
        </a>
      </section>
      <section className="auth-form">
        <Link href="/">← Back to YojanaSetu</Link>
        <h1>
          {mode === 'signup'
            ? 'Let’s build your next chapter.'
            : mode === 'forgot'
              ? 'Reset your password'
              : mode === 'reset'
                ? 'Choose a new password'
                : 'Welcome Back'}
        </h1>
        <p>
          {mode === 'signup'
            ? 'Create an account to find support for your business.'
            : 'Sign in to manage your YojanaSetu recommendations.'}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage('');
            const f = new FormData(e.currentTarget);
            try {
              const result = await api('auth', {
                action: mode,
                email: f.get('email'),
                password: f.get('password'),
              });
              if (result.confirmation)
                setMessage(
                  'Check your email to confirm your account, then log in.',
                );
              else if (result.message) setMessage(String(result.message));
              else {
                const next = params.get('next');
                router.push(
                  next?.startsWith('/') &&
                    !next.startsWith('//') &&
                    !next.includes('\\')
                    ? next
                    : '/dashboard',
                );
                router.refresh();
              }
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode !== 'reset' && (
            <label>
              Work email address
              <Input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@business.com"
                required
              />
            </label>
          )}
          {mode !== 'forgot' && (
            <label>
              Password
              <Input
                name="password"
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                minLength={12}
                maxLength={128}
                placeholder="At least 12 characters"
                required
              />
            </label>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <Button type="submit" className="app-button full" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Request recovery email'
                  : mode === 'reset'
                    ? 'Update password'
                    : 'Sign In to Account'}
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="auth-links">
          <button
            onClick={() => {
              setMode(mode === 'signup' ? 'login' : 'signup');
              setMessage('');
            }}
          >
            {mode === 'signup'
              ? 'Already have an account? Log in'
              : 'New to YojanaSetu? Create an account'}
          </button>
          <button
            onClick={() => {
              setMode('forgot');
              setMessage('');
            }}
          >
            Forgot password?
          </button>
        </div>
        <p className="auth-disclaimer">
          Local demo accounts are for testing only. Live authentication and
          email recovery use Supabase when configured.
        </p>
      </section>
    </main>
  );
}
