'use client';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { WifiOff } from 'lucide-react';
import { ConfirmHost } from '@/components/ui/Confirm';
import { notify } from '@/lib/notify';

/** Global UI: toasts, confirm dialog, offline banner, and a safety net for unhandled errors. */
export default function AppProviders() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const down = () => setOffline(true);
    const up = () => { setOffline(false); notify.success('Back online'); };

    // Errors thrown in async click handlers never reach an error boundary — show them instead of failing silently.
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      if (r?.name === 'AbortError') return;
      notify.error(r);
    };
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('offline', down);
      window.removeEventListener('online', up);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return (
    <>
      {offline && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 rounded-full bg-slate-900 text-white text-sm px-4 py-2 shadow-lg print-hide">
          <WifiOff size={16} /> You&apos;re offline. Changes won&apos;t save until you reconnect.
        </div>
      )}
      <ConfirmHost />
      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 3000,
          className: 'text-sm',
          style: { borderRadius: '10px', padding: '10px 14px', maxWidth: 420 },
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error: { duration: 6000, iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />
    </>
  );
}
