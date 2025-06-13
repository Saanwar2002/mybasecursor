
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form"; 
import { LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <LogIn className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-headline">Welcome Back to MyBase</CardTitle>
          <CardDescription>Log in to access your account and continue your journey.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
