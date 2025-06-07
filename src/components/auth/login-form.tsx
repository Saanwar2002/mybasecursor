
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Shadcn Label for consistency
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";

export function LoginForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleBasicFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    alert("Basic HTML form onSubmit CALLED!"); // Test alert
    event.preventDefault(); // Crucial to prevent page refresh
    setIsLoading(true);
    console.log("Basic HTML Form submitted with values:", { email, password });

    // Simulate API call
    toast({
      title: "Login Attempt (Test)",
      description: "This is a basic HTML form submission test. No actual login.",
      duration: 5000,
    });

    setTimeout(() => {
      setIsLoading(false);
      console.log("Basic HTML Form: isLoading set to false after timeout.");
    }, 1500);
  };

  return (
    <form onSubmit={handleBasicFormSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email-basic">Email</Label>
        <Input
          id="email-basic"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          // Removed 'required'
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
          // Removed 'required'
        />
      </div>
      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log In (Basic Form)
      </Button>
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
