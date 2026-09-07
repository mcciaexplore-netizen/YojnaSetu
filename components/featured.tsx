'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Scheme } from '@/types';
import { api } from '@/hooks/use-app';
import { ArrowUpRight, Landmark } from 'lucide-react';
export function Featured() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<Scheme[]>('catalogue')
      .then((s) => setSchemes(s.slice(0, 3)))
      .catch(() => setFailed(true));
  }, []);
  return (
    <section className="home-section">
      <span className="eyebrow">EXPLORE WHAT’S POSSIBLE</span>
      <h2>Support for your next move.</h2>
      <p className="featured-caption">
        Illustrative opportunities from the scheme catalogue. Demo data — verify
        before application.
      </p>
      <div className="scheme-grid">
        {schemes.map((s) => (
          <article className="panel featured-card" key={s.id}>
            <span className="icon-box">
              <Landmark size={21} />
            </span>
            <small>
              {s.level} · {s.fundingType} · {s.demo ? 'Demo' : s.status}
            </small>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <Link className="text-link" href={'/schemes/' + s.id}>
              Explore opportunity <ArrowUpRight size={15} />
            </Link>
          </article>
        ))}
      </div>
      {failed && (
        <p>
          The catalogue is currently unavailable.{' '}
          <Link className="text-link" href="/schemes">
            Try the scheme finder →
          </Link>
        </p>
      )}
    </section>
  );
}
