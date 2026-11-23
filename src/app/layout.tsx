import type { Metadata } from 'next';
import AppProviders from '@/components/AppProviders';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpsSuite',
  description: 'Palay/Corn buying station and Internet billing — management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AppProviders />
      </body>
    </html>
  );
}
