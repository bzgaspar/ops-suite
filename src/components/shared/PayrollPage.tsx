'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Printer, Save, CheckCircle2, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, n, round2, sum, today } from '@/lib/format';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Printable, Spinner, Textarea } from '@/components/ui';
import { useProfile } from '@/components/layout/AppShell';
import type { Employee, PayrollLine, PayrollPeriod, SystemKey } from '@/lib/types';

const SYSTEM_TITLE: Record<SystemKey, string> = { grain: 'Palay & Corn Buying Station', isp: 'Internet Service' };

type Line = Omit<PayrollLine, 'id' | 'gross_pay' | 'net_pay'> & { id?: string };

const grossOf = (l: Line) => n(l.basic_pay) + n(l.ot_pay) + n(l.food_allowance) + n(l.other_pay);
const netOf = (l: Line) => grossOf(l) - n(l.cash_advance) - n(l.other_deductions);

function defaultLine(periodId: string, e: Employee, period: PayrollPeriod): Line {
  const periodDays = differenceInCalendarDays(parseISO(period.period_end), parseISO(period.period_start)) + 1;
  const monthlyBasic = periodDays >= 28 ? n(e.rate) : round2(n(e.rate) / 2);
  return {
    period_id: periodId, employee_id: e.id, days_worked: 0,
    basic_pay: e.pay_type === 'monthly' ? monthlyBasic : 0,
    ot_hours: 0, ot_pay: 0, food_allowance: 0, other_pay: 0, cash_advance: 0, other_deductions: 0, remarks: null,
  };
}

export default function PayrollPage({ system }: { system: SystemKey }) {
  const me = useProfile();
  const db = supabaseBrowser();
  const T = { periods: `${system}_payroll_periods`, lines: `${system}_payroll_lines`, emps: `${system}_employees` };

  const { data: periods, loading, reload } = useLoad(async () => {
    const [ps, ls] = await Promise.all([
      db.from(T.periods).select('*').order('period_start', { ascending: false }).then(must),
      db.from(T.lines).select('period_id, net_pay').then(must),
    ]);
    const totals = new Map<string, number>();
    (ls as { period_id: string; net_pay: number }[]).forEach((l) => totals.set(l.period_id, (totals.get(l.period_id) ?? 0) + n(l.net_pay)));
    return (ps as PayrollPeriod[]).map((p) => ({ ...p, total: totals.get(p.id) ?? 0 }));
  }, [], `payroll:${system}`);
  const { data: employees } = useLoad(async () => must(await db.from(T.emps).select('*').order('full_name')) as Employee[], [], `employees:${system}`);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPeriod, setNewPeriod] = useState<{ period_start: string; period_end: string; notes: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const selected = periods?.find((p) => p.id === selectedId) ?? null;
  const locked = selected?.status === 'paid';
  const empMap = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);

  useEffect(() => {
    if (!selectedId && periods?.length) setSelectedId(periods[0].id);
  }, [periods, selectedId]);

  useEffect(() => {
    if (!selectedId) { setLines([]); return; }
    setLinesLoading(true);
    db.from(T.lines).select('*').eq('period_id', selectedId).then(({ data, error }) => {
      setLinesLoading(false);
      if (error) return toast.error(error.message);
      setLines((data as PayrollLine[]).map(({ gross_pay: _g, net_pay: _n, ...l }) => l));
      setDirty(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (me.role === 'staff') return <Card className="p-8 text-center text-slate-500">Payroll is for managers only.</Card>;

  const createPeriod = async () => {
    if (!newPeriod) return;
    const { data, error } = await db.from(T.periods).insert({ period_start: newPeriod.period_start, period_end: newPeriod.period_end, notes: newPeriod.notes || null }).select().single();
    if (error) return toast.error(error.message);
    const period = data as PayrollPeriod;
    const active = (employees ?? []).filter((e) => e.active);
    if (active.length) {
      const { error: lErr } = await db.from(T.lines).insert(active.map((e) => defaultLine(period.id, e, period)));
      if (lErr) toast.error(lErr.message);
    }
    toast.success(`Payroll created with ${active.length} employee(s). Enter days worked and overtime.`);
    setNewPeriod(null);
    setSelectedId(period.id);
    reload();
  };

  const update = (idx: number, key: keyof Line, raw: string) => {
    setDirty(true);
    setLines((cur) => cur.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, [key]: key === 'remarks' ? raw : raw === '' ? 0 : Number(raw) } as Line;
      const e = empMap.get(l.employee_id);
      if (e && key === 'days_worked') {
        if (e.pay_type === 'daily') next.basic_pay = round2(n(next.days_worked) * n(e.rate));
        next.food_allowance = round2(n(next.days_worked) * n(e.food_allowance_per_day));
      }
      if (e && key === 'ot_hours') next.ot_pay = round2(n(next.ot_hours) * n(e.ot_rate_per_hour));
      return next;
    }));
  };

  const saveLines = async () => {
    setSaving(true);
    const payload = lines.map(({ id: _id, ...l }) => l);
    const { error } = await db.from(T.lines).upsert(payload, { onConflict: 'period_id,employee_id' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Payroll saved');
    setDirty(false);
    reload();
  };

  const setStatus = async (status: 'paid' | 'draft') => {
    if (!selected) return;
    if (dirty) return toast.error('Save your changes first');
    if (status === 'paid' && !confirm('Mark this payroll as PAID? It will be locked from editing.')) return;
    const { error } = await db.from(T.periods).update({ status, paid_on: status === 'paid' ? today() : null }).eq('id', selected.id);
    if (error) return toast.error(error.message);
    reload();
  };

  const deletePeriod = async () => {
    if (!selected || !confirm('Delete this whole payroll period and all its lines?')) return;
    const { error } = await db.from(T.periods).delete().eq('id', selected.id);
    if (error) return toast.error(error.message);
    setSelectedId(null);
    reload();
  };

  const removeLine = async (idx: number) => {
    const l = lines[idx];
    if (l.id) {
      const { error } = await db.from(T.lines).delete().eq('id', l.id);
      if (error) return toast.error(error.message);
    }
    setLines((cur) => cur.filter((_, i) => i !== idx));
    reload();
  };

  const addEmployee = (e: Employee) => {
    if (!selected) return;
    setLines((cur) => [...cur, defaultLine(selected.id, e, selected)]);
    setDirty(true);
    setAddOpen(false);
  };

  const missing = (employees ?? []).filter((e) => !lines.some((l) => l.employee_id === e.id));
  const totals = {
    basic: sum(lines, (l) => l.basic_pay), ot: sum(lines, (l) => l.ot_pay), food: sum(lines, (l) => l.food_allowance),
    other: sum(lines, (l) => l.other_pay), ca: sum(lines, (l) => l.cash_advance), ded: sum(lines, (l) => l.other_deductions),
    net: lines.reduce((a, l) => a + netOf(l), 0),
  };
  const numCell = 'w-20 rounded border border-slate-200 px-1.5 py-1 text-right text-sm tabular-nums focus:border-primary-500 focus:outline-none disabled:bg-transparent disabled:border-transparent';

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Salaries, overtime, food allowance, cash advances and deductions"
        actions={<Button icon={<Plus size={16} />} onClick={() => setNewPeriod({ period_start: '', period_end: '', notes: '' })}>New payroll</Button>} />

      <div className="grid xl:grid-cols-[260px_1fr] gap-5">
        <Card className="h-fit">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-sm">Payroll periods</div>
          {loading ? <Spinner /> : !periods?.length ? <Empty text="No payroll yet." /> : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {periods.map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${p.id === selectedId ? 'bg-primary-50' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{fmtDate(p.period_start, 'MMM d')} – {fmtDate(p.period_end, 'MMM d, yyyy')}</span>
                    <Badge tone={p.status === 'paid' ? 'green' : 'amber'}>{p.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Net {money(p.total)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          {!selected ? <Empty text="Create or select a payroll period." /> : (
            <>
              <div className="p-4 border-b border-slate-200 flex flex-wrap gap-2 items-center justify-between">
                <div>
                  <h2 className="font-semibold">{fmtDate(selected.period_start)} – {fmtDate(selected.period_end)}</h2>
                  <p className="text-xs text-slate-500">{locked ? `Paid on ${fmtDate(selected.paid_on)}` : 'Draft — editable'}{selected.notes ? ` · ${selected.notes}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!locked && <Button size="sm" variant="secondary" icon={<UserPlus size={15} />} onClick={() => setAddOpen(true)} disabled={!missing.length}>Add employee</Button>}
                  {!locked && <Button size="sm" icon={<Save size={15} />} loading={saving} disabled={!dirty} onClick={saveLines}>Save</Button>}
                  <Button size="sm" variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()} disabled={!lines.length || dirty}>Payslips</Button>
                  {locked
                    ? <Button size="sm" variant="ghost" icon={<RotateCcw size={15} />} onClick={() => setStatus('draft')}>Reopen</Button>
                    : <Button size="sm" variant="success" icon={<CheckCircle2 size={15} />} onClick={() => setStatus('paid')} disabled={!lines.length}>Mark paid</Button>}
                  {!locked && <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 size={15} />} onClick={deletePeriod}>Delete</Button>}
                </div>
              </div>

              {linesLoading ? <Spinner /> : !lines.length ? <Empty text="No employees in this payroll. Add personnel first." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                        {['Employee', 'Days', 'Basic', 'OT hrs', 'OT pay', 'Food', 'Other pay', 'Cash adv.', 'Other ded.', 'Net pay', 'Remarks', ''].map((h) => (
                          <th key={h} className={`px-2 py-2.5 font-semibold border-b border-slate-200 whitespace-nowrap ${h === 'Employee' || h === 'Remarks' ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => {
                        const e = empMap.get(l.employee_id);
                        return (
                          <tr key={l.employee_id} className="border-b border-slate-100">
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <p className="font-medium">{e?.full_name ?? '—'}</p>
                              <p className="text-[11px] text-slate-400">{e ? `${money(e.rate)}/${e.pay_type === 'daily' ? 'day' : 'mo'} · OT ${money(e.ot_rate_per_hour)}/hr` : ''}</p>
                            </td>
                            {(['days_worked', 'basic_pay', 'ot_hours', 'ot_pay', 'food_allowance', 'other_pay', 'cash_advance', 'other_deductions'] as const).map((k) => (
                              <td key={k} className="px-1 py-1.5 text-right">
                                <input type="number" step="any" disabled={locked} className={numCell} value={l[k]} onChange={(ev) => update(i, k, ev.target.value)} onFocus={(ev) => ev.target.select()} />
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap">{money(netOf(l))}</td>
                            <td className="px-1 py-1.5"><input disabled={locked} className="w-32 rounded border border-slate-200 px-1.5 py-1 text-sm disabled:border-transparent disabled:bg-transparent" value={l.remarks ?? ''} onChange={(ev) => update(i, 'remarks', ev.target.value)} /></td>
                            <td className="px-1 py-1.5">{!locked && <button className="p-1 text-red-500 hover:bg-red-50 rounded" onClick={() => removeLine(i)}><Trash2 size={14} /></button>}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-semibold text-right tabular-nums">
                        <td className="px-2 py-2.5 text-left">Totals</td>
                        <td />
                        <td className="px-2">{money(totals.basic)}</td><td />
                        <td className="px-2">{money(totals.ot)}</td>
                        <td className="px-2">{money(totals.food)}</td>
                        <td className="px-2">{money(totals.other)}</td>
                        <td className="px-2">{money(totals.ca)}</td>
                        <td className="px-2">{money(totals.ded)}</td>
                        <td className="px-2 text-emerald-700">{money(totals.net)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 p-3">Days worked fills Basic (daily-rate staff) and Food allowance automatically; OT hours fills OT pay. You can still type over any amount.</p>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {selected && lines.length > 0 && (
        <Printable>
          {lines.map((l, i) => {
            const e = empMap.get(l.employee_id);
            const row = (label: string, v: number, neg = false) => (
              <div className="flex justify-between"><span>{label}</span><span>{neg ? '-' : ''}{money(v)}</span></div>
            );
            return (
              <div key={l.employee_id} className={`avoid-break border border-black p-4 mb-4 ${i % 2 === 1 ? 'page-break' : ''}`}>
                <div className="text-center mb-2">
                  <p className="font-bold text-sm">{SYSTEM_TITLE[system]}</p>
                  <p className="font-semibold">PAYSLIP</p>
                  <p>{fmtDate(selected.period_start)} – {fmtDate(selected.period_end)}</p>
                </div>
                <p><b>Employee:</b> {e?.full_name} {e?.position ? `(${e.position})` : ''}</p>
                <p className="mb-2"><b>Days worked:</b> {l.days_worked} · <b>OT hours:</b> {l.ot_hours}</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-0.5">
                    <p className="font-semibold border-b border-black">Earnings</p>
                    {row('Basic pay', n(l.basic_pay))}
                    {row('Overtime', n(l.ot_pay))}
                    {row('Food allowance', n(l.food_allowance))}
                    {row('Other pay', n(l.other_pay))}
                    <div className="flex justify-between font-semibold border-t border-black"><span>Gross</span><span>{money(grossOf(l))}</span></div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold border-b border-black">Deductions</p>
                    {row('Cash advance', n(l.cash_advance), true)}
                    {row('Other deductions', n(l.other_deductions), true)}
                    <div className="flex justify-between font-bold text-sm border-t border-black mt-4"><span>NET PAY</span><span>{money(netOf(l))}</span></div>
                  </div>
                </div>
                {l.remarks && <p className="mt-2"><b>Remarks:</b> {l.remarks}</p>}
                <div className="flex justify-between mt-8 text-center">
                  <div className="w-40 border-t border-black pt-1">Prepared by</div>
                  <div className="w-40 border-t border-black pt-1">Received by</div>
                </div>
              </div>
            );
          })}
        </Printable>
      )}

      <Modal isOpen={!!newPeriod} onClose={() => setNewPeriod(null)} title="New payroll period">
        {newPeriod && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="date" value={newPeriod.period_start} onChange={(e) => setNewPeriod({ ...newPeriod, period_start: e.target.value })} />
              <Input label="To" type="date" value={newPeriod.period_end} onChange={(e) => setNewPeriod({ ...newPeriod, period_end: e.target.value })} />
            </div>
            <Textarea label="Notes" value={newPeriod.notes} onChange={(e) => setNewPeriod({ ...newPeriod, notes: e.target.value })} />
            <p className="text-xs text-slate-500">All active personnel are added automatically. Monthly-salaried staff get a full month for periods of 28+ days, otherwise half.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNewPeriod(null)}>Cancel</Button>
              <Button onClick={createPeriod} disabled={!newPeriod.period_start || !newPeriod.period_end}>Create</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add employee to payroll" size="sm">
        <div className="divide-y divide-slate-100">
          {missing.map((e) => (
            <button key={e.id} onClick={() => addEmployee(e)} className="w-full text-left px-2 py-2.5 hover:bg-slate-50 text-sm">
              {e.full_name} <span className="text-slate-400">{e.position ?? ''} {!e.active && '(inactive)'}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
