import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeInitializer } from "@/components/theme-provider"; // Corrected to ThemeInitializer
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyBase App",
  description: "The ultimate taxi app solution.",
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
          <ThemeInitializer> {/* Corrected to ThemeInitializer */}
            <Toaster />
            {children}
          </ThemeInitializer>
        </AuthProvider>
      </body>
    </html>
  );
}
