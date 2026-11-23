import { format, parseISO } from 'date-fns';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

/** Supabase returns numeric columns as strings — always go through n(). */
export const n = (v: unknown): number => {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
};

export const money = (v: unknown) => peso.format(n(v));
export const kg = (v: unknown) => `${num.format(n(v))} kg`;
export const qty = (v: unknown) => num.format(n(v));
export const round2 = (v: number) => Math.round(v * 100) / 100;

export const fmtDate = (d: string | null | undefined, pattern = 'MMM d, yyyy') =>
  d ? format(parseISO(d), pattern) : '—';

export const today = () => format(new Date(), 'yyyy-MM-dd');
export const monthStart = (d = new Date()) => format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
export const monthEnd = (d = new Date()) => format(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd');

export const sum = <T,>(rows: T[], pick: (r: T) => unknown) => rows.reduce((a, r) => a + n(pick(r)), 0);

/** Turn "juan" into the hidden e-mail Supabase Auth needs. */
export const USERNAME_DOMAIN = 'users.ops-suite.local';
export const usernameToEmail = (u: string) => (u.includes('@') ? u.trim() : `${u.trim().toLowerCase()}@${USERNAME_DOMAIN}`);
