'use client';
import Link from 'next/link';
import {
  Bookmark,
  ArrowUpRight,
  CalendarDays,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Scheme, Match } from '@/types';
import { useApp } from '@/hooks/use-app';
import { Button } from '@/components/ui/button';
export function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  const statusTone =
    typeof children === 'string'
      ? ['Approved', 'Verified', 'Ready to Apply'].includes(children)
        ? 'green'
        : ['Rejected', 'Expired'].includes(children)
          ? 'red'
          : [
                'Documents Pending',
                'Under Review',
                'Pending Verification',
                'Needs Review',
              ].includes(children)
            ? 'orange'
            : 'blue'
      : 'blue';
  return <span className={'badge ' + (tone ?? statusTone)}>{children}</span>;
}
export function SchemeCard({
  scheme,
  match,
}: {
  scheme: Scheme;
  match?: Match;
}) {
  const { data, act, busy, notice } = useApp();
  const saved = data.saved.some((s) => s.schemeId === scheme.id);
  const tags = [
    ...new Set([
      ...scheme.categories.slice(0, 2),
      scheme.level + ' Government',
      ...scheme.tags.slice(0, 2),
    ]),
  ];
  return (
    <article className="scheme-card family-scheme-card">
      <div className="scheme-title-row">
        <div>
          <Link href={'/schemes/' + scheme.id}>
            <h3>{scheme.name}</h3>
          </Link>
          <p className="scheme-department">
            {scheme.department} · {scheme.level} Government
          </p>
        </div>
        {match && (
          <div className="family-match">
            <StatusBadge
              tone={
                match.score >= 90
                  ? 'green'
                  : match.score >= 75
                    ? 'blue'
                    : 'orange'
              }
            >
              {match.score}%
            </StatusBadge>
            <small>{match.classification}</small>
          </div>
        )}
      </div>
      <p className="scheme-description">{scheme.description}</p>
      <div className="scheme-facts">
        <span>
          <strong>Potential benefit</strong> Up to INR{' '}
          {(scheme.maximumBenefit / 100000).toLocaleString('en-IN')} lakh ·{' '}
          {scheme.fundingType}
        </span>
        <span className="scheme-deadline">
          <CalendarDays size={16} />
          {scheme.deadline
            ? 'Deadline: ' + scheme.deadline
            : 'No deadline recorded'}
        </span>
        <StatusBadge
          tone={
            scheme.demo || scheme.status !== 'Verified' ? 'orange' : 'green'
          }
        >
          {scheme.demo ? 'Demo · Needs verification' : scheme.status}
        </StatusBadge>
      </div>
      {match && (
        <div className="scheme-reasons">
          <strong>Why it matches</strong>
          {match.conditions
            .filter((c) => c.status === 'pass')
            .slice(0, 3)
            .map((c) => (
              <span key={c.label}>
                <Check size={14} />
                {c.label}
              </span>
            ))}
          {!match.conditions.some((c) => c.status === 'pass') && (
            <span>Review eligibility conditions in the scheme details.</span>
          )}
        </div>
      )}
      <div className="scheme-card-footer">
        <div className="scheme-tags">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="scheme-actions">
          <button
            className={saved ? 'saved bookmark' : 'bookmark'}
            aria-label={
              (saved ? 'Remove saved scheme: ' : 'Save scheme: ') + scheme.name
            }
            aria-pressed={saved}
            disabled={busy}
            onClick={() => {
              if (!data.user) {
                window.location.href = '/auth?next=/schemes';
                return;
              }
              act('save', { schemeId: scheme.id })
                .then(() => notice(saved ? 'Scheme removed.' : 'Scheme saved.'))
                .catch(() => {});
            }}
          >
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <Link className="button" href={'/schemes/' + scheme.id}>
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  href,
  label,
  saved = false,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
  saved?: boolean;
}) {
  return (
    <div className="empty-state">
      <span className="icon-box">{saved ? <Bookmark /> : <SearchIcon />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link className="button" href={href}>
          {label ?? 'Find Schemes'} <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
function SearchIcon() {
  return <AlertCircle />;
}
export function Heading({
  eyebrow,
  status,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  status?: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <div className="family-title-line">
          <h1>{title}</h1>
          {status}
        </div>
        <p>{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function RunButton({
  action,
  body,
  label,
}: {
  action: string;
  body?: Record<string, unknown>;
  label: string;
}) {
  const { act, busy, notice } = useApp();
  return (
    <Button
      className="app-button"
      disabled={busy}
      onClick={() =>
        act(action, body)
          .then(() => notice('Saved successfully.'))
          .catch(() => {})
      }
    >
      {label}
    </Button>
  );
}
