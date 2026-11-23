'use client';
import CrudPage from '@/components/shared/CrudPage';
import { Badge } from '@/components/ui';
import type { Farmer } from '@/lib/types';

export default function FarmersPage() {
  return (
    <CrudPage<Farmer>
      table="grain_farmers" title="Farmers / Sellers" subtitle="Regular suppliers of palay and corn" orderBy="name"
      searchText={(r) => `${r.name} ${r.address ?? ''} ${r.phone ?? ''}`}
      fields={[
        { key: 'name', label: 'Name', required: true },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address / Barangay', full: true },
        { key: 'active', label: 'Active', type: 'checkbox', default: true },
        { key: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
        { label: 'Phone', render: (r) => r.phone ?? '—' },
        { label: 'Address', render: (r) => r.address ?? '—' },
        { label: 'Status', render: (r) => (r.active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>) },
      ]}
    />
  );
}
