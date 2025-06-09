"use client";
import type { ReactNode } from 'react';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ border: '5px solid orange', padding: '10px', margin: '10px' }}>
      <h1 style={{ fontSize: '24px', color: 'orange', fontWeight: 'bold' }}>ULTRA-SIMPLIFIED MARKETING LAYOUT</h1>
      {children}
    </div>
  );
}
