import { AppProvider } from '@/hooks/use-app';
import { Shell } from '@/components/shell';
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
