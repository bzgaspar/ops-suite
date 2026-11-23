'use client';
import { money } from '@/lib/format';

export function PLRow({ label, value, strong, negative, indent, tone }: { label: string; value: number; strong?: boolean; negative?: boolean; indent?: boolean; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : '';
  return (
    <div className={`flex justify-between py-1.5 text-sm ${strong ? 'font-semibold border-t border-slate-200 mt-1 pt-2' : ''} ${indent ? 'pl-4 text-slate-600' : ''}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${color}`}>{negative ? `(${money(value)})` : money(value)}</span>
    </div>
  );
}

/** Group rows by a key and sum a set of numeric fields. */
export function groupSum<T>(rows: T[], key: (r: T) => string, fields: Record<string, (r: T) => number>) {
  const m = new Map<string, Record<string, number>>();
  rows.forEach((r) => {
    const k = key(r);
    const cur = m.get(k) ?? Object.fromEntries(Object.keys(fields).map((f) => [f, 0]));
    for (const [f, fn] of Object.entries(fields)) cur[f] += fn(r);
    m.set(k, cur);
  });
  return [...m.entries()].map(([k, v]) => ({ key: k, ...v })) as ({ key: string } & Record<string, number>)[];
}
