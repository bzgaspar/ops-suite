import 'server-only';
import { NextResponse } from 'next/server';
import { getProfile } from './auth';
import type { Profile, Role, SystemKey } from './types';

export async function requireAdminApi(): Promise<Profile | NextResponse> {
  const me = await getProfile();
  if (!me || !me.active || me.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  return me;
}

export function validateRoleSystem(role: unknown, system: unknown): { role: Role; system: SystemKey | null } | string {
  if (role !== 'admin' && role !== 'manager' && role !== 'staff') return 'Invalid role';
  if (role === 'admin') return { role, system: null };
  if (system !== 'grain' && system !== 'isp') return 'Choose a system for this user';
  return { role, system };
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
