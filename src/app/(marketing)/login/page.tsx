
"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // This is the ONLY JavaScript that should run after the component attempts to mount.
    // alert('LoginPage Minimal Mount Test: Component Mounted'); // Removed alert
    console.log('LoginPage Minimal Mount Test: Component Mounted (console)');
    const statusElement = document.getElementById('mountStatus');
    if (statusElement) {
      statusElement.innerText = 'SUCCESS: useEffect ran and changed this text!';
      statusElement.style.color = 'green';
      statusElement.style.fontWeight = 'bold';
    } else {
      // This alert might also be suppressed, but it's a fallback
      // alert('ERROR: Could not find statusElement to update.');
      console.error('ERROR: Could not find statusElement to update.');
    }
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div style={{ padding: '50px', textAlign: 'center', border: '5px solid orange', backgroundColor: 'lightyellow' }}>
      <h1>Login Page - MINIMAL TEST</h1>
      <p>If you see this, the basic page component is rendering.</p>
      <p id="mountStatus" style={{color: 'red', border: '1px dashed red', padding: '10px'}}>INITIAL: useEffect has not run or failed to change this text.</p>
      <p>If the text above changes to green and says "SUCCESS", then useEffect is working.</p>
    </div>
  );
}
