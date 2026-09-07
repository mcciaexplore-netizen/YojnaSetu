'use client';
import Link from 'next/link';
import { FileCheck } from 'lucide-react';
export function McciaBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={'product-brand' + (compact ? ' compact' : '')}>
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
export function McciaFooter() {
  return (
    <footer className="family-footer">
      <a
        href="https://www.mcciapune.com/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="MCCIA official website"
      >
        <img src="/assets/mccia-logo.png" alt="MCCIA" width={90} height={24} />
      </a>
      <span>
        YojanaSetu <small>MSME Scheme Eligibility Finder</small>
      </span>
      <p>An MCCIA Digital Initiative</p>
      <Link href="/enquiry">Help</Link>
    </footer>
  );
}
