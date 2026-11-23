'use client';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabaseBrowser } from '@/lib/supabase/client';
import { fmtDate, money, n, today } from '@/lib/format';
import { Button, Input, Modal, Printable, Select, Textarea } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import CustomerPicker from './CustomerPicker';
import type { CustomerWithBalance } from './data';
import type { Payment } from '@/lib/types';

export const PAY_METHODS = [
  { value: 'cash', label: 'Cash' }, { value: 'gcash', label: 'GCash' }, { value: 'maya', label: 'Maya' },
  { value: 'bank', label: 'Bank transfer' }, { value: 'check', label: 'Check' },
];

export default function PaymentModal({ customers, customerId, onClose, onSaved }: {
  customers: CustomerWithBalance[]; customerId?: string; onClose: () => void; onSaved: () => void;
}) {
  const me = useProfile();
  const db = supabaseBrowser();
  const [f, setF] = useState({ customer_id: customerId ?? '', paid_on: today(), amount: '', method: 'cash', reference: '', collector: me.full_name, notes: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Payment | null>(null);
  const cust = customers.find((c) => c.id === f.customer_id);

  const save = async () => {
    if (!f.customer_id) return toast.error('Choose a customer');
    if (!(n(f.amount) > 0)) return toast.error('Enter the amount received');
    setSaving(true);
    const { data, error } = await db.from('isp_payments').insert({
      customer_id: f.customer_id, paid_on: f.paid_on, amount: n(f.amount), method: f.method,
      reference: f.reference || null, collector: f.collector || null, notes: f.notes || null,
    }).select('*, isp_customers(full_name, account_no, address)').single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Payment recorded — ${(data as Payment).receipt_no}`);
    setSaved(data as Payment);
    onSaved();
  };

  if (saved) {
    const remaining = n(cust?.bal.balance) - n(saved.amount);
    return (
      <Modal isOpen onClose={onClose} title="Official receipt" size="sm">
        <OfficialReceipt p={saved} balanceAfter={remaining} />
        <Printable><OfficialReceipt p={saved} balanceAfter={remaining} /></Printable>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Done</Button>
          <Button className="flex-1" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Record payment / collection" size="lg">
      <div className="space-y-3">
        {customerId ? (
          <p className="text-sm"><b>{cust?.full_name}</b> <span className="text-slate-500">{cust?.account_no}</span></p>
        ) : (
          <CustomerPicker customers={customers} value={f.customer_id} onChange={(id) => setF({ ...f, customer_id: id })} />
        )}
        {cust && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm flex justify-between">
            <span>Current balance</span>
            <button type="button" className={`font-semibold ${n(cust.bal.balance) > 0 ? 'text-red-600' : 'text-emerald-600'} hover:underline`}
              onClick={() => n(cust.bal.balance) > 0 && setF({ ...f, amount: String(cust.bal.balance) })} title="Use as amount">
              {money(cust.bal.balance)}
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} />
          <Input label="Amount (₱)" type="number" step="any" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} autoFocus={!!customerId} />
          <Select label="Method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Input label="Reference #" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="GCash / bank ref" />
        </div>
        <Input label="Collector" value={f.collector} onChange={(e) => setF({ ...f, collector: e.target.value })} />
        <Textarea label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <p className="text-xs text-slate-500">Payments are applied to the oldest unpaid bills first. Overpayment is kept as credit for the next bill.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save payment</Button>
        </div>
      </div>
    </Modal>
  );
}

export function OfficialReceipt({ p, balanceAfter }: { p: Payment; balanceAfter?: number }) {
  const row = (k: string, v: string, bold = false) => <div className={`flex justify-between ${bold ? 'font-bold text-sm' : ''}`}><span>{k}</span><span>{v}</span></div>;
  return (
    <div className="font-mono text-xs space-y-1 max-w-[300px] mx-auto">
      <div className="text-center mb-2">
        <p className="font-bold text-sm">INTERNET SERVICE</p>
        <p>ACKNOWLEDGEMENT RECEIPT</p>
        <p>{p.receipt_no} · {fmtDate(p.paid_on)}</p>
      </div>
      {row('Customer', p.isp_customers?.full_name ?? '')}
      {row('Account #', p.isp_customers?.account_no ?? '')}
      <hr className="border-dashed border-slate-400" />
      {row('AMOUNT PAID', money(p.amount), true)}
      {row('Method', p.method.toUpperCase())}
      {p.reference && row('Reference', p.reference)}
      {p.collector && row('Collected by', p.collector)}
      {balanceAfter !== undefined && row('Remaining balance', money(Math.max(balanceAfter, 0)))}
      {balanceAfter !== undefined && balanceAfter < 0 && row('Advance credit', money(-balanceAfter))}
      <p className="text-center pt-3">Thank you for your payment!</p>
      <div className="flex justify-center pt-6"><div className="w-40 border-t border-black pt-1 text-center">Authorized signature</div></div>
    </div>
  );
}
