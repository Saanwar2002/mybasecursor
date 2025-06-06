
import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind

// Temporarily remove Metadata to reduce complexity
// export const metadata: Metadata = {
//   title: 'Link Cabs',
//   description: 'Your reliable cab booking service.',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Font links temporarily removed for debugging */}
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
