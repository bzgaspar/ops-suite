import AppShell from '@/components/layout/AppShell';
import { requireArea } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const profile = await requireArea('admin');
  return <AppShell area="admin" profile={profile}>{children}</AppShell>;
}
