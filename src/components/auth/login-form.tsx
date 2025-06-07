
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LoginForm() {
  const [buttonClickMessage, setButtonClickMessage] = useState("Button not clicked yet.");

  useEffect(() => {
    alert('LoginForm component has mounted!');
    console.log('LoginForm component has mounted! (console)');
  }, []);

  const handleTestButtonClick = () => {
    setButtonClickMessage("Minimal HTML button was clicked!");
    console.log('Minimal HTML button was clicked! (console log)');
  };

  return (
    <>
      <div style={{ padding: '20px', border: '2px solid red', margin: '20px' }}>
        <h1>Minimal Test Page</h1>
        <p>If you see this, React is rendering.</p>
        <p>Status: <span id="button-status" style={{ fontWeight: 'bold' }}>{buttonClickMessage}</span></p>
        <button
          onClick={handleTestButtonClick}
          style={{
            padding: '25px 40px', // Increased padding for larger size
            fontSize: '20px',     // Increased font size
            margin: '15px',        // Increased margin
            border: '2px solid darkblue',
            backgroundColor: 'tomato', // Distinct color
            color: 'white',
            borderRadius: '8px',
            fontWeight: 'bold',
            zIndex: 99999,
            position: 'relative',
            pointerEvents: 'auto',
            minWidth: '200px', // Ensure it's wide enough
            minHeight: '80px', // Ensure it's tall enough
            display: 'block', // Make it a block to control width/height more easily
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Test VERY LARGE Button
        </button>
        <p style={{textAlign: 'center', marginTop: '10px'}}>
          <Link href="/register" style={{color: 'blue', textDecoration: 'underline', fontSize: '18px'}}>Go to Register Page (Test Link)</Link>
        </p>
      </div>
    </>
  );
}
