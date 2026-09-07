'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  FileCheck,
  Menu,
  X,
  Bell,
  LogOut,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { McciaFooter } from '@/components/mccia-brand';
import { useApp, api } from '@/hooks/use-app';
const nav = [
  ['/dashboard', 'My schemes'],
  ['/saved', 'Saved'],
  ['/applications', 'Applications'],
  ['/deadlines', 'Closing soon'],
  ['/profile', 'Profile'],
] as const;
export function ProductBrand() {
  return (
    <Link className="product-brand" href="/">
      <span>
        <FileCheck size={20} />
      </span>
      <div>
        <strong>YojanaSetu</strong>
        <small>MSME Scheme Eligibility Finder</small>
      </div>
    </Link>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { data, notice } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  if (!path.startsWith('/schemes') && !data.user)
    return (
      <main className="standalone panel">
        <ProductBrand />
        <h1>Your business workspace</h1>
        <p>
          Log in or create an account to save your profile, recommendations, and
          application progress.
        </p>
        <Link
          href={'/auth?next=' + encodeURIComponent(path)}
          className="button"
        >
          Log in / Create account
        </Link>
        {data.mode === 'demo' && (
          <p className="notice">
            Local demo · Use test information only. Data is saved on this
            computer.
          </p>
        )}
      </main>
    );
  return (
    <div className="family-workspace">
      <a className="skip-link" href="#workspace-content">
        Skip to main content
      </a>
      <header className="family-header">
        <div className="family-header-inner">
          <ProductBrand />
          <button
            className="family-menu"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav
            aria-label="Main navigation"
            className={'family-nav' + (open ? ' is-open' : '')}
          >
            {nav.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
                className={path === href ? 'active' : ''}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="family-account">
            <Link
              className="family-bell"
              href="/notifications"
              aria-label="Notifications"
            >
              <Bell size={19} />
              {data.notifications.some((n) => !n.read) && <i />}
            </Link>
            <button
              className="account-trigger"
              aria-label="Account and more options"
              aria-expanded={account}
              aria-controls="account-options"
              onClick={() => setAccount(!account)}
            >
              <span className="family-avatar">
                {(data.profile.businessName || data.user?.email || 'YS')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <ChevronDown size={14} />
            </button>
            {account && (
              <>
                <button
                  className="account-dismiss"
                  aria-label="Close account menu"
                  onClick={() => setAccount(false)}
                />
                <nav
                  id="account-options"
                  className="account-popover"
                  aria-label="Account and tools"
                  onClick={() => setAccount(false)}
                >
                  <strong>
                    {data.profile.businessName || 'Your workspace'}
                  </strong>
                  <Link href="/schemes">Explore all schemes</Link>
                  <Link href="/applications#documents">Documents</Link>
                  <Link href="/notifications">Notifications & settings</Link>
                  <Link href="/assistant">Yojana Assistant</Link>
                  <Link href="/enquiry">Help from MCCIA</Link>
                  {data.user?.role === 'admin' && (
                    <Link href="/admin">Administration</Link>
                  )}
                  {data.user ? (
                    <button
                      onClick={async () => {
                        try {
                          await api('auth', { action: 'logout' });
                          window.location.href = '/';
                        } catch (e) {
                          notice((e as Error).message);
                        }
                      }}
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  ) : (
                    <Link href="/auth">Log in</Link>
                  )}
                </nav>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="workspace-content" className="family-content" tabIndex={-1}>
        {children}
      </main>
      <div className="family-data-note">
        <ShieldCheck size={14} />
        {data.mode === 'demo'
          ? 'Local demo · Illustrative scheme records. Verify official guidelines before applying.'
          : 'Verify official scheme guidelines before applying.'}
      </div>
      <McciaFooter />
    </div>
  );
}
