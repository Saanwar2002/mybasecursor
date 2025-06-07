
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

  // This function should NOT be called if the button is type="button"
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Still good practice to have it
    setIsLoading(true);
    console.log("Basic HTML form onSubmit CALLED! Values:", { email, password });

    toast({
      title: "Form Submit Attempt (Test)",
      description: "This is a basic HTML form submission test. No actual login.",
      duration: 5000,
    });

    setTimeout(() => {
      setIsLoading(false);
      console.log("isLoading set to false after timeout.");
    }, 1500);
  };

  const handleButtonClick = () => {
    console.log("Button onClick JavaScript EXECUTED!");
    const testButton = document.getElementById("test-interaction-button");
    if (testButton) {
      testButton.innerText = "CLICKED!";
      testButton.style.backgroundColor = "lightgreen"; // Visual feedback
    } else {
      console.error("Test button not found by ID.");
    }

    toast({
      title: "Button Clicked (Test)",
      description: "The type='button' onClick handler fired. Button text should change.",
      duration: 3000,
    });
    // No state update for isLoading here for this specific test
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
      {/* Basic HTML button with type="button" and direct onClick */}
      <button
        id="test-interaction-button"
        type="button"
        onClick={handleButtonClick}
        disabled={isLoading}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center h-10 px-4 py-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        style={{ backgroundColor: 'hsl(var(--primary))' }} // Ensure initial color is set
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Test Button (Click Me)
      </button>
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
