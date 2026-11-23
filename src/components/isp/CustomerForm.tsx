'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { n, today } from '@/lib/format';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import type { Customer, Plan } from '@/lib/types';

type F = Record<string, string>;

export default function CustomerForm({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: (id: string) => void }) {
  const db = supabaseBrowser();
  const { data: plans } = useLoad(async () => must(await db.from('isp_plans').select('*').order('monthly_fee')) as Plan[]);
  const [f, setF] = useState<F>(() => {
    const c = customer;
    return {
      full_name: c?.full_name ?? '', phone: c?.phone ?? '', email: c?.email ?? '', address: c?.address ?? '', area: c?.area ?? '',
      plan_id: c?.plan_id ?? '', monthly_fee: c ? String(c.monthly_fee) : '', install_date: c?.install_date ?? today(),
      billing_day: c ? String(c.billing_day) : '1', status: c?.status ?? 'active', pppoe_username: c?.pppoe_username ?? '',
      ip_address: c?.ip_address ?? '', notes: c?.notes ?? '', install_fee: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF((cur) => {
    const next = { ...cur, [k]: v };
    if (k === 'plan_id') {
      const p = plans?.find((x) => x.id === v);
      if (p) next.monthly_fee = String(p.monthly_fee);
    }
    return next;
  });

  const save = async () => {
    if (!f.full_name.trim()) return toast.error('Name is required');
    const day = Math.round(n(f.billing_day));
    if (day < 1 || day > 28) return toast.error('Billing day must be 1–28');
    const values = {
      full_name: f.full_name.trim(), phone: f.phone || null, email: f.email || null, address: f.address || null, area: f.area || null,
      plan_id: f.plan_id || null, monthly_fee: n(f.monthly_fee), install_date: f.install_date || null, billing_day: day,
      status: f.status, pppoe_username: f.pppoe_username || null, ip_address: f.ip_address || null, notes: f.notes || null,
    };
    setSaving(true);
    const res = customer
      ? await db.from('isp_customers').update(values).eq('id', customer.id).select('id').single()
      : await db.from('isp_customers').insert(values).select('id').single();
    if (res.error) { setSaving(false); return toast.error(res.error.message); }
    const id = (res.data as { id: string }).id;
    if (!customer && n(f.install_fee) > 0) {
      const { error } = await db.from('isp_invoices').insert({
        customer_id: id, kind: 'installation', description: 'Installation fee', amount: n(f.install_fee), due_date: f.install_date || today(),
      });
      if (error) toast.error(`Customer saved, but installation fee failed: ${error.message}`);
    }
    setSaving(false);
    toast.success('Customer saved');
    onSaved(id);
  };

  return (
    <Modal isOpen onClose={onClose} title={customer ? `Edit ${customer.account_no}` : 'New subscriber'} size="2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Full name" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
        <Input label="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input label="Address" value={f.address} onChange={(e) => set('address', e.target.value)} />
        <Input label="Area / Barangay / Route" value={f.area} onChange={(e) => set('area', e.target.value)} />
        <Select label="Plan" value={f.plan_id} onChange={(e) => set('plan_id', e.target.value)}>
          <option value="">— none —</option>
          {(plans ?? []).filter((p) => p.active || p.id === f.plan_id).map((p) => <option key={p.id} value={p.id}>{p.name} · ₱{p.monthly_fee}</option>)}
        </Select>
        <Input label="Monthly fee (₱)" type="number" step="any" value={f.monthly_fee} onChange={(e) => set('monthly_fee', e.target.value)} hint="Defaults to the plan price; override for promos." />
        <Input label="Installation date" type="date" value={f.install_date} onChange={(e) => set('install_date', e.target.value)} />
        <Input label="Billing / due day (1–28)" type="number" value={f.billing_day} onChange={(e) => set('billing_day', e.target.value)} hint="Day of the month the bill is due." />
        <Select label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="active">Active</option><option value="suspended">Suspended</option><option value="disconnected">Disconnected</option>
        </Select>
        <Input label="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="PPPoE username" value={f.pppoe_username} onChange={(e) => set('pppoe_username', e.target.value)} />
        <Input label="IP address" value={f.ip_address} onChange={(e) => set('ip_address', e.target.value)} />
        {!customer && <Input label="Installation fee to bill (₱)" type="number" step="any" value={f.install_fee} onChange={(e) => set('install_fee', e.target.value)} hint="Optional. Creates a one-time bill." />}
        <Textarea wrapClass="sm:col-span-2" label="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={saving} onClick={save}>Save</Button>
      </div>
    </Modal>
  );
}
