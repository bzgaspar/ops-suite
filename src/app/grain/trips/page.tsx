'use client';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Fuel, Plus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, monthEnd, monthStart, n, sum } from '@/lib/format';
import { Card, DateRange, Empty, PageHeader, Spinner, Table, td, tdR, th, thR } from '@/components/ui';
import { groupSum } from '@/components/shared/ReportBits';
import { useFleetLookups } from '@/components/grain/fleet';
import QuickExpense from '@/components/grain/QuickExpense';

interface Trip {
  id: string; ref_no: string; sale_date: string; net_kg: number; sacks: number; hauling_cost: number;
  truck_plate: string | null; driver: string | null; vehicle_id: string | null; driver_id: string | null; driver_fee: number;
  grain_buyers: { name: string; company: string | null } | null;
  grain_commodities: { name: string } | null;
  grain_expenses: { amount: number; category: string }[];
}

const tripExp = (t: Trip) => sum(t.grain_expenses ?? [], (e) => e.amount);
const tripCost = (t: Trip) => tripExp(t) + n(t.driver_fee) + n(t.hauling_cost);

function TripsInner() {
  const params = useSearchParams();
  const db = supabaseBrowser();
  const { data: lk } = useFleetLookups();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [vehicle, setVehicle] = useState(params.get('vehicle') ?? '');
  const [driver, setDriver] = useState(params.get('driver') ?? '');
  const [expenseFor, setExpenseFor] = useState<Trip | null>(null);

  const { data, loading, reload } = useLoad(async () =>
    must(await db.from('grain_sales')
      .select('id, ref_no, sale_date, net_kg, sacks, hauling_cost, truck_plate, driver, vehicle_id, driver_id, driver_fee, grain_buyers(name, company), grain_commodities(name), grain_expenses!grain_expenses_sale_id_fkey(amount, category)')
      .gte('sale_date', from).lte('sale_date', to)
      .order('sale_date', { ascending: false }).order('created_at', { ascending: false })) as unknown as Trip[], [from, to], 'grain:trips');

  const rows = useMemo(() => (data ?? []).filter((t) =>
    (!vehicle || (vehicle === 'hired' ? !t.vehicle_id : t.vehicle_id === vehicle)) && (!driver || t.driver_id === driver)), [data, vehicle, driver]);

  const plate = (t: Trip) => lk?.vehicles.find((v) => v.id === t.vehicle_id)?.plate_no ?? t.truck_plate;
  const driverName = (t: Trip) => lk?.drivers.find((d) => d.id === t.driver_id)?.full_name ?? t.driver;

  const byDriver = groupSum(rows.filter((t) => t.driver_id || t.driver), (t) => driverName(t) ?? '—', { trips: () => 1, kg: (t) => n(t.net_kg), fee: (t) => n(t.driver_fee) }).sort((a, b) => b.trips - a.trips);
  const byVehicle = groupSum(rows, (t) => (t.vehicle_id ? plate(t) ?? '?' : `Hired${t.truck_plate ? ` · ${t.truck_plate}` : ''}`), { trips: () => 1, kg: (t) => n(t.net_kg), cost: tripCost }).sort((a, b) => b.trips - a.trips);

  const sel = 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm';

  return (
    <div>
      <PageHeader title="Trips & Drivers" subtitle="Every delivery to a buyer is a trip: vehicle, driver, driver pay and trip costs"
        actions={<Link href="/grain/sales" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"><Plus size={16} /> New delivery</Link>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-3"><p className="text-xs text-slate-500">Trips</p><p className="text-lg font-bold">{rows.length}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Hauled</p><p className="text-lg font-bold">{kg(sum(rows, (t) => t.net_kg))}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Driver trip pay</p><p className="text-lg font-bold">{money(sum(rows, (t) => t.driver_fee))}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Trip expenses + hired trucks</p><p className="text-lg font-bold">{money(sum(rows, (t) => tripExp(t) + n(t.hauling_cost)))}</p></Card>
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-5">
        <Card>
          <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center">
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            <select className={sel} value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Vehicle">
              <option value="">All vehicles</option>
              {lk?.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_no}</option>)}
              <option value="hired">Hired / other trucks</option>
            </select>
            <select className={sel} value={driver} onChange={(e) => setDriver(e.target.value)} aria-label="Driver">
              <option value="">All drivers</option>
              {lk?.drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
          </div>
          {loading && !data ? <Spinner /> : rows.length === 0 ? <Empty text="No trips in this range." /> : (
            <Table>
              <thead><tr>
                <th className={th}>Date</th><th className={th}>Ref</th><th className={th}>Buyer</th><th className={th}>Load</th>
                <th className={th}>Vehicle</th><th className={th}>Driver</th><th className={thR}>Driver pay</th><th className={thR}>Trip exp.</th>
                <th className={thR}>Hired truck</th><th className={thR}>Trip cost</th><th className={th} />
              </tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className={td}>{fmtDate(t.sale_date, 'MMM d')}</td>
                    <td className={`${td} font-mono text-xs`}>{t.ref_no}</td>
                    <td className={td}>{t.grain_buyers?.company || t.grain_buyers?.name}</td>
                    <td className={td}>{kg(t.net_kg)}<span className="text-xs text-slate-400"> · {t.grain_commodities?.name}</span></td>
                    <td className={`${td} font-mono`}>{plate(t) ?? '—'}{!t.vehicle_id && t.truck_plate && <span className="text-xs text-slate-400 font-sans"> (hired)</span>}</td>
                    <td className={td}>{driverName(t) ?? '—'}</td>
                    <td className={tdR}>{money(t.driver_fee)}</td>
                    <td className={tdR}>{money(tripExp(t))}</td>
                    <td className={tdR}>{money(t.hauling_cost)}</td>
                    <td className={`${tdR} font-semibold`}>{money(tripCost(t))}</td>
                    <td className={`${td} text-right`}>
                      <button title="Add trip expense (fuel, toll, meals)" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setExpenseFor(t)}><Fuel size={15} /></button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className={td} colSpan={6}>Total</td>
                  <td className={tdR}>{money(sum(rows, (t) => t.driver_fee))}</td>
                  <td className={tdR}>{money(sum(rows, tripExp))}</td>
                  <td className={tdR}>{money(sum(rows, (t) => t.hauling_cost))}</td>
                  <td className={tdR}>{money(sum(rows, tripCost))}</td>
                  <td className={td} />
                </tr>
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">By driver</div>
            {byDriver.length === 0 ? <p className="p-4 text-sm text-slate-400">No drivers assigned yet.</p> : (
              <Table>
                <thead><tr><th className={th}>Driver</th><th className={thR}>Trips</th><th className={thR}>Trip pay</th></tr></thead>
                <tbody>{byDriver.map((r) => <tr key={r.key}><td className={td}>{r.key}</td><td className={tdR}>{r.trips}</td><td className={tdR}>{money(r.fee)}</td></tr>)}</tbody>
              </Table>
            )}
            <p className="px-4 py-2 text-xs text-slate-400">Trip pay is added to payroll automatically when you create a payroll for these dates.</p>
          </Card>
          <Card>
            <div className="px-4 py-3 border-b border-slate-200 font-semibold">By vehicle</div>
            {byVehicle.length === 0 ? <p className="p-4 text-sm text-slate-400">—</p> : (
              <Table>
                <thead><tr><th className={th}>Vehicle</th><th className={thR}>Trips</th><th className={thR}>Kg</th><th className={thR}>Cost</th></tr></thead>
                <tbody>{byVehicle.map((r) => <tr key={r.key}><td className={`${td} font-mono`}>{r.key}</td><td className={tdR}>{r.trips}</td><td className={tdR}>{kg(r.kg)}</td><td className={tdR}>{money(r.cost)}</td></tr>)}</tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>

      {expenseFor && (
        <QuickExpense title={`Trip expense · ${expenseFor.ref_no}`} vehicleId={expenseFor.vehicle_id} saleId={expenseFor.id}
          vehicles={lk?.vehicles} defaultDate={expenseFor.sale_date} onClose={() => setExpenseFor(null)} onSaved={reload} />
      )}
    </div>
  );
}

export default function TripsPage() {
  return <Suspense fallback={<Spinner />}><TripsInner /></Suspense>;
}
