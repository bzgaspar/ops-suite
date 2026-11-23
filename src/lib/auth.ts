import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';
import type { Profile, SystemKey } from './types';

/** Signed-in user's profile. Deduped per request; JWT verified locally via getClaims. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
  return (data as Profile) ?? null;
});

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
