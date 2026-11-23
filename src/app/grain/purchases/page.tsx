'use client';
import { useMemo, useState } from 'react';
import { Plus, Printer, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, monthEnd, monthStart, n, round2, sum, today, qty } from '@/lib/format';
import { Badge, Button, Card, DateRange, Empty, Input, Modal, PageHeader, Printable, SearchBox, Select, Spinner, Table, Textarea, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { useGrainLookups, moistureShrinkKg } from '@/components/grain/useGrainLookups';
import type { Purchase } from '@/lib/types';

interface Form {
  id?: string; purchase_date: string; farmer_id: string; seller_name: string; commodity_id: string;
  sacks: string; gross_kg: string; tare_per_sack: string; tare_kg: string; moisture_pct: string; auto_moisture: boolean;
  moisture_deduction_kg: string; price_per_kg: string; other_deductions: string; payment_status: 'paid' | 'unpaid'; remarks: string;
}

export default function PurchasesPage() {
  const me = useProfile();
  const db = supabaseBrowser();
  const { data: lk } = useGrainLookups();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(monthEnd());
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Purchase | null>(null);

  const { data, loading, reload } = useLoad(async () =>
    must(await db.from('grain_purchases').select('*, grain_commodities(name)').gte('purchase_date', from).lte('purchase_date', to)
      .order('purchase_date', { ascending: false }).order('created_at', { ascending: false })) as Purchase[], [from, to], 'grain:purchases');

  const rows = useMemo(() => (data ?? []).filter((r) => `${r.ref_no} ${r.seller_name} ${r.grain_commodities?.name}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  // ---- live computation in the form ----
  const calc = useMemo(() => {
    if (!form) return null;
    const gross = n(form.gross_kg), tare = n(form.tare_kg);
    const ded = form.auto_moisture ? moistureShrinkKg(gross - tare, n(form.moisture_pct)) : n(form.moisture_deduction_kg);
    const net = round2(gross - tare - ded);
    const amount = round2(net * n(form.price_per_kg));
    return { ded, net, amount, payable: round2(amount - n(form.other_deductions)) };
  }, [form]);

  const openNew = () => {
    const c = lk?.commodities.find((x) => x.active);
    setForm({
      purchase_date: today(), farmer_id: '', seller_name: '', commodity_id: c?.id ?? '', sacks: '', gross_kg: '',
      tare_per_sack: '0.5', tare_kg: '', moisture_pct: '', auto_moisture: false, moisture_deduction_kg: '',
      price_per_kg: c ? String(c.buy_price) : '', other_deductions: '', payment_status: 'paid', remarks: '',
    });
  };

  const openEdit = (r: Purchase) => setForm({
    id: r.id, purchase_date: r.purchase_date, farmer_id: r.farmer_id ?? '', seller_name: r.seller_name, commodity_id: r.commodity_id,
    sacks: String(r.sacks), gross_kg: String(r.gross_kg), tare_per_sack: '', tare_kg: String(r.tare_kg), moisture_pct: r.moisture_pct == null ? '' : String(r.moisture_pct),
    auto_moisture: false, moisture_deduction_kg: String(r.moisture_deduction_kg), price_per_kg: String(r.price_per_kg),
    other_deductions: String(r.other_deductions), payment_status: r.payment_status, remarks: r.remarks ?? '',
  });

  const patch = (p: Partial<Form>) => setForm((f) => {
    const next = { ...f!, ...p };
    if ('sacks' in p || 'tare_per_sack' in p) {
      if (next.tare_per_sack !== '') next.tare_kg = String(round2(n(next.sacks) * n(next.tare_per_sack)));
    }
    if ('commodity_id' in p) {
      const c = lk?.commodities.find((x) => x.id === p.commodity_id);
      if (c) next.price_per_kg = String(c.buy_price);
    }
    if ('farmer_id' in p) {
      const fm = lk?.farmers.find((x) => x.id === p.farmer_id);
      next.seller_name = fm?.name ?? '';
    }
    return next;
  });

  const save = async () => {
    if (!form || !calc) return;
    if (!form.seller_name.trim()) return notify.error('Choose a farmer or type the seller name');
    if (!form.commodity_id) return notify.error('Choose a commodity');
    if (calc.net <= 0) return notify.error('Net weight must be more than zero');
    if (!n(form.price_per_kg)) return notify.error('Enter the price per kg');
    const values = {
      purchase_date: form.purchase_date, farmer_id: form.farmer_id || null, seller_name: form.seller_name.trim(), commodity_id: form.commodity_id,
      sacks: Math.round(n(form.sacks)), gross_kg: n(form.gross_kg), tare_kg: n(form.tare_kg),
      moisture_pct: form.moisture_pct === '' ? null : n(form.moisture_pct), moisture_deduction_kg: calc.ded,
      price_per_kg: n(form.price_per_kg), other_deductions: n(form.other_deductions), payment_status: form.payment_status, remarks: form.remarks || null,
    };
    setSaving(true);
    const res = form.id
      ? await db.from('grain_purchases').update(values).eq('id', form.id).select('*, grain_commodities(name)').single()
      : await db.from('grain_purchases').insert(values).select('*, grain_commodities(name)').single();
    setSaving(false);
    if (res.error) return notify.error(res.error);
    notify.success(`Saved ${(res.data as Purchase).ref_no}`);
    setForm(null);
    setReceipt(res.data as Purchase);
    reload();
  };

  const markPaid = async (r: Purchase) => {
    const { error } = await db.from('grain_purchases').update({ payment_status: 'paid' }).eq('id', r.id);
    if (error) return notify.error(error);
    reload();
  };

  const remove = async (r: Purchase) => {
    if (!(await ask(`Delete purchase ${r.ref_no}? Stock will be reduced.`))) return;
    const { error } = await db.from('grain_purchases').delete().eq('id', r.id);
    if (error) return notify.error(error);
    reload();
  };

  const unpaid = (data ?? []).filter((r) => r.payment_status === 'unpaid');

  return (
    <div>
      <PageHeader title="Buying — Purchases from Farmers" subtitle="Weigh, deduct sacks & moisture, pay the farmer"
        actions={<Button icon={<Plus size={16} />} onClick={openNew}>New purchase</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Mini label="Net weight bought" value={kg(sum(rows, (r) => r.net_kg))} />
        <Mini label="Sacks" value={qty(sum(rows, (r) => r.sacks))} />
        <Mini label="Amount" value={money(sum(rows, (r) => r.amount))} />
        <Mini label="Unpaid to farmers" value={money(sum(unpaid, (r) => r.net_payable))} warn={unpaid.length > 0} />
      </div>

      <Card>
        <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <SearchBox value={q} onChange={setQ} placeholder="Search ref, farmer…" />
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No purchases in this range." /> : (
          <Table>
            <thead><tr>
              <th className={th}>Ref</th><th className={th}>Date</th><th className={th}>Farmer / Seller</th><th className={th}>Commodity</th>
              <th className={thR}>Sacks</th><th className={thR}>Gross</th><th className={thR}>Net kg</th><th className={thR}>Price</th>
              <th className={thR}>Amount</th><th className={thR}>Payable</th><th className={th}>Status</th><th className={th} />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className={`${td} font-mono text-xs`}>{r.ref_no}</td>
                  <td className={td}>{fmtDate(r.purchase_date)}</td>
                  <td className={`${td} font-medium`}>{r.seller_name}</td>
                  <td className={td}>{r.grain_commodities?.name}</td>
                  <td className={tdR}>{r.sacks}</td>
                  <td className={tdR}>{qty(r.gross_kg)}</td>
                  <td className={`${tdR} font-medium`}>{qty(r.net_kg)}</td>
                  <td className={tdR}>{money(r.price_per_kg)}</td>
                  <td className={tdR}>{money(r.amount)}</td>
                  <td className={`${tdR} font-semibold`}>{money(r.net_payable)}</td>
                  <td className={td}>{r.payment_status === 'paid' ? <Badge tone="green">paid</Badge> : <Badge tone="red">unpaid</Badge>}</td>
                  <td className={`${td} text-right`}>
                    <div className="inline-flex gap-1">
                      {r.payment_status === 'unpaid' && <button title="Mark paid" className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" onClick={() => markPaid(r)}><CheckCircle2 size={15} /></button>}
                      <button title="Receipt" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setReceipt(r)}><Printer size={15} /></button>
                      <button title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => openEdit(r)}><Pencil size={15} /></button>
                      {me.role !== 'staff' && <button title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(r)}><Trash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit purchase' : 'New purchase'} size="2xl">
        {form && calc && lk && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Date" type="date" value={form.purchase_date} onChange={(e) => patch({ purchase_date: e.target.value })} />
              <Select label="Farmer (saved)" value={form.farmer_id} onChange={(e) => patch({ farmer_id: e.target.value })}>
                <option value="">— Walk-in —</option>
                {lk.farmers.filter((f) => f.active || f.id === form.farmer_id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
              <Input label="Seller name" value={form.seller_name} onChange={(e) => setForm({ ...form, seller_name: e.target.value })} disabled={!!form.farmer_id} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Select label="Commodity" value={form.commodity_id} onChange={(e) => patch({ commodity_id: e.target.value })}>
                {lk.commodities.filter((c) => c.active || c.id === form.commodity_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Price per kg (₱)" type="number" step="any" value={form.price_per_kg} onChange={(e) => patch({ price_per_kg: e.target.value })} />
              <Input label="No. of sacks" type="number" value={form.sacks} onChange={(e) => patch({ sacks: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input label="Gross weight (kg)" type="number" step="any" value={form.gross_kg} onChange={(e) => patch({ gross_kg: e.target.value })} />
              <Input label="Tare per sack (kg)" type="number" step="any" value={form.tare_per_sack} onChange={(e) => patch({ tare_per_sack: e.target.value })} hint="Fills total tare" />
              <Input label="Total tare (kg)" type="number" step="any" value={form.tare_kg} onChange={(e) => setForm({ ...form, tare_kg: e.target.value, tare_per_sack: '' })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <Input label="Moisture (%)" type="number" step="any" value={form.moisture_pct} onChange={(e) => patch({ moisture_pct: e.target.value })} />
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                <input type="checkbox" checked={form.auto_moisture} onChange={(e) => patch({ auto_moisture: e.target.checked })} className="w-4 h-4" />
                Auto-deduct to 14% standard
              </label>
              <Input label="Moisture deduction (kg)" type="number" step="any" value={form.auto_moisture ? String(calc.ded) : form.moisture_deduction_kg}
                disabled={form.auto_moisture} onChange={(e) => patch({ moisture_deduction_kg: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Other deductions (₱)" type="number" step="any" value={form.other_deductions} onChange={(e) => patch({ other_deductions: e.target.value })} hint="Cash advance repayment, hauling, etc." />
              <Select label="Payment" value={form.payment_status} onChange={(e) => patch({ payment_status: e.target.value as 'paid' | 'unpaid' })}>
                <option value="paid">Paid now (cash)</option>
                <option value="unpaid">Unpaid / to be paid later</option>
              </Select>
            </div>
            <Textarea label="Remarks" value={form.remarks} onChange={(e) => patch({ remarks: e.target.value })} />

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-slate-500 text-xs">Net weight</p><p className="font-bold text-lg">{kg(calc.net)}</p></div>
              <div><p className="text-slate-500 text-xs">Amount</p><p className="font-bold text-lg">{money(calc.amount)}</p></div>
              <div><p className="text-slate-500 text-xs">Less deductions</p><p className="font-bold text-lg">{money(form.other_deductions)}</p></div>
              <div><p className="text-slate-500 text-xs">Pay farmer</p><p className="font-bold text-lg text-emerald-700">{money(calc.payable)}</p></div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button loading={saving} onClick={save}>Save purchase</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Purchase receipt" size="sm">
        {receipt && (
          <>
            <PurchaseReceipt p={receipt} />
            <Printable><PurchaseReceipt p={receipt} /></Printable>
            <Button className="w-full mt-4" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button>
          </>
        )}
      </Modal>
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </Card>
  );
}

function PurchaseReceipt({ p }: { p: Purchase }) {
  const row = (k: string, v: string, bold = false) => (
    <div className={`flex justify-between ${bold ? 'font-bold text-sm' : ''}`}><span>{k}</span><span>{v}</span></div>
  );
  return (
    <div className="max-w-[300px] mx-auto font-mono text-xs space-y-1">
      <div className="text-center mb-2">
        <p className="font-bold text-sm">PALAY & CORN BUYING STATION</p>
        <p>PURCHASE RECEIPT</p>
        <p>{p.ref_no} · {fmtDate(p.purchase_date)}</p>
      </div>
      {row('Seller', p.seller_name)}
      {row('Commodity', p.grain_commodities?.name ?? '')}
      <hr className="border-dashed border-slate-400" />
      {row('Sacks', String(p.sacks))}
      {row('Gross weight', kg(p.gross_kg))}
      {row('Less tare', kg(p.tare_kg))}
      {n(p.moisture_deduction_kg) > 0 && row(`Less moisture${p.moisture_pct != null ? ` (${p.moisture_pct}%)` : ''}`, kg(p.moisture_deduction_kg))}
      {row('Net weight', kg(p.net_kg), true)}
      {row('Price / kg', money(p.price_per_kg))}
      {row('Amount', money(p.amount))}
      {n(p.other_deductions) > 0 && row('Less deductions', money(p.other_deductions))}
      <hr className="border-dashed border-slate-400" />
      {row('NET PAYABLE', money(p.net_payable), true)}
      {row('Status', p.payment_status.toUpperCase())}
      {p.remarks && <p className="pt-1">Note: {p.remarks}</p>}
      <div className="flex justify-between pt-8 text-center">
        <div className="w-28 border-t border-black pt-1">Weigher</div>
        <div className="w-28 border-t border-black pt-1">Seller</div>
      </div>
    </div>
  );
}
