
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
import { useAuth, UserRole } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }), // Min 1 for now, can be increased
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
    setIsLoading(true);
    console.log("Login form submitted with values:", values); // For console debugging

    if (!auth || !db) {
      toast({
        title: "Login Error",
        description: "Firebase services not initialized. Please try again later.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      // Fetch user profile from Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userProfile = userDocSnap.data();
        contextLogin(
          firebaseUser.uid,
          firebaseUser.email || userProfile.email,
          userProfile.name || firebaseUser.displayName,
          userProfile.role || 'passenger', // Default to passenger if role not in profile
          userProfile.vehicleCategory,
          userProfile.phoneNumber || firebaseUser.phoneNumber,
          userProfile.phoneVerified || firebaseUser.phoneNumber ? true : false, // Assume verified if phone exists from Auth
          userProfile.status || 'Active',
          userProfile.phoneVerificationDeadline ? new Date(userProfile.phoneVerificationDeadline.seconds * 1000).toISOString() : null,
          userProfile.customId,
          userProfile.operatorCode,
          userProfile.driverIdentifier
        );
        toast({
          title: "Login Successful",
          description: `Welcome back, ${userProfile.name || firebaseUser.displayName}!`,
        });
      } else {
        // This case should ideally not happen if registration always creates a profile
        // But handle it defensively.
        console.error("User profile not found in Firestore for UID:", firebaseUser.uid);
        contextLogin(
          firebaseUser.uid, 
          firebaseUser.email!, 
          firebaseUser.displayName || "User", 
          'passenger' // Default to passenger if profile missing
        ); 
        toast({
          title: "Login Partially Successful",
          description: "Logged in, but profile details incomplete. Please contact support if issues persist.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "An unknown error occurred during login.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential': // Covers both wrong email/password in newer SDK versions
            errorMessage = 'Invalid email or password. Please try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This user account has been disabled.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
          default:
            errorMessage = `Login failed: ${error.message}`;
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
                <Input type="email" placeholder="you@example.com" {...field} disabled={isLoading} />
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
                <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
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
          <Link href="/forgot-password" className="underline text-muted-foreground hover:text-primary">
            Forgot your password?
          </Link>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="underline text-accent hover:text-accent/90">
            Sign up
          </Link>
        </p>
      </form>
    </Form>
  );
}
