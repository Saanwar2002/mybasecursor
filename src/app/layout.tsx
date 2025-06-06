
import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind
import { AuthProvider } from '@/contexts/auth-context';
// import { ThemeInitializer } from '@/components/theme-provider'; // Temporarily commented out
// import { Toaster } from "@/components/ui/toaster"; // Temporarily commented out
// AppLayout is NOT used here; it's for the (app) group.

// Assuming PT Sans is the desired font.
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
        {/* <ThemeInitializer> */}
          <AuthProvider>
            {children}
            {/* <Toaster /> */}
          </AuthProvider>
        {/* </ThemeInitializer> */}
      </body>
    </html>
  );
}
