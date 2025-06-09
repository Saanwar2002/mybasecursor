import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  console.log("MARKETING GROUP LAYOUT (src/app/(marketing)/layout.tsx) IS PROCESSING. This should appear if you navigate to /test-marketing-layout.");
  return (
    <div style={{ border: '5px solid red', padding: '10px', margin: '10px' }}>
      <h1 style={{ fontSize: '24px', color: 'red', fontWeight: 'bold' }}>ULTRA-SIMPLIFIED MARKETING LAYOUT</h1>
      {children}
    </div>
  );
}
