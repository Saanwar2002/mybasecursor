import React from 'react';

export default function TestMarketingLayoutPage() {
  console.log("TestMarketingLayoutPage rendering...");
  return (
    <div style={{ border: '5px solid orange', padding: '10px', margin: '10px' }}>
      <h1 style={{ fontSize: '24px', color: 'orange', fontWeight: 'bold' }}>TEST MARKETING LAYOUT PAGE</h1>
      <p>If the RED marketing layout border is visible around this, the layout is working for this specific route.</p>
    </div>
  );
}
