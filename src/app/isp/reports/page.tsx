'use client';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, monthEnd, monthStart, n, sum, today } from '@/lib/format';
import { printPage } from '@/lib/print';
import { Button, Card, DateRange, PageHeader, Spinner, Table, td, tdR, th, thR } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { PLRow, groupSum } from '@/components/shared/ReportBits';
import { loadCustomers } from '@/components/isp/data';
import type { Expense, Invoice, Payment } from '@/lib/types';

export default function IspReports() {
  const me = useProfile();
  const db = supabaseBrowser();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());

  const { data, loading } = useLoad(async () => {
    const [customers, invoices, payments, openInv, expenses, periods] = await Promise.all([
      loadCustomers(),
      db.from('isp_invoices').select('*').gte('due_date', from).lte('due_date', to).then(must),
      db.from('isp_payments').select('*').gte('paid_on', from).lte('paid_on', to).then(must),
      db.from('isp_invoices').select('customer_id, due_date, total, amount_paid').then(must),
      db.from('isp_expenses').select('*').gte('expense_date', from).lte('expense_date', to).then(must),
      db.from('isp_payroll_periods').select('id').gte('period_end', from).lte('period_end', to).then(must),
    ]);
    const ids = (periods as { id: string }[]).map((p) => p.id);
    const lines = ids.length ? must(await db.from('isp_payroll_lines').select('gross_pay, net_pay').in('period_id', ids)) : [];
    return {
      customers, invoices: invoices as Invoice[], payments: payments as Payment[], expenses: expenses as Expense[],
      open: (openInv as Invoice[]).filter((i) => n(i.total) - n(i.amount_paid) > 0.005), payroll: lines as { gross_pay: number; net_pay: number }[],
    };
  }, [from, to]);

  if (me.role === 'staff') return <Card className="p-8 text-center text-slate-500">Reports are for managers only.</Card>;

  const body = () => {
    if (loading || !data) return <Spinner />;
    const collected = sum(data.payments, (p) => p.amount);
    const billed = sum(data.invoices, (i) => i.total);
    const billedPaid = sum(data.invoices, (i) => i.amount_paid);
    const expenses = sum(data.expenses, (e) => e.amount);
    const payroll = sum(data.payroll, (l) => l.gross_pay);
    const net = collected - expenses - payroll;

    const t = today();
    const buckets = { 'Not yet due': 0, '1–30 days': 0, '31–60 days': 0, '61–90 days': 0, 'Over 90 days': 0 };
    data.open.forEach((i) => {
      const bal = n(i.total) - n(i.amount_paid);
      const d = differenceInCalendarDays(parseISO(t), parseISO(i.due_date));
      const k = d <= 0 ? 'Not yet due' : d <= 30 ? '1–30 days' : d <= 60 ? '31–60 days' : d <= 90 ? '61–90 days' : 'Over 90 days';
      buckets[k] += bal;
    });
    const custArea = new Map(data.customers.map((c) => [c.id, c.area || '(no area)']));
    const byArea = groupSum(data.customers, (c) => c.area || '(no area)', { subs: () => 1, active: (c) => (c.status === 'active' ? 1 : 0), mrr: (c) => (c.status === 'active' ? n(c.monthly_fee) : 0), bal: (c) => Math.max(n(c.bal.balance), 0) });
    const collectedByArea = new Map(groupSum(data.payments, (p) => custArea.get(p.customer_id) ?? '?', { amt: (p) => n(p.amount) }).map((r) => [r.key, r.amt]));
    const byCollector = groupSum(data.payments, (p) => p.collector || '—', { amt: (p) => n(p.amount), cnt: () => 1 }).sort((a, b) => b.amt - a.amt);
    const byCat = groupSum(data.expenses, (e) => e.category, { amt: (e) => n(e.amount) }).sort((a, b) => b.amt - a.amt);

    return (
      <div className="space-y-5">
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5 avoid-break">
            <h2 className="font-semibold mb-2">Income statement (cash basis)</h2>
            <PLRow label="Collections" value={collected} />
            <PLRow label="Payroll (gross, incl. OT & food)" value={payroll} negative indent />
            <PLRow label="Operating expenses" value={expenses} negative indent />
            <PLRow label="NET INCOME" value={net} strong tone={net >= 0 ? 'good' : 'bad'} />
          </Card>
          <Card className="p-5 avoid-break">
            <h2 className="font-semibold mb-2">Billing & collection efficiency</h2>
            <PLRow label="Bills due in this range" value={billed} />
            <PLRow label="Of which already paid" value={billedPaid} indent />
            <PLRow label="Of which unpaid" value={billed - billedPaid} indent tone="bad" />
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-1"><span>Collection rate</span><b>{billed ? Math.round((billedPaid / billed) * 100) : 0}%</b></div>
              <div className="h-2 bg-slate-100 rounded-full"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${billed ? Math.min(100, (billedPaid / billed) * 100) : 0}%` }} /></div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Monthly recurring revenue (active subscribers): <b>{money(sum(data.customers.filter((c) => c.status === 'active'), (c) => c.monthly_fee))}</b></p>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="avoid-break">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">Receivables aging (as of today)</div>
            <Table><tbody>
              {Object.entries(buckets).map(([k, v]) => <tr key={k}><td className={td}>{k}</td><td className={`${tdR} ${k.includes('days') && v > 0 ? 'text-red-600' : ''}`}>{money(v)}</td></tr>)}
              <tr className="bg-slate-50 font-semibold"><td className={td}>Total receivables</td><td className={tdR}>{money(Object.values(buckets).reduce((a, b) => a + b, 0))}</td></tr>
            </tbody></Table>
          </Card>
          <Card className="avoid-break">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">Collections by collector</div>
            <Table>
              <thead><tr><th className={th}>Collector</th><th className={thR}>Receipts</th><th className={thR}>Amount</th></tr></thead>
              <tbody>{byCollector.map((r) => <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{r.cnt}</td><td className={tdR}>{money(r.amt)}</td></tr>)}</tbody>
            </Table>
          </Card>
        </div>

        <Card className="avoid-break">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold">By area</div>
          <Table>
            <thead><tr><th className={th}>Area</th><th className={thR}>Subscribers</th><th className={thR}>Active</th><th className={thR}>Monthly revenue</th><th className={thR}>Collected (range)</th><th className={thR}>Outstanding</th></tr></thead>
            <tbody>{byArea.sort((a, b) => b.subs - a.subs).map((r) => (
              <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{r.subs}</td><td className={tdR}>{r.active}</td><td className={tdR}>{money(r.mrr)}</td><td className={tdR}>{money(collectedByArea.get(r.key) ?? 0)}</td><td className={`${tdR} ${r.bal > 0 ? 'text-red-600' : ''}`}>{money(r.bal)}</td></tr>
            ))}</tbody>
          </Table>
        </Card>

        <Card className="avoid-break">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold">Expenses by category</div>
          <Table><tbody>
            {byCat.map((r) => <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{money(r.amt)}</td></tr>)}
            <tr className="bg-slate-50 font-semibold"><td className={td}>Payroll</td><td className={tdR}>{money(payroll)}</td></tr>
          </tbody></Table>
        </Card>
        <p className="text-xs text-slate-400">Payroll counts periods whose end date falls in this range.</p>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${fmtDate(from)} – ${fmtDate(to)}`}
        actions={<><DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} /><Button variant="secondary" icon={<Printer size={16} />} onClick={printPage}>Print</Button></>} />
      {body()}
    </div>
  );
}
