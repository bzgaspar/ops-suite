'use client';
import { useState } from 'react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { n, today } from '@/lib/format';
import { Button, Input, Modal, Select } from '@/components/ui';
import { TRIP_EXPENSE_CATEGORIES } from './fleet';
import type { Vehicle } from '@/lib/types';

/** Small form to log a vehicle or trip expense (fuel, toll, repairs…) into grain_expenses. */
export default function QuickExpense({ title, vehicleId, saleId, vehicles, defaultDate, onClose, onSaved }: {
  title: string; vehicleId?: string | null; saleId?: string | null; vehicles?: Vehicle[]; defaultDate?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState({
    expense_date: defaultDate ?? today(), category: 'Fuel', amount: '', description: '', paid_to: '', reference: '', vehicle_id: vehicleId ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!(n(f.amount) > 0)) return notify.error('Enter the amount');
    setSaving(true);
    const { error } = await supabaseBrowser().from('grain_expenses').insert({
      expense_date: f.expense_date, category: f.category, amount: n(f.amount), description: f.description || null,
      paid_to: f.paid_to || null, reference: f.reference || null, vehicle_id: f.vehicle_id || null, sale_id: saleId ?? null,
    });
    setSaving(false);
    if (error) return notify.error(error);
    notify.success('Expense saved');
    onSaved();
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={f.expense_date} onChange={(e) => setF({ ...f, expense_date: e.target.value })} />
          <Input label="Amount (₱)" type="number" step="any" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {TRIP_EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          {vehicles && !vehicleId ? (
            <Select label="Vehicle" value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })}>
              <option value="">— none —</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_no}{v.name ? ` · ${v.name}` : ''}</option>)}
            </Select>
          ) : <Input label="Paid to" value={f.paid_to} onChange={(e) => setF({ ...f, paid_to: e.target.value })} placeholder="Gas station, shop…" />}
        </div>
        <Input label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. 40 L diesel" />
        <Input label="OR / Reference #" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save expense</Button>
        </div>
      </div>
    </Modal>
  );
}
