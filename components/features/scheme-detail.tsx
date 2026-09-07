'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  AlertTriangle,
  X,
  ArrowUpRight,
  Bookmark,
  ClipboardList,
  Bell,
  Download,
} from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { matchScheme } from '@/lib/matching';
import { Heading, StatusBadge, EmptyState } from '@/components/scheme-card';
import { Button } from '@/components/ui/button';
export function SchemeDetail({ id }: { id: string }) {
  const { data, act, busy, notice } = useApp();
  const router = useRouter();
  const scheme = data.schemes.find((s) => s.id === id);
  useEffect(() => {
    if (data.user)
      void fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'event', type: 'view', schemeId: id }),
      });
  }, [id, data.user]);
  if (!scheme)
    return (
      <EmptyState
        title="Scheme not found"
        description="This record may have been archived or removed."
        href="/schemes"
      />
    );
  const match = matchScheme(data.profile, scheme);
  const saved = data.saved.some((s) => s.schemeId === id);
  const expired =
    scheme.status === 'Expired' ||
    !!(
      scheme.deadline && scheme.deadline < new Date().toISOString().slice(0, 10)
    );
  async function run(action: string) {
    if (!data.user) {
      router.push('/auth?next=/schemes/' + id);
      return;
    }
    try {
      await act(action, { schemeId: id });
      notice(
        action === 'save'
          ? 'Shortlist updated.'
          : action === 'reminder'
            ? 'In-app reminder added.'
            : 'Application checklist created.',
      );
      if (action === 'checklist') router.push('/applications');
    } catch {}
  }
  return (
    <>
      <Link className="back-link" href="/schemes">
        ← Back to schemes
      </Link>
      <Heading
        eyebrow={
          scheme.level.toUpperCase() + ' · ' + scheme.fundingType.toUpperCase()
        }
        title={scheme.name.replace(' — Demo', '')}
        description={scheme.description}
      >
        <Button
          className="app-button"
          variant="outline"
          disabled={busy}
          onClick={() => run('save')}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved' : 'Save Scheme'}
        </Button>
      </Heading>
      <div className="notice">
        {scheme.demo
          ? 'Demo data — verify before application. This is an illustrative record, not a real government scheme.'
          : scheme.status +
            ' · Last verified: ' +
            (scheme.verifiedAt ?? 'Never')}
        {expired && ' The application window has expired.'}
      </div>
      <div className="detail-columns">
        <div className="detail-sections">
          <section className="panel">
            <h2>Overview</h2>
            <p>{scheme.detail}</p>
            <div className="detail-facts">
              <div>
                <small>GOVERNMENT LEVEL</small>
                <strong>{scheme.level}</strong>
              </div>
              <div>
                <small>LOCATION</small>
                <strong>{scheme.state}</strong>
              </div>
              <div>
                <small>DEPARTMENT</small>
                <strong>{scheme.department}</strong>
              </div>
              <div>
                <small>MINISTRY</small>
                <strong>{scheme.ministry}</strong>
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>Who can apply?</h2>
            <p>
              {scheme.industries.join(', ')} businesses. All the conditions
              below must be reviewed.
            </p>
            <h3>Based on your profile</h3>
            {!scheme.rules.length && (
              <p className="notice">
                Eligibility rules are missing. No eligibility claim can be made.
              </p>
            )}
            <div className="condition-list">
              {match.conditions.map((c, i) => (
                <div key={i} className={c.status}>
                  {c.status === 'pass' ? (
                    <Check size={18} />
                  ) : c.status === 'fail' ? (
                    <X size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                  <span>
                    {c.label}
                    <small>
                      {c.required ? 'Required condition' : 'Relevance factor'}
                    </small>
                  </span>
                  <StatusBadge
                    tone={
                      c.status === 'pass'
                        ? 'green'
                        : c.status === 'fail'
                          ? 'red'
                          : 'orange'
                    }
                  >
                    {c.status === 'pass'
                      ? 'Matches'
                      : c.status === 'fail'
                        ? 'Does not match'
                        : 'Needs verification'}
                  </StatusBadge>
                </div>
              ))}
            </div>
            <p className="subtle">
              A recorded match does not confirm final eligibility. Unknown
              conditions are not assumed satisfied.
            </p>
          </section>
          <section className="panel">
            <h2>Benefits</h2>
            <p>{scheme.benefit}</p>
            {scheme.subsidyPercentage !== null && (
              <p>
                Illustrative subsidy percentage: {scheme.subsidyPercentage}%
              </p>
            )}
            <p>
              Support type: {scheme.fundingType}. Amounts and conditions require
              official verification.
            </p>
          </section>
          <section className="panel">
            <h2>What you need before applying</h2>
            <ul className="document-list">
              {scheme.documents.map((d) => (
                <li key={d}>
                  <ClipboardList size={16} />
                  {d}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Application process</h2>
            <ol className="process-list">
              {scheme.process.map((p, i) => (
                <li key={p}>
                  <span>{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          </section>
          <section className="panel">
            <h2>Official sources & important dates</h2>
            <p>Source: {scheme.source}</p>
            <p>Last verified: {scheme.verifiedAt ?? 'Never — not verified'}</p>
            <p>
              Deadline:{' '}
              {scheme.deadline ?? 'Not recorded. Check with the authority.'}
            </p>
            {scheme.officialUrl ? (
              <a
                className="text-link"
                href={scheme.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit official source <ArrowUpRight size={16} />
              </a>
            ) : (
              <p className="notice">
                No official application link is available for this illustrative
                record.
              </p>
            )}
          </section>
        </div>
        <aside>
          <div className="panel action-card">
            <StatusBadge tone="green">YOUR SCHEME MATCH</StatusBadge>
            <strong
              className={
                'big-score score-' +
                (match.score >= 90
                  ? 'high'
                  : match.score >= 75
                    ? 'strong'
                    : 'potential')
              }
            >
              {match.score}
              <span>%</span>
            </strong>
            <h3>{match.classification}</h3>
            <dl className="quick-facts">
              <div>
                <dt>Data status</dt>
                <dd>
                  {scheme.demo ? 'Demo · Needs verification' : scheme.status}
                </dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>{scheme.verifiedAt?.slice(0, 10) ?? 'Not yet verified'}</dd>
              </div>
            </dl>
            <p>
              {match.needsVerification
                ? 'Needs verification before applying.'
                : 'Recorded conditions are met. Confirm with the authority.'}
            </p>
            <div className="benefit">
              <small>POTENTIAL BENEFIT</small>
              <strong>Up to INR {scheme.maximumBenefit / 100000} lakh</strong>
            </div>
            <Button
              disabled={busy || expired}
              className="app-button full"
              onClick={() => run('checklist')}
            >
              <ClipboardList size={17} />
              Create Application Checklist
            </Button>
            {scheme.deadline && (
              <Button
                variant="outline"
                className="app-button full"
                disabled={busy}
                onClick={() => run('reminder')}
              >
                <Bell size={16} />
                Set in-app reminder
              </Button>
            )}
            {scheme.officialUrl && (
              <a
                className="button outline full"
                href={scheme.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit Official Portal <ArrowUpRight size={16} />
              </a>
            )}
          </div>
          <div className="panel mccia-card">
            <h3>Need help understanding or applying?</h3>
            <p>Send a question for MCCIA administrator review.</p>
            <Link
              className="button outline full"
              href={'/enquiry?scheme=' + id}
            >
              Connect with MCCIA <ArrowUpRight size={16} />
            </Link>
            <small>Guidance does not guarantee approval.</small>
          </div>
        </aside>
      </div>
    </>
  );
}
export function Saved() {
  const { data, act, busy, notice } = useApp();
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <>
      <Heading
        eyebrow="YOUR OPPORTUNITY SHORTLIST"
        title="Saved Schemes"
        description="Keep the opportunities that matter close at hand."
      >
        <a className="button outline" href="/api/export?format=csv">
          <Download size={16} />
          Export CSV
        </a>
      </Heading>
      {!data.saved.length ? (
        <EmptyState
          saved
          title="No saved schemes yet"
          description="Go to your recommendations to save schemes."
          href="/dashboard"
          label="Go to My Schemes"
        />
      ) : (
        <div className="saved-list">
          {data.saved.map((saved) => {
            const s = data.schemes.find((s) => s.id === saved.schemeId);
            if (!s)
              return (
                <div key={saved.schemeId} className="panel">
                  <p>This saved scheme is no longer available.</p>
                  <Button
                    onClick={() =>
                      act('save', { schemeId: saved.schemeId }).catch(() => {})
                    }
                  >
                    Remove
                  </Button>
                </div>
              );
            return (
              <article className="panel" key={s.id}>
                <div className="saved-heading">
                  <div>
                    <StatusBadge>
                      {s.level} · {s.fundingType}
                    </StatusBadge>
                    <h2>
                      <Link href={'/schemes/' + s.id}>{s.name}</Link>
                    </h2>
                    <p>{s.benefit}</p>
                  </div>
                  <StatusBadge tone="green">
                    {matchScheme(data.profile, s).score}% match
                  </StatusBadge>
                </div>
                <div className="saved-meta">
                  <span>Deadline: {s.deadline ?? 'Not recorded'}</span>
                  <span>{s.demo ? 'Demo · Not verified' : s.status}</span>
                  <span>
                    {data.applications.find((a) => a.schemeId === s.id)
                      ?.status ?? 'Not started'}
                  </span>
                </div>
                <label className="field">
                  Your notes
                  <textarea
                    value={notes[s.id] ?? saved.notes}
                    onChange={(e) =>
                      setNotes({ ...notes, [s.id]: e.target.value })
                    }
                    placeholder="Why this opportunity matters to your business…"
                    maxLength={5000}
                  />
                </label>
                <div className="actions">
                  <Button
                    disabled={busy}
                    className="app-button"
                    onClick={() =>
                      act('saved-notes', {
                        schemeId: s.id,
                        notes: notes[s.id] ?? saved.notes,
                      })
                        .then(() => notice('Notes saved.'))
                        .catch(() => {})
                    }
                  >
                    Save notes
                  </Button>
                  <Link href={'/schemes/' + s.id} className="button outline">
                    Open scheme
                  </Link>
                  <Button
                    variant="outline"
                    className="app-button"
                    disabled={busy}
                    onClick={() =>
                      act('checklist', { schemeId: s.id })
                        .then(() => {
                          window.location.href = '/applications';
                        })
                        .catch(() => {})
                    }
                  >
                    Create checklist
                  </Button>
                  <Button
                    variant="ghost"
                    className="app-button danger"
                    disabled={busy}
                    onClick={() =>
                      act('save', { schemeId: s.id }).catch(() => {})
                    }
                  >
                    Remove
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
