'use client';
import { useMemo, useState } from 'react';
import { BellRing, Printer, Download, Trash2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, n, sum } from '@/lib/format';
import { Badge, Button, Card, DateRange, Empty, Input, Modal, PageHeader, Printable, Select, Spinner, Table, Textarea, td, tdR, th, thR } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { loadCustomers, NOTICE_LABEL, NOTICE_TEMPLATES } from '@/components/isp/data';
import NoticePrint, { fillTemplate } from '@/components/isp/NoticePrint';
import type { Notice, NoticeType } from '@/lib/types';

type Target = 'balance' | 'overdue' | 'active';
const SEL = '*, isp_customers(full_name, account_no, address, area, phone)';

export default function NoticesPage() {
  const me = useProfile();
  const db = supabaseBrowser();
  const { data: customers } = useLoad(loadCustomers, [], 'isp:customers');
  const [from, setFrom] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: history, loading, reload } = useLoad(async () =>
    must(await db.from('isp_notices').select(SEL).gte('issued_on', from).lte('issued_on', to).order('created_at', { ascending: false })) as Notice[], [from, to], 'isp:notices');

  const [type, setType] = useState<NoticeType>('reminder');
  const [target, setTarget] = useState<Target>('balance');
  const [area, setArea] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [due, setDue] = useState(format(addDays(new Date(), 5), 'yyyy-MM-dd'));
  const [template, setTemplate] = useState(NOTICE_TEMPLATES.reminder);
  const [creating, setCreating] = useState(false);
  const [toPrint, setToPrint] = useState<Notice[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const areas = useMemo(() => [...new Set((customers ?? []).map((c) => c.area).filter(Boolean))].sort() as string[], [customers]);
  const targets = useMemo(() => (customers ?? []).filter((c) => {
    if (area && c.area !== area) return false;
    if (target === 'active') return c.status === 'active';
    if (target === 'overdue') return n(c.bal.overdue) > 0 && n(c.bal.overdue) >= n(minAmount);
    return n(c.bal.balance) > 0 && n(c.bal.balance) >= n(minAmount);
  }), [customers, target, area, minAmount]);

  const changeType = (t: NoticeType) => { setType(t); setTemplate(NOTICE_TEMPLATES[t]); if (t === 'disconnection') setTarget('overdue'); };

  const create = async () => {
    if (!targets.length) return toast.error('No customers match');
    if (!confirm(`Create ${targets.length} ${NOTICE_LABEL[type]}(s)?`)) return;
    setCreating(true);
    const rows = targets.map((c) => {
      const amount = Math.max(n(c.bal.balance), 0);
      return { customer_id: c.id, notice_type: type, due_date: due || null, amount_due: amount, message: fillTemplate(template, { name: c.full_name, account: c.account_no, amount, due }) };
    });
    const { data, error } = await db.from('isp_notices').insert(rows).select(SEL);
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} notice(s) created`);
    reload();
    setToPrint(data as Notice[]);
  };

  const exportSms = (list: Notice[]) => {
    const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const csv = ['phone,name,account,amount_due,due_date,message', ...list.map((nt) => {
      const c = nt.isp_customers as (Notice['isp_customers'] & { phone?: string | null }) | null;
      return [c?.phone ?? '', c?.full_name ?? '', c?.account_no ?? '', nt.amount_due, nt.due_date ?? '', nt.message.replace(/\s+/g, ' ').trim()].map((v) => esc(String(v))).join(',');
    })].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `notices-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    a.click();
  };

  const remove = async (nt: Notice) => {
    if (!confirm('Delete this notice record?')) return;
    const { error } = await db.from('isp_notices').delete().eq('id', nt.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const pickedList = (history ?? []).filter((h) => picked.has(h.id));

  return (
    <div>
      <PageHeader title="Notices" subtitle="Billing statements, payment reminders, disconnection & reconnection notices" />

      <Card className="p-4 mb-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><BellRing size={16} /> Generate notices</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select label="Notice type" value={type} onChange={(e) => changeType(e.target.value as NoticeType)}>
            {Object.entries(NOTICE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select label="Send to" value={target} onChange={(e) => setTarget(e.target.value as Target)}>
            <option value="balance">Customers with a balance</option>
            <option value="overdue">Customers with overdue bills</option>
            <option value="active">All active customers</option>
          </Select>
          <Select label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Input label="Minimum amount (₱)" type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} disabled={target === 'active'} />
          <Input label="Pay on or before" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <Textarea wrapClass="mt-3" label="Message — placeholders: {name} {account} {amount} {due}" rows={5} value={template} onChange={(e) => setTemplate(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
          <p className="text-sm text-slate-600"><b>{targets.length}</b> customer(s) · total balance {money(sum(targets, (c) => Math.max(n(c.bal.balance), 0)))}</p>
          <Button loading={creating} onClick={create} disabled={!customers}>Create & print</Button>
        </div>
      </Card>

      <Card>
        <div className="p-3 flex flex-wrap gap-2 items-center justify-between border-b border-slate-200">
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Printer size={15} />} disabled={!pickedList.length} onClick={() => setToPrint(pickedList)}>Print selected ({pickedList.length})</Button>
            <Button size="sm" variant="secondary" icon={<Download size={15} />} disabled={!pickedList.length} onClick={() => exportSms(pickedList)}>SMS CSV</Button>
          </div>
        </div>
        {loading ? <Spinner /> : !history?.length ? <Empty text="No notices in this range." /> : (
          <Table>
            <thead><tr>
              <th className={th}><input type="checkbox" checked={picked.size === history.length} onChange={(e) => setPicked(e.target.checked ? new Set(history.map((h) => h.id)) : new Set())} /></th>
              <th className={th}>Issued</th><th className={th}>Type</th><th className={th}>Customer</th><th className={th}>Area</th><th className={th}>Due</th><th className={thR}>Amount due</th><th className={th} />
            </tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50">
                <td className={td}><input type="checkbox" checked={picked.has(h.id)} onChange={(e) => { const s = new Set(picked); if (e.target.checked) s.add(h.id); else s.delete(h.id); setPicked(s); }} /></td>
                <td className={td}>{fmtDate(h.issued_on)}</td>
                <td className={td}><Badge tone={h.notice_type === 'disconnection' ? 'red' : h.notice_type === 'reminder' ? 'amber' : h.notice_type === 'reconnection' ? 'green' : 'blue'}>{h.notice_type}</Badge></td>
                <td className={`${td} font-medium`}>{h.isp_customers?.full_name} <span className="text-xs text-slate-400">{h.isp_customers?.account_no}</span></td>
                <td className={td}>{h.isp_customers?.area ?? '—'}</td>
                <td className={td}>{fmtDate(h.due_date)}</td>
                <td className={tdR}>{money(h.amount_due)}</td>
                <td className={`${td} text-right`}>
                  <div className="inline-flex gap-1">
                    <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" onClick={() => setToPrint([h])}><Printer size={15} /></button>
                    {me.role !== 'staff' && <button className="p-1.5 rounded hover:bg-red-50 text-red-500" onClick={() => remove(h)}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>

      <Modal isOpen={!!toPrint} onClose={() => setToPrint(null)} title={`Print ${toPrint?.length ?? 0} notice(s)`} size="2xl">
        {toPrint && (
          <>
            <div className="flex gap-2 mb-4">
              <Button icon={<Printer size={16} />} onClick={() => window.print()}>Print all</Button>
              <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportSms(toPrint)}>SMS CSV</Button>
            </div>
            <div className="text-xs"><NoticePrint notices={toPrint} /></div>
            <Printable><NoticePrint notices={toPrint} /></Printable>
          </>
        )}
      </Modal>
    </div>
  );
}
