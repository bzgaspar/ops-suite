'use client';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import { fmtDate, money, n, today } from '@/lib/format';
import type { Commodity } from '@/lib/types';

export type Side = 'buy' | 'sell';
export interface PriceInfo {
  last: number;
  lastDate: string;
  todayMin: number | null;
  todayMax: number | null;
  todayCount: number;
}

/**
 * Prices actually used on recent purchases (buy) or sales (sell), per commodity.
 * Prices move with the market, so new forms start from the last price used, not a fixed list price.
 */
export function useRecentPrices(side: Side) {
  return useLoad(async () => {
    const db = supabaseBrowser();
    const dateCol = side === 'buy' ? 'purchase_date' : 'sale_date';
    const rows = must(await db.from(side === 'buy' ? 'grain_purchases' : 'grain_sales')
      .select(`commodity_id, price_per_kg, ${dateCol}`)
      .order(dateCol, { ascending: false }).order('created_at', { ascending: false })
      .limit(500)) as unknown as Record<string, string | number>[];

    const t = today();
    const map = new Map<string, PriceInfo>();
    for (const r of rows) {
      const id = String(r.commodity_id), price = n(r.price_per_kg), date = String(r[dateCol]);
      let info = map.get(id);
      if (!info) { info = { last: price, lastDate: date, todayMin: null, todayMax: null, todayCount: 0 }; map.set(id, info); }
      if (date === t) {
        info.todayMin = info.todayMin == null ? price : Math.min(info.todayMin, price);
        info.todayMax = info.todayMax == null ? price : Math.max(info.todayMax, price);
        info.todayCount++;
      }
    }
    return map;
  }, [side], `grain:prices:${side}`);
}

/** Starting price for a new transaction: last price used, else the commodity's reference price. */
export function startingPrice(side: Side, c: Commodity | undefined, prices: Map<string, PriceInfo> | null | undefined): string {
  if (!c) return '';
  const last = prices?.get(c.id)?.last;
  return String(last ?? (side === 'buy' ? c.buy_price : c.sell_price));
}

/** Small line under the price field: last price, today's range, and one-click fill buttons. */
export function PriceHint({ side, commodity, prices, current, onPick }: {
  side: Side; commodity: Commodity | undefined; prices: Map<string, PriceInfo> | null | undefined;
  current: string; onPick: (price: string) => void;
}) {
  if (!commodity) return null;
  const info = prices?.get(commodity.id);
  const ref = n(side === 'buy' ? commodity.buy_price : commodity.sell_price);
  const chip = (label: string, value: number) => (
    <button type="button" onClick={() => onPick(String(value))}
      className={`px-1.5 py-0.5 rounded border text-[11px] ${n(current) === value ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
      {label} {money(value)}
    </button>
  );
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
      {info ? chip(`Last (${fmtDate(info.lastDate, 'MMM d')})`, info.last) : <span>No {side === 'buy' ? 'purchases' : 'sales'} yet ·</span>}
      {ref > 0 && (!info || info.last !== ref) && chip('Reference', ref)}
      {info?.todayCount ? (
        <span>Today {info.todayMin === info.todayMax ? money(info.todayMin) : `${money(info.todayMin)}–${money(info.todayMax)}`} ({info.todayCount})</span>
      ) : null}
    </div>
  );
}
