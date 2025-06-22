import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeInitializer } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { GoogleMapsProvider } from '@/contexts/google-maps/google-maps-provider';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyBase - TaxiNow",
  description: "The all-in-one taxi platform for passengers, drivers, and operators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <GoogleMapsProvider>
            <ThemeInitializer>
              <Toaster />
              {children}
            </ThemeInitializer>
          </GoogleMapsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
