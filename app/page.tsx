import { McciaBrand, McciaFooter } from '@/components/mccia-brand';
import { Workflow } from '@/components/workflow';
import { Featured } from '@/components/featured';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  Check,
  ShieldCheck,
  Sprout,
  Globe2,
  Cpu,
  Factory,
  Store,
  BriefcaseBusiness,
} from 'lucide-react';
export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <McciaBrand />
        <nav>
          <a href="#how">How it works</a>
          <Link href="/schemes">Explore schemes</Link>
          <a href="#faq">FAQs</a>
        </nav>
        <Link href="/auth" className="button outline">
          Log in <ArrowUpRight size={16} />
        </Link>
      </header>
      <section className="hero mccia-hero">
        <div>
          <span className="eyebrow">AN MCCIA DIGITAL INITIATIVE</span>
          <h1>
            Find government schemes.
            <br />
            <span>Relevant to your business.</span>
          </h1>
          <p>
            Government schemes and support relevant to your business. Create one
            profile to understand your options and take the next step with
            confidence.
          </p>
          <div className="actions">
            <Link className="button" href="/profile">
              Find Schemes for My Business <ArrowRight size={18} />
            </Link>
            <Link className="button outline" href="/schemes">
              Explore Schemes
            </Link>
          </div>
          <div className="hero-trust">
            <ShieldCheck size={17} /> Clear eligibility <span>·</span> Relevant
            opportunities <span>·</span> Practical next steps
          </div>
        </div>
        <aside className="hero-guidance">
          <div className="hero-guidance-label">
            <Building2 size={21} />
            <span>YOUR BUSINESS. YOUR OPPORTUNITIES.</span>
          </div>
          <h2>
            One profile.
            <br />
            Many opportunities.
          </h2>
          <p>
            A clear path from understanding your business to preparing your
            application.
          </p>
          <ol>
            {[
              [
                'Tell us about your business',
                'Sector, location, size and business goals.',
              ],
              [
                'Understand the fit',
                'See benefits and conditions that need checking.',
              ],
              [
                'Take the next step',
                'Save opportunities, prepare documents and track progress.',
              ],
            ].map(([title, description], i) => (
              <li key={title}>
                <span>{i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <small>
            Demo schemes are clearly marked. Always verify before applying.
          </small>
        </aside>
      </section>
      <section className="sector-strip">
        <p>BIG POSSIBILITIES. EVERY KIND OF SMALL BUSINESS.</p>
        <div>
          {[
            [Factory, 'Manufacturing'],
            [Cpu, 'IT & software'],
            [Store, 'Retail & trading'],
            [BriefcaseBusiness, 'Services'],
            [Sprout, 'Agri & food'],
            [Globe2, 'Exporters'],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Factory;
            return (
              <span key={String(label)}>
                <I size={21} />
                {String(label)}
              </span>
            );
          })}
        </div>
      </section>
      <section id="how" className="home-section">
        <span className="eyebrow">A CLEAR PATH FORWARD</span>
        <h2>Less searching. More possibilities.</h2>
        <Workflow />
      </section>
      <Featured />
      <section className="home-callout">
        <div>
          <span className="eyebrow">A LITTLE CLARITY. A BIG STEP FORWARD.</span>
          <h2>Built around your business.</h2>
          <p>
            Understand why a scheme is relevant before you spend time applying.
          </p>
        </div>
        <ul>
          {[
            'Explainable matching, with no hidden assumptions',
            'Central and state support in one place',
            'A checklist for every application',
            'MCCIA enquiries for additional guidance',
          ].map((t) => (
            <li key={t}>
              <Check size={18} />
              {t}
            </li>
          ))}
        </ul>
      </section>
      <section id="faq" className="home-section faq">
        <div>
          <span className="eyebrow">GOOD QUESTIONS</span>
          <h2>A few things to know.</h2>
        </div>
        <div>
          {[
            [
              'Does a match guarantee approval?',
              'No. A match indicates relevance based on your profile and the conditions recorded in our database. The official authority determines eligibility and approval.',
            ],
            [
              'Can service and retail businesses use YojanaSetu?',
              'Yes. Profiles and support categories cover manufacturing, services, retail, software, food processing, agriculture-related businesses, and exporters.',
            ],
            [
              'Is the scheme information verified?',
              'The initial catalogue uses clearly labelled illustrative demo records. They are not government schemes or verified financial guidance. Always verify official conditions before applying.',
            ],
            [
              'Can I save my progress?',
              'Yes. Your profile draft, saved schemes, checklists, and application updates persist in your account.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <McciaFooter />
    </main>
  );
}
