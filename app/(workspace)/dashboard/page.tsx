import { Suspense } from 'react';
import { Dashboard } from '@/components/features/discovery';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Dashboard />
    </Suspense>
  );
}
