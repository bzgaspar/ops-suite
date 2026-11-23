'use client';
import CrudPage from '@/components/shared/CrudPage';
import { Badge } from '@/components/ui';
import { money } from '@/lib/format';
import type { Plan } from '@/lib/types';

export default function PlansPage() {
  return (
    <CrudPage<Plan>
      table="isp_plans" title="Plans" subtitle="Internet packages. Changing a plan price does not change existing customers' monthly fee." orderBy="monthly_fee"
      fields={[
        { key: 'name', label: 'Plan name', required: true },
        { key: 'speed_mbps', label: 'Speed (Mbps)', type: 'number' },
        { key: 'monthly_fee', label: 'Monthly fee (₱)', type: 'number', required: true },
        { key: 'active', label: 'Available for new subscribers', type: 'checkbox', default: true },
      ]}
      columns={[
        { label: 'Plan', render: (r) => <span className="font-medium">{r.name}</span> },
        { label: 'Speed', render: (r) => (r.speed_mbps ? `${r.speed_mbps} Mbps` : '—') },
        { label: 'Monthly', right: true, render: (r) => money(r.monthly_fee) },
        { label: 'Status', render: (r) => (r.active ? <Badge tone="green">active</Badge> : <Badge>retired</Badge>) },
      ]}
    />
  );
}
