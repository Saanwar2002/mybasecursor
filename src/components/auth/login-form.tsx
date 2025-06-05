
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
import { useAuth, UserRole, User } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { User as UserIconLucide, Briefcase, CarIcon, Loader2, Shield, KeyRound, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["passenger", "driver", "operator", "admin"], { required_error: "You must select a role." }),
});

const pinFormSchema = z.object({
  pin: z.string().length(4, { message: "PIN must be 4 digits." }).regex(/^\d{4}$/, { message: "PIN must be 4 digits." }),
});

interface StoredPinUser extends User {
  pin: string;
}

export function LoginForm() {
  const { login: contextLogin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [pinUserEmail, setPinUserEmail] = useState<string | null>(null);

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
    // Check if a PIN is stored for any user to enable the PIN login button
    if (typeof window !== "undefined") {
      const storedUserData = localStorage.getItem('linkCabsUserWithPin');
      if (storedUserData) {
        try {
          const parsedData: StoredPinUser = JSON.parse(storedUserData);
          setPinUserEmail(parsedData.email); // Store email to prefill or identify
        } catch (e) {
          console.error("Error parsing stored PIN user data from localStorage:", e);
          localStorage.removeItem('linkCabsUserWithPin'); // Clear potentially corrupted data
        }
      }
    }
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth || !db) {
      toast({
        title: "Login Error",
        description: "Firebase services not available. Please try again later.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        toast({
          title: "Login Failed",
          description: "User profile not found. Please contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const userProfile = userDocSnap.data();

      if (userProfile.role !== values.role) {
        toast({
          title: "Role Mismatch",
          description: `You're trying to log in as ${values.role}, but your account is registered as ${userProfile.role}. Please select the correct role.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      let deadlineISO: string | null = null;
      if (userProfile.phoneVerificationDeadline) {
          if (userProfile.phoneVerificationDeadline instanceof Timestamp) {
              deadlineISO = userProfile.phoneVerificationDeadline.toDate().toISOString();
          } else if (typeof userProfile.phoneVerificationDeadline === 'string') {
              try {
                  deadlineISO = new Date(userProfile.phoneVerificationDeadline).toISOString();
              } catch (e) { console.warn("Could not parse phoneVerificationDeadline from string", userProfile.phoneVerificationDeadline); }
          } else if (typeof userProfile.phoneVerificationDeadline === 'object' && ('seconds' in userProfile.phoneVerificationDeadline || '_seconds' in userProfile.phoneVerificationDeadline)) {
              const seconds = (userProfile.phoneVerificationDeadline as any).seconds ?? (userProfile.phoneVerificationDeadline as any)._seconds;
              const nanoseconds = (userProfile.phoneVerificationDeadline as any).nanoseconds ?? (userProfile.phoneVerificationDeadline as any)._nanoseconds ?? 0;
              if (typeof seconds === 'number') {
                  deadlineISO = new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
              }
          }
      }

      contextLogin(
        firebaseUser.uid,
        firebaseUser.email || values.email,
        userProfile.name || firebaseUser.displayName || values.email.split('@')[0],
        userProfile.role as UserRole,
        userProfile.vehicleCategory,
        userProfile.phoneNumber || firebaseUser.phoneNumber,
        userProfile.phoneVerified,
        userProfile.status,
        deadlineISO,
        userProfile.customId,
        userProfile.operatorCode,
        userProfile.driverIdentifier
      );

      toast({
        title: "Login Successful",
        description: `Welcome back, ${userProfile.name || firebaseUser.displayName}!`,
      });

    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Invalid email or password.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = "Invalid email or password. Please try again.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Too many login attempts. Please try again later.";
            break;
          case 'auth/user-disabled':
            errorMessage = "This account has been disabled.";
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

  async function onPinSubmit(values: z.infer<typeof pinFormSchema>) {
    setIsLoading(true);
    const storedUserData = localStorage.getItem('linkCabsUserWithPin');
    if (!storedUserData) {
      toast({ title: "PIN Login Failed", description: "No PIN found for this device. Please login with password to set up a PIN.", variant: "destructive" });
      setIsLoading(false);
      setShowPinLogin(false); // Revert to password login
      return;
    }
    try {
      const storedUser: StoredPinUser = JSON.parse(storedUserData);
      if (storedUser.pin === values.pin) {
        // Directly use stored user data. This is a mock and not fully secure.
        contextLogin(
          storedUser.id,
          storedUser.email,
          storedUser.name,
          storedUser.role,
          storedUser.vehicleCategory,
          storedUser.phoneNumber,
          storedUser.phoneVerified,
          storedUser.status,
          storedUser.phoneVerificationDeadline,
          storedUser.customId,
          storedUser.operatorCode,
          storedUser.driverIdentifier
        );
        toast({ title: "PIN Login Successful", description: `Welcome back, ${storedUser.name}!` });
      } else {
        toast({ title: "PIN Login Failed", description: "Incorrect PIN.", variant: "destructive" });
        pinForm.resetField("pin");
      }
    } catch (e) {
        toast({ title: "PIN Login Error", description: "Could not process stored PIN data.", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }


  const handleGuestLogin = (role: UserRole) => {
    let email = "";
    let name = "";
    const guestId = `guest-${Date.now()}`;
    switch (role) {
      case "passenger":
        email = "guest-passenger@taxinow.com";
        name = "Guest Passenger";
        break;
      case "driver":
        email = "guest-driver@taxinow.com";
        name = "Guest Driver";
        break;
      case "operator":
        email = "guest-operator@taxinow.com";
        name = "Guest Operator";
        break;
      case "admin":
        email = "guest-admin@taxinow.com";
        name = "Guest Platform Admin";
        break;
    }
    contextLogin(guestId, email, name, role, undefined, undefined, true, 'Active', null);
    toast({
      title: "Guest Login Successful",
      description: `Logged in as ${name}.`,
    });
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

      {!showPinLogin ? (
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
             {pinUserEmail && (
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowPinLogin(true)} disabled={isLoading}>
                <KeyRound className="mr-2 h-4 w-4" /> Quick Login with PIN (for {pinUserEmail.length > 15 ? pinUserEmail.substring(0,12) + "..." : pinUserEmail})
              </Button>
            )}
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
            <p className="text-sm text-center text-muted-foreground">
              Quick login for <span className="font-semibold">{pinUserEmail}</span>.
            </p>
            <FormField
              control={pinForm.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enter 4-Digit PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="tel" // Changed from "password" to "tel"
                      maxLength={4}
                      placeholder="••••"
                      {...field}
                      disabled={isLoading}
                      className="text-center text-2xl tracking-[0.5em]"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Login with PIN
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={() => setShowPinLogin(false)} disabled={isLoading}>
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
