
import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  console.log("Minimal MarketingLayout rendering...");
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 bg-card border-b">
        <h1 className="text-lg font-semibold text-primary">Minimal Marketing Header</h1>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="p-4 bg-card border-t mt-auto">
        <p className="text-center text-sm text-muted-foreground">Minimal Marketing Footer</p>
      </footer>
    </div>
  );
}
