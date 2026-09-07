import { Suspense } from 'react';
import { Assistant } from '@/components/features/workspace';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Assistant />
    </Suspense>
  );
}
