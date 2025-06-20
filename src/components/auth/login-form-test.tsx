"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useAuth } from "@/contexts/auth-context";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Loader2, UserIcon, CarIcon, BriefcaseIcon, ShieldIcon } from "lucide-react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export function LoginForm() {
  const { login, loginAsGuest, db } = useAuth();
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
    try {
      await login(values.email, values.password);
      toast({
        title: "Logged In",
        description: "You have successfully logged in.",
      });
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleGuestLoginAndCreateRide = async (role: 'passenger' | 'driver' | 'operator' | 'admin') => {
    setIsLoading(true);
    try {
      const guestUser = await loginAsGuest(role);
      
      const router = (window as any).next.router;
      const paths = {
        passenger: '/dashboard',
        driver: '/driver',
        operator: '/operator',
        admin: '/admin',
      };
      router.push(paths[role]);

    } catch (error: any) {
      // Error is already handled in the auth context
      console.error("Caught error in UI component:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} />
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
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log In
          </Button>
        </form>
      </Form>
      <Separator className="my-6" />
      <div className="space-y-3">
        <h3 className="text-center text-sm font-medium text-muted-foreground"> Or log in as a Guest (Development) </h3>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="sm" onClick={() => handleGuestLoginAndCreateRide('passenger')} disabled={isLoading}>
            <span className="flex items-center justify-center">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserIcon className="mr-2 h-4 w-4" />}
              Passenger
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLoginAndCreateRide('driver')} disabled={isLoading}>
            <span className="flex items-center justify-center">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CarIcon className="mr-2 h-4 w-4" />}
              Driver
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLoginAndCreateRide('operator')} disabled={isLoading}>
            <span className="flex items-center justify-center">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BriefcaseIcon className="mr-2 h-4 w-4" />}
              Operator
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGuestLoginAndCreateRide('admin')} disabled={isLoading}>
            <span className="flex items-center justify-center">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldIcon className="mr-2 h-4 w-4" />}
              Admin
            </span>
          </Button>
        </div>
      </div>
    </>
  );
} 