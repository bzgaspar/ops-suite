'use client';
import Link from 'next/link';
import { Sprout, Wifi, Users, ArrowRight } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { money, kg, n, sum, monthStart, monthEnd } from '@/lib/format';
import { Card, PageHeader, Spinner } from '@/components/ui';
import type { Profile } from '@/lib/types';

export default function AdminOverview() {
  const { data, loading } = useLoad(async () => {
    const db = supabaseBrowser();
    const from = monthStart(), to = monthEnd();
    const [profiles, purchases, sales, inv, customers, invoices, payments, balances] = await Promise.all([
      db.from('profiles').select('*').then(must),
      db.from('grain_purchases').select('net_kg, amount').gte('purchase_date', from).lte('purchase_date', to).then(must),
      db.from('grain_sales').select('net_kg, amount, amount_paid').gte('sale_date', from).lte('sale_date', to).then(must),
      db.from('grain_inventory').select('on_hand_kg').then(must),
      db.from('isp_customers').select('status').then(must),
      db.from('isp_invoices').select('total').gte('period_month', from).lte('period_month', to).then(must),
      db.from('isp_payments').select('amount').gte('paid_on', from).lte('paid_on', to).then(must),
      db.from('isp_customer_balances').select('balance').then(must),
    ]);
    return { profiles: profiles as Profile[], purchases, sales, inv, customers, invoices, payments, balances };
  });

  if (loading || !data) return <Spinner />;
  const users = data.profiles;
  const count = (s: string) => users.filter((u) => u.system === s && u.active).length;

  return (
    <div>
      <PageHeader title="Admin Overview" subtitle="Both systems at a glance — this month" actions={
        <Link href="/admin/users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
          <Users size={16} /> Manage users
        </Link>
      } />

      <div className="grid gap-5 lg:grid-cols-2">
        <SystemCard href="/grain" icon={<Sprout className="text-white" size={20} />} color="bg-emerald-600" title="Palay & Corn Station" users={count('grain')} rows={[
          ['Bought this month', `${kg(sum(data.purchases, (r) => r.net_kg))} · ${money(sum(data.purchases, (r) => r.amount))}`],
          ['Sold this month', `${kg(sum(data.sales, (r) => r.net_kg))} · ${money(sum(data.sales, (r) => r.amount))}`],
          ['Uncollected from buyers (this month)', money(sum(data.sales, (r) => n(r.amount) - n(r.amount_paid)))],
          ['Stock on hand', kg(sum(data.inv, (r) => r.on_hand_kg))],
        ]} />
        <SystemCard href="/isp" icon={<Wifi className="text-white" size={20} />} color="bg-primary-600" title="Internet Billing" users={count('isp')} rows={[
          ['Active subscribers', `${data.customers.filter((c) => c.status === 'active').length} of ${data.customers.length}`],
          ['Billed this month', money(sum(data.invoices, (r) => r.total))],
          ['Collected this month', money(sum(data.payments, (r) => r.amount))],
          ['Total outstanding balance', money(sum(data.balances.filter((b) => n(b.balance) > 0), (r) => r.balance))],
        ]} />
      </div>

      <Card className="p-4 mt-5">
        <p className="text-sm text-slate-600">
          <b>{users.length}</b> accounts · <b>{users.filter((u) => u.role === 'admin').length}</b> admin ·{' '}
          <b>{count('grain')}</b> station users · <b>{count('isp')}</b> ISP users ·{' '}
          <b>{users.filter((u) => !u.active).length}</b> disabled
        </p>
        <p className="text-xs text-slate-400 mt-1">Station users cannot see ISP data and ISP users cannot see station data. Only admins see both.</p>
      </Card>
    </div>
  );
}

function SystemCard({ href, icon, color, title, users, rows }: { href: string; icon: React.ReactNode; color: string; title: string; users: number; rows: [string, string][] }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{users} active user{users === 1 ? '' : 's'}</p>
          </div>
        </div>
        <Link href={href} className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">Open <ArrowRight size={14} /></Link>
      </div>
      <dl className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-2 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-900 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
