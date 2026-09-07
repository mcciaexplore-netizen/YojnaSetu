import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone panel">
      <h1>This page isn’t available.</h1>
      <p>Return to your workspace or explore the scheme catalogue.</p>
      <Link className="button" href="/schemes">
        Explore Schemes
      </Link>
    </main>
  );
}
