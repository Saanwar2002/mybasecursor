
import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/layout/public-header'; 
import { PublicFooter } from '@/components/layout/public-footer'; 

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PublicHeader />
      <main className="flex-grow container mx-auto px-4 pt-8 pb-8 flex flex-col items-center"> {/* Changed pt-0 to pt-8 and justify-center to flex-col items-center */}
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
