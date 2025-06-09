"use client"; // Added "use client"

import type { ReactNode } from 'react';

// Simplified layout for debugging 404
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background"> {/* Removed diagnostic border */}
      <header className="py-4 px-6 border-b bg-card shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-lg font-bold text-primary">MyBase (Minimal Header)</div>
          <nav className="flex items-center space-x-4">
            <span className="text-sm">Minimal Nav</span>
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="py-8 px-6 border-t bg-muted/50">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MyBase (Minimal Footer)</p>
        </div>
      </footer>
    </div>
  );
}
