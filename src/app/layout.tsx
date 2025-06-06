
import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeInitializer } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from '@/components/layout/app-layout'; // Ensure AppLayout is imported if it's used here, or remove if only for (app) group.

// Assuming PT Sans is the desired font.
// You can get these links from Google Fonts.
// Example: <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeInitializer>
          <AuthProvider>
            {/* If AppLayout is meant to wrap all routes, it would go here.
                However, based on typical Next.js (app) router patterns,
                AppLayout is likely in src/app/(app)/layout.tsx.
                If children here are for both marketing and app routes,
                then AppLayout should NOT be here.
                Assuming children can be either marketing or app pages.
            */}
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeInitializer>
      </body>
    </html>
  );
}
