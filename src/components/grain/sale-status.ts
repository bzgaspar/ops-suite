import { n } from '@/lib/format';
import type { Sale } from '@/lib/types';

export function saleStatus(s: Pick<Sale, 'amount' | 'amount_paid'>) {
  const bal = n(s.amount) - n(s.amount_paid);
  if (bal <= 0.005) return { label: 'paid', tone: 'green' as const, bal: 0 };
  if (n(s.amount_paid) > 0) return { label: 'partial', tone: 'amber' as const, bal };
  return { label: 'unpaid', tone: 'red' as const, bal };
}
