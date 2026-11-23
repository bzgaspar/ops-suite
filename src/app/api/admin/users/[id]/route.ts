import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdminApi, validateRoleSystem, bad } from '@/lib/admin-api';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await requireAdminApi();
  if (me instanceof NextResponse) return me;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  const update: Record<string, unknown> = {};
  if (typeof body.full_name === 'string' && body.full_name.trim()) update.full_name = body.full_name.trim();
  if (body.role !== undefined) {
    const rs = validateRoleSystem(body.role, body.system);
    if (typeof rs === 'string') return bad(rs);
    if (id === me.id && rs.role !== 'admin') return bad('You cannot remove your own admin role');
    Object.assign(update, rs);
  }
  if (typeof body.active === 'boolean') {
    if (id === me.id && !body.active) return bad('You cannot disable your own account');
    update.active = body.active;
  }

  if (Object.keys(update).length) {
    const { error } = await admin.from('profiles').update(update).eq('id', id);
    if (error) return bad(error.message, 500);
  }

  const authUpdate: { password?: string; ban_duration?: string } = {};
  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 6) return bad('Password must be at least 6 characters');
    authUpdate.password = body.password;
  }
  // A disabled user is also banned in Supabase Auth so their session can't be refreshed.
  if (typeof body.active === 'boolean') authUpdate.ban_duration = body.active ? 'none' : '876000h';
  if (Object.keys(authUpdate).length) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (error) return bad(error.message, 500);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const me = await requireAdminApi();
  if (me instanceof NextResponse) return me;
  const { id } = await params;
  if (id === me.id) return bad('You cannot delete your own account');
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}
