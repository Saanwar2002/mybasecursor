
"use client";

import Link from "next/link";
import { useEffect } from "react";

export function LoginForm() {
  useEffect(() => {
    alert('LoginForm component has mounted!');
    console.log('LoginForm component has mounted! (console)');
  }, []);

  return (
    <>
      <div style={{ padding: '20px', border: '2px solid red', margin: '20px' }}>
        <h1>Minimal Test Page</h1>
        <p>If you see this, React is rendering.</p>
        <button
          onClick={() => alert('Minimal HTML button clicked!')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            margin: '10px',
            border: '1px solid blue',
            backgroundColor: 'red', // Made it red for high visibility
            color: 'white',
            zIndex: 99999, // Very high z-index
            position: 'relative', // Needed for z-index to work reliably on non-positioned elements
            pointerEvents: 'auto', // Explicitly set pointer-events
          }}
        >
          Test Basic HTML Button
        </button>
        <p>
          <Link href="/register" style={{color: 'blue', textDecoration: 'underline'}}>Go to Register Page (Test Link)</Link>
        </p>
      </div>
    </>
  );
}
