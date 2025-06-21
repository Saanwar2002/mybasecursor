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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }), 
  role: z.enum(["passenger", "driver", "operator", "admin"], {
    required_error: "You must select a role to log in.",
  }),
});

export function LoginForm() {
  const { loginWithEmail, loginAsGuest, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "passenger",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("LoginForm onSubmit triggered with Firebase integration:", values.email);
    setIsSubmittingForm(true);
    try {
      await loginWithEmail(values.email, values.password, values.role);
    } catch (error) {
      console.error("LoginForm direct catch from onSubmit (should be rare if AuthContext handles well):", error);
    } finally {
      setIsSubmittingForm(false);
    }
  }

  const handleGuestLogin = async (role: UserRole) => {
    console.log(`LoginForm handleGuestLogin triggered for role: ${role}`);
    setIsSubmittingForm(true);
    try {
      await loginAsGuest(role);
    } catch (error) {
      toast({ title: "Guest Login Error", description: "Could not log in as guest.", variant: "destructive"});
      console.error("LoginForm handleGuestLogin error:", error);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const isLoading = isSubmittingForm || authLoading;

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
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Log in as</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-2 gap-4"
                    disabled={isLoading}
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="passenger" />
                      </FormControl>
                      <FormLabel className="font-normal flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" /> Passenger
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="driver" />
                      </FormControl>
                      <FormLabel className="font-normal flex items-center gap-2">
                         <CarIcon className="h-4 w-4 text-muted-foreground" /> Driver
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="operator" />
                      </FormControl>
                      <FormLabel className="font-normal flex items-center gap-2">
                        <BriefcaseIcon className="h-4 w-4 text-muted-foreground" /> Operator
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="admin" />
                      </FormControl>
                      <FormLabel className="font-normal flex items-center gap-2">
                        <ShieldIcon className="h-4 w-4 text-muted-foreground" /> Admin
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
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
            <Link href="/register" prefetch={false} className="underline text-primary hover:text-primary/90 font-semibold">
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
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <UserIcon className="mr-2 h-4 w-4" /> Passenger
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('driver')} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <CarIcon className="mr-2 h-4 w-4" /> Driver
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('operator')} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <BriefcaseIcon className="mr-2 h-4 w-4" /> Operator
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('admin')} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <ShieldIcon className="mr-2 h-4 w-4" /> Admin
          </Button>
        </div>
      </div>
    </>
  );
}
