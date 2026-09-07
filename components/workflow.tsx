import {
  Building2,
  ClipboardCheck,
  Search,
  FileCheck,
  ArrowRight,
} from 'lucide-react';
const steps = [
  ['Business Profile', 'Tell us about your business.', Building2],
  ['Profile Processing', 'Review your business details.', ClipboardCheck],
  ['Scheme Matching', 'Compare eligibility conditions.', Search],
  ['Relevant Schemes', 'Understand your opportunities.', FileCheck],
  ['Take Action', 'Save, prepare and track.', ArrowRight],
] as const;
export function Workflow({ matching = false }: { matching?: boolean }) {
  return (
    <ol
      className={'mccia-workflow' + (matching ? ' matching-workflow' : '')}
      aria-label="Your journey from business profile to application"
    >
      {steps.map(([title, description, Icon], i) => (
        <li key={title}>
          <div>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <Icon size={21} />
          </div>
          <strong>{title}</strong>
          <p>{description}</p>
        </li>
      ))}
    </ol>
  );
}
export function WorkspaceSkeleton() {
  return (
    <main
      className="workspace-skeleton"
      aria-busy="true"
      aria-label="Loading your business workspace"
    >
      <div className="skeleton-bar skeleton" />
      <div className="skeleton-title skeleton" />
      <div className="skeleton-caption skeleton" />
      <div className="skeleton-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
      <div className="skeleton-cards">
        {[0, 1, 2].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading your workspace and scheme information.
      </span>
    </main>
  );
}
