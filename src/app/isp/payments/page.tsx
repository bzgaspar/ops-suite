'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, n, sum, today } from '@/lib/format';
import { Button, Card, DateRange, Empty, Modal, PageHeader, Printable, SearchBox, Spinner, Table, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { loadCustomers } from '@/components/isp/data';
import PaymentModal, { OfficialReceipt } from '@/components/isp/PaymentModal';
import { groupSum } from '@/components/shared/ReportBits';
import type { Payment } from '@/lib/types';

export default function PaymentsPage() {
  const me = useProfile();
  const db = supabaseBrowser();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const { data: customers, reload: reloadCustomers } = useLoad(loadCustomers, [], 'isp:customers');
  const { data, loading, reload } = useLoad(async () =>
    must(await db.from('isp_payments').select('*, isp_customers(full_name, account_no, address)').gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false }).order('created_at', { ascending: false })) as Payment[], [from, to], 'isp:payments');

  const rows = useMemo(() => (data ?? []).filter((p) => `${p.receipt_no} ${p.isp_customers?.full_name} ${p.isp_customers?.account_no} ${p.reference ?? ''} ${p.collector ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const byCollector = groupSum(rows, (p) => p.collector || '—', { amt: (p) => n(p.amount), cnt: () => 1 });
  const byMethod = groupSum(rows, (p) => p.method, { amt: (p) => n(p.amount) });

  const remove = async (p: Payment) => {
    if (!(await ask(`Void/delete payment ${p.receipt_no} (${money(p.amount)})? The customer's balance will go back up.`))) return;
    const { error } = await db.from('isp_payments').delete().eq('id', p.id);
    if (error) return notify.error(error);
    reload(); reloadCustomers();
  };

  return (
    <div>
      <PageHeader title="Collections" subtitle="Payments received from subscribers"
        actions={<Button icon={<Plus size={16} />} onClick={() => setAdding(true)} disabled={!customers}>Record payment</Button>} />

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        <Card>
          <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            <SearchBox value={q} onChange={setQ} placeholder="OR #, customer, collector…" />
          </div>
          {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No collections in this range." /> : (
            <Table>
              <thead><tr><th className={th}>OR #</th><th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Method</th><th className={th}>Ref</th><th className={th}>Collector</th><th className={thR}>Amount</th><th className={th} /></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className={`${td} font-mono text-xs`}>{p.receipt_no}</td>
                    <td className={td}>{fmtDate(p.paid_on)}</td>
                    <td className={`${td} font-medium`}><Link className="hover:text-primary-600" href={`/isp/customers/${p.customer_id}`}>{p.isp_customers?.full_name}</Link> <span className="text-xs text-slate-400">{p.isp_customers?.account_no}</span></td>
                    <td className={`${td} capitalize`}>{p.method}</td>
                    <td className={td}>{p.reference ?? ''}</td>
                    <td className={td}>{p.collector ?? ''}</td>
                    <td className={`${tdR} font-semibold`}>{money(p.amount)}</td>
                    <td className={`${td} text-right`}>
                      <div className="inline-flex gap-1">
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setReceipt(p)}><Printer size={15} /></button>
                        {me.role !== 'staff' && <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(p)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold"><td className={td} colSpan={6}>{rows.length} payment(s)</td><td className={tdR}>{money(sum(rows, (p) => p.amount))}</td><td className={td} /></tr>
              </tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-5">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">By collector</h3>
            {byCollector.map((r) => <div key={r.key} className="flex justify-between text-sm py-1"><span>{r.key} <span className="text-slate-400">({r.cnt})</span></span><span className="font-medium">{money(r.amt)}</span></div>)}
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold mb-2">By method</h3>
            {byMethod.map((r) => <div key={r.key} className="flex justify-between text-sm py-1 capitalize"><span>{r.key}</span><span className="font-medium">{money(r.amt)}</span></div>)}
          </Card>
        </div>
      </div>

      {adding && customers && <PaymentModal customers={customers} onClose={() => setAdding(false)} onSaved={() => { reload(); reloadCustomers(); }} />}
      <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Receipt" size="sm">
        {receipt && <><OfficialReceipt p={receipt} /><Printable><OfficialReceipt p={receipt} /></Printable><Button className="w-full mt-4" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button></>}
      </Modal>
    </div>
  );
}
