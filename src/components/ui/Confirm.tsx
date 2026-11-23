'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Button from './Button';

export interface AskOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
type Pending = AskOptions & { message: string; resolve: (ok: boolean) => void };

let open: ((p: Pending) => void) | null = null;

/**
 * Styled replacement for window.confirm. `await ask('Delete this?')` → true/false.
 * Destructive wording (delete/void/remove/disconnect) gets a red button automatically.
 */
export function ask(message: string, opts: AskOptions = {}): Promise<boolean> {
  if (!open) return Promise.resolve(window.confirm(message)); // host not mounted (shouldn't happen)
  return new Promise((resolve) => open!({ message, ...opts, resolve }));
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    open = setP;
    return () => { open = null; };
  }, []);

  const close = (ok: boolean) => { p?.resolve(ok); setP(null); };

  useEffect(() => {
    if (!p) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  if (!p) return null;
  const danger = p.danger ?? /\b(delete|void|remove|disconnect)/i.test(p.message);
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => close(false)} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="font-semibold text-slate-900">{p.title ?? (danger ? 'Are you sure?' : 'Please confirm')}</h2>
            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{p.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>{p.cancelLabel ?? 'Cancel'}</Button>
          <Button ref={okRef} variant={danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {p.confirmLabel ?? (/\b(delete|void|remove)/i.test(p.message) ? 'Delete' : danger ? 'Continue' : 'Confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
