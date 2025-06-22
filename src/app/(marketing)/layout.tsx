import type { ReactNode } from 'react';
import { PublicFooter } from '@/components/layout/public-footer';
import { PublicHeader } from '@/components/layout/public-header';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  // console.log("MARKETING GROUP LAYOUT (src/app/(marketing)/layout.tsx) IS PROCESSING. This should appear if you navigate to /test-marketing-layout.");
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
