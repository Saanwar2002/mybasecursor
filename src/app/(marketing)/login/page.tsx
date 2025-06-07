
"use client";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [statusMessage, setStatusMessage] = useState("INITIAL: useState is working, useEffect pending.");
  const [statusColor, setStatusColor] = useState("red");
  const [statusWeight, setStatusWeight] = useState("normal");

  useEffect(() => {
    // This is the ONLY JavaScript that should run after the component attempts to mount.
    // alert('LoginPage Minimal Mount Test: Component Mounted'); // Removed alert
    console.log('LoginPage Minimal Mount Test: Component Mounted (console). Attempting to setStatusMessage.');
    setStatusMessage('SUCCESS: useEffect ran and called setStatusMessage!');
    setStatusColor('green');
    setStatusWeight('bold');
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div style={{ padding: '50px', textAlign: 'center', border: '5px solid orange', backgroundColor: 'lightyellow' }}>
      <h1>Login Page - MINIMAL TEST</h1>
      <p>If you see this, the basic page component is rendering.</p>
      <p 
        id="mountStatus" 
        style={{
          color: statusColor, 
          border: '1px dashed red', 
          padding: '10px', 
          fontWeight: statusWeight as 'normal' | 'bold' // Cast to type
        }}
      >
        {statusMessage}
      </p>
      <p>If the text above changes to green and says "SUCCESS...", then useEffect and useState are working.</p>
    </div>
  );
}
