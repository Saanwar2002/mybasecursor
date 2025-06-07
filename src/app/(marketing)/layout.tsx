
import type { ReactNode } from 'react';
// import { PublicHeader } from '@/components/layout/public-header'; // Temporarily commented out
// import { PublicFooter } from '@/components/layout/public-footer'; // Temporarily commented out

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* <PublicHeader /> */}
      <main className="flex-grow container mx-auto px-4 py-8 flex justify-center items-center"> {/* Added flex for centering */}
        {children}
      </main>
      {/* <PublicFooter /> */}
    </div>
  );
}
