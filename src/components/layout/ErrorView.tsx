'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { friendlyError } from '@/lib/errors';

/** Shown by error.tsx boundaries when a page crashes while rendering. */
export default function ErrorView({ error, reset, home = '/' }: { error: Error & { digest?: string }; reset: () => void; home?: string }) {
  useEffect(() => { console.error(error); }, [error]);
  const reloadNeeded = /new version/.test(friendlyError(error));

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full text-center bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">This page hit a problem</h1>
        <p className="mt-1 text-sm text-slate-600">{friendlyError(error, 'Something unexpected happened.')}</p>
        {error.digest && <p className="mt-2 text-xs text-slate-400 font-mono">Ref: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => (reloadNeeded ? window.location.reload() : reset())}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
            <RotateCcw size={16} /> Try again
          </button>
          <Link href={home} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300">
            <Home size={16} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
