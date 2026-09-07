'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Upload, Download, Check, Send, Sparkles, Bell } from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { Heading, EmptyState, StatusBadge } from '@/components/scheme-card';
import { applicationStatuses, completeness } from '@/lib/validation';
import type { Application } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function Applications() {
  const { data } = useApp();
  return (
    <>
      <Heading
        eyebrow="ONE STEP CLOSER"
        title="Applications"
        description="Prepare your documents, record your progress, and keep every next step in view."
      />
      {data.applications.length ? (
        <div id="documents" className="application-list">
          {data.applications.map((a) => (
            <ApplicationEditor key={a.id + ':' + a.updatedAt} application={a} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No applications being tracked."
          description="Open a scheme and choose Create Application Checklist to get started."
          href="/schemes"
        />
      )}
    </>
  );
}
function ApplicationEditor({ application }: { application: Application }) {
  const { data, act, busy, notice, reload } = useApp();
  const [a, setA] = useState(application);
  const [uploading, setUploading] = useState('');
  const scheme = data.schemes.find((s) => s.id === a.schemeId);
  const completed = a.documents.filter((d) => d.complete).length;
  return (
    <article className="panel application">
      <div className="saved-heading">
        <div>
          <StatusBadge>{a.status}</StatusBadge>
          <h2>
            <Link href={'/schemes/' + a.schemeId}>
              {scheme?.name ?? 'Archived scheme'}
            </Link>
          </h2>
          <p>
            {completed} of {a.documents.length} documents prepared · Last
            updated {new Date(a.updatedAt).toLocaleString('en-IN')}
          </p>
        </div>
      </div>
      <div className="progress-track">
        <i
          style={{
            width:
              (a.documents.length
                ? (completed / a.documents.length) * 100
                : 0) + '%',
          }}
        />
      </div>
      <div className="application-columns">
        <section>
          <h3>Application checklist</h3>
          {a.documents.map((d, i) => (
            <div className="document-row" key={d.name}>
              <label>
                <input
                  type="checkbox"
                  checked={d.complete}
                  onChange={(e) =>
                    setA({
                      ...a,
                      documents: a.documents.map((x, j) =>
                        j === i ? { ...x, complete: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <span>
                  {d.name}
                  <small>{d.fileName ?? 'No file uploaded'}</small>
                </span>
              </label>
              {d.fileId && (
                <a
                  href={'/api/file?id=' + d.fileId}
                  aria-label={'Download ' + d.name}
                >
                  <Download size={17} />
                </a>
              )}
              <label className="upload-button" aria-label={'Upload ' + d.name}>
                <Upload size={16} />
                <span>{uploading === d.name ? 'Uploading…' : 'Upload'}</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  disabled={!!uploading || busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 4 * 1024 * 1024) {
                      notice('Choose a file smaller than 4 MB.');
                      return;
                    }
                    setUploading(d.name);
                    try {
                      await act('application', {
                        id: a.id,
                        application: {
                          ...a,
                          documents: a.documents.map(({ name, complete }) => ({
                            name,
                            complete,
                          })),
                        },
                      });
                      const form = new FormData();
                      form.set('file', file);
                      form.set('applicationId', a.id);
                      form.set('document', d.name);
                      const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: form,
                      });
                      const result = await res.json();
                      if (!res.ok) throw Error(result.error);
                      await reload();
                      notice('Document uploaded.');
                    } catch (e) {
                      notice((e as Error).message);
                    } finally {
                      setUploading('');
                    }
                  }}
                />
              </label>
            </div>
          ))}
          <p className="subtle">
            PDF, JPEG, PNG · Maximum 4 MB · Private to your account
          </p>
        </section>
        <section className="form-grid">
          <label className="field">
            Application status
            <select
              value={a.status}
              onChange={(e) =>
                setA({ ...a, status: e.target.value as Application['status'] })
              }
            >
              {applicationStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Checklist status
            <select
              value={a.checklistStatus}
              onChange={(e) =>
                setA({
                  ...a,
                  checklistStatus: e.target
                    .value as Application['checklistStatus'],
                })
              }
            >
              {['Not Started', 'In Progress', 'Ready', 'Submitted'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Application date
            <Input
              type="date"
              value={a.applicationDate}
              onChange={(e) => setA({ ...a, applicationDate: e.target.value })}
            />
          </label>
          <label className="field">
            Reference number
            <Input
              value={a.reference}
              onChange={(e) => setA({ ...a, reference: e.target.value })}
              maxLength={200}
            />
          </label>
          <label className="field wide">
            Notes
            <textarea
              value={a.notes}
              onChange={(e) => setA({ ...a, notes: e.target.value })}
              maxLength={5000}
            />
          </label>
        </section>
      </div>
      <div className="timeline">
        {a.history.map((h, i) => (
          <div
            key={i}
            className={i === a.history.length - 1 ? 'current' : 'completed'}
            aria-current={i === a.history.length - 1 ? 'step' : undefined}
          >
            <span>
              <Check size={12} />
            </span>
            <strong>{h.status}</strong>
            <small>{new Date(h.at).toLocaleDateString('en-IN')}</small>
          </div>
        ))}
      </div>
      <Button
        className="app-button"
        disabled={busy || !!uploading}
        onClick={() =>
          act('application', {
            id: a.id,
            application: {
              ...a,
              documents: a.documents.map(({ name, complete }) => ({
                name,
                complete,
              })),
            },
          })
            .then(() => notice('Application updated.'))
            .catch(() => {})
        }
      >
        Save application updates
      </Button>
    </article>
  );
}
export function Notifications() {
  const { data, act, busy, notice } = useApp();
  return (
    <>
      <Heading
        title="Notifications"
        description="Updates that help you keep moving."
      >
        <Button
          variant="outline"
          className="app-button"
          disabled={busy}
          onClick={() => act('notification', { id: 'all' }).catch(() => {})}
        >
          Mark all as read
        </Button>
      </Heading>
      <div className="panel notification-preferences">
        <h3>Your preferences</h3>
        {[
          ['inApp', 'In-app notifications'],
          ['email', 'Email notifications'],
        ].map(([k, label]) => (
          <label key={k}>
            <input
              type="checkbox"
              checked={data.preferences[k as 'email' | 'inApp']}
              disabled={busy}
              onChange={(e) =>
                act('preferences', {
                  preferences: { ...data.preferences, [k]: e.target.checked },
                })
                  .then(() => notice('Preferences saved.'))
                  .catch(() => {})
              }
            />
            {label}
          </label>
        ))}
        <small>
          Email delivery needs a configured delivery worker. Your preference is
          saved; emails are not sent by the local demo.
        </small>
      </div>
      {completeness(data.profile) < 100 && (
        <div className="notice">
          Your business profile is incomplete.{' '}
          <Link href="/profile">
            Add details to improve your recommendations →
          </Link>
        </div>
      )}
      {data.notifications.length ? (
        <div className="panel">
          {[...data.notifications].reverse().map((n) => (
            <article
              className={'notification ' + (!n.read ? 'unread' : '')}
              key={n.id}
            >
              <span className="icon-box">
                <Bell size={18} />
              </span>
              <div>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <small>{new Date(n.createdAt).toLocaleString('en-IN')}</small>
                {n.schemeId && (
                  <Link className="text-link" href={'/schemes/' + n.schemeId}>
                    View scheme →
                  </Link>
                )}
              </div>
              {!n.read && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    act('notification', { id: n.id }).catch(() => {})
                  }
                >
                  Mark read
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You’re all caught up"
          description="Scheme recommendations and application updates will appear here."
        />
      )}
    </>
  );
}
export function Assistant() {
  const { act, busy } = useApp();
  const [q, setQ] = useState('');
  const [messages, setMessages] = useState<
    {
      question: string;
      answer: string;
      sources: { id: string; name: string }[];
    }[]
  >([]);
  async function ask(question: string) {
    if (!question.trim()) return;
    try {
      const result = await act('assistant', { question });
      setMessages([
        ...messages,
        {
          question,
          answer: String(result.answer),
          sources: result.sources as { id: string; name: string }[],
        },
      ]);
      setQ('');
    } catch {}
  }
  return (
    <>
      <Heading
        title="Yojana Assistant"
        description="Plain-language answers from the verified scheme records in YojanaSetu."
      />
      <div className="assistant-panel panel">
        <span className="icon-box">
          <Sparkles />
        </span>
        <h2>A little clarity for your next step.</h2>
        <p>
          This database assistant uses recorded scheme information only. It
          cannot confirm eligibility or invent missing details.
        </p>
        <div className="suggestion-grid">
          {[
            'What schemes can help me buy machinery?',
            'Which schemes support exporters?',
            'What documents do I need?',
            'Why am I not eligible?',
          ].map((q) => (
            <button disabled={busy} key={q} onClick={() => ask(q)}>
              {q} →
            </button>
          ))}
        </div>
        {messages.map((m, i) => (
          <div className="assistant-message" key={i}>
            <strong>{m.question}</strong>
            <p>{m.answer}</p>
            {m.sources.map((s) => (
              <Link href={'/schemes/' + s.id} key={s.id}>
                {s.name} →
              </Link>
            ))}
          </div>
        ))}
        <form
          className="assistant-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <Input
            aria-label="Ask Yojana Assistant"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about schemes or required documents…"
            maxLength={1000}
          />
          <Button
            className="app-button"
            disabled={busy || q.trim().length < 2}
            type="submit"
          >
            <Send size={17} />
            {busy ? 'Checking…' : 'Ask'}
          </Button>
        </form>
        <small>
          Verify financial and eligibility decisions with the official authority
          or a qualified professional.
        </small>
      </div>
    </>
  );
}
export function Enquiry() {
  const { data, act, busy, notice } = useApp();
  const params = useSearchParams();
  return (
    <>
      <Heading
        title="Connect with MCCIA"
        description="Need help understanding a scheme? Leave a question for administrator review."
      />
      <form
        className="panel enquiry-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          try {
            const r = await act('enquiry', {
              schemeId: f.get('schemeId'),
              question: f.get('question'),
              contact: f.get('contact'),
            });
            notice(String(r.message));
            form.reset();
          } catch {}
        }}
      >
        <div className="form-grid">
          <label className="field">
            Business
            <Input
              value={
                data.profile.businessName ?? 'Complete your business profile'
              }
              readOnly
            />
          </label>
          <label className="field">
            Contact email
            <Input
              name="contact"
              type="email"
              defaultValue={data.user?.email}
              required
            />
          </label>
          <label className="field wide">
            Scheme
            <select name="schemeId" defaultValue={params.get('scheme') ?? ''}>
              <option value="">General question</option>
              {data.schemes.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field wide">
            How can we help?
            <textarea
              name="question"
              minLength={10}
              maxLength={5000}
              rows={5}
              required
            />
          </label>
        </div>
        <p className="notice">
          This form saves an enquiry for the administrator. It does not send an
          external message or guarantee scheme approval.
        </p>
        <Button type="submit" disabled={busy} className="app-button">
          Submit enquiry <Send size={16} />
        </Button>
      </form>
    </>
  );
}
