
"use client"; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { LoginForm } from "@/components/auth/login-form"; // Temporarily commented out
import { LogIn } from "lucide-react";
import { useState, useEffect } from "react"; // Added for page-level test
import Link from "next/link"; // Added for page-level test

export default function LoginPage() {
  const [pageButtonClickMessage, setPageButtonClickMessage] = useState("Page Button not clicked yet.");

  useEffect(() => {
    // This alert will confirm if the page itself is running JS correctly
    alert('LoginPage component has mounted!');
    console.log('LoginPage component has mounted! (console)');
  }, []);

  const handlePageTestButtonClick = () => {
    setPageButtonClickMessage("Page-level HTML button was clicked!");
    console.log('Page-level HTML button was clicked! (console log)');
  };

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
      <div style={{ padding: '20px', border: '2px solid crimson', margin: '20px', backgroundColor: '#fff0f0', width: '100%', maxWidth: '450px' }}>
        <h3>Page-Level Test Area</h3>
        <p>Page Status: <span style={{ fontWeight: 'bold' }}>{pageButtonClickMessage}</span></p>
        <button
          onClick={handlePageTestButtonClick}
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
          Test Page-Level Button
        </button>
        <p style={{textAlign: 'center', marginTop: '10px'}}>
          <Link href="/register" style={{color: 'crimson', textDecoration: 'underline', fontSize: '16px'}}>Go to Register Page (Page-Level Link)</Link>
        </p>
      </div>
    </div>
  );
}
