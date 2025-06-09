
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Mail className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-headline">Simple Forgot Password</CardTitle>
          <CardDescription>
            This is a test to see if the forgot-password route works.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p>If you see this, the /forgot-password route is loading!</p>
            <Button asChild variant="link" className="mt-4">
                <Link href="/login">Back to Login</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
