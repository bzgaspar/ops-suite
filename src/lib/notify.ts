'use client';
import toast from 'react-hot-toast';
import { friendlyError, isAuthError } from './errors';

let redirecting = false;
function sessionExpired() {
  if (redirecting) return;
  redirecting = true;
  toast.error('Your session has expired. Please sign in again.', { id: 'session', duration: 4000 });
  setTimeout(() => window.location.assign('/login'), 1500);
}

/** App-wide notifications. Same message shown twice at once is collapsed into one toast. */
export const notify = {
  success: (msg: string) => toast.success(msg, { id: `ok:${msg}` }),
  info: (msg: string) => toast(msg, { id: `info:${msg}`, icon: 'ℹ️' }),
  /** Accepts a string (validation message) or any error object (Supabase, fetch, thrown). */
  error: (e: unknown, fallback?: string) => {
    if (typeof e !== 'string' && isAuthError(e)) return sessionExpired();
    const msg = typeof e === 'string' ? e : friendlyError(e, fallback);
    if (typeof e !== 'string') console.error(e);
    toast.error(msg, { id: `err:${msg}`, duration: 6000 });
  },
};
