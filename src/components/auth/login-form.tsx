
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Loader2, User as UserIcon, Car as CarIcon, Briefcase as BriefcaseIcon, Shield as ShieldIcon, LogIn } from "lucide-react";
import React, { useState } from "react";
import { useAuth, UserRole } from "@/contexts/auth-context";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
  role: z.enum(["passenger", "driver", "operator", "admin"]).default("passenger"),
});

export function LoginForm() {
  const { loginWithEmail, loginAsGuest, loading: authLoading } = useAuth(); 
  const { toast } = useToast();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "passenger",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("LoginForm onSubmit triggered with Firebase integration:", values.email, values.role);
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
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="passenger" id="role-passenger" />
                    </FormControl>
                    <FormLabel htmlFor="role-passenger">Passenger</FormLabel>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="driver" id="role-driver" />
                    </FormControl>
                    <FormLabel htmlFor="role-driver">Driver</FormLabel>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="operator" id="role-operator" />
                    </FormControl>
                    <FormLabel htmlFor="role-operator">Operator</FormLabel>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="admin" id="role-admin" />
                    </FormControl>
                    <FormLabel htmlFor="role-admin">Admin</FormLabel>
                  </div>
                </RadioGroup>
                <FormMessage />
              </FormItem>
            )}
          />
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
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
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
            {isLoading && form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <UserIcon className="mr-2 h-4 w-4" /> Passenger
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('driver')} disabled={isLoading}>
            {isLoading && form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <CarIcon className="mr-2 h-4 w-4" /> Driver
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('operator')} disabled={isLoading}>
            {isLoading && form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <BriefcaseIcon className="mr-2 h-4 w-4" /> Operator
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLogin('admin')} disabled={isLoading}>
            {isLoading && form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <ShieldIcon className="mr-2 h-4 w-4" /> Admin
          </Button>
        </div>
      </div>
    </>
  );
}
