import { format, startOfMonth, subMonths } from 'date-fns';

/** The last `count` months (oldest first) as { key: 'yyyy-MM', label: 'MMM', start: 'yyyy-MM-dd' }. */
export function lastMonths(count = 6) {
  const now = startOfMonth(new Date());
  return Array.from({ length: count }, (_, i) => {
    const d = subMonths(now, count - 1 - i);
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy'), start: format(d, 'yyyy-MM-dd') };
  });
}

/** Sum rows into month buckets by a 'yyyy-MM-dd' date field. */
export function bucketByMonth<T>(rows: T[], date: (r: T) => string | null, value: (r: T) => number, keys: string[]) {
  const m = new Map(keys.map((k) => [k, 0]));
  rows.forEach((r) => {
    const d = date(r);
    if (!d) return;
    const k = d.slice(0, 7);
    if (m.has(k)) m.set(k, m.get(k)! + value(r));
  });
  return keys.map((k) => Math.round(m.get(k)! * 100) / 100);
}
