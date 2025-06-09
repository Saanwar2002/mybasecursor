
import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { ThemeInitializer } from '@/components/theme-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  console.log("RootLayout rendering (minimal for 404 debug)...");
  return (
    <html lang="en" suppressHydrationWarning>
      <body> {/* Removed diagnostic border */}
        <ThemeInitializer>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeInitializer>
      </body>
    </html>
  );
}
