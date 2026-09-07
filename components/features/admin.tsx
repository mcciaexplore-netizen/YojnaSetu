'use client';
import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Plus, Save, ShieldCheck } from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { Heading, StatusBadge, EmptyState } from '@/components/scheme-card';
import type { Scheme } from '@/types';
import { schemeSchema } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const emptyScheme = (): Scheme => ({
  id: 'scheme-' + Date.now(),
  name: 'New scheme',
  description: 'Add a clear description of the scheme.',
  detail: 'Add the full eligibility guidance and programme description.',
  level: 'Central',
  ministry: 'To be confirmed',
  department: 'To be confirmed',
  state: 'All',
  industries: [],
  categories: [],
  fundingType: 'Grant',
  benefit: 'To be confirmed',
  maximumBenefit: 0,
  subsidyPercentage: null,
  loanSupport: false,
  grantSupport: true,
  reimbursement: false,
  rules: [],
  documents: [],
  process: [],
  deadline: null,
  officialUrl: null,
  source: 'Not yet verified',
  verifiedAt: null,
  status: 'Draft',
  demo: false,
  tags: [],
  createdAt: new Date().toISOString(),
});
export function Admin() {
  const { data, act, busy, notice } = useApp();
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState<Scheme | null>(null);
  const [rules, setRules] = useState('');
  const [error, setError] = useState('');
  const [taxonomyKind, setTaxonomyKind] = useState('industries');
  const [taxonomy, setTaxonomy] = useState('');
  if (data.user?.role !== 'admin')
    return (
      <EmptyState
        title="Administrator access required"
        description="This area is restricted to authorised administrators."
        href="/dashboard"
        label="Back to dashboard"
      />
    );
  const a = data.analytics!;
  function edit(s: Scheme) {
    setEditing(structuredClone(s));
    setRules(JSON.stringify(s.rules, null, 2));
    setError('');
  }
  return (
    <>
      <Heading
        eyebrow="ADMINISTRATION"
        title="Keep opportunities accurate."
        description="Manage the scheme catalogue, review enquiries, and understand business needs."
      >
        <Button
          className="app-button"
          onClick={() => {
            setTab('Schemes');
            edit(emptyScheme());
          }}
        >
          <Plus size={16} />
          Add scheme
        </Button>
      </Heading>
      <div className="tabs admin-tabs">
        {[
          'Overview',
          'Schemes',
          'Eligibility Rules',
          'Users',
          'MCCIA Enquiries',
          'Analytics',
          'Categories',
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => {
              setTab(t);
              setEditing(null);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {(tab === 'Overview' || tab === 'Analytics') && (
        <>
          <div className="stats-grid">
            {[
              [a.users, 'Registered businesses'],
              [a.searches, 'Scheme searches'],
              [a.matches, 'Matching runs'],
              [a.started, 'Applications started'],
            ].map(([n, t]) => (
              <div className="stat-card" key={t}>
                <strong>{n}</strong>
                <h3>{t}</h3>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>{a.submitted} applications submitted</h2>
            <p>
              Based on user-reported application timelines, not government
              approval records.
            </p>
          </div>
          <div className="analytics-grid">
            {[
              ['Most common industries', a.industries],
              ['Most common objectives', a.objectives],
              ['Most viewed schemes', a.popular],
              ['Most saved schemes', a.saved],
            ].map(([title, values]) => (
              <section className="panel" key={String(title)}>
                <h3>{String(title)}</h3>
                {Object.keys(values).length ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart
                      data={Object.entries(values).map(([name, total]) => ({
                        name,
                        total,
                      }))}
                      margin={{ bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        fontSize={10}
                        angle={-20}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Bar
                        dataKey="total"
                        fill="#2a65d7"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p>No activity recorded yet.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {(tab === 'Schemes' || tab === 'Eligibility Rules') && !editing && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scheme</th>
                <th>Status</th>
                <th>Rules</th>
                <th>Last verified</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.schemes.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small>
                      {s.level} … {s.fundingType}
                    </small>
                  </td>
                  <td>
                    <StatusBadge
                      tone={s.status === 'Verified' ? 'green' : 'orange'}
                    >
                      {s.status}
                    </StatusBadge>
                  </td>
                  <td>{s.rules.length}</td>
                  <td>{s.verifiedAt?.slice(0, 10) ?? 'Never'}</td>
                  <td>
                    <Button variant="outline" onClick={() => edit(s)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <form
          className="panel admin-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const scheme = { ...editing, rules: JSON.parse(rules) };
              const result = schemeSchema.safeParse(scheme);
              if (!result.success) {
                setError(
                  result.error.issues
                    .map((i) => i.path.join('.') + ': ' + i.message)
                    .join('\n'),
                );
                return;
              }
              await act('admin-scheme', { scheme: result.data });
              notice('Scheme saved.');
              setEditing(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h2>Edit scheme</h2>
          <div className="form-grid">
            {[
              ['name', 'Scheme name'],
              ['ministry', 'Ministry'],
              ['department', 'Department'],
              ['state', 'State / All'],
              ['benefit', 'Benefit description'],
              ['source', 'Source description'],
            ].map(([key, label]) => (
              <label className="field" key={key}>
                {label}
                <Input
                  value={String(editing[key as keyof Scheme] ?? '')}
                  onChange={(e) =>
                    setEditing({ ...editing, [key]: e.target.value })
                  }
                  required
                />
              </label>
            ))}
            <label className="field">
              Government level
              <select
                value={editing.level}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    level: e.target.value as Scheme['level'],
                  })
                }
              >
                <option>Central</option>
                <option>State</option>
              </select>
            </label>
            <label className="field">
              Funding type
              <select
                value={editing.fundingType}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    fundingType: e.target.value,
                    loanSupport: e.target.value === 'Loan',
                    grantSupport: e.target.value === 'Grant',
                    reimbursement: e.target.value === 'Reimbursement',
                  })
                }
              >
                {['Grant', 'Loan', 'Subsidy', 'Reimbursement'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Maximum benefit (INR)
              <Input
                type="number"
                min="0"
                value={editing.maximumBenefit}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    maximumBenefit: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              Subsidy percentage (optional)
              <Input
                type="number"
                min="0"
                max="100"
                value={editing.subsidyPercentage ?? ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    subsidyPercentage:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              Status
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    status: e.target.value as Scheme['status'],
                  })
                }
              >
                {[
                  'Draft',
                  'Pending Verification',
                  'Verified',
                  'Needs Review',
                  'Expired',
                  'Archived',
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Last verified
              <Input
                type="date"
                value={editing.verifiedAt?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, verifiedAt: e.target.value || null })
                }
              />
            </label>
            <label className="field">
              Deadline
              <Input
                type="date"
                value={editing.deadline ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, deadline: e.target.value || null })
                }
              />
            </label>
            <label className="field">
              Official HTTPS URL
              <Input
                type="url"
                value={editing.officialUrl ?? ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    officialUrl: e.target.value || null,
                  })
                }
              />
            </label>
            <label className="check-tile">
              <input
                type="checkbox"
                checked={editing.demo}
                onChange={(e) =>
                  setEditing({ ...editing, demo: e.target.checked })
                }
              />
              Illustrative demo record
            </label>
            {[
              ['description', 'Short description'],
              ['detail', 'Detailed description'],
            ].map(([k, label]) => (
              <label className="field wide" key={k}>
                {label}
                <textarea
                  rows={3}
                  value={String(editing[k as keyof Scheme])}
                  onChange={(e) =>
                    setEditing({ ...editing, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            {[
              ['industries', 'Industries (one per line)'],
              ['categories', 'Objectives / categories (one per line)'],
              ['documents', 'Required documents (one per line)'],
              ['process', 'Application steps (one per line)'],
              ['tags', 'Search tags (one per line)'],
            ].map(([k, label]) => (
              <label className="field" key={k}>
                {label}
                <textarea
                  rows={4}
                  value={(editing[k as keyof Scheme] as string[]).join('\n')}
                  onChange={(e) =>
                    setEditing({ ...editing, [k]: e.target.value.split('\n') })
                  }
                />
              </label>
            ))}
            <label className="field wide">
              Eligibility rules (validated JSON)
              <textarea
                className="code-input"
                rows={14}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
              <small>
                Fields: industry, state, businessType, stage, turnover,
                investment, employees, registrations, objectives, exporting,
                planningExport, womenOwned. Operators: in, range, all, any,
                equals. Each rule needs id, field, operator, value, label,
                required, weight.
              </small>
            </label>
          </div>
          <div className="notice">
            <ShieldCheck size={16} />
            Verified status requires non-demo data, an official source URL,
            verification date, and eligibility rules. Archive a record to
            deactivate it.
          </div>
          {error && (
            <p className="field-error pre-wrap" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <Button className="app-button" type="submit" disabled={busy}>
              <Save size={16} />
              Save scheme
            </Button>
            <Button
              className="app-button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {tab === 'Users' && (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Account ID</th>
              </tr>
            </thead>
            <tbody>
              {data.users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'MCCIA Enquiries' &&
        (data.enquiries.length ? (
          <div className="saved-list">
            {data.enquiries.map((e) => (
              <article className="panel" key={e.id}>
                <h3>{e.business || 'Business not specified'}</h3>
                <p>{e.question}</p>
                <p>Contact: {e.contact}</p>
                <small>
                  {data.schemes.find((s) => s.id === e.schemeId)?.name ??
                    'General enquiry'}{' '}
                  … {new Date(e.createdAt).toLocaleString('en-IN')}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No enquiries yet"
            description="Questions submitted through Connect with MCCIA will appear here."
          />
        ))}
      {tab === 'Categories' && (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            await act('taxonomy', {
              kind: taxonomyKind,
              values: (taxonomy || data.taxonomy[taxonomyKind].join('\n'))
                .split('\n')
                .filter(Boolean),
            })
              .then(() => notice('Categories saved.'))
              .catch(() => {});
          }}
        >
          <label className="field">
            Manage
            <select
              value={taxonomyKind}
              onChange={(e) => {
                setTaxonomyKind(e.target.value);
                setTaxonomy('');
              }}
            >
              {['industries', 'states', 'categories'].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="field">
            One value per line
            <textarea
              rows={15}
              value={taxonomy || data.taxonomy[taxonomyKind].join('\n')}
              onChange={(e) => setTaxonomy(e.target.value)}
            />
          </label>
          <Button className="app-button" type="submit" disabled={busy}>
            Save categories
          </Button>
        </form>
      )}
    </>
  );
}
