
"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // This is the ONLY JavaScript that should run after the component attempts to mount.
    alert('LoginPage Minimal Mount Test: Component Mounted');
    console.log('LoginPage Minimal Mount Test: Component Mounted (console)');
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div style={{ padding: '50px', textAlign: 'center', border: '5px solid orange', backgroundColor: 'lightyellow' }}>
      <h1>Login Page - MINIMAL TEST</h1>
      <p>If you see this text and an alert box saying "LoginPage Minimal Mount Test: Component Mounted", then the basic page component is working.</p>
      <p>If the alert does NOT appear, there is a problem preventing this component from mounting or running its useEffect hook.</p>
    </div>
  );
}
