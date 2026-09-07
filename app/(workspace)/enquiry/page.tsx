import { Suspense } from 'react';
import { Enquiry } from '@/components/features/workspace';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <Enquiry />
    </Suspense>
  );
}
