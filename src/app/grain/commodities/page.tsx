'use client';
import CrudPage from '@/components/shared/CrudPage';
import { Badge } from '@/components/ui';
import { fmtDate, money } from '@/lib/format';
import { useRecentPrices, type PriceInfo } from '@/components/grain/prices';
import type { Commodity } from '@/lib/types';

function Last({ info }: { info: PriceInfo | undefined }) {
  if (!info) return <span className="text-slate-400">—</span>;
  return <span>{money(info.last)} <span className="text-xs text-slate-400">{fmtDate(info.lastDate, 'MMM d')}</span></span>;
}

export default function CommoditiesPage() {
  const { data: buy } = useRecentPrices('buy');
  const { data: sell } = useRecentPrices('sell');
  return (
    <CrudPage<Commodity>
      table="grain_commodities" title="Commodities & Prices" subtitle="Prices change every buy and sell. Each transaction keeps its own price; new forms start from the last price used. The reference price is only a fallback for a commodity with no transactions yet." orderBy="name"
      fields={[
        { key: 'name', label: 'Name', required: true, hint: 'e.g. Palay - Dry (RC222), Yellow Corn - Wet' },
        { key: 'kind', label: 'Kind', type: 'select', required: true, default: 'palay', options: [{ value: 'palay', label: 'Palay' }, { value: 'corn', label: 'Corn' }, { value: 'other', label: 'Other' }] },
        { key: 'buy_price', label: 'Reference buying price / kg (₱)', type: 'number', required: true },
        { key: 'sell_price', label: 'Reference selling price / kg (₱)', type: 'number', required: true },
        { key: 'active', label: 'Active', type: 'checkbox', default: true },
      ]}
      columns={[
        { label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
        { label: 'Kind', render: (r) => <Badge tone={r.kind === 'palay' ? 'green' : r.kind === 'corn' ? 'amber' : 'slate'}>{r.kind}</Badge> },
        { label: 'Last bought at', right: true, render: (r) => <Last info={buy?.get(r.id)} /> },
        { label: 'Last sold at', right: true, render: (r) => <Last info={sell?.get(r.id)} /> },
        { label: 'Margin / kg', right: true, render: (r) => {
          const b = buy?.get(r.id)?.last ?? Number(r.buy_price), s = sell?.get(r.id)?.last ?? Number(r.sell_price);
          return <span className={s - b < 0 ? 'text-red-600' : ''}>{money(s - b)}</span>;
        } },
        { label: 'Reference buy / sell', right: true, render: (r) => <span className="text-slate-500">{money(r.buy_price)} / {money(r.sell_price)}</span> },
        { label: 'Status', render: (r) => (r.active ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>) },
      ]}
    />
  );
}
