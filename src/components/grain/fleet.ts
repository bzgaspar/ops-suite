'use client';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useLoad, must } from '@/lib/hooks';
import type { Employee, Vehicle, VehicleType } from '@/lib/types';

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'truck', label: 'Truck' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'van', label: 'Van' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'other', label: 'Other' },
];

export const TRIP_EXPENSE_CATEGORIES = ['Fuel', 'Toll & Parking', 'Food / Meals', 'Repairs & Maintenance', 'Other'];

export type Driver = Pick<Employee, 'id' | 'full_name' | 'position' | 'trip_rate' | 'active'>;

const isDriverLike = (e: Driver) => /driver|helper|pahinante|kargador/i.test(e.position ?? '');

/** Vehicles and personnel for trip forms. Drivers/helpers are listed first. Pass false to skip (non-grain pages). */
export function useFleetLookups(enabled = true) {
  return useLoad(async () => {
    if (!enabled) return { vehicles: [] as Vehicle[], drivers: [] as Driver[] };
    const db = supabaseBrowser();
    const [vehicles, people] = await Promise.all([
      db.from('grain_vehicles').select('*').order('plate_no').then(must),
      db.from('grain_employees').select('id, full_name, position, trip_rate, active').order('full_name').then(must),
    ]);
    const drivers = (people as Driver[]).sort((a, b) => Number(isDriverLike(b)) - Number(isDriverLike(a)));
    return { vehicles: vehicles as Vehicle[], drivers };
  }, [enabled], 'grain:fleet');
}

/** Status of a registration / insurance date: expired, due within 30 days, or fine. */
export function expiryStatus(date: string | null) {
  if (!date) return null;
  const days = differenceInCalendarDays(parseISO(date), new Date());
  if (days < 0) return { tone: 'red' as const, label: 'expired', days };
  if (days <= 30) return { tone: 'amber' as const, label: `${days}d left`, days };
  return { tone: 'green' as const, label: 'ok', days };
}
