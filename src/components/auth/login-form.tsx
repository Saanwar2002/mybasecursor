
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
import { Loader2, User as UserIcon, Car as CarIcon, Briefcase as BriefcaseIcon, Shield as ShieldIcon, LogIn } from "lucide-react";
import React, { useState } from "react";
import { useAuth, UserRole } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }), // Min 1 for quick testing, ideally 6+
});

export function LoginForm() {
  const { loginWithEmail, loginAsGuest, loading: authLoading } = useAuth(); // Renamed loading to authLoading
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("LoginForm onSubmit with Firebase integration:", values);
    setIsSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password);
      // Success toast and redirection are handled by AuthContext
    } catch (error) {
      // Error toast is handled by AuthContext's loginWithEmail
      console.error("LoginForm direct catch (should be rare if AuthContext handles well):", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGuestLogin = async (role: UserRole) => {
    setIsSubmitting(true);
    try {
      await loginAsGuest(role);
    } catch (error) {
      toast({ title: "Guest Login Error", description: "Could not log in as guest.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <>
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

      <Separator className="my-6" />

      <div className="space-y-3">
        <h3 className="text-center text-sm font-medium text-muted-foreground">
          Or log in as a Guest (Development)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('passenger')} disabled={isLoading}>
            <UserIcon className="mr-2 h-4 w-4" /> Passenger
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('driver')} disabled={isLoading}>
            <CarIcon className="mr-2 h-4 w-4" /> Driver
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('operator')} disabled={isLoading}>
            <BriefcaseIcon className="mr-2 h-4 w-4" /> Operator
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('admin')} disabled={isLoading}>
            <ShieldIcon className="mr-2 h-4 w-4" /> Admin
          </Button>
        </div>
      </div>
    </>
  );
}
