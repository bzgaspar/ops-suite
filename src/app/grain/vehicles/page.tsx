'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Fuel, AlertTriangle } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, monthEnd, monthStart, n, sum } from '@/lib/format';
import { Badge, Button, Card, DateRange, Empty, Input, Modal, PageHeader, Select, Spinner, Table, Textarea, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { VEHICLE_TYPES, expiryStatus, useFleetLookups } from '@/components/grain/fleet';
import QuickExpense from '@/components/grain/QuickExpense';
import type { Vehicle, VehicleType } from '@/lib/types';

interface Form {
  id?: string; plate_no: string; name: string; vehicle_type: VehicleType; capacity_kg: string; default_driver_id: string;
  registration_expiry: string; insurance_expiry: string; active: boolean; notes: string;
}
const blank: Form = { plate_no: '', name: '', vehicle_type: 'truck', capacity_kg: '', default_driver_id: '', registration_expiry: '', insurance_expiry: '', active: true, notes: '' };

function ExpiryCell({ date }: { date: string | null }) {
  const st = expiryStatus(date);
  if (!date || !st) return <span className="text-slate-400">—</span>;
  return <span className="inline-flex items-center gap-1.5">{fmtDate(date)}{st.tone !== 'green' && <Badge tone={st.tone}>{st.label}</Badge>}</span>;
}

export default function VehiclesPage() {
  const me = useProfile();
  const router = useRouter();
  const db = supabaseBrowser();
  const { data: lk, loading: lkLoading, reload: reloadLk } = useFleetLookups();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [expenseFor, setExpenseFor] = useState<Vehicle | null>(null);

  const { data: usage, reload: reloadUsage } = useLoad(async () => {
    const [trips, expenses] = await Promise.all([
      db.from('grain_sales').select('vehicle_id, net_kg, driver_fee').not('vehicle_id', 'is', null).gte('sale_date', from).lte('sale_date', to).then(must),
      db.from('grain_expenses').select('vehicle_id, amount').not('vehicle_id', 'is', null).gte('expense_date', from).lte('expense_date', to).then(must),
    ]);
    return { trips: trips as { vehicle_id: string; net_kg: number; driver_fee: number }[], expenses: expenses as { vehicle_id: string; amount: number }[] };
  }, [from, to], 'grain:vehicle-usage');

  const stats = useMemo(() => {
    const m = new Map<string, { trips: number; kg: number; fees: number; exp: number }>();
    const get = (id: string) => m.get(id) ?? (m.set(id, { trips: 0, kg: 0, fees: 0, exp: 0 }), m.get(id)!);
    usage?.trips.forEach((t) => { const s = get(t.vehicle_id); s.trips++; s.kg += n(t.net_kg); s.fees += n(t.driver_fee); });
    usage?.expenses.forEach((e) => { get(e.vehicle_id).exp += n(e.amount); });
    return m;
  }, [usage]);

  const vehicles = lk?.vehicles ?? [];
  const driverName = (id: string | null) => lk?.drivers.find((d) => d.id === id)?.full_name ?? '—';
  const alerts = vehicles.filter((v) => v.active && [v.registration_expiry, v.insurance_expiry].some((d) => (expiryStatus(d)?.days ?? 99) <= 30));

  const openEdit = (v: Vehicle) => setForm({
    id: v.id, plate_no: v.plate_no, name: v.name ?? '', vehicle_type: v.vehicle_type, capacity_kg: v.capacity_kg == null ? '' : String(v.capacity_kg),
    default_driver_id: v.default_driver_id ?? '', registration_expiry: v.registration_expiry ?? '', insurance_expiry: v.insurance_expiry ?? '', active: v.active, notes: v.notes ?? '',
  });

  const save = async () => {
    if (!form || saving) return;
    const plate = form.plate_no.trim().toUpperCase();
    if (!plate) return notify.error('Plate number is required');
    const values = {
      plate_no: plate, name: form.name.trim() || null, vehicle_type: form.vehicle_type, capacity_kg: form.capacity_kg === '' ? null : n(form.capacity_kg),
      default_driver_id: form.default_driver_id || null, registration_expiry: form.registration_expiry || null,
      insurance_expiry: form.insurance_expiry || null, active: form.active, notes: form.notes.trim() || null,
    };
    setSaving(true);
    const res = form.id ? await db.from('grain_vehicles').update(values).eq('id', form.id) : await db.from('grain_vehicles').insert(values);
    setSaving(false);
    if (res.error) return notify.error(res.error);
    notify.success(`Vehicle ${plate} saved`);
    setForm(null);
    reloadLk();
  };

  const remove = async (v: Vehicle) => {
    if (!(await ask(`Delete vehicle ${v.plate_no}? Its past trips and expenses are kept but will no longer be linked to it. Consider marking it inactive instead.`))) return;
    const { error } = await db.from('grain_vehicles').delete().eq('id', v.id);
    if (error) return notify.error(error);
    notify.success('Vehicle deleted');
    reloadLk();
    reloadUsage();
  };

  const totals = { trips: sum([...stats.values()], (s) => s.trips), kg: sum([...stats.values()], (s) => s.kg), exp: sum([...stats.values()], (s) => s.exp), fees: sum([...stats.values()], (s) => s.fees) };

  return (
    <div>
      <PageHeader title="Vehicles" subtitle="Your trucks, their drivers, trips and running costs"
        actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ ...blank })}>Add vehicle</Button>} />

      {alerts.length > 0 && (
        <Card className="p-3 mb-4 border-amber-300 bg-amber-50">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800"><AlertTriangle size={16} /> Renewal due</p>
          <ul className="mt-1 text-sm text-amber-900 space-y-0.5">
            {alerts.map((v) => {
              const r = expiryStatus(v.registration_expiry), i = expiryStatus(v.insurance_expiry);
              return (
                <li key={v.id}><b>{v.plate_no}</b>
                  {r && r.days <= 30 && ` · registration ${r.days < 0 ? 'expired' : 'due'} ${fmtDate(v.registration_expiry)}`}
                  {i && i.days <= 30 && ` · insurance ${i.days < 0 ? 'expired' : 'due'} ${fmtDate(v.insurance_expiry)}`}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-3"><p className="text-xs text-slate-500">Trips (own vehicles)</p><p className="text-lg font-bold">{totals.trips}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Hauled</p><p className="text-lg font-bold">{kg(totals.kg)}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Vehicle expenses</p><p className="text-lg font-bold">{money(totals.exp)}</p></Card>
        <Card className="p-3"><p className="text-xs text-slate-500">Driver trip pay</p><p className="text-lg font-bold">{money(totals.fees)}</p></Card>
      </div>

      <Card>
        <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2 items-center justify-between">
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <p className="text-xs text-slate-500">Click a vehicle to see its trips.</p>
        </div>
        {lkLoading && !lk ? <Spinner /> : vehicles.length === 0 ? <Empty text="No vehicles yet. Add your first truck." /> : (
          <Table>
            <thead><tr>
              <th className={th}>Plate</th><th className={th}>Vehicle</th><th className={th}>Default driver</th>
              <th className={th}>Registration</th><th className={th}>Insurance</th>
              <th className={thR}>Trips</th><th className={thR}>Hauled</th><th className={thR}>Expenses</th><th className={thR}>Driver pay</th><th className={thR}>Cost / trip</th><th className={th} />
            </tr></thead>
            <tbody>
              {vehicles.map((v) => {
                const s = stats.get(v.id) ?? { trips: 0, kg: 0, fees: 0, exp: 0 };
                return (
                  <tr key={v.id} className={`hover:bg-slate-50 cursor-pointer ${v.active ? '' : 'opacity-60'}`} onClick={() => router.push(`/grain/trips?vehicle=${v.id}`)}>
                    <td className={`${td} font-mono font-semibold`}>{v.plate_no}{!v.active && <span className="ml-2"><Badge>inactive</Badge></span>}</td>
                    <td className={td}>{v.name ?? '—'}<span className="text-xs text-slate-400"> · {VEHICLE_TYPES.find((t) => t.value === v.vehicle_type)?.label}{v.capacity_kg ? ` · ${kg(v.capacity_kg)}` : ''}</span></td>
                    <td className={td}>{driverName(v.default_driver_id)}</td>
                    <td className={td}><ExpiryCell date={v.registration_expiry} /></td>
                    <td className={td}><ExpiryCell date={v.insurance_expiry} /></td>
                    <td className={tdR}>{s.trips}</td>
                    <td className={tdR}>{kg(s.kg)}</td>
                    <td className={tdR}>{money(s.exp)}</td>
                    <td className={tdR}>{money(s.fees)}</td>
                    <td className={`${tdR} font-medium`}>{s.trips ? money((s.exp + s.fees) / s.trips) : '—'}</td>
                    <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <button title="Add expense (fuel, repairs…)" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setExpenseFor(v)}><Fuel size={15} /></button>
                        <button title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => openEdit(v)}><Pencil size={15} /></button>
                        {me.role !== 'staff' && <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(v)}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-slate-400 mt-2">Cost per trip = vehicle expenses + driver trip pay, divided by trips in this date range.</p>

      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.plate_no}` : 'Add vehicle'} size="xl">
        {form && lk && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Plate number" value={form.plate_no} onChange={(e) => setForm({ ...form, plate_no: e.target.value })} placeholder="ABC 1234" autoFocus />
            <Input label="Make / model" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Isuzu Elf 6-wheeler" />
            <Select label="Type" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value as VehicleType })}>
              {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input label="Capacity (kg)" type="number" step="any" value={form.capacity_kg} onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })} />
            <Select label="Default driver" wrapClass="sm:col-span-2" value={form.default_driver_id} onChange={(e) => setForm({ ...form, default_driver_id: e.target.value })}
              hint="Pre-selected when you record a delivery with this vehicle">
              <option value="">— none —</option>
              {lk.drivers.filter((d) => d.active || d.id === form.default_driver_id).map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.position ? ` (${d.position})` : ''}</option>)}
            </Select>
            <Input label="Registration expiry (LTO)" type="date" value={form.registration_expiry} onChange={(e) => setForm({ ...form, registration_expiry: e.target.value })} />
            <Input label="Insurance expiry" type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} />
            <Textarea label="Notes" wrapClass="sm:col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="w-4 h-4 rounded" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {expenseFor && (
        <QuickExpense title={`Expense · ${expenseFor.plate_no}`} vehicleId={expenseFor.id} onClose={() => setExpenseFor(null)} onSaved={reloadUsage} />
      )}
    </div>
  );
}
