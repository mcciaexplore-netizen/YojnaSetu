import { Suspense } from 'react';
import { Applications } from '@/components/features/workspace';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Applications />
    </Suspense>
  );
}
