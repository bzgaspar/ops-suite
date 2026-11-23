'use client';
import Link from 'next/link';
import { ShoppingBasket, Truck, Wallet, Warehouse, Plus, AlertTriangle } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, monthStart, n, sum, today } from '@/lib/format';
import { lastMonths, bucketByMonth } from '@/lib/months';
import { Card, PageHeader, Spinner, StatCard, Table, td, tdR, th, thR } from '@/components/ui';
import BarChart from '@/components/ui/BarChart';
import { saleStatus } from '@/components/grain/sale-status';
import { expiryStatus } from '@/components/grain/fleet';
import type { InventoryRow, Purchase, Sale } from '@/lib/types';

export default function GrainDashboard() {
  const months = lastMonths(6);
  const { data, loading } = useLoad(async () => {
    const db = supabaseBrowser();
    const [purchases, sales, openSales, inventory, expenses, vehicles] = await Promise.all([
      db.from('grain_purchases').select('id, ref_no, purchase_date, seller_name, net_kg, amount, net_payable, payment_status, grain_commodities(name)').gte('purchase_date', months[0].start).order('purchase_date', { ascending: false }).then(must),
      db.from('grain_sales').select('id, ref_no, sale_date, net_kg, amount, amount_paid, hauling_cost, grain_buyers(name), grain_commodities(name)').gte('sale_date', months[0].start).order('sale_date', { ascending: false }).then(must),
      db.from('grain_sales_open').select('amount, amount_paid').then(must),
      db.from('grain_inventory').select('*').then(must),
      db.from('grain_expenses').select('expense_date, amount').gte('expense_date', months[0].start).then(must),
      db.from('grain_vehicles').select('plate_no, registration_expiry, insurance_expiry').eq('active', true).then(must),
    ]);
    return {
      purchases: purchases as unknown as Purchase[], sales: sales as unknown as Sale[],
      openSales: openSales as Pick<Sale, 'amount' | 'amount_paid'>[], inventory: inventory as InventoryRow[],
      expenses: expenses as { expense_date: string; amount: number }[],
      vehicles: vehicles as { plate_no: string; registration_expiry: string | null; insurance_expiry: string | null }[],
    };
  }, [], 'grain:dashboard');

  if (loading || !data) return <Spinner />;
  const t = today(), ms = monthStart();
  const pToday = data.purchases.filter((p) => p.purchase_date === t);
  const sMonth = data.sales.filter((s) => s.sale_date >= ms);
  const pMonth = data.purchases.filter((p) => p.purchase_date >= ms);
  const receivable = sum(data.openSales, (s) => saleStatus(s).bal);
  const unpaidFarmers = sum(data.purchases.filter((p) => p.payment_status === 'unpaid'), (p) => p.net_payable);
  const keys = months.map((m) => m.key);
  const renewals = data.vehicles.flatMap((v) => [
    ['registration', v.registration_expiry] as const, ['insurance', v.insurance_expiry] as const,
  ].flatMap(([what, d]) => { const st = expiryStatus(d); return st && st.days <= 30 ? [`${v.plate_no} ${what} ${st.days < 0 ? 'expired' : 'due'} ${fmtDate(d, 'MMM d')}`] : []; }));

  return (
    <div>
      <PageHeader title="Buying Station Dashboard" subtitle={fmtDate(t, 'EEEE, MMMM d, yyyy')} actions={<>
        <Link href="/grain/purchases" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"><Plus size={16} /> Buy</Link>
        <Link href="/grain/sales" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"><Plus size={16} /> Sell</Link>
      </>} />

      {renewals.length > 0 && (
        <Link href="/grain/vehicles" className="flex items-start gap-2 mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span><b>Vehicle renewal:</b> {renewals.join(' · ')}</span>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="Bought today" value={kg(sum(pToday, (p) => p.net_kg))} sub={money(sum(pToday, (p) => p.amount))} icon={<ShoppingBasket size={20} />} tone="green" />
        <StatCard label="Bought this month" value={kg(sum(pMonth, (p) => p.net_kg))} sub={money(sum(pMonth, (p) => p.amount))} icon={<ShoppingBasket size={20} />} tone="blue" />
        <StatCard label="Sold this month" value={kg(sum(sMonth, (s) => s.net_kg))} sub={money(sum(sMonth, (s) => s.amount))} icon={<Truck size={20} />} tone="violet" />
        <StatCard label="To collect from buyers" value={money(receivable)} sub={unpaidFarmers > 0 ? `Owed to farmers: ${money(unpaidFarmers)}` : 'Farmers fully paid'} icon={<Wallet size={20} />} tone={receivable > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 mb-5">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Last 6 months</h2>
          <BarChart labels={months.map((m) => m.label)} series={[
            { label: 'Purchases', data: bucketByMonth(data.purchases, (r) => r.purchase_date, (r) => n(r.amount), keys) },
            { label: 'Sales', data: bucketByMonth(data.sales, (r) => r.sale_date, (r) => n(r.amount), keys) },
            { label: 'Expenses', data: bucketByMonth(data.expenses, (r) => r.expense_date, (r) => n(r.amount), keys) },
          ]} />
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Warehouse size={16} /> Stock on hand</h2>
          <div className="space-y-3">
            {data.inventory.map((i) => (
              <div key={i.commodity_id} className="flex justify-between items-center text-sm">
                <div><p className="font-medium">{i.name}</p><p className="text-xs text-slate-500">avg cost {money(i.avg_cost_per_kg)}/kg</p></div>
                <div className="text-right"><p className={`font-semibold ${n(i.on_hand_kg) < 0 ? 'text-red-600' : ''}`}>{kg(i.on_hand_kg)}</p><p className="text-xs text-slate-500">{money(n(i.on_hand_kg) * n(i.avg_cost_per_kg))}</p></div>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
              <span>Total</span><span>{kg(sum(data.inventory, (i) => i.on_hand_kg))}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <div className="px-4 py-3 border-b border-slate-200 font-semibold flex justify-between"><span>Recent purchases</span><Link className="text-sm text-primary-600" href="/grain/purchases">View all</Link></div>
          <Table>
            <thead><tr><th className={th}>Date</th><th className={th}>Farmer</th><th className={thR}>Net kg</th><th className={thR}>Amount</th></tr></thead>
            <tbody>{data.purchases.slice(0, 6).map((p) => (
              <tr key={p.id}><td className={td}>{fmtDate(p.purchase_date, 'MMM d')}</td><td className={td}>{p.seller_name}<span className="text-xs text-slate-400"> · {p.grain_commodities?.name}</span></td><td className={tdR}>{kg(p.net_kg)}</td><td className={tdR}>{money(p.amount)}</td></tr>
            ))}</tbody>
          </Table>
        </Card>
        <Card>
          <div className="px-4 py-3 border-b border-slate-200 font-semibold flex justify-between"><span>Recent sales</span><Link className="text-sm text-primary-600" href="/grain/sales">View all</Link></div>
          <Table>
            <thead><tr><th className={th}>Date</th><th className={th}>Buyer</th><th className={thR}>Net kg</th><th className={thR}>Amount</th></tr></thead>
            <tbody>{data.sales.slice(0, 6).map((s) => (
              <tr key={s.id}><td className={td}>{fmtDate(s.sale_date, 'MMM d')}</td><td className={td}>{s.grain_buyers?.name}<span className="text-xs text-slate-400"> · {s.grain_commodities?.name}</span></td><td className={tdR}>{kg(s.net_kg)}</td><td className={tdR}>{money(s.amount)}</td></tr>
            ))}</tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
