import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-slate-300">404</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <Link href="/" className="mt-5 inline-flex px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">Go home</Link>
      </div>
    </div>
  );
}
