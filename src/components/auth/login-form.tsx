
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); 
    setIsLoading(true);
    // This alert won't show, but keeping logic for future
    // alert("Basic HTML form onSubmit CALLED!"); 
    toast({
      title: "Login Attempt (Test)",
      description: "This is a basic HTML form submission test. No actual login.",
      duration: 5000,
    });
    setTimeout(() => setIsLoading(false), 1500);
  };

  const handleButtonClick = () => {
    console.log("Button onClick JavaScript EXECUTED (for text change and style)!");
    const testButton = document.getElementById("test-interaction-button");
    const statusSpan = document.getElementById("click-status-span");

    if (testButton) {
      // This part works (background color change)
      testButton.style.backgroundColor = "lightgreen"; 
      // This part did not work (innerText on button itself)
      // testButton.innerText = "CLICKED!";
    } else {
      console.error("Test button not found by ID.");
    }

    if (statusSpan) {
      statusSpan.innerText = "Button was clicked! Span updated.";
      statusSpan.style.color = "green";
      statusSpan.style.fontWeight = "bold";
    } else {
      console.error("Status span not found by ID.");
    }

    // This part also does not seem to work (toast)
    toast({
      title: "Button Clicked (Test)",
      description: "The type='button' onClick handler fired. Span text should change.",
      duration: 3000,
    });
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email-basic">Email</Label>
        <Input
          id="email-basic"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-basic">Password</Label>
        <Input
          id="password-basic"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>
      
      <button
        id="test-interaction-button"
        type="button" // Important: not type="submit" for this test
        onClick={handleButtonClick}
        disabled={isLoading}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center h-10 px-4 py-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        style={{ backgroundColor: 'hsl(var(--primary))' }}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Test Button (Click Me)
      </button>

      <div className="text-center mt-4">
        <span id="click-status-span" style={{ color: 'red' }}>Status: Button not clicked yet.</span>
      </div>

      <div className="text-sm text-center">
        <Link href="/forgot-password" prefetch={false} className="underline text-muted-foreground hover:text-primary">
          Forgot your password?
        </Link>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" prefetch={false} className="underline text-accent hover:text-accent/90">
          Sign up
        </Link>
      </p>
    </form>
  );
}

    