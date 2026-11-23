'use client';
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, monthEnd, monthStart, n, sum, today } from '@/lib/format';
import { Button, Card, DateRange, Empty, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, td, tdR, th, thR } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import type { Expense, SystemKey } from '@/lib/types';

export const EXPENSE_CATEGORIES: Record<SystemKey, string[]> = {
  grain: ['Food / Meals', 'Fuel', 'Hauling / Trucking', 'Labor (Kargador / Pakyaw)', 'Drying', 'Sacks & Supplies', 'Repairs & Maintenance', 'Electricity', 'Rent', 'Permits & Fees', 'Other'],
  isp: ['Bandwidth / Upstream', 'Equipment & Materials', 'Fuel / Transportation', 'Food / Meals', 'Electricity', 'Rent / Pole Rental', 'Repairs & Maintenance', 'Collector Commission', 'Permits & Fees', 'Other'],
};

type Form = Partial<Omit<Expense, 'amount'>> & { amount: number | string };

export default function ExpensesPage({ system }: { system: SystemKey }) {
  const me = useProfile();
  const db = supabaseBrowser();
  const table = `${system}_expenses`;
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [cat, setCat] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const categories = EXPENSE_CATEGORIES[system];

  const { data, loading, reload } = useLoad(async () =>
    must(await db.from(table).select('*').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false })) as Expense[], [from, to]);

  const rows = (data ?? []).filter((r) => !cat || r.category === cat);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    (data ?? []).forEach((r) => m.set(r.category, (m.get(r.category) ?? 0) + n(r.amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const save = async () => {
    if (!form) return;
    if (!form.category || !n(form.amount)) return toast.error('Category and amount are required');
    const values = {
      expense_date: form.expense_date, category: form.category, description: form.description || null,
      amount: n(form.amount), paid_to: form.paid_to || null, reference: form.reference || null,
    };
    setSaving(true);
    const res = form.id ? await db.from(table).update(values).eq('id', form.id) : await db.from(table).insert(values);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success('Expense saved');
    setForm(null);
    reload();
  };

  const remove = async (r: Expense) => {
    if (!confirm('Delete this expense?')) return;
    const { error } = await db.from(table).delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Food, fuel, utilities and other operating costs"
        actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ expense_date: today(), category: categories[0], amount: '' })}>Add expense</Button>} />

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        <Card>
          <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
              <option value="">All categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No expenses in this range." /> : (
            <Table>
              <thead><tr><th className={th}>Date</th><th className={th}>Category</th><th className={th}>Description</th><th className={th}>Paid to</th><th className={thR}>Amount</th><th className={th} /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className={td}>{fmtDate(r.expense_date)}</td>
                    <td className={td}>{r.category}</td>
                    <td className={`${td} whitespace-normal min-w-[160px]`}>{r.description ?? '—'}{r.reference && <span className="text-xs text-slate-400"> · {r.reference}</span>}</td>
                    <td className={td}>{r.paid_to ?? '—'}</td>
                    <td className={`${tdR} font-medium`}>{money(r.amount)}</td>
                    <td className={`${td} text-right`}>
                      <div className="inline-flex gap-1">
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setForm({ ...r })}><Pencil size={15} /></button>
                        {me.role !== 'staff' && <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold"><td className={td} colSpan={4}>Total</td><td className={tdR}>{money(sum(rows, (r) => r.amount))}</td><td className={td} /></tr>
              </tbody>
            </Table>
          )}
        </Card>

        <Card className="p-4 h-fit">
          <h3 className="font-semibold text-slate-900 mb-3">By category</h3>
          {byCat.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
            <div className="space-y-2">
              {byCat.map(([c, amt]) => {
                const pct = (amt / Math.max(1, sum(data ?? [], (r) => r.amount))) * 100;
                return (
                  <div key={c}>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">{c}</span><span className="font-medium">{money(amt)}</span></div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1"><div className="h-1.5 bg-primary-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit expense' : 'Add expense'}>
        {form && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" value={form.expense_date ?? ''} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              <Input label="Amount (₱)" type="number" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <Select label="Category" value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </Select>
            <Textarea label="Description" value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Paid to" value={form.paid_to ?? ''} onChange={(e) => setForm({ ...form, paid_to: e.target.value })} />
              <Input label="OR / Reference #" value={form.reference ?? ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
