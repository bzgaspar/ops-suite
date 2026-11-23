import 'server-only';
import { NextResponse } from 'next/server';
import { getProfile } from './auth';
import type { Profile, Role, UserSystem } from './types';

export async function requireAdminApi(): Promise<Profile | NextResponse> {
  const me = await getProfile();
  if (!me) return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  if (!me.active || me.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can do this.' }, { status: 403 });
  }
  return me;
}

export function validateRoleSystem(role: unknown, system: unknown): { role: Role; system: UserSystem | null } | string {
  if (role !== 'admin' && role !== 'manager' && role !== 'staff') return 'Invalid role';
  if (role === 'admin') return { role, system: null };
  if (system !== 'grain' && system !== 'isp' && system !== 'both') return 'Choose a system for this user';
  return { role, system };
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Wrap a route handler so unexpected throws return JSON the UI can show, not an HTML 500. */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      console.error(e);
      return bad(e instanceof Error ? e.message : 'Server error', 500);
    }
  };
}
