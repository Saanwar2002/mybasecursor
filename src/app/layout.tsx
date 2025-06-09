import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind

// Removed AuthProvider, Toaster, ThemeInitializer for extreme debugging

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  console.log("RootLayout rendering (ULTRA-SIMPLIFIED for manifest debug)...");
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ border: '5px solid limegreen', padding: '10px', margin: '10px' }}>
        <div style={{ fontSize: '24px', color: 'limegreen', fontWeight: 'bold', marginBottom: '10px' }}>ULTRA-SIMPLIFIED ROOT LAYOUT START</div>
        {children}
        <div style={{ fontSize: '24px', color: 'limegreen', fontWeight: 'bold', marginTop: '10px' }}>ULTRA-SIMPLIFIED ROOT LAYOUT END</div>
      </body>
    </html>
  );
}
