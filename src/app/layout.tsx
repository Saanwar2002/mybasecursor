
import type { Metadata } from 'next';
// import { AuthProvider } from '@/contexts/auth-context'; // AuthProvider remains commented out
// import { Toaster } from "@/components/ui/toaster"; // Toaster is now commented out
// import { ThemeInitializer } from '@/components/theme-provider'; // ThemeInitializer now commented out
import './globals.css'; // Ensure this is uncommented and present

export const metadata: Metadata = {
  title: 'Link Cabs',
  description: 'Your reliable cab booking service.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        {/* <ThemeInitializer> */}
          {/* <AuthProvider> */}
            {children}
            {/* <Toaster /> */}
          {/* </AuthProvider> */}
        {/* </ThemeInitializer> */}
      </body>
    </html>
  );
}
