import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'QueryPerf | Static Analysis for AI-Generated DB Code',
  description: 'Catch structural database performance bugs (N+1 queries, missing indexes) in your AI-generated Prisma + PostgreSQL code before they reach production.',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: 'QueryPerf - Terminal Precision DB Audits',
    description: 'Intercept bad AI-generated database code at the moment it\'s written.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QueryPerf Open Graph Image',
      },
    ],
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}