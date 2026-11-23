'use client';
import { Loader2, Search, Inbox } from 'lucide-react';
export { default as Button } from './Button';
export { default as Modal } from './Modal';
export { Input, Select, Textarea, Field, inputCls } from './Field';
export { default as Printable } from './Printable';
export { ask } from './Confirm';

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print-hide">{actions}</div>}
    </div>
  );
}

const tones = {
  blue: 'bg-primary-50 text-primary-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  violet: 'bg-violet-50 text-violet-600',
  slate: 'bg-slate-100 text-slate-600',
};
export type Tone = keyof typeof tones;

export function StatCard({ label, value, sub, icon, tone = 'blue' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <div className={`p-2.5 rounded-lg flex-shrink-0 ${tones[tone]}`}>{icon}</div>}
      </div>
    </Card>
  );
}

const badgeTones = {
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-primary-100 text-primary-700',
  slate: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-100 text-violet-700',
};
export function Badge({ tone = 'slate', children }: { tone?: keyof typeof badgeTones; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${badgeTones[tone]}`}>{children}</span>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
      <Loader2 className="animate-spin" size={18} /> {label}
    </div>
  );
}

export function Empty({ text = 'Nothing here yet.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2">
      <Inbox size={28} /> {text}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
    </div>
  );
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const cls = 'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-primary-500 focus:outline-none';
  return (
    <div className="flex items-center gap-2 text-sm">
      <input type="date" value={from} onChange={(e) => onChange(e.target.value, to)} className={cls} aria-label="From" />
      <span className="text-slate-400">to</span>
      <input type="date" value={to} onChange={(e) => onChange(from, e.target.value)} className={cls} aria-label="To" />
    </div>
  );
}

/** Responsive table wrapper: horizontal scroll on phones. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export const th = 'px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 whitespace-nowrap';
export const thR = `${th} text-right`;
export const td = 'px-3 py-2.5 border-b border-slate-100 text-slate-700 whitespace-nowrap';
export const tdR = `${td} text-right tabular-nums`;
