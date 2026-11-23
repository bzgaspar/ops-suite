import { redirect } from 'next/navigation';
import { getProfile, homeFor } from '@/lib/auth';

export default async function Home() {
  const profile = await getProfile();
  if (!profile || !profile.active) redirect('/login');
  redirect(homeFor(profile));
}
