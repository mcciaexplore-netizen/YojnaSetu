import { Suspense } from 'react';
import { ProfileWizard } from '@/components/features/profile';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace...</p>}>
      <ProfileWizard />
    </Suspense>
  );
}
