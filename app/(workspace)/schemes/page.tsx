import { Suspense } from 'react';
import { Schemes } from '@/components/features/discovery';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Schemes />
    </Suspense>
  );
}
