
import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind
// import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { ThemeInitializer } from '@/components/theme-provider';

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeInitializer>
          {/* <AuthProvider> */}
            {children}
            <Toaster />
          {/* </AuthProvider> */}
        </ThemeInitializer>
      </body>
    </html>
  );
}
