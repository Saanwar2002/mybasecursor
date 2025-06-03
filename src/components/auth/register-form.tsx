
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, UserRole } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Car, Loader2 } from "lucide-react";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase"; // Updated path

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["passenger", "driver", "operator"], { required_error: "You must select a role." }),
  vehicleCategory: z.string().optional(),
}).refine(data => {
  if (data.role === 'driver') {
    return !!data.vehicleCategory && ["car", "estate", "minibus_6", "minibus_8"].includes(data.vehicleCategory);
  }
  return true;
}, {
  message: "Vehicle category is required for drivers.",
  path: ["vehicleCategory"],
});

export function RegisterForm() {
  const { login: contextLogin } = useAuth(); // Renamed to avoid conflict
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "passenger",
      vehicleCategory: undefined,
    },
  });

  const watchedRole = form.watch("role");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) {
      toast({
        title: "Registration Error",
        description: "Firebase Authentication is not initialized. Please check the console.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      // Step 1: Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      // For now, we'll continue to use the existing AuthContext.login.
      // In a future step, we'll integrate this with Firestore profile creation
      // and use firebaseUser.uid as the primary ID.
      contextLogin(firebaseUser.email || values.email, values.name, values.role as UserRole, values.role === 'driver' ? values.vehicleCategory : undefined);

      toast({
        title: "Registration Successful!",
        description: `Welcome, ${values.name}! Your account has been created.`,
      });
      // The contextLogin will handle redirection.

    } catch (error: any) {
      let errorMessage = "An unknown error occurred during registration.";
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already in use.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak.';
            break;
          default:
            errorMessage = error.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} disabled={isSubmitting} />
              </FormControl>
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
                <Input placeholder="your@email.com" {...field} disabled={isSubmitting} />
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
                <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
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
              <FormLabel>Register as:</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value !== 'driver') {
                      form.setValue('vehicleCategory', undefined);
                      form.clearErrors('vehicleCategory');
                    } else {
                        form.setValue('vehicleCategory', 'car');
                    }
                  }}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4"
                  disabled={isSubmitting}
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="passenger" disabled={isSubmitting} />
                    </FormControl>
                    <FormLabel className="font-normal">Passenger</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="driver" disabled={isSubmitting} />
                    </FormControl>
                    <FormLabel className="font-normal">Driver</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="operator" disabled={isSubmitting} />
                    </FormControl>
                    <FormLabel className="font-normal">Taxi Base Operator</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedRole === "driver" && (
          <FormField
            control={form.control}
            name="vehicleCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1"><Car className="w-4 h-4 text-muted-foreground" /> Vehicle Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || "car"}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your vehicle category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="car">Car (Standard)</SelectItem>
                    <SelectItem value="estate">Estate Car</SelectItem>
                    <SelectItem value="minibus_6">Minibus (6 people)</SelectItem>
                    <SelectItem value="minibus_8">Minibus (8 people)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </Button>
         <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="underline text-accent hover:text-accent/90">
            Log in
          </Link>
        </p>
      </form>
    </Form>
  );
}
