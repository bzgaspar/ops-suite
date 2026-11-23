'use client';
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { Button, Card, Empty, Input, Modal, PageHeader, SearchBox, Select, Spinner, Table, Textarea, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';

export interface CrudField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  default?: unknown;
  hint?: string;
  full?: boolean; // span both columns
}

export interface CrudColumn<T> {
  label: string;
  render: (row: T) => React.ReactNode;
  right?: boolean;
}

interface Props<T> {
  table: string;
  title: string;
  subtitle?: string;
  fields: CrudField[];
  columns: CrudColumn<T>[];
  orderBy?: string;
  select?: string;
  searchText?: (row: T) => string;
  managerOnly?: boolean;
  onRowClick?: (row: T) => void;
  extraActions?: React.ReactNode;
  /** Fill or adjust values before save (e.g. copy plan fee). */
  beforeSave?: (values: Record<string, unknown>) => Record<string, unknown>;
  onFieldChange?: (key: string, value: unknown, values: Record<string, unknown>) => Record<string, unknown>;
}

export default function CrudPage<T extends { id: string }>(p: Props<T>) {
  const me = useProfile();
  const canDelete = me.role !== 'staff';
  const db = supabaseBrowser();
  const { data, loading, reload } = useLoad(async () =>
    must(await db.from(p.table).select(p.select ?? '*').order(p.orderBy ?? 'created_at', { ascending: p.orderBy ? true : false })) as unknown as T[], [p.table], `crud:${p.table}:${p.select ?? '*'}`);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!q || !p.searchText) return list;
    const s = q.toLowerCase();
    return list.filter((r) => p.searchText!(r).toLowerCase().includes(s));
  }, [data, q, p.searchText]);

  if (p.managerOnly && me.role === 'staff') return <Card className="p-8 text-center text-slate-500">This page is for managers only.</Card>;

  const blank = () => Object.fromEntries(p.fields.map((f) => [f.key, f.default ?? (f.type === 'checkbox' ? true : '')]));

  const save = async () => {
    if (!editing) return;
    for (const f of p.fields) {
      if (f.required && (editing[f.key] === '' || editing[f.key] == null)) return notify.error(`${f.label} is required`);
    }
    let values: Record<string, unknown> = {};
    for (const f of p.fields) {
      const v = editing[f.key];
      values[f.key] = v === '' ? (f.type === 'number' ? 0 : null) : f.type === 'number' ? Number(v) : v;
    }
    if (p.beforeSave) values = p.beforeSave(values);
    setSaving(true);
    const res = editing.id
      ? await db.from(p.table).update(values).eq('id', editing.id as string)
      : await db.from(p.table).insert(values);
    setSaving(false);
    if (res.error) return notify.error(res.error);
    notify.success('Saved');
    setEditing(null);
    reload();
  };

  const remove = async (row: T) => {
    if (!(await ask('Delete this record? This cannot be undone.'))) return;
    const { error } = await db.from(p.table).delete().eq('id', row.id);
    if (error) return notify.error(error);
    notify.success('Deleted');
    reload();
  };

  const set = (key: string, value: unknown) => {
    setEditing((cur) => {
      let next = { ...cur!, [key]: value };
      if (p.onFieldChange) next = p.onFieldChange(key, value, next);
      return next;
    });
  };

  return (
    <div>
      <PageHeader title={p.title} subtitle={p.subtitle} actions={<>
        {p.extraActions}
        <Button icon={<Plus size={16} />} onClick={() => setEditing(blank())}>Add</Button>
      </>} />
      <Card>
        {p.searchText && <div className="p-3 border-b border-slate-200"><SearchBox value={q} onChange={setQ} /></div>}
        {loading ? <Spinner /> : rows.length === 0 ? <Empty /> : (
          <Table>
            <thead><tr>{p.columns.map((c) => <th key={c.label} className={c.right ? thR : th}>{c.label}</th>)}<th className={th} /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50 ${p.onRowClick ? 'cursor-pointer' : ''}`} onClick={() => p.onRowClick?.(r)}>
                  {p.columns.map((c) => <td key={c.label} className={c.right ? tdR : td}>{c.render(r)}</td>)}
                  <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex gap-1">
                      <button title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setEditing({ ...(r as Record<string, unknown>) })}><Pencil size={15} /></button>
                      {canDelete && <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${p.title.replace(/s$/, '')}` : `Add ${p.title.replace(/s$/, '')}`} size="xl">
        {editing && (
          <div className="grid sm:grid-cols-2 gap-3">
            {p.fields.map((f) => {
              const v = editing[f.key];
              const span = f.full || f.type === 'textarea' ? 'sm:col-span-2' : '';
              if (f.type === 'textarea') return <Textarea key={f.key} wrapClass={span} label={f.label} value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
              if (f.type === 'select') return (
                <Select key={f.key} wrapClass={span} label={f.label} hint={f.hint} value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              );
              if (f.type === 'checkbox') return (
                <label key={f.key} className={`flex items-center gap-2 text-sm text-slate-700 ${span}`}>
                  <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} className="w-4 h-4 rounded" /> {f.label}
                </label>
              );
              return <Input key={f.key} wrapClass={span} label={f.label} hint={f.hint} type={f.type ?? 'text'} step={f.type === 'number' ? 'any' : undefined} value={(v as string | number) ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
            })}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
