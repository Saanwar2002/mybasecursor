"use client";

import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-background marketing-layout-test">
      <p style={{ fontSize: '24px', color: 'red', fontWeight: 'bold', border: '2px solid red', padding: '10px' }}>MARKETING LAYOUT START</p>
      <PublicHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>
      <PublicFooter />
      <p style={{ fontSize: '24px', color: 'red', fontWeight: 'bold', border: '2px solid red', padding: '10px' }}>MARKETING LAYOUT END</p>
    </div>
  );
}
