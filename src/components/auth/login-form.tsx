
"use client";

import Link from "next/link";
import { useEffect, useState } from "react"; // Added useState

export function LoginForm() {
  const [buttonClickMessage, setButtonClickMessage] = useState("Button not clicked yet."); // New state

  useEffect(() => {
    alert('LoginForm component has mounted!');
    console.log('LoginForm component has mounted! (console)');
  }, []);

  const handleTestButtonClick = () => {
    setButtonClickMessage("Minimal HTML button was clicked!");
    // We can also try a console log here for desktop debugging if needed
    console.log('Minimal HTML button was clicked! (console log)');
  };

  return (
    <>
      <div style={{ padding: '20px', border: '2px solid red', margin: '20px' }}>
        <h1>Minimal Test Page</h1>
        <p>If you see this, React is rendering.</p>
        <p>Status: <span id="button-status" style={{ fontWeight: 'bold' }}>{buttonClickMessage}</span></p> {/* Display state */}
        <button
          onClick={handleTestButtonClick} // Call the new handler
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            margin: '10px',
            border: '1px solid blue',
            backgroundColor: 'red', // Keeping it red for visibility
            color: 'white',
            zIndex: 99999, 
            position: 'relative', 
            pointerEvents: 'auto', 
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
