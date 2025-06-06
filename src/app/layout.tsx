
import type { ReactNode } from 'react';
import './globals.css'; // Essential for Tailwind

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
