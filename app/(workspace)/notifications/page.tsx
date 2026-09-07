import { Suspense } from 'react';
import { Notifications } from '@/components/features/workspace';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Notifications />
    </Suspense>
  );
}
