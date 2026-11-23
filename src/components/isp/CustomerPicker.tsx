'use client';
import { useMemo, useState } from 'react';
import { money, n } from '@/lib/format';
import { inputCls } from '@/components/ui';
import type { CustomerWithBalance } from './data';

export default function CustomerPicker({ customers, value, onChange }: { customers: CustomerWithBalance[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return customers.filter((c) => `${c.full_name} ${c.account_no} ${c.area ?? ''} ${c.address ?? ''}`.toLowerCase().includes(s)).slice(0, 30);
  }, [customers, q]);

  return (
    <div className="relative">
      <span className="block text-xs font-medium text-slate-600 mb-1">Customer</span>
      <input
        className={inputCls}
        placeholder="Search name, account # or area…"
        value={open ? q : selected ? `${selected.full_name} (${selected.account_no})` : q}
        onFocus={() => { setOpen(true); setQ(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {list.length === 0 && <p className="p-3 text-sm text-slate-400">No match</p>}
          {list.map((c) => (
            <button key={c.id} type="button" onMouseDown={() => { onChange(c.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex justify-between gap-2">
              <span><span className="font-medium">{c.full_name}</span> <span className="text-slate-400 text-xs">{c.account_no} · {c.area ?? '—'}</span></span>
              <span className={n(c.bal.balance) > 0 ? 'text-red-600' : 'text-slate-400'}>{money(c.bal.balance)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
