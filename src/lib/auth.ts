import 'server-only';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import type { Profile, SystemKey } from './types';

export async function getProfile(): Promise<Profile | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return (data as Profile) ?? null;
}

export function homeFor(profile: Profile): string {
  if (profile.role === 'admin') return '/admin';
  return `/${profile.system}`;
}

/** Use in a server layout: only lets through users allowed into this area. */
export async function requireArea(area: SystemKey | 'admin'): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || !profile.active) redirect('/login');
  if (profile.role === 'admin') return profile;
  if (area === 'admin' || profile.system !== area) redirect(homeFor(profile));
  return profile;
}
