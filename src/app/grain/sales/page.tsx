'use client';
import { useMemo, useState } from 'react';
import { Plus, Printer, Pencil, Trash2, Wallet, Fuel, Truck } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, monthEnd, monthStart, n, qty, round2, sum, today } from '@/lib/format';
import { Badge, Button, Card, DateRange, Empty, Input, Modal, PageHeader, Printable, SearchBox, Select, Spinner, Table, Textarea, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { useGrainLookups } from '@/components/grain/useGrainLookups';
import { saleStatus } from '@/components/grain/sale-status';
import { useFleetLookups, type Driver } from '@/components/grain/fleet';
import QuickExpense from '@/components/grain/QuickExpense';
import type { Expense, Sale, SalePayment, Vehicle } from '@/lib/types';

const SEL = '*, grain_commodities(name), grain_buyers(name, company)';

interface Form {
  id?: string; sale_date: string; buyer_id: string; commodity_id: string; sacks: string; gross_kg: string; tare_kg: string;
  deduction_kg: string; price_per_kg: string; hauling_cost: string; truck_plate: string; driver: string; remarks: string;
  vehicle_id: string; driver_id: string; driver_fee: string;
}

export default function SalesPage() {
  const me = useProfile();
  const db = supabaseBrowser();
  const { data: lk } = useGrainLookups();
  const { data: fleet } = useFleetLookups();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [q, setQ] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Sale | null>(null);

  const { data, loading, reload } = useLoad(async () => {
    let query = db.from('grain_sales').select(SEL).order('sale_date', { ascending: false }).order('created_at', { ascending: false });
    // "Unpaid only" ignores dates so old receivables are never hidden.
    if (!onlyOpen) query = query.gte('sale_date', from).lte('sale_date', to);
    const rows = must(await query) as Sale[];
    return onlyOpen ? rows.filter((r) => saleStatus(r).bal > 0) : rows;
  }, [from, to, onlyOpen], 'grain:sales');

  const rows = useMemo(() => (data ?? []).filter((r) => `${r.ref_no} ${r.grain_buyers?.name} ${r.grain_commodities?.name} ${r.truck_plate ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  const calc = form ? (() => {
    const net = round2(n(form.gross_kg) - n(form.tare_kg) - n(form.deduction_kg));
    return { net, amount: round2(net * n(form.price_per_kg)) };
  })() : null;

  const openNew = () => {
    const c = lk?.commodities.find((x) => x.active);
    setForm({ sale_date: today(), buyer_id: lk?.buyers.find((b) => b.active)?.id ?? '', commodity_id: c?.id ?? '', sacks: '', gross_kg: '', tare_kg: '', deduction_kg: '', price_per_kg: c ? String(c.sell_price) : '', hauling_cost: '', truck_plate: '', driver: '', remarks: '', vehicle_id: '', driver_id: '', driver_fee: '' });
  };
  const openEdit = (r: Sale) => setForm({
    id: r.id, sale_date: r.sale_date, buyer_id: r.buyer_id, commodity_id: r.commodity_id, sacks: String(r.sacks), gross_kg: String(r.gross_kg),
    tare_kg: String(r.tare_kg), deduction_kg: String(r.deduction_kg), price_per_kg: String(r.price_per_kg), hauling_cost: String(r.hauling_cost),
    truck_plate: r.truck_plate ?? '', driver: r.driver ?? '', remarks: r.remarks ?? '',
    vehicle_id: r.vehicle_id ?? '', driver_id: r.driver_id ?? '', driver_fee: String(r.driver_fee ?? 0),
  });

  // Picking a vehicle fills its plate and default driver; picking a driver fills their per-trip pay.
  const pickDriver = (f: Form, id: string): Form => {
    const d = fleet?.drivers.find((x) => x.id === id);
    return { ...f, driver_id: id, driver: d?.full_name ?? (id ? f.driver : ''), driver_fee: d ? String(d.trip_rate ?? 0) : id ? f.driver_fee : '' };
  };
  const pickVehicle = (f: Form, id: string): Form => {
    const v = fleet?.vehicles.find((x) => x.id === id);
    let next: Form = { ...f, vehicle_id: id, truck_plate: v?.plate_no ?? '' };
    if (v?.default_driver_id && !f.driver_id) next = pickDriver(next, v.default_driver_id);
    return next;
  };

  const save = async () => {
    if (!form || !calc) return;
    if (!form.buyer_id) return notify.error('Choose a buyer (add one under Big Buyers first)');
    if (calc.net <= 0) return notify.error('Net weight must be more than zero');
    if (!n(form.price_per_kg)) return notify.error('Enter the price per kg');
    if (n(form.driver_fee) < 0 || n(form.hauling_cost) < 0) return notify.error('Driver pay and trucking cost cannot be negative');
    const values = {
      sale_date: form.sale_date, buyer_id: form.buyer_id, commodity_id: form.commodity_id, sacks: Math.round(n(form.sacks)),
      gross_kg: n(form.gross_kg), tare_kg: n(form.tare_kg), deduction_kg: n(form.deduction_kg), price_per_kg: n(form.price_per_kg),
      hauling_cost: n(form.hauling_cost), truck_plate: form.truck_plate.trim().toUpperCase() || null, driver: form.driver.trim() || null, remarks: form.remarks || null,
      vehicle_id: form.vehicle_id || null, driver_id: form.driver_id || null, driver_fee: form.driver_id || form.driver.trim() ? n(form.driver_fee) : 0,
    };
    if (saving) return;
    setSaving(true);
    const res = form.id
      ? await db.from('grain_sales').update(values).eq('id', form.id).select(SEL).single()
      : await db.from('grain_sales').insert(values).select(SEL).single();
    setSaving(false);
    if (res.error) return notify.error(res.error);
    notify.success(`Saved ${(res.data as Sale).ref_no}`);
    setForm(null);
    setDetail(res.data as Sale);
    reload();
  };

  const remove = async (r: Sale) => {
    if (!(await ask(`Delete sale ${r.ref_no} and its payments? Stock will be restored.`))) return;
    const { error } = await db.from('grain_sales').delete().eq('id', r.id);
    if (error) return notify.error(error);
    reload();
  };

  return (
    <div>
      <PageHeader title="Selling — Deliveries to Big Buyers" subtitle="Deliveries, buyer deductions, hauling and collections"
        actions={<Button icon={<Plus size={16} />} onClick={openNew}>New delivery / sale</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-3"><p className="text-xs text-slate-500">Net weight sold</p><p className="text-lg font-bold">{kg(sum(rows, (r) => r.net_kg))}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Sales amount</p><p className="text-lg font-bold">{money(sum(rows, (r) => r.amount))}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Driver pay + hired trucks</p><p className="text-lg font-bold">{money(sum(rows, (r) => n(r.driver_fee) + n(r.hauling_cost)))}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">To collect</p><p className="text-lg font-bold text-red-600">{money(sum(rows, (r) => saleStatus(r).bal))}</p></Card>
      </div>

      <Card>
        <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            {!onlyOpen && <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />}
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Unpaid only (all dates)</label>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search ref, buyer, plate…" />
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No sales found." /> : (
          <Table>
            <thead><tr>
              <th className={th}>Ref</th><th className={th}>Date</th><th className={th}>Buyer</th><th className={th}>Commodity</th>
              <th className={thR}>Sacks</th><th className={thR}>Net kg</th><th className={thR}>Price</th><th className={thR}>Amount</th>
              <th className={thR}>Paid</th><th className={thR}>Balance</th><th className={th}>Status</th><th className={th} />
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const st = saleStatus(r);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDetail(r)}>
                    <td className={`${td} font-mono text-xs`}>{r.ref_no}</td>
                    <td className={td}>{fmtDate(r.sale_date)}</td>
                    <td className={`${td} font-medium`}>{r.grain_buyers?.name}</td>
                    <td className={td}>{r.grain_commodities?.name}</td>
                    <td className={tdR}>{r.sacks}</td>
                    <td className={tdR}>{qty(r.net_kg)}</td>
                    <td className={tdR}>{money(r.price_per_kg)}</td>
                    <td className={`${tdR} font-medium`}>{money(r.amount)}</td>
                    <td className={tdR}>{money(r.amount_paid)}</td>
                    <td className={`${tdR} font-semibold ${st.bal > 0 ? 'text-red-600' : ''}`}>{money(st.bal)}</td>
                    <td className={td}><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <button title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => openEdit(r)}><Pencil size={15} /></button>
                        {me.role !== 'staff' && <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit sale' : 'New delivery / sale'} size="2xl">
        {form && calc && lk && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Date" type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
              <Select label="Buyer" value={form.buyer_id} onChange={(e) => setForm({ ...form, buyer_id: e.target.value })}>
                <option value="">— choose —</option>
                {lk.buyers.filter((b) => b.active || b.id === form.buyer_id).map((b) => <option key={b.id} value={b.id}>{b.name}{b.company ? ` (${b.company})` : ''}</option>)}
              </Select>
              <Select label="Commodity" value={form.commodity_id} onChange={(e) => {
                const c = lk.commodities.find((x) => x.id === e.target.value);
                setForm({ ...form, commodity_id: e.target.value, price_per_kg: c ? String(c.sell_price) : form.price_per_kg });
              }}>
                {lk.commodities.filter((c) => c.active || c.id === form.commodity_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="grid sm:grid-cols-4 gap-3">
              <Input label="Sacks" type="number" value={form.sacks} onChange={(e) => setForm({ ...form, sacks: e.target.value })} />
              <Input label="Gross kg" type="number" step="any" value={form.gross_kg} onChange={(e) => setForm({ ...form, gross_kg: e.target.value })} />
              <Input label="Tare kg" type="number" step="any" value={form.tare_kg} onChange={(e) => setForm({ ...form, tare_kg: e.target.value })} />
              <Input label="Buyer deduction kg" type="number" step="any" value={form.deduction_kg} onChange={(e) => setForm({ ...form, deduction_kg: e.target.value })} hint="Moisture / quality" />
            </div>
            <div className="grid sm:grid-cols-4 gap-3">
              <Input label="Price / kg (₱)" type="number" step="any" value={form.price_per_kg} onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })} />
            </div>
            <TripFields form={form} setForm={setForm} vehicles={fleet?.vehicles ?? []} drivers={fleet?.drivers ?? []} pickVehicle={pickVehicle} pickDriver={pickDriver} />
            <Textarea label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 gap-3">
              <div><p className="text-slate-500 text-xs">Net weight</p><p className="font-bold text-lg">{kg(calc.net)}</p></div>
              <div><p className="text-slate-500 text-xs">Sale amount</p><p className="font-bold text-lg text-emerald-700">{money(calc.amount)}</p></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>Save sale</Button>
            </div>
          </div>
        )}
      </Modal>

      {detail && <SaleDetail sale={detail} onClose={() => setDetail(null)} onChanged={(s) => { setDetail(s); reload(); }} />}
    </div>
  );
}

function SaleDetail({ sale, onClose, onChanged }: { sale: Sale; onClose: () => void; onChanged: (s: Sale) => void }) {
  const me = useProfile();
  const db = supabaseBrowser();
  const { data: payments, reload } = useLoad(async () => must(await db.from('grain_sale_payments').select('*').eq('sale_id', sale.id).order('paid_on')) as SalePayment[], [sale.id], 'grain:sale-payments');
  const { data: tripExpenses, reload: reloadTrip } = useLoad(async () =>
    must(await db.from('grain_expenses').select('*').eq('sale_id', sale.id).order('expense_date')) as Expense[], [sale.id], 'grain:trip-expenses');
  const { data: fleet } = useFleetLookups();
  const [addingExpense, setAddingExpense] = useState(false);
  const st = saleStatus(sale);
  const [pay, setPay] = useState({ paid_on: today(), amount: '', method: 'cash', reference: '' });
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    reload();
    const { data } = await db.from('grain_sales').select(SEL).eq('id', sale.id).single();
    if (data) onChanged(data as Sale);
  };

  const addPayment = async () => {
    if (!n(pay.amount)) return notify.error('Enter an amount');
    setSaving(true);
    const { error } = await db.from('grain_sale_payments').insert({ sale_id: sale.id, paid_on: pay.paid_on, amount: n(pay.amount), method: pay.method, reference: pay.reference || null });
    setSaving(false);
    if (error) return notify.error(error);
    notify.success('Payment recorded');
    setPay({ ...pay, amount: '', reference: '' });
    refresh();
  };

  const delExpense = async (x: Expense) => {
    if (!(await ask(`Delete this ${x.category} expense of ${money(x.amount)}?`))) return;
    const { error } = await db.from('grain_expenses').delete().eq('id', x.id);
    if (error) return notify.error(error);
    notify.success('Expense deleted');
    reloadTrip();
  };

  const delPayment = async (p: SalePayment) => {
    if (!(await ask('Delete this payment?'))) return;
    const { error } = await db.from('grain_sale_payments').delete().eq('id', p.id);
    if (error) return notify.error(error);
    refresh();
  };

  return (
    <Modal isOpen onClose={onClose} title={`Sale ${sale.ref_no}`} size="2xl">
      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <DeliveryReceipt s={sale} />
          <Printable><DeliveryReceipt s={sale} /></Printable>
          <Button variant="secondary" className="w-full mt-3" icon={<Printer size={16} />} onClick={() => window.print()}>Print delivery receipt</Button>

          <div className="mt-5">
            <h3 className="font-semibold flex items-center gap-2 mb-2"><Truck size={16} /> Trip</h3>
            <div className="text-sm space-y-1 mb-2">
              <div className="flex justify-between"><span className="text-slate-500">Vehicle</span><span className="font-mono">{sale.truck_plate ?? '—'}{sale.truck_plate && !sale.vehicle_id ? ' (hired)' : ''}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Driver</span><span>{sale.driver ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Driver trip pay</span><span>{money(sale.driver_fee)}</span></div>
              {n(sale.hauling_cost) > 0 && <div className="flex justify-between"><span className="text-slate-500">Hired trucking</span><span>{money(sale.hauling_cost)}</span></div>}
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-2">
              {(tripExpenses ?? []).length === 0 && <p className="text-sm text-slate-400 p-3">No trip expenses (fuel, toll, meals) yet.</p>}
              {(tripExpenses ?? []).map((x) => (
                <div key={x.id} className="flex items-center justify-between p-2 text-sm">
                  <div><p className="font-medium">{money(x.amount)} <span className="font-normal text-slate-500">· {x.category}</span></p><p className="text-xs text-slate-500">{fmtDate(x.expense_date)}{x.description ? ` · ${x.description}` : ''}</p></div>
                  {me.role !== 'staff' && <button className="p-1 text-red-500 hover:bg-red-50 rounded" onClick={() => delExpense(x)} title="Delete"><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Total trip cost</span>
              <span>{money(n(sale.driver_fee) + n(sale.hauling_cost) + sum(tripExpenses ?? [], (x) => x.amount))}</span>
            </div>
            <Button variant="secondary" size="sm" className="w-full" icon={<Fuel size={15} />} onClick={() => setAddingExpense(true)}>Add trip expense</Button>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2"><Wallet size={16} /> Collections</h3>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <div className="text-sm space-y-1 mb-3">
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span>{money(sale.amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Paid</span><span>{money(sale.amount_paid)}</span></div>
            <div className="flex justify-between font-semibold"><span>Balance</span><span className={st.bal > 0 ? 'text-red-600' : ''}>{money(st.bal)}</span></div>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-3">
            {(payments ?? []).length === 0 && <p className="text-sm text-slate-400 p-3">No payments yet.</p>}
            {(payments ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-2 text-sm">
                <div><p className="font-medium">{money(p.amount)}</p><p className="text-xs text-slate-500">{fmtDate(p.paid_on)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</p></div>
                {me.role !== 'staff' && <button className="p-1 text-red-500 hover:bg-red-50 rounded" onClick={() => delPayment(p)}><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
          {st.bal > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Input label="Date" type="date" value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} />
                <Input label="Amount" type="number" step="any" value={pay.amount} placeholder={String(st.bal)} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                <Select label="Method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                  <option value="cash">Cash</option><option value="check">Check</option><option value="bank">Bank transfer</option><option value="gcash">GCash</option>
                </Select>
                <Input label="Ref / Check #" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
              </div>
              <Button className="w-full" loading={saving} onClick={addPayment}>Record payment</Button>
            </div>
          )}
        </div>
      </div>
      {addingExpense && (
        <QuickExpense title={`Trip expense · ${sale.ref_no}`} vehicleId={sale.vehicle_id} saleId={sale.id} vehicles={fleet?.vehicles}
          defaultDate={sale.sale_date} onClose={() => setAddingExpense(false)} onSaved={reloadTrip} />
      )}
    </Modal>
  );
}

function TripFields({ form, setForm, vehicles, drivers, pickVehicle, pickDriver }: {
  form: Form; setForm: (f: Form) => void; vehicles: Vehicle[]; drivers: Driver[];
  pickVehicle: (f: Form, id: string) => Form; pickDriver: (f: Form, id: string) => Form;
}) {
  const hasDriver = !!form.driver_id || !!form.driver.trim();
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2"><Truck size={15} /> Trip</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Select label="Vehicle" value={form.vehicle_id} onChange={(e) => setForm(pickVehicle(form, e.target.value))}>
          <option value="">Hired / other truck</option>
          {vehicles.filter((v) => v.active || v.id === form.vehicle_id).map((v) => <option key={v.id} value={v.id}>{v.plate_no}{v.name ? ` · ${v.name}` : ''}</option>)}
        </Select>
        {!form.vehicle_id
          ? <Input label="Plate # (hired truck)" value={form.truck_plate} onChange={(e) => setForm({ ...form, truck_plate: e.target.value })} placeholder="Optional" />
          : <div className="hidden sm:block" />}
        <Select label="Driver" value={form.driver_id} onChange={(e) => setForm(pickDriver(form, e.target.value))}>
          <option value="">Other / not on staff</option>
          {drivers.filter((d) => d.active || d.id === form.driver_id).map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.position ? ` (${d.position})` : ''}</option>)}
        </Select>
        {!form.driver_id
          ? <Input label="Driver name" value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} placeholder="Optional" />
          : <div className="hidden sm:block" />}
        <Input label="Driver trip pay (₱)" type="number" step="any" value={form.driver_fee} disabled={!hasDriver}
          onChange={(e) => setForm({ ...form, driver_fee: e.target.value })}
          hint={form.driver_id ? 'Added to this driver\'s payroll' : 'Pay for this trip, if any'} />
        <Input label="Hired trucking cost (₱)" type="number" step="any" value={form.hauling_cost}
          onChange={(e) => setForm({ ...form, hauling_cost: e.target.value })} hint="Only if you paid an outside truck" />
      </div>
      {vehicles.length === 0 && <p className="text-xs text-slate-500">Tip: add your trucks under <b>Vehicles</b> to track trips and costs per truck.</p>}
    </div>
  );
}

function DeliveryReceipt({ s }: { s: Sale }) {
  const row = (k: string, v: string, bold = false) => <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}><span>{k}</span><span>{v}</span></div>;
  return (
    <div className="font-mono text-xs space-y-1 border border-slate-200 rounded-lg p-3 max-w-[320px] mx-auto">
      <div className="text-center mb-2">
        <p className="font-bold text-sm">PALAY & CORN BUYING STATION</p>
        <p>DELIVERY RECEIPT</p>
        <p>{s.ref_no} · {fmtDate(s.sale_date)}</p>
      </div>
      {row('Buyer', `${s.grain_buyers?.name ?? ''}`)}
      {s.grain_buyers?.company && row('Company', s.grain_buyers.company)}
      {row('Commodity', s.grain_commodities?.name ?? '')}
      {s.truck_plate && row('Truck', s.truck_plate)}
      {s.driver && row('Driver', s.driver)}
      <hr className="border-dashed border-slate-400" />
      {row('Sacks', String(s.sacks))}
      {row('Gross', kg(s.gross_kg))}
      {row('Tare', kg(s.tare_kg))}
      {n(s.deduction_kg) > 0 && row('Deduction', kg(s.deduction_kg))}
      {row('Net weight', kg(s.net_kg), true)}
      {row('Price / kg', money(s.price_per_kg))}
      {row('TOTAL', money(s.amount), true)}
      {s.remarks && <p>Note: {s.remarks}</p>}
      <div className="flex justify-between pt-8 text-center">
        <div className="w-28 border-t border-black pt-1">Delivered by</div>
        <div className="w-28 border-t border-black pt-1">Received by</div>
      </div>
    </div>
  );
}
