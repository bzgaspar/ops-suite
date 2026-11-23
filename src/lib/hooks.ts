'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from './notify';

// In-memory cache for useLoad (per browser tab). Cleared on sign-out.
const cache = new Map<string, unknown>();
export const clearLoadCache = () => cache.clear();

/**
 * Load data on mount (and when deps change). Returns data + a reload function.
 * Pass a `key` to cache results: revisiting a page shows the last data instantly
 * and refreshes it in the background (no spinner).
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], key?: string) {
  const cacheKey = key ? `${key}|${JSON.stringify(deps)}` : null;
  const cached = cacheKey && cache.has(cacheKey) ? (cache.get(cacheKey) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const keyRef = useRef(cacheKey);
  keyRef.current = cacheKey;

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const k = keyRef.current;
    try {
      const result = await fnRef.current();
      if (k) cache.set(k, result);
      if (k === keyRef.current) setData(result); // ignore responses for stale deps
    } catch (e) {
      notify.error(e, 'Could not load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const hit = keyRef.current && cache.has(keyRef.current);
    if (hit) setData(cache.get(keyRef.current!) as T);
    reload(!!hit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reloadLoud = useCallback(() => reload(), [reload]);
  return { data, loading, reload: reloadLoud, setData };
}

/** Throw Supabase errors (keeping code/details so notify can explain them). */
export function must<T>(res: { data: T | null; error: { message: string; code?: string; details?: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), res.error);
  return res.data as T;
}
