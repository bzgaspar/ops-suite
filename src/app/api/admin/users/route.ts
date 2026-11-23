import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdminApi, validateRoleSystem, bad, withErrors } from '@/lib/admin-api';
import { usernameToEmail } from '@/lib/format';

export const GET = withErrors(async () => {
  const me = await requireAdminApi();
  if (me instanceof NextResponse) return me;
  const { data, error } = await supabaseAdmin().from('profiles').select('*').order('created_at');
  if (error) return bad(error.message, 500);
  return NextResponse.json(data);
});

export const POST = withErrors(async (req: Request) => {
  const me = await requireAdminApi();
  if (me instanceof NextResponse) return me;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? '').trim().toLowerCase();
  const full_name = String(body.full_name ?? '').trim();
  const password = String(body.password ?? '');
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return bad('Username: 3–32 letters, numbers, dot, dash or underscore');
  if (!full_name) return bad('Full name is required');
  if (password.length < 6) return bad('Password must be at least 6 characters');
  const rs = validateRoleSystem(body.role, body.system);
  if (typeof rs === 'string') return bad(rs);

  const admin = supabaseAdmin();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error || !created.user) return bad(error?.message?.includes('already') ? 'Username already taken' : (error?.message ?? 'Could not create user'));

  const { error: pErr } = await admin.from('profiles').insert({ id: created.user.id, username, full_name, ...rs, active: true });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return bad(pErr.message.includes('duplicate') ? 'Username already taken' : pErr.message);
  }
  return NextResponse.json({ ok: true });
});
