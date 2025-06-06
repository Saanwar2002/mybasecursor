
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
// import { useAuth, UserRole, User } from "@/contexts/auth-context"; // Commented out
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { User as UserIconLucide, Briefcase, CarIcon, Loader2, Shield, KeyRound, AlertTriangle, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useRef } from "react";
// import { signInWithEmailAndPassword, User as FirebaseUser } from "firebase/auth"; // Commented out
// import { auth, db } from "@/lib/firebase"; // Commented out
// import { doc, getDoc, Timestamp } from "firebase/firestore"; // Commented out
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["passenger", "driver", "operator", "admin"], { required_error: "You must select a role." }),
});

const pinFormSchema = z.object({
  pin: z.string().length(4, { message: "PIN must be 4 digits." }).regex(/^\d{4}$/, { message: "PIN must be 4 digits." }),
});

// interface StoredPinUser extends User { // User type is from auth-context
//   pin: string;
// }
interface StoredPinUser { // Temporary simplified User type
  id: string;
  email: string;
  name: string;
  role: 'passenger' | 'driver' | 'operator' | 'admin';
  pin: string;
  vehicleCategory?: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  status?: 'Active' | 'Pending Approval' | 'Suspended';
  phoneVerificationDeadline?: string | null;
  customId?: string;
  operatorCode?: string;
  driverIdentifier?: string;
}


export function LoginForm() {
  // const { login: contextLogin } = useAuth(); // Commented out
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'pin'>('email');
  const [storedPinUser, setStoredPinUser] = useState<StoredPinUser | null>(null);
  const [pinInputValue, setPinInputValue] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "passenger",
    },
  });

  const pinForm = useForm<z.infer<typeof pinFormSchema>>({
    resolver: zodResolver(pinFormSchema),
    defaultValues: {
      pin: "",
    },
  });

  useEffect(() => {
    if (loginMode === 'pin' && typeof window !== "undefined") {
      const storedUserData = localStorage.getItem('linkCabsUserWithPin');
      if (storedUserData) {
        try {
          const parsedData: StoredPinUser = JSON.parse(storedUserData);
          setStoredPinUser(parsedData);
        } catch (e) {
          console.error("Error parsing stored PIN user data from localStorage:", e);
          localStorage.removeItem('linkCabsUserWithPin');
          setStoredPinUser(null);
        }
      } else {
        setStoredPinUser(null);
      }
    }
  }, [loginMode]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setPinInputValue("");
    toast({ title: "Login (Mocked)", description: "Login functionality temporarily disabled for debugging.", variant: "default" });
    console.log("Login form submitted (mocked):", values);
    // Actual login logic commented out
    // if (!auth || !db) { ... }
    // try { ... signInWithEmailAndPassword ... contextLogin ... }
    // catch (error: any) { ... }
    setIsLoading(false);
  }

  async function onPinSubmit(values: z.infer<typeof pinFormSchema>) {
    setIsLoading(true);
    toast({ title: "PIN Login (Mocked)", description: "PIN Login temporarily disabled for debugging.", variant: "default" });
    console.log("PIN Login form submitted (mocked):", values);
    // Actual PIN login logic commented out
    // if (!storedPinUser) { ... }
    // try { if (storedPinUser.pin === values.pin) { ... contextLogin ... } else { ... } }
    // catch (e) { ... }
    setIsLoading(false);
    setPinInputValue("");
  }

  const handleGuestLogin = (role: 'passenger' | 'driver' | 'operator' | 'admin' // UserRole
   ) => {
    toast({ title: "Guest Login (Mocked)", description: `Guest login as ${role} temporarily disabled.`, variant: "default" });
    console.log("Guest login clicked (mocked):", role);
    // Actual guest login logic commented out
    // let email = ""; ... contextLogin ...
    setPinInputValue("");
  };
  
  const switchToPinLogin = () => {
    setLoginMode('pin');
    setPinInputValue("");
    pinForm.reset();
  };

  const switchToEmailLogin = () => {
    setLoginMode('email');
    form.reset(); 
  };

  return (
    <>
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Developer Note: PIN Feature</AlertTitle>
        <AlertDescription>
          The PIN login feature is a **non-secure prototype** for UI demonstration only.
          It uses localStorage and does not involve proper hashing or security measures.
          **Do not use for real applications.**
        </AlertDescription>
      </Alert>

      {loginMode === 'email' ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="your@email.com" {...field} disabled={isLoading} />
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
                  <div className="flex justify-between items-center">
                    <FormLabel>Password</FormLabel>
                    <Link href="/forgot-password"
                          className="text-xs text-muted-foreground hover:text-primary underline">
                      Forgot Password?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
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
                  <FormLabel>Login as:</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-2 md:flex-wrap"
                      disabled={isLoading}
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0 p-1">
                        <FormControl><RadioGroupItem value="passenger" /></FormControl>
                        <FormLabel className="font-normal">Passenger</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-1">
                        <FormControl><RadioGroupItem value="driver" /></FormControl>
                        <FormLabel className="font-normal">Driver</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-1">
                        <FormControl><RadioGroupItem value="operator" /></FormControl>
                        <FormLabel className="font-normal">Taxi Base Operator</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0 p-1">
                        <FormControl><RadioGroupItem value="admin" /></FormControl>
                        <FormLabel className="font-normal">Platform Administrator</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login with Email/Password
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={switchToPinLogin} disabled={isLoading}>
              <KeyRound className="mr-2 h-4 w-4" /> Use Quick PIN Login
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="underline text-accent hover:text-accent/90">
                Sign up
              </Link>
            </p>
          </form>
        </Form>
      ) : ( 
        <Form {...pinForm}>
          <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="space-y-6">
            {storedPinUser ? (
              <p className="text-sm text-center text-muted-foreground">
                Enter PIN for <span className="font-semibold">{storedPinUser.email.length > 20 ? storedPinUser.email.substring(0,17) + "..." : storedPinUser.email}</span>.
              </p>
            ) : (
              <Alert variant="default" className="bg-blue-50 border-blue-300">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700">No PIN Configured</AlertTitle>
                <AlertDescription className="text-blue-600">
                  No PIN is set up for quick login on this device. Please log in with your email and password, then set up a PIN in your Profile section if you wish.
                </AlertDescription>
              </Alert>
            )}
            <FormField
              control={pinForm.control}
              name="pin"
              render={({ field }) => ( 
                <FormItem>
                  <FormLabel>Enter 4-Digit PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="tel" 
                      placeholder="••••"
                      value={pinInputValue} 
                      onChange={(e) => {
                        const newRawValue = e.target.value;
                        const newNumericValue = newRawValue.replace(/\D/g, "").slice(0, 4);
                        setPinInputValue(newNumericValue); 
                        pinForm.setValue("pin", newNumericValue, { shouldValidate: true });
                      }}
                      disabled={isLoading || !storedPinUser}
                      className="text-center text-2xl tracking-[0.5em]"
                      inputMode="numeric"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || !storedPinUser}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Login with PIN
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={switchToEmailLogin} disabled={isLoading}>
              Login with Email/Password instead
            </Button>
          </form>
        </Form>
      )}

      <Separator className="my-6" />

      <div className="space-y-4">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Or try as a guest:
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleGuestLogin("passenger")}
        >
          <UserIconLucide className="mr-2 h-4 w-4" /> Login as Guest Passenger
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleGuestLogin("driver")}
        >
          <CarIcon className="mr-2 h-4 w-4" /> Login as Guest Driver
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleGuestLogin("operator")}
        >
          <Briefcase className="mr-2 h-4 w-4" /> Login as Guest Operator
        </Button>
        <Button
          variant="outline"
          className="w-full border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white"
          onClick={() => handleGuestLogin("admin")}
        >
          <Shield className="mr-2 h-4 w-4" /> Login as Guest Admin
        </Button>
      </div>
    </>
  );
}
