'use client';
import ErrorView from '@/components/layout/ErrorView';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="min-h-screen bg-slate-50"><ErrorView {...props} /></div>;
}
