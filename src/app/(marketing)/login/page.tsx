
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";
// LoginForm is still commented out as per previous steps
// import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  // State for the message is no longer used by the button's test click,
  // but we'll keep it to show the initial text.
  const [pageButtonClickMessage, setPageButtonClickMessage] = useState("Page Button not clicked yet.");

  useEffect(() => {
    alert('LoginPage component has mounted!'); // This alert confirms useEffect runs
    console.log('LoginPage component has mounted! (console)');

    const testButton = document.getElementById('pageLevelTestButton');
    if (testButton) {
      const handleClick = () => {
        console.log('Manual event listener (direct DOM manipulation) triggered!'); // Log first
        const statusElement = document.getElementById('buttonStatus');
        if (statusElement) {
          // Direct DOM manipulation
          statusElement.innerText = "Page Status: Page-level HTML button (manual listener) was clicked! (Direct DOM)";
        } else {
          console.error('Status element not found for direct DOM manipulation.');
        }
      };
      testButton.addEventListener('click', handleClick);
      console.log('Manual event listener (direct DOM) attached to pageLevelTestButton');

      return () => {
        if (testButton) {
            testButton.removeEventListener('click', handleClick);
            console.log('Manual event listener (direct DOM) removed from pageLevelTestButton');
        }
      };
    } else {
      console.error('Test button not found in DOM for manual listener attachment (direct DOM test).');
    }
  }, []);

  return (
    <div className="flex flex-col justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-xl mb-6">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <LogIn className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-headline">Welcome Back</CardTitle>
          <CardDescription>Log in to access your MyBase account.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* <LoginForm /> */}
          <p className="text-center text-sm text-muted-foreground">
            (LoginForm component temporarily removed for testing)
          </p>
        </CardContent>
      </Card>

      <div style={{ padding: '20px', border: '2px solid crimson', margin: '20px', backgroundColor: '#fff0f0', width: '100%', maxWidth: '450px', textAlign: 'center' }}>
        <h3>Page-Level Test Area</h3>
        {/* The text of this paragraph will be updated by direct DOM manipulation */}
        <p id="buttonStatus">Page Status: {pageButtonClickMessage}</p>
        <button
          id="pageLevelTestButton"
          style={{
            padding: '15px 25px',
            fontSize: '18px',
            margin: '10px auto',
            border: '2px solid darkred',
            backgroundColor: 'salmon',
            color: 'white',
            borderRadius: '8px',
            display: 'block',
          }}
        >
          Test Page-Level Button (Manual Listener)
        </button>
        <p style={{textAlign: 'center', marginTop: '10px'}}>
          <Link href="/register" style={{color: 'crimson', textDecoration: 'underline', fontSize: '16px'}}>Go to Register Page (Page-Level Link)</Link>
        </p>
      </div>
    </div>
  );
}
