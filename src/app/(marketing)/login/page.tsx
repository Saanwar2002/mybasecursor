
"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
// LoginForm import is still commented out
// import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [pageButtonClickMessage, setPageButtonClickMessage] = useState("Page Button not clicked yet.");

  useEffect(() => {
    alert('LoginPage component has mounted!'); // This should still show
    // console.log('LoginPage component has mounted! (console)'); // Temporarily disable for cleaner alert testing

    const testButton = document.getElementById('pageLevelTestButton');
    const statusElement = document.getElementById('buttonStatus'); // Get the status element

    if (testButton && statusElement) { // Ensure both elements are found
      const handleClick = () => {
        console.log('Manual event listener (direct DOM manipulation) triggered!'); // Log first
        // Direct DOM manipulation
        statusElement.innerText = "Page Status: Page-level HTML button (manual listener) was clicked! (Direct DOM)";
        // NO ALERT FROM BUTTON CLICK - text change is the feedback
      };
      testButton.addEventListener('click', handleClick);
      alert('DEBUG: Event listener ATTACHED to pageLevelTestButton!'); // Alert to confirm listener attachment
      // console.log('Manual event listener (direct DOM) attached to pageLevelTestButton'); // Temporarily disable

      // Cleanup function to remove the event listener when the component unmounts
      return () => {
        if (testButton) { // Check if testButton still exists
            testButton.removeEventListener('click', handleClick);
            // console.log('Manual event listener (direct DOM) removed from pageLevelTestButton'); // Temporarily disable
        }
      };
    } else {
      let notFoundMessage = "DEBUG ERROR: ";
      if (!testButton) notFoundMessage += "Test button ('pageLevelTestButton') NOT FOUND. ";
      if (!statusElement) notFoundMessage += "Status element ('buttonStatus') NOT FOUND.";
      alert(notFoundMessage.trim()); // Alert if elements are not found
      // console.error('Test button or status element not found in DOM for manual listener attachment (direct DOM test).'); // Temporarily disable
    }
  }, []); // Empty dependency array, runs once on mount

  return (
    <div className="flex flex-col justify-center items-center py-12">
      {/* The Card for LoginForm is still here but LoginForm itself is commented out */}
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
        {/* The text of this paragraph will be updated by direct DOM manipulation or React state */}
        <p id="buttonStatus" style={{ fontWeight: 'bold', margin: '10px 0', color: 'darkblue' }}>
          Page Status: {pageButtonClickMessage}
        </p>
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
