'use client';
import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Wallet, FilePlus2, BellRing, Printer, Trash2, Power, PauseCircle, PlayCircle } from 'lucide-react';
import { notify } from '@/lib/notify';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, n, today } from '@/lib/format';
import { Badge, Button, Card, Input, Modal, PageHeader, Printable, Select, Spinner, Table, Textarea, td, tdR, th, thR, ask } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import { loadCustomers, invoiceStatus, STATUS_TONE, NOTICE_TEMPLATES, NOTICE_LABEL } from '@/components/isp/data';
import CustomerForm from '@/components/isp/CustomerForm';
import PaymentModal, { OfficialReceipt } from '@/components/isp/PaymentModal';
import NoticePrint, { fillTemplate } from '@/components/isp/NoticePrint';
import type { Invoice, Notice, NoticeType, Payment } from '@/lib/types';

type Entry = { date: string; kind: 'bill' | 'payment'; ref: string; desc: string; debit: number; credit: number; id: string; raw: Invoice | Payment };

export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useProfile();
  const router = useRouter();
  const db = supabaseBrowser();
  const { data: customers, reload: reloadCustomers } = useLoad(loadCustomers, [], 'isp:customers');
  const { data: ledger, reload: reloadLedger } = useLoad(async () => {
    const [inv, pay, notices] = await Promise.all([
      db.from('isp_invoices').select('*').eq('customer_id', id).order('due_date').then(must),
      db.from('isp_payments').select('*, isp_customers(full_name, account_no, address)').eq('customer_id', id).order('paid_on').then(must),
      db.from('isp_notices').select('*, isp_customers(full_name, account_no, address, area)').eq('customer_id', id).order('issued_on', { ascending: false }).then(must),
    ]);
    return { invoices: inv as Invoice[], payments: pay as Payment[], notices: notices as Notice[] };
  }, [id], 'isp:ledger');

  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [charge, setCharge] = useState<{ kind: string; description: string; amount: string; due_date: string } | null>(null);
  const [notice, setNotice] = useState<{ notice_type: NoticeType; due_date: string; message: string } | null>(null);
  const [printing, setPrinting] = useState<{ kind: 'soa' } | { kind: 'or'; p: Payment } | { kind: 'notice'; n: Notice } | null>(null);

  const c = customers?.find((x) => x.id === id);
  const reload = () => { reloadCustomers(); reloadLedger(); };

  const entries = useMemo(() => {
    if (!ledger) return [];
    const list: Entry[] = [
      ...ledger.invoices.map((i) => ({ date: i.due_date, kind: 'bill' as const, ref: i.invoice_no, desc: i.description ?? i.kind, debit: n(i.total), credit: 0, id: i.id, raw: i })),
      ...ledger.payments.map((p) => ({ date: p.paid_on, kind: 'payment' as const, ref: p.receipt_no, desc: `Payment · ${p.method}${p.reference ? ` · ${p.reference}` : ''}`, debit: 0, credit: n(p.amount), id: p.id, raw: p })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'bill' ? -1 : 1));
    let run = 0;
    return list.map((e) => ({ ...e, running: (run += e.debit - e.credit) }));
  }, [ledger]);

  if (!c || !ledger) return <Spinner />;
  const bal = n(c.bal.balance);

  const setStatus = async (status: string) => {
    if (!(await ask(`Change status to ${status.toUpperCase()}?`))) return;
    const { error } = await db.from('isp_customers').update({ status }).eq('id', id);
    if (error) return notify.error(error);
    notify.success(`Customer ${status}`);
    reload();
  };

  const saveCharge = async () => {
    if (!charge || !(n(charge.amount) > 0)) return notify.error('Enter an amount');
    const { error } = await db.from('isp_invoices').insert({ customer_id: id, kind: charge.kind, description: charge.description || null, amount: n(charge.amount), due_date: charge.due_date });
    if (error) return notify.error(error);
    notify.success('Charge added');
    setCharge(null);
    reload();
  };

  const deleteEntry = async (e: Entry) => {
    if (!(await ask(`Delete ${e.ref}? Balances will be recalculated.`))) return;
    const { error } = await db.from(e.kind === 'bill' ? 'isp_invoices' : 'isp_payments').delete().eq('id', e.id);
    if (error) return notify.error(error);
    reload();
  };

  const openNotice = (type: NoticeType) => {
    const due = c.bal.oldest_unpaid_due && c.bal.oldest_unpaid_due >= today() ? c.bal.oldest_unpaid_due : today();
    setNotice({ notice_type: type, due_date: due, message: fillTemplate(NOTICE_TEMPLATES[type], { name: c.full_name, account: c.account_no, amount: Math.max(bal, 0), due }) });
  };

  const saveNotice = async () => {
    if (!notice) return;
    const { data, error } = await db.from('isp_notices').insert({ customer_id: id, notice_type: notice.notice_type, due_date: notice.due_date || null, amount_due: Math.max(bal, 0), message: notice.message })
      .select('*, isp_customers(full_name, account_no, address, area)').single();
    if (error) return notify.error(error);
    setNotice(null);
    reloadLedger();
    setPrinting({ kind: 'notice', n: data as Notice });
  };

  const deleteCustomer = async () => {
    if (!(await ask(`Permanently delete ${c.full_name} and ALL their bills and payments? Consider "Disconnect" instead.`))) return;
    const { error } = await db.from('isp_customers').delete().eq('id', id);
    if (error) return notify.error(error);
    router.push('/isp/customers');
  };

  return (
    <div>
      <Link href="/isp/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"><ArrowLeft size={14} /> Customers</Link>
      <PageHeader title={c.full_name} subtitle={`${c.account_no} · ${c.isp_plans?.name ?? 'No plan'} · ${money(c.monthly_fee)}/month · due every ${c.billing_day}${['st', 'nd', 'rd'][c.billing_day - 1] ?? 'th'}`}
        actions={<>
          <Button icon={<Wallet size={16} />} onClick={() => setPaying(true)}>Payment</Button>
          <Button variant="secondary" icon={<FilePlus2 size={16} />} onClick={() => setCharge({ kind: 'other', description: '', amount: '', due_date: today() })}>Add charge</Button>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={() => setPrinting({ kind: 'soa' })}>Statement</Button>
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit</Button>
        </>} />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-3">
              <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
              <span className={`text-2xl font-bold ${bal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(bal)}</span>
            </div>
            <p className="text-xs text-slate-500 text-right -mt-2 mb-3">{bal < 0 ? 'advance credit' : n(c.bal.overdue) > 0 ? `${money(c.bal.overdue)} overdue since ${fmtDate(c.bal.oldest_unpaid_due)}` : 'current balance'}</p>
            <dl className="text-sm space-y-1.5">
              {[['Phone', c.phone], ['Email', c.email], ['Address', c.address], ['Area', c.area], ['Installed', fmtDate(c.install_date)], ['PPPoE', c.pppoe_username], ['IP', c.ip_address], ['Last payment', fmtDate(c.bal.last_paid_on)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right">{v || '—'}</dd></div>
              ))}
            </dl>
            {c.notes && <p className="text-sm text-slate-600 mt-3 bg-slate-50 rounded p-2">{c.notes}</p>}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {c.status !== 'active' && <Button size="sm" variant="success" icon={<PlayCircle size={15} />} onClick={() => setStatus('active')}>Reconnect</Button>}
              {c.status === 'active' && <Button size="sm" variant="secondary" icon={<PauseCircle size={15} />} onClick={() => setStatus('suspended')}>Suspend</Button>}
              {c.status !== 'disconnected' && <Button size="sm" variant="danger" icon={<Power size={15} />} onClick={() => setStatus('disconnected')}>Disconnect</Button>}
              {me.role !== 'staff' && <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 size={15} />} onClick={deleteCustomer}>Delete</Button>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><BellRing size={16} /> Notices</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(['billing', 'reminder', 'disconnection', 'reconnection', 'general'] as NoticeType[]).map((t) => (
                <button key={t} onClick={() => openNotice(t)} className="px-2 py-1 rounded-md text-xs bg-slate-100 hover:bg-slate-200 capitalize">{t}</button>
              ))}
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {ledger.notices.length === 0 && <p className="text-slate-400 text-sm">No notices sent.</p>}
              {ledger.notices.map((nt) => (
                <button key={nt.id} onClick={() => setPrinting({ kind: 'notice', n: nt })} className="w-full text-left py-2 hover:bg-slate-50 flex justify-between">
                  <span>{NOTICE_LABEL[nt.notice_type]}</span><span className="text-slate-500">{fmtDate(nt.issued_on)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <div className="px-4 py-3 border-b border-slate-200 font-semibold">Account ledger</div>
          <Table>
            <thead><tr><th className={th}>Date</th><th className={th}>Ref</th><th className={th}>Description</th><th className={thR}>Charges</th><th className={thR}>Payments</th><th className={thR}>Balance</th><th className={th}>Status</th><th className={th} /></tr></thead>
            <tbody>
              {entries.length === 0 && <tr><td className={td} colSpan={8}>No bills or payments yet.</td></tr>}
              {entries.map((e) => {
                const st = e.kind === 'bill' ? invoiceStatus(e.raw as Invoice) : null;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className={td}>{fmtDate(e.date)}</td>
                    <td className={`${td} font-mono text-xs`}>{e.kind === 'payment' ? <button className="text-primary-600 hover:underline" onClick={() => setPrinting({ kind: 'or', p: e.raw as Payment })}>{e.ref}</button> : e.ref}</td>
                    <td className={td}>{e.desc}</td>
                    <td className={tdR}>{e.debit ? money(e.debit) : ''}</td>
                    <td className={`${tdR} text-emerald-600`}>{e.credit ? money(e.credit) : ''}</td>
                    <td className={`${tdR} font-medium`}>{money(e.running)}</td>
                    <td className={td}>{st && <Badge tone={st.tone}>{st.label}</Badge>}</td>
                    <td className={`${td} text-right`}>{me.role !== 'staff' && <button className="p-1 text-red-500 hover:bg-red-50 rounded" onClick={() => deleteEntry(e)}><Trash2 size={14} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>

      {editing && <CustomerForm customer={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {paying && customers && <PaymentModal customers={customers} customerId={id} onClose={() => setPaying(false)} onSaved={reload} />}

      <Modal isOpen={!!charge} onClose={() => setCharge(null)} title="Add charge">
        {charge && (
          <div className="space-y-3">
            <Select label="Type" value={charge.kind} onChange={(e) => setCharge({ ...charge, kind: e.target.value })}>
              <option value="other">Other (reconnection fee, materials, penalty…)</option><option value="installation">Installation</option><option value="monthly">Monthly (manual)</option>
            </Select>
            <Input label="Description" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount (₱)" type="number" step="any" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} />
              <Input label="Due date" type="date" value={charge.due_date} onChange={(e) => setCharge({ ...charge, due_date: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCharge(null)}>Cancel</Button><Button onClick={saveCharge}>Add</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!notice} onClose={() => setNotice(null)} title={notice ? NOTICE_LABEL[notice.notice_type] : ''} size="lg">
        {notice && (
          <div className="space-y-3">
            <Input label="Pay on or before" type="date" value={notice.due_date} onChange={(e) => setNotice({ ...notice, due_date: e.target.value, message: fillTemplate(NOTICE_TEMPLATES[notice.notice_type], { name: c.full_name, account: c.account_no, amount: Math.max(bal, 0), due: e.target.value }) })} />
            <Textarea label="Message" rows={8} value={notice.message} onChange={(e) => setNotice({ ...notice, message: e.target.value })} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setNotice(null)}>Cancel</Button><Button onClick={saveNotice}>Save & print</Button></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!printing} onClose={() => setPrinting(null)} title={printing?.kind === 'soa' ? 'Statement of account' : printing?.kind === 'or' ? 'Receipt' : 'Notice'} size={printing?.kind === 'or' ? 'sm' : '2xl'}>
        {printing && (() => {
          const content = printing.kind === 'soa' ? <Statement name={c.full_name} account={c.account_no} address={`${c.address ?? ''}${c.area ? `, ${c.area}` : ''}`} plan={c.isp_plans?.name ?? ''} entries={entries} balance={bal} />
            : printing.kind === 'or' ? <OfficialReceipt p={printing.p} />
            : <NoticePrint notices={[printing.n]} />;
          return <>{content}<Printable>{content}</Printable><Button className="w-full mt-4" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button></>;
        })()}
      </Modal>
    </div>
  );
}

function Statement({ name, account, address, plan, entries, balance }: { name: string; account: string; address: string; plan: string; entries: (Entry & { running: number })[]; balance: number }) {
  const recent = entries.slice(-15);
  return (
    <div className="text-xs">
      <div className="text-center mb-3"><p className="font-bold text-base">INTERNET SERVICE PROVIDER</p><p className="font-semibold">STATEMENT OF ACCOUNT</p><p>As of {fmtDate(today())}</p></div>
      <p><b>{name}</b> · {account}</p><p>{address}</p><p className="mb-3">Plan: {plan}</p>
      <table className="w-full border-collapse">
        <thead><tr className="border-b border-black text-left"><th className="py-1">Date</th><th>Ref</th><th>Description</th><th className="text-right">Charges</th><th className="text-right">Payments</th><th className="text-right">Balance</th></tr></thead>
        <tbody>{recent.map((e) => (
          <tr key={e.id} className="border-b border-slate-200"><td className="py-1">{fmtDate(e.date, 'MM/dd/yy')}</td><td>{e.ref}</td><td>{e.desc}</td><td className="text-right">{e.debit ? money(e.debit) : ''}</td><td className="text-right">{e.credit ? money(e.credit) : ''}</td><td className="text-right">{money(e.running)}</td></tr>
        ))}</tbody>
      </table>
      <p className="text-right text-sm font-bold mt-3">{balance >= 0 ? 'AMOUNT DUE' : 'ADVANCE CREDIT'}: {money(Math.abs(balance))}</p>
    </div>
  );
}
