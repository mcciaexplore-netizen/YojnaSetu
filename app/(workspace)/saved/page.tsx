import { Suspense } from 'react';
import { Saved } from '@/components/features/scheme-detail';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Saved />
    </Suspense>
  );
}
