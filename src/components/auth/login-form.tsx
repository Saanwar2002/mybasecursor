
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export function LoginForm() {
  const [buttonClickMessage, setButtonClickMessage] = useState("Button not clicked yet (from LoginForm).");

  // useEffect(() => {
  //   // Removed alert('LoginForm component has mounted!');
  //   console.log('LoginForm component has mounted! (console)');
  // }, []);

  const handleTestButtonClick = () => {
    setButtonClickMessage("Button inside LoginForm was clicked!");
    console.log('Button inside LoginForm was clicked! (console log)');
  };

  return (
    <>
      <div style={{ padding: '10px', border: '1px dashed green', margin: '5px', backgroundColor: '#f0fff0' }}>
        <h5>LoginForm Component (Simplified)</h5>
        <p>LoginForm Status: <span style={{ fontWeight: 'bold' }}>{buttonClickMessage}</span></p>
        <button
          onClick={handleTestButtonClick}
          style={{
            padding: '8px 12px',
            fontSize: '12px',
            margin: '5px',
            border: '1px solid darkgreen',
            backgroundColor: 'lightgreen',
          }}
        >
          Test Button (in LoginForm)
        </button>
      </div>
    </>
  );
}
