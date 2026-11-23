'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, addMonths, parseISO } from 'date-fns';
import { Zap, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, n, sum } from '@/lib/format';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, SearchBox, Spinner, StatCard, Table, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { invoiceStatus } from '@/components/isp/data';
import type { Invoice } from '@/lib/types';

export default function BillingPage() {
  const me = useProfile();
  const db = supabaseBrowser();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM-01'));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [generating, setGenerating] = useState(false);
  const [edit, setEdit] = useState<{ inv: Invoice; amount: string; other_charges: string; discount: string; due_date: string; description: string } | null>(null);

  const monthEnd = format(addMonths(parseISO(month), 1), 'yyyy-MM-01');
  const { data, loading, reload } = useLoad(async () => {
    // Monthly bills for this month + one-off charges due this month
    const [monthly, others] = await Promise.all([
      db.from('isp_invoices').select('*, isp_customers(full_name, account_no, area)').eq('kind', 'monthly').eq('period_month', month).then(must),
      db.from('isp_invoices').select('*, isp_customers(full_name, account_no, area)').neq('kind', 'monthly').gte('due_date', month).lt('due_date', monthEnd).then(must),
    ]);
    return ([...(monthly as Invoice[]), ...(others as Invoice[])]).sort((a, b) => (a.isp_customers?.full_name ?? '').localeCompare(b.isp_customers?.full_name ?? ''));
  }, [month], 'isp:billing');
  const { data: activeCount } = useLoad(async () => (await db.from('isp_customers').select('id', { count: 'exact', head: true }).eq('status', 'active')).count ?? 0, [], 'isp:active-count');

  const rows = useMemo(() => (data ?? []).filter((i) => {
    const st = invoiceStatus(i);
    if (filter === 'unpaid' && st.bal <= 0) return false;
    if (filter === 'paid' && st.bal > 0) return false;
    return `${i.invoice_no} ${i.isp_customers?.full_name} ${i.isp_customers?.account_no} ${i.isp_customers?.area ?? ''}`.toLowerCase().includes(q.toLowerCase());
  }), [data, q, filter]);

  const generate = async () => {
    if (!(await ask(`Create ${format(parseISO(month), 'MMMM yyyy')} bills for all ACTIVE customers who don't have one yet?`))) return;
    setGenerating(true);
    const { data: count, error } = await db.rpc('isp_generate_monthly_bills', { p_month: month });
    setGenerating(false);
    if (error) return notify.error(error);
    notify.success(count ? `${count} bill(s) created` : 'Everyone already has a bill for this month');
    reload();
  };

  const saveEdit = async () => {
    if (!edit) return;
    const { error } = await db.from('isp_invoices').update({
      amount: n(edit.amount), other_charges: n(edit.other_charges), discount: n(edit.discount), due_date: edit.due_date, description: edit.description || null,
    }).eq('id', edit.inv.id);
    if (error) return notify.error(error);
    notify.success('Bill updated');
    setEdit(null);
    reload();
  };

  const remove = async (i: Invoice) => {
    if (!(await ask(`Delete bill ${i.invoice_no}? Payments will be re-applied to other bills.`))) return;
    const { error } = await db.from('isp_invoices').delete().eq('id', i.id);
    if (error) return notify.error(error);
    reload();
  };

  const all = data ?? [];
  const billed = sum(all, (i) => i.total), paid = sum(all, (i) => i.amount_paid);
  const shift = (d: number) => setMonth(format(addMonths(parseISO(month), d), 'yyyy-MM-01'));

  return (
    <div>
      <PageHeader title="Billing" subtitle="Generate monthly bills, adjust discounts/rebates and charges"
        actions={<Button icon={<Zap size={16} />} loading={generating} onClick={generate}>Generate {format(parseISO(month), 'MMM yyyy')} bills</Button>} />

      <div className="flex items-center gap-2 mb-4">
        <Button variant="secondary" size="sm" onClick={() => shift(-1)}><ChevronLeft size={16} /></Button>
        <input type="month" value={month.slice(0, 7)} onChange={(e) => e.target.value && setMonth(`${e.target.value}-01`)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        <Button variant="secondary" size="sm" onClick={() => shift(1)}><ChevronRight size={16} /></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Bills" value={`${all.filter((i) => i.kind === 'monthly').length} / ${activeCount ?? 0}`} sub="monthly bills / active customers" />
        <StatCard label="Billed" value={money(billed)} />
        <StatCard label="Paid" value={money(paid)} tone="green" />
        <StatCard label="Unpaid" value={money(billed - paid)} sub={billed ? `${Math.round((paid / billed) * 100)}% collected` : undefined} tone="red" />
      </div>

      <Card>
        <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
          <div className="flex gap-1">
            {(['all', 'unpaid', 'paid'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{f}</button>
            ))}
          </div>
          <SearchBox value={q} onChange={setQ} />
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No bills for this month yet. Click “Generate bills”." /> : (
          <Table>
            <thead><tr>
              <th className={th}>Bill #</th><th className={th}>Customer</th><th className={th}>Area</th><th className={th}>Type</th><th className={th}>Due</th>
              <th className={thR}>Amount</th><th className={thR}>+ Charges</th><th className={thR}>− Discount</th><th className={thR}>Total</th><th className={thR}>Paid</th><th className={th}>Status</th><th className={th} />
            </tr></thead>
            <tbody>
              {rows.map((i) => {
                const st = invoiceStatus(i);
                return (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className={`${td} font-mono text-xs`}>{i.invoice_no}</td>
                    <td className={`${td} font-medium`}><Link href={`/isp/customers/${i.customer_id}`} className="hover:text-primary-600">{i.isp_customers?.full_name}</Link></td>
                    <td className={td}>{i.isp_customers?.area ?? '—'}</td>
                    <td className={td}>{i.kind}</td>
                    <td className={td}>{fmtDate(i.due_date, 'MMM d')}</td>
                    <td className={tdR}>{money(i.amount)}</td>
                    <td className={tdR}>{n(i.other_charges) ? money(i.other_charges) : ''}</td>
                    <td className={tdR}>{n(i.discount) ? money(i.discount) : ''}</td>
                    <td className={`${tdR} font-semibold`}>{money(i.total)}</td>
                    <td className={tdR}>{money(i.amount_paid)}</td>
                    <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className={`${td} text-right`}>
                      <div className="inline-flex gap-1">
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setEdit({ inv: i, amount: String(i.amount), other_charges: String(i.other_charges), discount: String(i.discount), due_date: i.due_date, description: i.description ?? '' })}><Pencil size={15} /></button>
                        {me.role !== 'staff' && <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(i)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.inv.invoice_no ?? ''}`}>
        {edit && (
          <div className="space-y-3">
            <Input label="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount" type="number" step="any" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
              <Input label="Due date" type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
              <Input label="Other charges" type="number" step="any" value={edit.other_charges} onChange={(e) => setEdit({ ...edit, other_charges: e.target.value })} hint="Penalty, materials" />
              <Input label="Discount / rebate" type="number" step="any" value={edit.discount} onChange={(e) => setEdit({ ...edit, discount: e.target.value })} hint="Downtime rebate, promo" />
            </div>
            <p className="text-sm">New total: <b>{money(n(edit.amount) + n(edit.other_charges) - n(edit.discount))}</b></p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
