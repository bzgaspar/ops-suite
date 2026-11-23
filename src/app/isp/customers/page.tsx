'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Wallet } from 'lucide-react';
import { useLoad } from '@/lib/hooks';
import { fmtDate, money, n, sum } from '@/lib/format';
import { Badge, Button, Card, Empty, PageHeader, SearchBox, Spinner, Table, td, tdR, th, thR } from '@/components/ui';
import { loadCustomers, STATUS_TONE } from '@/components/isp/data';
import CustomerForm from '@/components/isp/CustomerForm';
import PaymentModal from '@/components/isp/PaymentModal';

export default function CustomersPage() {
  const router = useRouter();
  const { data, loading, reload } = useLoad(loadCustomers, [], 'isp:customers');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [withBal, setWithBal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);

  const areas = useMemo(() => [...new Set((data ?? []).map((c) => c.area).filter(Boolean))].sort() as string[], [data]);
  const rows = useMemo(() => (data ?? []).filter((c) =>
    (!status || c.status === status) && (!area || c.area === area) && (!withBal || n(c.bal.balance) > 0) &&
    `${c.full_name} ${c.account_no} ${c.phone ?? ''} ${c.address ?? ''} ${c.pppoe_username ?? ''}`.toLowerCase().includes(q.toLowerCase())), [data, q, status, area, withBal]);

  const sel = 'rounded-lg border border-slate-300 px-2.5 py-2 text-sm';

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${(data ?? []).filter((c) => c.status === 'active').length} active of ${(data ?? []).length} subscribers`}
        actions={<>
          <Button variant="secondary" icon={<Wallet size={16} />} onClick={() => setPayFor('')}>Record payment</Button>
          <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>New subscriber</Button>
        </>} />

      <Card>
        <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
          <div className="flex flex-wrap gap-2 items-center">
            <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="disconnected">Disconnected</option>
            </select>
            <select className={sel} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={withBal} onChange={(e) => setWithBal(e.target.checked)} /> With balance</label>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Name, account, phone, PPPoE…" />
        </div>
        {loading ? <Spinner /> : rows.length === 0 ? <Empty text="No customers found." /> : (
          <Table>
            <thead><tr>
              <th className={th}>Account</th><th className={th}>Name</th><th className={th}>Area</th><th className={th}>Plan</th>
              <th className={thR}>Monthly</th><th className={th}>Due day</th><th className={th}>Status</th><th className={th}>Last paid</th><th className={thR}>Balance</th><th className={th} />
            </tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/isp/customers/${c.id}`)}>
                  <td className={`${td} font-mono text-xs`}>{c.account_no}</td>
                  <td className={`${td} font-medium`}>{c.full_name}<p className="text-xs text-slate-400 font-normal">{c.phone ?? ''}</p></td>
                  <td className={td}>{c.area ?? '—'}</td>
                  <td className={td}>{c.isp_plans?.name ?? '—'}</td>
                  <td className={tdR}>{money(c.monthly_fee)}</td>
                  <td className={td}>{c.billing_day}</td>
                  <td className={td}><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
                  <td className={td}>{fmtDate(c.bal.last_paid_on)}</td>
                  <td className={`${tdR} font-semibold ${n(c.bal.balance) > 0 ? (n(c.bal.overdue) > 0 ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'}`}>{money(c.bal.balance)}</td>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => setPayFor(c.id)}>Pay</Button>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold"><td className={td} colSpan={8}>{rows.length} customer(s)</td><td className={tdR}>{money(sum(rows, (c) => Math.max(n(c.bal.balance), 0)))}</td><td className={td} /></tr>
            </tbody>
          </Table>
        )}
      </Card>

      {adding && <CustomerForm onClose={() => setAdding(false)} onSaved={(id) => router.push(`/isp/customers/${id}`)} />}
      {payFor !== null && data && <PaymentModal customers={data} customerId={payFor || undefined} onClose={() => setPayFor(null)} onSaved={reload} />}
    </div>
  );
}
