import type { Profile, SystemKey } from './types';

/** Can this profile work in the given system? Admins: all. 'both': grain and ISP. */
export const canUseSystem = (p: Pick<Profile, 'role' | 'system'>, sys: SystemKey) =>
  p.role === 'admin' || p.system === sys || p.system === 'both';

/** Systems a profile can open (admin and 'both' users get a switcher). */
export const systemsOf = (p: Pick<Profile, 'role' | 'system'>): SystemKey[] =>
  (['grain', 'isp'] as SystemKey[]).filter((s) => canUseSystem(p, s));

/** Where to land after sign-in. */
export const homeFor = (p: Pick<Profile, 'role' | 'system'>) =>
  p.role === 'admin' ? '/admin' : `/${systemsOf(p)[0] ?? 'grain'}`;

export const SYSTEM_LABEL: Record<SystemKey | 'both', string> = { grain: 'Palay & Corn', isp: 'Internet Billing', both: 'Both systems' };
