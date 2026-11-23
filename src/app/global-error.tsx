'use client';
// Last-resort boundary (root layout crashed). Must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>OpsSuite couldn&apos;t load</h1>
          <p style={{ color: '#475569', fontSize: 14 }}>Check your internet connection, then try again.</p>
          <button onClick={() => reset()} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
