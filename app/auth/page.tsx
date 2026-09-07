import { Suspense } from 'react';
import { Auth } from '@/components/features/auth';
export default function Page() {
  return (
    <Suspense fallback={<p>Opening sign in...</p>}>
      <Auth />
    </Suspense>
  );
}
