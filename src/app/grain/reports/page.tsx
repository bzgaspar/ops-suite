'use client';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, monthEnd, monthStart, n, sum } from '@/lib/format';
import { Button, Card, DateRange, PageHeader, Spinner, Table, td, tdR, th, thR } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { PLRow, groupSum } from '@/components/shared/ReportBits';
import { printPage } from '@/lib/print';
import type { Expense, InventoryRow, Purchase, Sale } from '@/lib/types';

export default function GrainReports() {
  const me = useProfile();
  const db = supabaseBrowser();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());

  const { data, loading } = useLoad(async () => {
    const [purchases, sales, saleCollections, expenses, inv, periods] = await Promise.all([
      db.from('grain_purchases').select('*, grain_commodities(name)').gte('purchase_date', from).lte('purchase_date', to).then(must),
      db.from('grain_sales').select('*, grain_commodities(name), grain_buyers(name, company), grain_vehicles!grain_sales_vehicle_id_fkey(plate_no)').gte('sale_date', from).lte('sale_date', to).then(must),
      db.from('grain_sale_payments').select('amount').gte('paid_on', from).lte('paid_on', to).then(must),
      db.from('grain_expenses').select('*, grain_vehicles!grain_expenses_vehicle_id_fkey(plate_no)').gte('expense_date', from).lte('expense_date', to).then(must),
      db.from('grain_inventory').select('*').then(must),
      db.from('grain_payroll_periods').select('id').gte('period_end', from).lte('period_end', to).then(must),
    ]);
    const ids = (periods as { id: string }[]).map((p) => p.id);
    const lines = ids.length ? must(await db.from('grain_payroll_lines').select('gross_pay, net_pay, trip_pay, cash_advance, other_deductions').in('period_id', ids)) : [];
    return {
      purchases: purchases as Purchase[], sales: sales as Sale[], collections: saleCollections as { amount: number }[],
      expenses: expenses as Expense[], inv: inv as InventoryRow[], payroll: lines as { gross_pay: number; net_pay: number; trip_pay: number }[],
    };
  }, [from, to], 'grain:reports');

  if (me.role === 'staff') return <Card className="p-8 text-center text-slate-500">Reports are for managers only.</Card>;

  const body = () => {
    if (loading || !data) return <Spinner />;
    const avgCost = new Map(data.inv.map((i) => [i.commodity_id, n(i.avg_cost_per_kg)]));
    const revenue = sum(data.sales, (s) => s.amount);
    const cogs = sum(data.sales, (s) => n(s.net_kg) * (avgCost.get(s.commodity_id) ?? 0));
    const gross = revenue - cogs;
    const hauling = sum(data.sales, (s) => s.hauling_cost);
    const payroll = sum(data.payroll, (l) => l.gross_pay);
    const expenses = sum(data.expenses, (e) => e.amount);
    const net = gross - hauling - payroll - expenses;

    const byCommodity = groupSum([...data.purchases.map((p) => ({ name: p.grain_commodities?.name ?? '?', bkg: n(p.net_kg), bamt: n(p.amount), skg: 0, samt: 0 })),
      ...data.sales.map((s) => ({ name: s.grain_commodities?.name ?? '?', bkg: 0, bamt: 0, skg: n(s.net_kg), samt: n(s.amount) }))],
      (r) => r.name, { bkg: (r) => r.bkg, bamt: (r) => r.bamt, skg: (r) => r.skg, samt: (r) => r.samt });
    const byBuyer = groupSum(data.sales, (s) => s.grain_buyers?.company || s.grain_buyers?.name || '?', { kg: (s) => n(s.net_kg), amt: (s) => n(s.amount), bal: (s) => n(s.amount) - n(s.amount_paid) });
    const byFarmer = groupSum(data.purchases, (p) => p.seller_name, { kg: (p) => n(p.net_kg), amt: (p) => n(p.net_payable), n: () => 1 }).sort((a, b) => b.kg - a.kg).slice(0, 15);
    const byCat = groupSum(data.expenses, (e) => e.category, { amt: (e) => n(e.amount) }).sort((a, b) => b.amt - a.amt);
    type FleetRow = { plate: string; trips: number; kg: number; fees: number; exp: number };
    const fleet = groupSum([
      ...data.sales.filter((s) => s.vehicle_id).map((s): FleetRow => ({ plate: s.grain_vehicles?.plate_no ?? '?', trips: 1, kg: n(s.net_kg), fees: n(s.driver_fee), exp: 0 })),
      ...data.expenses.filter((e) => e.vehicle_id).map((e): FleetRow => ({ plate: e.grain_vehicles?.plate_no ?? '?', trips: 0, kg: 0, fees: 0, exp: n(e.amount) })),
    ], (r) => r.plate, { trips: (r) => r.trips, kg: (r) => r.kg, fees: (r) => r.fees, exp: (r) => r.exp }).sort((a, b) => b.trips - a.trips);

    return (
      <div className="space-y-5">
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5 avoid-break">
            <h2 className="font-semibold mb-2">Profit & Loss</h2>
            <PLRow label="Sales to buyers" value={revenue} />
            <PLRow label="Cost of grain sold (at average buying cost)" value={cogs} negative indent />
            <PLRow label="Gross profit" value={gross} strong tone={gross >= 0 ? 'good' : 'bad'} />
            <PLRow label="Hired trucking" value={hauling} negative indent />
            <PLRow label="Payroll (gross pay, incl. OT, food & trip pay)" value={payroll} negative indent />
            <PLRow label="Operating expenses" value={expenses} negative indent />
            <PLRow label="NET PROFIT" value={net} strong tone={net >= 0 ? 'good' : 'bad'} />
          </Card>
          <Card className="p-5 avoid-break">
            <h2 className="font-semibold mb-2">Cash movement</h2>
            <PLRow label="Collected from buyers" value={sum(data.collections, (c) => c.amount)} />
            <PLRow label="Paid to farmers (paid purchases)" value={sum(data.purchases.filter((p) => p.payment_status === 'paid'), (p) => p.net_payable)} negative indent />
            <PLRow label="Payroll released (net pay)" value={sum(data.payroll, (l) => l.net_pay)} negative indent />
            <PLRow label="Hired trucking" value={hauling} negative indent />
            <PLRow label="Expenses" value={expenses} negative indent />
            <div className="mt-3 text-xs text-slate-500 space-y-0.5">
              <p>Still owed to farmers (this range): <b>{money(sum(data.purchases.filter((p) => p.payment_status === 'unpaid'), (p) => p.net_payable))}</b></p>
              <p>Uncollected from buyers (this range): <b>{money(sum(data.sales, (s) => n(s.amount) - n(s.amount_paid)))}</b></p>
            </div>
          </Card>
        </div>

        <Card className="avoid-break">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold">By commodity</div>
          <Table>
            <thead><tr><th className={th}>Commodity</th><th className={thR}>Bought kg</th><th className={thR}>Bought ₱</th><th className={thR}>Avg buy</th><th className={thR}>Sold kg</th><th className={thR}>Sold ₱</th><th className={thR}>Avg sell</th></tr></thead>
            <tbody>{byCommodity.map((r) => (
              <tr key={r.key}><td className={`${td} font-medium`}>{r.key}</td><td className={tdR}>{kg(r.bkg)}</td><td className={tdR}>{money(r.bamt)}</td><td className={tdR}>{r.bkg ? money(r.bamt / r.bkg) : '—'}</td><td className={tdR}>{kg(r.skg)}</td><td className={tdR}>{money(r.samt)}</td><td className={tdR}>{r.skg ? money(r.samt / r.skg) : '—'}</td></tr>
            ))}</tbody>
          </Table>
        </Card>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="avoid-break">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">By buyer</div>
            <Table>
              <thead><tr><th className={th}>Buyer</th><th className={thR}>Kg</th><th className={thR}>Amount</th><th className={thR}>Unpaid</th></tr></thead>
              <tbody>{byBuyer.map((r) => <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{kg(r.kg)}</td><td className={tdR}>{money(r.amt)}</td><td className={`${tdR} ${r.bal > 0 ? 'text-red-600' : ''}`}>{money(r.bal)}</td></tr>)}</tbody>
            </Table>
          </Card>
          <Card className="avoid-break">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">Top farmers</div>
            <Table>
              <thead><tr><th className={th}>Farmer</th><th className={thR}>Deliveries</th><th className={thR}>Kg</th><th className={thR}>Paid</th></tr></thead>
              <tbody>{byFarmer.map((r) => <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{r.n}</td><td className={tdR}>{kg(r.kg)}</td><td className={tdR}>{money(r.amt)}</td></tr>)}</tbody>
            </Table>
          </Card>
        </div>

        {fleet.length > 0 && (
          <Card className="avoid-break">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">Vehicles</div>
            <Table>
              <thead><tr><th className={th}>Plate</th><th className={thR}>Trips</th><th className={thR}>Hauled</th><th className={thR}>Expenses</th><th className={thR}>Driver trip pay</th><th className={thR}>Cost / trip</th></tr></thead>
              <tbody>{fleet.map((r) => (
                <tr key={r.key}><td className={`${td} font-mono`}>{r.key}</td><td className={tdR}>{r.trips}</td><td className={tdR}>{kg(r.kg)}</td><td className={tdR}>{money(r.exp)}</td><td className={tdR}>{money(r.fees)}</td><td className={tdR}>{r.trips ? money((r.exp + r.fees) / r.trips) : '—'}</td></tr>
              ))}</tbody>
            </Table>
          </Card>
        )}

        <Card className="avoid-break">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold">Expenses by category</div>
          <Table>
            <tbody>{byCat.map((r) => <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{money(r.amt)}</td></tr>)}
              <tr className="font-semibold bg-slate-50"><td className={td}>Payroll</td><td className={tdR}>{money(payroll)}</td></tr>
            </tbody>
          </Table>
        </Card>
        <p className="text-xs text-slate-400">Payroll counts periods whose end date falls in this range. Cost of grain sold uses each commodity&apos;s all-time average buying cost.</p>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle={`${fmtDate(from)} – ${fmtDate(to)}`}
        actions={<><DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} /><Button variant="secondary" icon={<Printer size={16} />} onClick={printPage}>Print</Button></>} />
      <div id="report">{body()}</div>
    </div>
  );
}
