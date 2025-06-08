
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
import { useAuth } from "@/contexts/auth-context";
import { auth } from "@/lib/firebase"; // Import Firebase auth
import { signInWithEmailAndPassword, User as FirebaseUser } from "firebase/auth"; // Import signIn and FirebaseUser type

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export function LoginForm() {
  const { login: contextLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("LoginForm onSubmit with Firebase integration:", values);
    setIsLoading(true);

    if (!auth) {
      toast({
        title: "Error",
        description: "Firebase authentication is not initialized. Please try again later.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser: FirebaseUser = userCredential.user;

      // For now, we use simplified login context.
      // In a real app, you'd fetch user details (role, name) from Firestore here based on firebaseUser.uid
      // and then call contextLogin.
      // For demo, assuming passenger role if not specified elsewhere.
      // The AuthContext is simplified and doesn't handle Firestore fetching on login right now.
      
      // This is a placeholder - we'll need to fetch the actual role from Firestore.
      // For now, let's assume a default role or try to get it from the user object if available (though typically not directly on FirebaseUser).
      // The AuthContext's login function needs to be updated to handle this properly later.
      
      // For now, let's provide basic info and a default role if not fetched.
      // The AuthContext will need to be enhanced to fetch full user profile from Firestore.
      
      // Placeholder: In a real app, fetch user's role and full name from your Firestore 'users' collection
      // using firebaseUser.uid. For now, using email as name and 'passenger' as default role.
      // This will be updated when we implement Firestore user profile fetching in AuthContext.
      contextLogin(
        firebaseUser.uid, 
        firebaseUser.email || values.email, 
        firebaseUser.displayName || values.email.split('@')[0], // Use displayName or derive from email
        'passenger' // Placeholder role, should be fetched from Firestore
        // Add other fields if your contextLogin expects them, e.g., vehicleCategory, phoneNumber etc.
      );

      toast({
        title: "Login Successful!",
        description: `Welcome back, ${firebaseUser.displayName || values.email.split('@')[0]}!`,
      });
      // No form.reset() here, as the page will redirect via AuthContext

    } catch (error: any) {
      console.error("Firebase login error:", error);
      let errorMessage = "Failed to log in. Please check your credentials.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential': // Covers both wrong email and password in newer SDKs
            errorMessage = "Invalid email or password. Please try again.";
            break;
          case 'auth/invalid-email':
            errorMessage = "The email address is not valid.";
            break;
          case 'auth/user-disabled':
            errorMessage = "This user account has been disabled.";
            break;
          default:
            errorMessage = `Login error: ${error.message}`;
        }
      }
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
