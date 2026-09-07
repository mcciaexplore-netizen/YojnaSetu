'use client';
import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  Download,
  Sparkles,
  RefreshCw,
  Bookmark,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '@/hooks/use-app';
import { recommendations, matchScheme, searchScheme } from '@/lib/matching';
import { completeness, stages } from '@/lib/validation';
import { SchemeCard, Heading, EmptyState } from '@/components/scheme-card';
import { Button } from '@/components/ui/button';
export function Schemes() {
  const { data, act } = useApp();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [level, setLevel] = useState('All');
  const [industry, setIndustry] = useState('All');
  const [funding, setFunding] = useState('All');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('relevance');
  const [stage, setStage] = useState('All');
  const [eligibility, setEligibility] = useState('All');
  const [deadline, setDeadline] = useState('All');
  const today = new Date().toISOString().slice(0, 10);
  const closingDate = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [onlyMatches, setOnlyMatches] = useState(
    params.get('matched') === 'true',
  );
  const [count, setCount] = useState(9);
  useEffect(() => {
    setQ(params.get('q') ?? '');
  }, [params]);
  const matches = useMemo(
    () => recommendations(data.profile, data.schemes),
    [data.profile, data.schemes],
  );
  const results = data.schemes
    .filter(
      (s) =>
        !['Archived', 'Draft'].includes(s.status) &&
        searchScheme(s, q) &&
        (level === 'All' || s.level === level) &&
        (industry === 'All' || s.industries.includes(industry)) &&
        (funding === 'All' || s.fundingType === funding) &&
        (category === 'All' || s.categories.includes(category)) &&
        (stage === 'All' ||
          !s.rules.some((r) => r.field === 'stage') ||
          s.rules
            .filter((r) => r.field === 'stage')
            .every(
              (r) =>
                Array.isArray(r.value) && (r.value as string[]).includes(stage),
            )) &&
        (deadline === 'All' ||
          (deadline === 'No deadline' && !s.deadline) ||
          (deadline === 'Open' &&
            s.status !== 'Expired' &&
            (!s.deadline || s.deadline >= today)) ||
          (deadline === 'Closing soon' &&
            !!s.deadline &&
            s.deadline >= today &&
            s.deadline <= closingDate)),
    )
    .map((s) => matchScheme(data.profile, s))
    .filter(
      (m) =>
        (!onlyMatches || m.score >= 50) &&
        (eligibility === 'All' ||
          (eligibility === 'High match' && m.score >= 75) ||
          (eligibility === 'Potential match' && m.score >= 50 && m.score < 75)),
    )
    .sort((a, b) =>
      sort === 'benefit'
        ? b.scheme.maximumBenefit - a.scheme.maximumBenefit
        : sort === 'deadline'
          ? (a.scheme.deadline ?? '9999').localeCompare(
              b.scheme.deadline ?? '9999',
            )
          : sort === 'verified'
            ? (b.scheme.verifiedAt ?? '').localeCompare(
                a.scheme.verifiedAt ?? '',
              )
            : b.score - a.score,
    );
  return (
    <>
      <Heading
        eyebrow="FIND SUPPORT FOR YOUR BUSINESS"
        title={onlyMatches ? 'Your Scheme Recommendations' : 'Find Schemes'}
        description="Explore support for your next stage of growth. Understand the fit before you apply."
      >
        {data.user && (
          <a className="button outline" href="/api/export?format=pdf">
            <Download size={16} />
            Download report
          </a>
        )}
      </Heading>
      {data.profile.confirmed ? (
        <div className="match-summary">
          <div className="summary-main">
            <span className="icon-box">
              <Sparkles />
            </span>
            <div>
              <small>YOUR SCHEME MATCH</small>
              <h2>{matches.length} opportunities to explore</h2>
              <p>Based on {data.profile.businessName}’s business profile</p>
            </div>
          </div>
          <div className="summary-stat">
            <strong>{matches.filter((m) => m.score >= 90).length}</strong>
            <span>
              <i className="dot green-dot" />
              Highly relevant
            </span>
          </div>
          <div className="summary-stat">
            <strong>
              {matches.filter((m) => m.score >= 75 && m.score < 90).length}
            </strong>
            <span>
              <i className="dot blue-dot" />
              Strong match
            </span>
          </div>
          <div className="summary-stat">
            <strong>
              {matches.filter((m) => m.score >= 50 && m.score < 75).length}
            </strong>
            <span>
              <i className="dot orange-dot" />
              Potential match
            </span>
          </div>
        </div>
      ) : (
        <div className="profile-nudge">
          <Sparkles size={22} />
          <div>
            <strong>
              A little about your business. A lot more relevant results.
            </strong>
            <p>
              Create your profile to see personalized matches and eligibility
              explanations.
            </p>
          </div>
          <Link href="/profile">
            Complete your profile <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <div className="filter-panel">
        <form
          className="scheme-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (data.user)
              act('event', { type: 'search', query: q }).catch(() => {});
          }}
        >
          <Search size={18} />
          <input
            aria-label="Search schemes"
            placeholder="Search schemes, subsidies, grants..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCount(9);
            }}
          />
          <Button type="submit" className="app-button">
            Search
          </Button>
        </form>
        <div className="filters">
          <SlidersHorizontal size={16} />
          {[
            ['Government level', level, setLevel, ['All', 'Central', 'State']],
            ['Business stage', stage, setStage, ['All', ...stages]],
            [
              'Eligibility',
              eligibility,
              setEligibility,
              ['All', 'High match', 'Potential match'],
            ],
            [
              'Deadline',
              deadline,
              setDeadline,
              ['All', 'Closing soon', 'Open', 'No deadline'],
            ],
            [
              'Industry',
              industry,
              setIndustry,
              ['All', ...data.taxonomy.industries],
            ],
            [
              'Funding type',
              funding,
              setFunding,
              ['All', ...new Set(data.schemes.map((s) => s.fundingType))],
            ],
            [
              'Category',
              category,
              setCategory,
              ['All', ...data.taxonomy.categories],
            ],
          ].map(([label, value, set, options]) => (
            <select
              key={String(label)}
              aria-label={String(label)}
              value={String(value)}
              onChange={(e) => {
                (set as (s: string) => void)(e.target.value);
                setCount(9);
              }}
            >
              {(options as string[]).map((o) => (
                <option key={o} value={o}>
                  {o === 'All' ? label + ' · All' : o}
                </option>
              ))}
            </select>
          ))}
          <button
            className="text-button"
            onClick={() => {
              setStage('All');
              setEligibility('All');
              setDeadline('All');
              setCount(9);
              setLevel('All');
              setIndustry('All');
              setFunding('All');
              setCategory('All');
              setQ('');
              setOnlyMatches(false);
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <CategoryPills
        categories={data.taxonomy.categories}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setCount(9);
        }}
      />
      <div className="results-toolbar">
        <div className="tabs">
          <button
            className={!onlyMatches ? 'active' : ''}
            onClick={() => setOnlyMatches(false)}
          >
            All schemes
          </button>
          <button
            className={onlyMatches ? 'active' : ''}
            onClick={() => setOnlyMatches(true)}
          >
            My matches <span>{matches.length}</span>
          </button>
        </div>
        <div>
          <small>{results.length} results</small>
          <select
            aria-label="Sort results"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="relevance">Most relevant</option>
            <option value="benefit">Highest benefit</option>
            <option value="deadline">Nearest deadline</option>
            <option value="verified">Recently verified</option>
          </select>
        </div>
      </div>
      {onlyMatches && !matches.some((m) => m.score >= 75) && (
        <div className="notice">
          We couldn’t find strong matches based on your current profile. Add
          registrations, objectives, turnover, or export plans. Potential
          matches appear below.
        </div>
      )}
      {results.length ? (
        <div className="scheme-grid">
          {results.slice(0, count).map((m) => (
            <SchemeCard
              key={m.scheme.id}
              scheme={m.scheme}
              match={data.profile.confirmed ? m : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching opportunities yet"
          description="Try fewer filters, another search, or add more details to your business profile."
          href="/profile"
          label="Update business profile"
        />
      )}
      {results.length > count && (
        <div className="load-more">
          <Button
            className="app-button"
            variant="outline"
            onClick={() => setCount(count + 9)}
          >
            Show more schemes
          </Button>
        </div>
      )}
      <div className="guidance-strip">
        <CheckCircle2 size={19} />
        <p>
          Every recommendation includes its eligibility conditions. Demo records
          have not been verified.
        </p>
      </div>
    </>
  );
}
export function Dashboard() {
  const { data, reload, notice } = useApp();
  const [category, setCategory] = useState('All');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const matches = recommendations(data.profile, data.schemes);
  const filtered = matches.filter(
    (m) =>
      (category === 'All' || m.scheme.categories.includes(category)) &&
      searchScheme(m.scheme, q),
  );
  const deadlines = data.schemes
    .filter(
      (s) =>
        s.deadline &&
        s.deadline >= new Date().toISOString().slice(0, 10) &&
        data.saved.some((x) => x.schemeId === s.id),
    )
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  return (
    <>
      <Heading
        title="Your scheme matches"
        status={
          <span
            className={
              'family-heading-status' +
              (data.profile.confirmed ? '' : ' pending')
            }
          >
            <CheckCircle2 size={13} />
            {data.profile.confirmed
              ? 'Profile complete'
              : 'Complete your profile for personalized matches'}
          </span>
        }
        description={
          'Government schemes ranked for ' +
          (data.profile.businessName || 'your business') +
          '.'
        }
      >
        <Button
          className="app-button"
          disabled={refreshing}
          onClick={async () => {
            setRefreshing(true);
            try {
              await reload();
              notice('Recommendations refreshed.');
            } catch (e) {
              notice((e as Error).message);
            } finally {
              setRefreshing(false);
            }
          }}
        >
          <RefreshCw size={17} />
          {refreshing ? 'Refreshing...' : 'Refresh Recommendations'}
        </Button>
      </Heading>
      <div className="stats-grid">
        {[
          [matches.length, 'Schemes found', 'Based on your profile'],
          [
            matches.filter((m) => m.score >= 90).length,
            'Highly relevant',
            'Your strongest matches',
          ],
          [data.saved.length, 'Saved schemes', 'Your shortlist'],
          [data.applications.length, 'Applications', 'In progress'],
        ].map(([n, title, description]) => (
          <div className="stat-card" key={title}>
            <h3>{title}</h3>
            <strong>{n}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <label className="dashboard-search">
        <Search size={18} />
        <input
          aria-label="Search recommendations"
          placeholder="Search schemes, subsidies, grants..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <CategoryPills
        categories={data.taxonomy.categories}
        value={category}
        onChange={setCategory}
      />
      {filtered.length ? (
        <div className="scheme-grid">
          {filtered.map((m) => (
            <SchemeCard key={m.scheme.id} scheme={m.scheme} match={m} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            matches.length
              ? 'No schemes match these filters'
              : 'Find schemes for your business'
          }
          description={
            matches.length
              ? 'Choose another category or change your search.'
              : 'Complete your business profile to get personalized recommendations.'
          }
          href={matches.length ? '/schemes' : '/profile'}
          label={
            matches.length ? 'Explore all schemes' : 'Complete Business Profile'
          }
        />
      )}
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="section-title">
            <h2>Closing soon</h2>
            <Link href="/deadlines">
              View deadlines <ArrowRight size={15} />
            </Link>
          </div>
          {deadlines.length ? (
            deadlines.slice(0, 3).map((s) => (
              <Link className="list-row" href={'/schemes/' + s.id} key={s.id}>
                <div>
                  <strong>{s.name}</strong>
                  <small>Recorded deadline: {s.deadline}</small>
                </div>
                <CalendarDays size={17} />
              </Link>
            ))
          ) : (
            <p>No upcoming deadlines recorded for your saved schemes.</p>
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Recently saved</h2>
            <Link href="/saved">
              View saved <ArrowRight size={15} />
            </Link>
          </div>
          {data.saved.length ? (
            data.saved.slice(0, 3).map((s) => (
              <Link
                key={s.schemeId}
                className="list-row"
                href={'/schemes/' + s.schemeId}
              >
                <strong>
                  {data.schemes.find((t) => t.id === s.schemeId)?.name}
                </strong>
                <Bookmark size={17} />
              </Link>
            ))
          ) : (
            <p>Save schemes to keep your opportunities together.</p>
          )}
        </section>
      </div>
      <div className="section-title">
        <Link href="/schemes">
          Explore all schemes <ArrowRight size={15} />
        </Link>
        <Link href="/profile">
          Business profile · {completeness(data.profile)}% complete
        </Link>
      </div>
    </>
  );
}
export function CategoryPills({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="category-pills" role="group" aria-label="Scheme categories">
      {['All', ...categories].map((category) => (
        <button
          key={category}
          className={value === category ? 'active' : ''}
          aria-pressed={value === category}
          onClick={() => onChange(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
export function Deadlines() {
  const { data } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const schemes = data.schemes
    .filter(
      (s) =>
        !['Archived', 'Draft'].includes(s.status) &&
        s.deadline &&
        s.deadline >= today &&
        s.deadline <= end,
    )
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  return (
    <>
      <Heading
        title="Closing soon"
        description={
          schemes.length +
          ' schemes with recorded deadlines in the next 7 days.'
        }
      />
      {schemes.length ? (
        <div className="scheme-grid">
          {schemes.map((s) => (
            <div key={s.id}>
              <p className="deadline-urgency">
                <CalendarDays size={15} />
                {Math.ceil(
                  (Date.parse(s.deadline!) - Date.parse(today)) / 86400000,
                )}{' '}
                days remaining{s.demo ? ' · Demo date, verify first' : ''}
              </p>
              <SchemeCard
                scheme={s}
                match={
                  data.profile.confirmed
                    ? matchScheme(data.profile, s)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No schemes closing soon"
          description="No recorded application deadlines fall in the next 7 days. Check official sources for current dates."
          href="/schemes"
          label="Explore Schemes"
        />
      )}
    </>
  );
}
