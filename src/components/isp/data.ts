'use client';
import { supabaseBrowser } from '@/lib/supabase/client';
import { must } from '@/lib/hooks';
import { n } from '@/lib/format';
import type { Customer, CustomerBalance, Invoice } from '@/lib/types';

export type CustomerWithBalance = Customer & { bal: CustomerBalance };

const EMPTY_BAL = { total_billed: 0, total_paid: 0, balance: 0, overdue: 0, oldest_unpaid_due: null, last_paid_on: null };

export async function loadCustomers(): Promise<CustomerWithBalance[]> {
  const db = supabaseBrowser();
  const [cs, bs] = await Promise.all([
    db.from('isp_customers').select('*, isp_plans(name)').order('full_name').then(must),
    db.from('isp_customer_balances').select('*').then(must),
  ]);
  const map = new Map((bs as CustomerBalance[]).map((b) => [b.customer_id, b]));
  return (cs as Customer[]).map((c) => ({ ...c, bal: map.get(c.id) ?? { customer_id: c.id, ...EMPTY_BAL } }));
}

export function invoiceStatus(i: Pick<Invoice, 'total' | 'amount_paid' | 'due_date'>) {
  const bal = n(i.total) - n(i.amount_paid);
  if (bal <= 0.005) return { label: 'paid', tone: 'green' as const, bal: 0 };
  const overdue = i.due_date < new Date().toISOString().slice(0, 10);
  if (n(i.amount_paid) > 0) return { label: overdue ? 'partial · overdue' : 'partial', tone: 'amber' as const, bal };
  return { label: overdue ? 'overdue' : 'unpaid', tone: overdue ? ('red' as const) : ('slate' as const), bal };
}

export const STATUS_TONE = { active: 'green', suspended: 'amber', disconnected: 'red' } as const;

export const NOTICE_LABEL: Record<string, string> = {
  billing: 'Billing Statement',
  reminder: 'Payment Reminder',
  disconnection: 'Notice of Disconnection',
  reconnection: 'Reconnection Notice',
  general: 'Notice',
};

export const NOTICE_TEMPLATES: Record<string, string> = {
  billing: 'Dear {name},\n\nThis is your internet service billing statement. Your total amount due is {amount}, payable on or before {due}.\n\nThank you for your continued patronage.',
  reminder: 'Dear {name},\n\nThis is a friendly reminder that your account {account} has an unpaid balance of {amount}. Kindly settle on or before {due} to avoid interruption of service.\n\nPlease disregard this notice if payment has been made.',
  disconnection: 'Dear {name},\n\nOur records show that your account {account} has an overdue balance of {amount}. Please settle this amount on or before {due}. Failure to pay will result in DISCONNECTION of your internet service without further notice.\n\nA reconnection fee may apply.',
  reconnection: 'Dear {name},\n\nWe are pleased to inform you that your internet service for account {account} has been reconnected. Thank you for settling your account.',
  general: 'Dear {name},\n\n',
};
