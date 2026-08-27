/**
 * The entry point. Wraps every page in the app.
 *
 * This project is the website only — landing page and dashboard. It holds no
 * business logic: no database, no vendor keys, no pricing. All of that lives in
 * the backend (`../backend`, entry point `src/main.ts`), which this reaches over
 * HTTP through `lib/api.ts`.
 *
 * Routing is by folder: `app/page.tsx` is `/`, `app/studio/page.tsx` is
 * `/studio`, and so on. There is no route table to keep in step.
 */
import './globals.css';
import type { ReactNode } from 'react';
import Connection from '@/components/Connection';

export const metadata = {
  title: 'Meerah',
  description: 'AI video and content for Nigerian creators. Pay in Naira, credits never expire.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Meerah', statusBarStyle: 'black-translucent' as const },
};

export const viewport = {
  themeColor: '#131A3A',
  // Installed apps sit under the notch; this keeps content clear of it.
  viewportFit: 'cover' as const,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <Connection />
      </body>
    </html>
  );
}
