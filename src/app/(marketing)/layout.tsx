import type { ReactNode } from 'react';
// import { PublicHeader } from '@/components/layout/public-header'; // Still commented out
// import { PublicFooter } from '@/components/layout/public-footer'; // Still commented out

export default function MarketingLayout({ children }: { children: ReactNode }) {
  // console.log("MarketingLayout rendering (ULTRA-SIMPLIFIED for manifest debug)..."); // Removed
  return (
    <div style={{ border: '5px solid red', padding: '10px', margin: '10px' }}>
      <h1 style={{ fontSize: '24px', color: 'red', fontWeight: 'bold' }}>ULTRA-SIMPLIFIED MARKETING LAYOUT</h1>
      {/* <PublicHeader /> */}
      {children}
      {/* <PublicFooter /> */}
    </div>
  );
}
