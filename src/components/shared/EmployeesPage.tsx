'use client';
import CrudPage from './CrudPage';
import { Badge } from '@/components/ui';
import { money, n } from '@/lib/format';
import type { Employee, SystemKey } from '@/lib/types';

export default function EmployeesPage({ system }: { system: SystemKey }) {
  return (
    <CrudPage<Employee>
      table={`${system}_employees`}
      title="Personnel"
      subtitle="Rates used to pre-fill payroll: daily rate (or monthly salary), overtime per hour and food allowance per day."
      orderBy="full_name"
      managerOnly
      searchText={(r) => `${r.full_name} ${r.position ?? ''}`}
      fields={[
        { key: 'full_name', label: 'Full name', required: true },
        { key: 'position', label: 'Position', hint: system === 'grain' ? 'e.g. Weigher, Kargador, Driver, Cashier' : 'e.g. Technician, Collector, Installer' },
        { key: 'phone', label: 'Phone' },
        { key: 'hired_on', label: 'Date hired', type: 'date' },
        { key: 'pay_type', label: 'Pay type', type: 'select', required: true, default: 'daily', options: [{ value: 'daily', label: 'Daily rate' }, { value: 'monthly', label: 'Monthly salary' }] },
        { key: 'rate', label: 'Rate (₱ per day or per month)', type: 'number', required: true },
        { key: 'ot_rate_per_hour', label: 'Overtime rate (₱ / hour)', type: 'number' },
        { key: 'food_allowance_per_day', label: 'Food allowance (₱ / day)', type: 'number' },
        ...(system === 'grain' ? [{ key: 'trip_rate', label: 'Pay per delivery trip (₱)', type: 'number' as const, hint: 'For drivers / helpers. Pre-fills driver pay on each delivery.' }] : []),
        { key: 'active', label: 'Active', type: 'checkbox', default: true },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium">{r.full_name}</span> },
        { label: 'Position', render: (r) => r.position ?? '—' },
        { label: 'Rate', right: true, render: (r) => `${money(r.rate)} / ${r.pay_type === 'daily' ? 'day' : 'month'}` },
        { label: 'OT / hr', right: true, render: (r) => money(r.ot_rate_per_hour) },
        { label: 'Food / day', right: true, render: (r) => money(r.food_allowance_per_day) },
        ...(system === 'grain' ? [{ label: 'Per trip', right: true, render: (r: Employee) => (n(r.trip_rate) ? money(r.trip_rate) : '—') }] : []),
        { label: 'Status', render: (r) => (r.active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>) },
      ]}
    />
  );
}
