'use client';
import CrudPage from '@/components/shared/CrudPage';
import { Badge } from '@/components/ui';
import { money } from '@/lib/format';
import type { Commodity } from '@/lib/types';

export default function CommoditiesPage() {
  return (
    <CrudPage<Commodity>
      table="grain_commodities" title="Commodities & Prices" subtitle="Update today's buying and selling price per kg — new transactions use these as defaults" orderBy="name"
      fields={[
        { key: 'name', label: 'Name', required: true, hint: 'e.g. Palay - Dry (RC222), Yellow Corn - Wet' },
        { key: 'kind', label: 'Kind', type: 'select', required: true, default: 'palay', options: [{ value: 'palay', label: 'Palay' }, { value: 'corn', label: 'Corn' }, { value: 'other', label: 'Other' }] },
        { key: 'buy_price', label: 'Buying price / kg (₱)', type: 'number', required: true },
        { key: 'sell_price', label: 'Selling price / kg (₱)', type: 'number', required: true },
        { key: 'active', label: 'Active', type: 'checkbox', default: true },
      ]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
        { label: 'Kind', render: (r) => <Badge tone={r.kind === 'palay' ? 'green' : r.kind === 'corn' ? 'amber' : 'slate'}>{r.kind}</Badge> },
        { label: 'Buy / kg', right: true, render: (r) => money(r.buy_price) },
        { label: 'Sell / kg', right: true, render: (r) => money(r.sell_price) },
        { label: 'Margin / kg', right: true, render: (r) => money(Number(r.sell_price) - Number(r.buy_price)) },
        { label: 'Status', render: (r) => (r.active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>) },
      ]}
    />
  );
}
