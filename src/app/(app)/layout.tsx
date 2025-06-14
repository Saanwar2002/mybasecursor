
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  // console.log("DEBUG: (app)/layout.tsx is rendering.");
  return (
    <div style={{ border: '5px solid purple', padding: '10px', margin: '2px', minHeight: 'calc(100vh - 4px)' }}>
      <p style={{ color: 'purple', fontWeight: 'bold', fontSize: '10px', position:'fixed', top:'20px', left:'10px', background:'white', zIndex: 10000 }}>
        DEBUG: (app)/layout.tsx (PURPLE BORDER) rendering...
      </p>
      <AppLayout>{children}</AppLayout>
    </div>
  );
}
