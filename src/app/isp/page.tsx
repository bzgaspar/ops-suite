'use client';
import Link from 'next/link';
import { Users, FileText, Wallet, AlertTriangle, Plus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, monthStart, n, sum, today } from '@/lib/format';
import { lastMonths, bucketByMonth } from '@/lib/months';
import { Badge, Card, PageHeader, Spinner, StatCard, Table, td, tdR, th, thR } from '@/components/ui';
import BarChart from '@/components/ui/BarChart';
import { loadCustomers, STATUS_TONE } from '@/components/isp/data';
import type { Invoice, Payment } from '@/lib/types';

export default function IspDashboard() {
  const months = lastMonths(6);
  const { data, loading } = useLoad(async () => {
    const db = supabaseBrowser();
    const [customers, invoices, payments, expenses] = await Promise.all([
      loadCustomers(),
      db.from('isp_invoices').select('due_date, total').gte('due_date', months[0].start).then(must),
      db.from('isp_payments').select('id, receipt_no, paid_on, amount, method, collector, customer_id, isp_customers(full_name)').gte('paid_on', months[0].start).order('created_at', { ascending: false }).then(must),
      db.from('isp_expenses').select('expense_date, amount').gte('expense_date', months[0].start).then(must),
    ]);
    return { customers, invoices: invoices as Pick<Invoice, 'due_date' | 'total'>[], payments: payments as unknown as Payment[], expenses: expenses as { expense_date: string; amount: number }[] };
  }, [], 'isp:dashboard');

  if (loading || !data) return <Spinner />;
  const t = today(), ms = monthStart();
  const active = data.customers.filter((c) => c.status === 'active');
  const outstanding = sum(data.customers, (c) => Math.max(n(c.bal.balance), 0));
  const overdue = data.customers.filter((c) => n(c.bal.overdue) > 0).sort((a, b) => n(b.bal.overdue) - n(a.bal.overdue));
  const collectedMonth = sum(data.payments.filter((p) => p.paid_on >= ms), (p) => p.amount);
  const todayPays = data.payments.filter((p) => p.paid_on === t);
  const billedMonth = sum(data.invoices.filter((i) => i.due_date >= ms), (i) => i.total);
  const keys = months.map((m) => m.key);

  return (
    <div>
      <PageHeader title="Internet Billing Dashboard" subtitle={fmtDate(t, 'EEEE, MMMM d, yyyy')} actions={<>
        <Link href="/isp/payments" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"><Plus size={16} /> Collect</Link>
        <Link href="/isp/billing" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"><FileText size={16} /> Billing</Link>
      </>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="Active subscribers" value={active.length} sub={`${data.customers.filter((c) => c.status === 'suspended').length} suspended · ${data.customers.filter((c) => c.status === 'disconnected').length} disconnected`} icon={<Users size={20} />} />
        <StatCard label="Collected this month" value={money(collectedMonth)} sub={`Today: ${money(sum(todayPays, (p) => p.amount))} (${todayPays.length})`} icon={<Wallet size={20} />} tone="green" />
        <StatCard label="Billed this month" value={money(billedMonth)} sub={`Expected monthly: ${money(sum(active, (c) => c.monthly_fee))}`} icon={<FileText size={20} />} tone="violet" />
        <StatCard label="Total receivables" value={money(outstanding)} sub={`${overdue.length} customer(s) overdue`} icon={<AlertTriangle size={20} />} tone={overdue.length ? 'red' : 'slate'} />
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-5 mb-5">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Last 6 months</h2>
          <BarChart labels={months.map((m) => m.label)} series={[
            { label: 'Billed', data: bucketByMonth(data.invoices, (r) => r.due_date, (r) => n(r.total), keys) },
            { label: 'Collected', data: bucketByMonth(data.payments, (r) => r.paid_on, (r) => n(r.amount), keys) },
            { label: 'Expenses', data: bucketByMonth(data.expenses, (r) => r.expense_date, (r) => n(r.amount), keys) },
          ]} />
        </Card>
        <Card>
          <div className="px-4 py-3 border-b border-slate-200 font-semibold flex justify-between"><span>Top overdue</span><Link className="text-sm text-primary-600" href="/isp/notices">Send notices</Link></div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {overdue.length === 0 && <p className="p-4 text-sm text-slate-400">No overdue accounts 🎉</p>}
            {overdue.slice(0, 12).map((c) => (
              <Link key={c.id} href={`/isp/customers/${c.id}`} className="flex justify-between items-center px-4 py-2 hover:bg-slate-50 text-sm">
                <div><p className="font-medium">{c.full_name}</p><p className="text-xs text-slate-500">{c.area ?? '—'} · since {fmtDate(c.bal.oldest_unpaid_due, 'MMM d')} <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></p></div>
                <span className="font-semibold text-red-600">{money(c.bal.overdue)}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">Today&apos;s collections</div>
        <Table>
          <thead><tr><th className={th}>OR #</th><th className={th}>Customer</th><th className={th}>Method</th><th className={th}>Collector</th><th className={thR}>Amount</th></tr></thead>
          <tbody>
            {todayPays.length === 0 && <tr><td className={td} colSpan={5}>No collections yet today.</td></tr>}
            {todayPays.map((p) => <tr key={p.id}><td className={`${td} font-mono text-xs`}>{p.receipt_no}</td><td className={td}>{p.isp_customers?.full_name}</td><td className={`${td} capitalize`}>{p.method}</td><td className={td}>{p.collector}</td><td className={tdR}>{money(p.amount)}</td></tr>)}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
