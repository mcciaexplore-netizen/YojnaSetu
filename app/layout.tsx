import type { Metadata } from 'next';
import './globals.css';
import './mccia-theme.css';
const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const metadata: Metadata = {
  metadataBase: new URL(origin),
  icons: { icon: '/favicon.svg' },
  title: 'YojanaSetu | MSME Scheme Eligibility Finder',
  description:
    'One Profile. Many Opportunities. Find support for your business with transparent scheme matching.',
  openGraph: {
    title: 'YojanaSetu',
    description: 'One Profile. Many Opportunities.',
    images: [{ url: '/og.png', width: 1731, height: 909 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YojanaSetu',
    description: 'One Profile. Many Opportunities.',
    images: ['/og.png'],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
