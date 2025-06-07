
"use client"; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { LoginForm } from "@/components/auth/login-form"; // LoginForm still commented out
import { LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [pageButtonClickMessage, setPageButtonClickMessage] = useState("Page Button not clicked yet.");

  useEffect(() => {
    alert('LoginPage component has mounted!'); // This alert confirms useEffect runs
    console.log('LoginPage component has mounted! (console)');

    const testButton = document.getElementById('pageLevelTestButton');
    if (testButton) {
      const handleClick = () => {
        setPageButtonClickMessage("Page-level HTML button (manual listener) was clicked!");
        console.log('Page-level HTML button (manual listener) was clicked! (console log)');
        // We can even try a direct DOM manipulation here if setState isn't updating the view
        // const statusElement = document.getElementById('buttonStatus');
        // if (statusElement) statusElement.innerText = "Page-level HTML button (manual listener) was clicked! (Direct DOM)";
      };
      testButton.addEventListener('click', handleClick);
      console.log('Manual event listener attached to pageLevelTestButton');

      // Cleanup the event listener when the component unmounts
      return () => {
        if (testButton) { // Check if testButton still exists before removing listener
            testButton.removeEventListener('click', handleClick);
            console.log('Manual event listener removed from pageLevelTestButton');
        }
      };
    } else {
      console.error('Test button not found in DOM for manual listener attachment.');
    }
  }, []); // Empty dependency array ensures this runs once on mount

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

      {/* Page-level test area */}
      <div style={{ padding: '20px', border: '2px solid crimson', margin: '20px', backgroundColor: '#fff0f0', width: '100%', maxWidth: '450px', textAlign: 'center' }}>
        <h3>Page-Level Test Area</h3>
        <p id="buttonStatus">Page Status: <span style={{ fontWeight: 'bold' }}>{pageButtonClickMessage}</span></p>
        <button
          id="pageLevelTestButton" // Added ID for manual event listener
          // onClick is removed, event listener is attached in useEffect
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
