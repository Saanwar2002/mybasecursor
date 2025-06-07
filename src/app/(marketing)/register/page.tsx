
"use client"; // Add this line

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/register-form";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="flex justify-center items-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
           <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <UserPlus className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-headline">Create your MyBase Account</CardTitle> {/* Updated App Name */}
          <CardDescription>Join us today! Choose your role and fill in your details.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}
