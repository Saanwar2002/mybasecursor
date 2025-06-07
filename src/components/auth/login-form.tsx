
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
// Removed: import { useAuth } from "@/contexts/auth-context"; // Not used in this restored basic version yet

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }), // Min 1 to allow submission for basic testing
});

export function LoginForm() {
  // const { login } = useAuth(); // Not used yet
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // This is where actual login logic would go
    console.log("LoginForm onSubmit (Restored):", values);
    setIsLoading(true);
    toast({
      title: "Login Attempted (Restored Form)",
      description: `Email: ${values.email}. (Actual login not implemented yet).`,
    });
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      // Example: For now, let's assume login fails or is just a test
      // In a real scenario:
      // try {
      //   await firebaseLoginFunction(values.email, values.password);
      //   contextLogin(userId, email, name, role, ...); // Call context login
      // } catch (error) {
      //   toast({ title: "Login Failed", description: error.message, variant: "destructive"});
      // }
    }, 1500);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="you@example.com" 
                  {...field} 
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  {...field} 
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Log In
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
    </Form>
  );
}
