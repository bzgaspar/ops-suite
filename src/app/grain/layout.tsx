import AppShell from '@/components/layout/AppShell';
import { requireArea } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const profile = await requireArea('grain');
  return <AppShell area="grain" profile={profile}>{children}</AppShell>;
}
