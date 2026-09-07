import { Suspense } from 'react';
import { Admin } from '@/components/features/admin';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Admin />
    </Suspense>
  );
}
