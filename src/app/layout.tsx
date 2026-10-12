import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'NeuroÉquilibre Centre',
    template: '%s — NeuroÉquilibre',
  },
  description: 'Gestion des clients, du planning et du suivi des séances de neurofeedback.',
  robots: { index: false, follow: false },
  icons: {
    icon: '/neuroequilibre-logo.png',
    apple: '/neuroequilibre-logo.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
