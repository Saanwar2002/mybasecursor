
import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/layout/public-header'; 
import { PublicFooter } from '@/components/layout/public-footer'; 

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PublicHeader />
      <main className="flex-grow container mx-auto px-4 pt-2 pb-8 flex justify-center items-center"> {/* Changed pt-4 to pt-2 */}
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

