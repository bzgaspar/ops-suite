'use client';
import { useState } from 'react';
import { Plus, Pencil, Trash2, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLoad } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';
import { Badge, Button, Card, Input, Modal, PageHeader, SearchBox, Select, Spinner, Table, td, th } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import type { Profile, Role, SystemKey } from '@/lib/types';

const SYSTEM_LABEL: Record<string, string> = { grain: 'Palay & Corn', isp: 'Internet Billing' };

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'Request failed');
  return json;
}

interface Form { id?: string; username: string; full_name: string; password: string; role: Role; system: SystemKey | '' }
const blank: Form = { username: '', full_name: '', password: '', role: 'staff', system: 'grain' };

export default function UsersPage() {
  const me = useProfile();
  const { data: users, loading, reload } = useLoad<Profile[]>(() => api('/api/admin/users', 'GET'), [], 'admin:users');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'grain' | 'isp' | 'admin'>('all');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const list = (users ?? []).filter((u) =>
    (filter === 'all' || (filter === 'admin' ? u.role === 'admin' : u.system === filter)) &&
    `${u.full_name} ${u.username}`.toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (form.id) {
        await api(`/api/admin/users/${form.id}`, 'PATCH', {
          full_name: form.full_name, role: form.role, system: form.system || null, password: form.password || undefined,
        });
        toast.success('User updated');
      } else {
        await api('/api/admin/users', 'POST', { ...form, system: form.system || null });
        toast.success('User created');
      }
      setForm(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (u: Profile) => {
    try {
      await api(`/api/admin/users/${u.id}`, 'PATCH', { active: !u.active });
      toast.success(u.active ? 'Account disabled' : 'Account enabled');
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (u: Profile) => {
    if (!confirm(`Delete ${u.full_name} (${u.username}) permanently?`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, 'DELETE');
      toast.success('User deleted');
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Only the admin can add users. Each user belongs to one system and sees only that system."
        actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ ...blank })}>Add user</Button>} />

      <Card>
        <div className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center justify-between border-b border-slate-200">
          <div className="flex gap-1 flex-wrap">
            {(['all', 'grain', 'isp', 'admin'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {f === 'all' ? 'All' : f === 'admin' ? 'Admins' : SYSTEM_LABEL[f]}
              </button>
            ))}
          </div>
          <SearchBox value={q} onChange={setQ} />
        </div>
        {loading ? <Spinner /> : (
          <Table>
            <thead><tr><th className={th}>Name</th><th className={th}>Username</th><th className={th}>System</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Created</th><th className={th}></th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className={`${td} font-medium`}>{u.full_name}{u.id === me.id && <span className="text-xs text-slate-400"> (you)</span>}</td>
                  <td className={td}>{u.username}</td>
                  <td className={td}>{u.role === 'admin' ? <Badge tone="violet">all systems</Badge> : <Badge tone={u.system === 'grain' ? 'green' : 'blue'}>{SYSTEM_LABEL[u.system!]}</Badge>}</td>
                  <td className={td}><Badge tone={u.role === 'admin' ? 'red' : u.role === 'manager' ? 'amber' : 'slate'}>{u.role}</Badge></td>
                  <td className={td}>{u.active ? <Badge tone="green">active</Badge> : <Badge tone="red">disabled</Badge>}</td>
                  <td className={td}>{fmtDate(u.created_at)}</td>
                  <td className={`${td} text-right`}>
                    <div className="inline-flex gap-1">
                      <button title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setForm({ id: u.id, username: u.username, full_name: u.full_name, password: '', role: u.role, system: u.system ?? '' })}><Pencil size={15} /></button>
                      {u.id !== me.id && <>
                        <button title={u.active ? 'Disable' : 'Enable'} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => toggle(u)}><Power size={15} /></button>
                        <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(u)}><Trash2 size={15} /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit user' : 'Add user'}>
        {form && (
          <div className="space-y-3">
            <Input label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label="Username" value={form.username} disabled={!!form.id} onChange={(e) => setForm({ ...form, username: e.target.value })} hint="Used to sign in. Letters, numbers, dot, dash, underscore." />
            <Input label={form.id ? 'New password (leave blank to keep)' : 'Password'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              hint="Manager: full access to their system including personnel & payroll. Staff: daily records only.">
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin (all systems + users)</option>
            </Select>
            {form.role !== 'admin' && (
              <Select label="System" value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value as SystemKey })}>
                <option value="grain">Palay & Corn Buying Station</option>
                <option value="isp">Internet Billing & Collection</option>
              </Select>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>{form.id ? 'Save' : 'Create user'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
