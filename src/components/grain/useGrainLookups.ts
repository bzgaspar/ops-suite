'use client';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import type { Buyer, Commodity, Farmer } from '@/lib/types';

export function useGrainLookups() {
  return useLoad(async () => {
    const db = supabaseBrowser();
    const [commodities, farmers, buyers] = await Promise.all([
      db.from('grain_commodities').select('*').order('name').then(must),
      db.from('grain_farmers').select('*').order('name').then(must),
      db.from('grain_buyers').select('*').order('name').then(must),
    ]);
    return { commodities: commodities as Commodity[], farmers: farmers as Farmer[], buyers: buyers as Buyer[] };
  });
}

/** Weight lost when drying grain from `moisture`% down to the 14% standard. */
export function moistureShrinkKg(weightKg: number, moisture: number, standard = 14) {
  if (!(moisture > standard) || weightKg <= 0) return 0;
  return Math.round(weightKg * ((moisture - standard) / (100 - standard)) * 100) / 100;
}
