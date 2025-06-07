
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
import { User as UserIconLucide, Briefcase, CarIcon as CarIconLucide, Loader2, Shield, KeyRound, AlertTriangle, Info } from "lucide-react"; // Renamed CarIcon to CarIconLucide
import { Separator } from "@/components/ui/separator";
import { useState, useEffect, useRef } from "react";
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
      const storedUserData = localStorage.getItem('myBaseUserWithPin');
      if (storedUserData) {
        try {
          const parsedData: StoredPinUser = JSON.parse(storedUserData);
          setStoredPinUser(parsedData);
        } catch (e) {
          console.error("Error parsing stored PIN user data from localStorage:", e);
          localStorage.removeItem('myBaseUserWithPin');
          setStoredPinUser(null);
        }
      } else {
        setStoredPinUser(null);
      }
    }
  }, [loginMode]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("LoginForm onSubmit triggered with values:", values);
    setIsLoading(true);
    setPinInputValue(""); 
    if (!auth || !db) {
        toast({ title: "Login Error", description: "Firebase services not initialized. Please try again later or contact support.", variant: "destructive", duration: 7000 });
        setIsLoading(false);
        return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role !== values.role) {
          toast({
            title: "Role Mismatch",
            description: `You're trying to log in as a ${values.role}, but this account is registered as a ${userData.role}. Please select the correct role.`,
            variant: "destructive",
            duration: 7000,
          });
          setIsLoading(false);
          return;
        }
        if (userData.status === 'Suspended') {
           toast({ title: "Account Suspended", description: "Your account has been suspended. Please contact support.", variant: "destructive", duration: 10000 });
           setIsLoading(false);
           return;
        }

        contextLogin(
          firebaseUser.uid, 
          firebaseUser.email || values.email, 
          userData.name || firebaseUser.displayName || "User", 
          userData.role as UserRole,
          userData.vehicleCategory,
          userData.phoneNumber || firebaseUser.phoneNumber,
          userData.phoneVerified,
          userData.status,
          userData.phoneVerificationDeadline, 
          userData.customId,
          userData.operatorCode,
          userData.driverIdentifier
        );
        toast({ title: "Login Successful!", description: `Welcome back, ${userData.name || firebaseUser.displayName}!` });

      } else {
        toast({ title: "Login Failed", description: "No profile data found for this user. Please complete registration or contact support.", variant: "destructive" });
      }
    } catch (error: any) {
      let errorMessage = "An error occurred during login.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = "Invalid email or password. Please check your credentials and try again.";
            break;
          case 'auth/invalid-email':
            errorMessage = "The email address is not valid.";
            break;
          case 'auth/user-disabled':
            errorMessage = "This user account has been disabled by an administrator.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
            break;
          default:
            errorMessage = `Login failed: ${error.message} (Code: ${error.code})`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error("Login error details:", error);
      toast({ title: "Login Failed", description: errorMessage, variant: "destructive", duration: 7000 });
    } finally {
      setIsLoading(false);
    }
  }

  async function onPinSubmit(values: z.infer<typeof pinFormSchema>) {
    console.log("LoginForm onPinSubmit triggered with PIN:", values.pin);
    setIsLoading(true);
    if (!storedPinUser) {
      toast({ title: "PIN Login Error", description: "No PIN user data found for this device. Please log in with email/password first to set up a PIN.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (!auth || !db) {
        toast({ title: "Login Error", description: "Firebase services not initialized.", variant: "destructive" });
        setIsLoading(false);
        return;
    }

    try {
      if (storedPinUser.pin === values.pin) {
        const userDocRef = doc(db, "users", storedPinUser.id);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
           if (userData.status === 'Suspended') {
             toast({ title: "Account Suspended", description: "Your account has been suspended. Please contact support.", variant: "destructive", duration: 10000 });
             setIsLoading(false);
             return;
          }
          contextLogin(
            storedPinUser.id,
            userData.email || storedPinUser.email,
            userData.name || storedPinUser.name,
            userData.role as UserRole,
            userData.vehicleCategory,
            userData.phoneNumber,
            userData.phoneVerified,
            userData.status,
            userData.phoneVerificationDeadline,
            userData.customId,
            userData.operatorCode,
            userData.driverIdentifier
          );
          toast({ title: "PIN Login Successful!", description: `Welcome back, ${userData.name || storedPinUser.name}!` });
        } else {
          toast({ title: "PIN Login Failed", description: "User profile not found for stored PIN data. Please re-login with email.", variant: "destructive" });
          localStorage.removeItem('myBaseUserWithPin');
          setStoredPinUser(null);
          setLoginMode('email');
        }
      } else {
        toast({ title: "Incorrect PIN", description: "The PIN you entered is incorrect. Please try again.", variant: "destructive" });
        pinForm.resetField("pin");
        setPinInputValue("");
      }
    } catch (e: any) {
      console.error("Error during PIN login process:", e);
      toast({ title: "PIN Login Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const handleGuestLogin = (role: UserRole) => {
    console.log(`Guest login attempt for role: ${role}`); 
    toast({ title: `Test Click: Guest ${role} button clicked!`});
    let email = "";
    let name = "";
    const guestId = `guest-${Date.now()}`;
    let operatorCodeForGuest: string | undefined = undefined;
    let customIdForGuest: string | undefined = undefined;

    switch (role) {
      case "passenger":
        email = "guest-passenger@mybase.com";
        name = "Guest Passenger";
        customIdForGuest = `CU-${guestId.slice(-6)}`;
        break;
      case "driver":
        email = "guest-driver@mybase.com";
        name = "Guest Driver";
        operatorCodeForGuest = "OP001"; 
        customIdForGuest = `DR-${guestId.slice(-6)}`;
        break;
      case "operator":
        email = "guest-operator@mybase.com";
        name = "Guest Operator";
        operatorCodeForGuest = "OP001"; 
        customIdForGuest = `OP-${guestId.slice(-6)}`;
        break;
      case "admin":
        email = "guest-admin@mybase.com";
        name = "Guest Platform Admin";
        customIdForGuest = `AD-${guestId.slice(-6)}`;
        break;
    }
    contextLogin(guestId, email, name, role, undefined, undefined, true, 'Active', null, customIdForGuest, operatorCodeForGuest);
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
      {isLoading && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black p-2 rounded shadow-lg z-50 text-xs">
          DEBUG: isLoading is TRUE
        </div>
      )}

      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Developer Note: PIN Feature</AlertTitle>
        <AlertDescription>
          The PIN login feature is a **non-secure prototype** for UI demonstration only.
          It uses localStorage and does not involve proper hashing or security measures.
          **Do not use for real applications.**
        </AlertDescription>
      </Alert>

      <Button 
        variant="secondary" 
        className="w-full mb-4" 
        onClick={() => alert('Minimal Shadcn Button Clicked!')}
      >
        Test Minimal Shadcn Button
      </Button>

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
        
        <button
          type="button"
          onClick={() => {
            alert("HTML Button Clicked!"); // For immediate visual feedback
            // toast({ title: "Standard HTML Guest Passenger button clicked!" });
            // handleGuestLogin("passenger"); 
          }}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <UserIconLucide className="mr-2 h-4 w-4" /> Login as Guest Passenger (HTML Button)
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            // alert("Shadcn Guest Driver Button Clicked!"); // Reverted this direct alert
            handleGuestLogin("driver");
          }}
          disabled={isLoading}
        >
          <CarIconLucide className="mr-2 h-4 w-4" /> Login as Guest Driver
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleGuestLogin("operator")}
          disabled={isLoading}
        >
          <Briefcase className="mr-2 h-4 w-4" /> Login as Guest Operator
        </Button>
        <Button
          variant="outline"
          className="w-full border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white"
          onClick={() => handleGuestLogin("admin")}
          disabled={isLoading}
        >
          <Shield className="mr-2 h-4 w-4" /> Login as Guest Admin
        </Button>
      </div>
    </>
  );
}
