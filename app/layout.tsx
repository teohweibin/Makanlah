import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Makanlah',
  description: 'Know why they stopped coming — before they stop for good.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
