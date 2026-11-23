'use client';
import CrudPage from '@/components/shared/CrudPage';
import { Badge } from '@/components/ui';
import type { Buyer } from '@/lib/types';

export default function BuyersPage() {
  return (
    <CrudPage<Buyer>
      table="grain_buyers" title="Big Buyers" subtitle="Rice mills, feed mills, traders and other buyers" orderBy="name"
      searchText={(r) => `${r.name} ${r.company ?? ''}`}
      fields={[
        { key: 'name', label: 'Contact name', required: true },
        { key: 'company', label: 'Company / Mill' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' },
        { key: 'active', label: 'Active', type: 'checkbox', default: true },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
        { label: 'Company', render: (r) => r.company ?? '—' },
        { label: 'Phone', render: (r) => r.phone ?? '—' },
        { label: 'Address', render: (r) => r.address ?? '—' },
        { label: 'Status', render: (r) => (r.active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>) },
      ]}
    />
  );
}
