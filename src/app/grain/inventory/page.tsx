'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, kg, money, n, sum, today } from '@/lib/format';
import { Button, Card, Empty, Input, Modal, PageHeader, Select, Spinner, Table, td, tdR, th, thR } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import type { InventoryRow, StockAdjustment } from '@/lib/types';

export default function InventoryPage() {
  const me = useProfile();
  const db = supabaseBrowser();
  const { data, loading, reload } = useLoad(async () => {
    const [inv, adj] = await Promise.all([
      db.from('grain_inventory').select('*').order('name').then(must),
      db.from('grain_stock_adjustments').select('*, grain_commodities(name)').order('adj_date', { ascending: false }).limit(100).then(must),
    ]);
    return { inv: inv as InventoryRow[], adj: adj as StockAdjustment[] };
  }, [], 'grain:inventory');
  const [form, setForm] = useState<{ adj_date: string; commodity_id: string; direction: '-' | '+'; kg: string; reason: string } | null>(null);

  const save = async () => {
    if (!form || !n(form.kg) || !form.reason.trim()) return toast.error('Enter kg and reason');
    const { error } = await db.from('grain_stock_adjustments').insert({
      adj_date: form.adj_date, commodity_id: form.commodity_id, kg: (form.direction === '-' ? -1 : 1) * Math.abs(n(form.kg)), reason: form.reason.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success('Adjustment saved');
    setForm(null);
    reload();
  };

  const remove = async (a: StockAdjustment) => {
    if (!confirm('Delete this adjustment?')) return;
    const { error } = await db.from('grain_stock_adjustments').delete().eq('id', a.id);
    if (error) return toast.error(error.message);
    reload();
  };

  if (loading || !data) return <Spinner />;
  const value = sum(data.inv, (i) => n(i.on_hand_kg) * n(i.avg_cost_per_kg));

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock = bought − sold ± adjustments (drying loss, spoilage, recount)"
        actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ adj_date: today(), commodity_id: data.inv[0]?.commodity_id ?? '', direction: '-', kg: '', reason: '' })}>Stock adjustment</Button>} />

      <Card className="mb-5">
        <Table>
          <thead><tr>
            <th className={th}>Commodity</th><th className={thR}>Bought</th><th className={thR}>Sold</th><th className={thR}>Adjustments</th>
            <th className={thR}>On hand</th><th className={thR}>Avg cost/kg</th><th className={thR}>Stock value</th><th className={thR}>Current buy / sell</th>
          </tr></thead>
          <tbody>
            {data.inv.map((i) => (
              <tr key={i.commodity_id}>
                <td className={`${td} font-medium`}>{i.name}</td>
                <td className={tdR}>{kg(i.purchased_kg)}</td>
                <td className={tdR}>{kg(i.sold_kg)}</td>
                <td className={tdR}>{kg(i.adjusted_kg)}</td>
                <td className={`${tdR} font-bold ${n(i.on_hand_kg) < 0 ? 'text-red-600' : ''}`}>{kg(i.on_hand_kg)}</td>
                <td className={tdR}>{money(i.avg_cost_per_kg)}</td>
                <td className={tdR}>{money(n(i.on_hand_kg) * n(i.avg_cost_per_kg))}</td>
                <td className={tdR}>{money(i.buy_price)} / {money(i.sell_price)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className={td}>Total</td><td className={tdR}>{kg(sum(data.inv, (i) => i.purchased_kg))}</td><td className={tdR}>{kg(sum(data.inv, (i) => i.sold_kg))}</td>
              <td className={tdR}>{kg(sum(data.inv, (i) => i.adjusted_kg))}</td><td className={tdR}>{kg(sum(data.inv, (i) => i.on_hand_kg))}</td><td className={td} />
              <td className={tdR}>{money(value)}</td><td className={td} />
            </tr>
          </tbody>
        </Table>
      </Card>

      <Card>
        <div className="px-4 py-3 border-b border-slate-200 font-semibold">Stock adjustments</div>
        {data.adj.length === 0 ? <Empty text="No adjustments." /> : (
          <Table>
            <thead><tr><th className={th}>Date</th><th className={th}>Commodity</th><th className={thR}>Kg</th><th className={th}>Reason</th><th className={th} /></tr></thead>
            <tbody>{data.adj.map((a) => (
              <tr key={a.id}>
                <td className={td}>{fmtDate(a.adj_date)}</td><td className={td}>{a.grain_commodities?.name}</td>
                <td className={`${tdR} font-medium ${n(a.kg) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{n(a.kg) > 0 ? '+' : ''}{kg(a.kg)}</td>
                <td className={td}>{a.reason}</td>
                <td className={`${td} text-right`}>{me.role !== 'staff' && <button className="p-1.5 text-red-500 hover:bg-red-50 rounded" onClick={() => remove(a)}><Trash2 size={15} /></button>}</td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!form} onClose={() => setForm(null)} title="Stock adjustment">
        {form && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date" type="date" value={form.adj_date} onChange={(e) => setForm({ ...form, adj_date: e.target.value })} />
              <Select label="Commodity" value={form.commodity_id} onChange={(e) => setForm({ ...form, commodity_id: e.target.value })}>
                {data.inv.map((i) => <option key={i.commodity_id} value={i.commodity_id}>{i.name}</option>)}
              </Select>
              <Select label="Type" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as '-' | '+' })}>
                <option value="-">Decrease (loss)</option><option value="+">Increase (recount)</option>
              </Select>
              <Input label="Kg" type="number" step="any" value={form.kg} onChange={(e) => setForm({ ...form, kg: e.target.value })} />
            </div>
            <Input label="Reason" value={form.reason} placeholder="e.g. Drying loss, rat damage, physical count" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button onClick={save}>Save</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
