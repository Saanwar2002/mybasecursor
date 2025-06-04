
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, UserRole } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Car, Loader2, PhoneOutcome } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { 
  createUserWithEmailAndPassword, 
  RecaptchaVerifier, 
  linkWithPhoneNumber,
  PhoneAuthProvider,
  ConfirmationResult,
  User as FirebaseUser,
  updateProfile as updateFirebaseUserProfile,
  linkWithCredential,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, updateDoc, Timestamp, getDoc, deleteField } from "firebase/firestore";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["passenger", "driver", "operator"], { required_error: "You must select a role." }),
  vehicleCategory: z.string().optional(),
  phoneNumber: z.string().optional(),
  verificationCode: z.string().optional().refine(value => !value || /^\d{6}$/.test(value), {
    message: "Verification code must be 6 digits."
  }),
}).refine(data => {
  if (data.role === 'driver') {
    return !!data.vehicleCategory && ["car", "estate", "minibus_6", "minibus_8"].includes(data.vehicleCategory);
  }
  return true;
}, {
  message: "Vehicle category is required for drivers.",
  path: ["vehicleCategory"],
}).refine(data => {
  if (data.role === 'passenger') {
    return !!data.phoneNumber && data.phoneNumber.trim() !== "" && phoneRegex.test(data.phoneNumber);
  }
  return !data.phoneNumber || data.phoneNumber.trim() === "" || phoneRegex.test(data.phoneNumber);
}, {
  message: "Valid phone number is required for passengers (e.g., +14155552671). Optional for others.",
  path: ["phoneNumber"],
});

type RegistrationStep = 'initial' | 'verifyingPhone';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  vehicleCategory?: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  phoneVerificationDeadline?: Timestamp | string | null;
  status?: 'Active' | 'Pending Approval' | 'Suspended';
}


export function RegisterForm() {
  const { login: contextLogin, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('initial');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [firebaseUserForLinking, setFirebaseUserForLinking] = useState<FirebaseUser | null>(null);
  
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "passenger",
      vehicleCategory: undefined,
      phoneNumber: "",
      verificationCode: "",
    },
  });

  const watchedRole = form.watch("role");

  useEffect(() => {
    if (auth && recaptchaContainerRef.current && !recaptchaVerifierRef.current && registrationStep === 'initial') {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          'size': 'invisible',
          'callback': (response: any) => {
            // reCAPTCHA solved, allow phone number submission
            console.log("reCAPTCHA solved:", response);
          },
          'expired-callback': () => {
            toast({ title: "reCAPTCHA Expired", description: "Please try sending the code again.", variant: "default"});
             if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.render().then((widgetId) => {
                    if (typeof window !== 'undefined' && (window as any).grecaptcha) {
                        (window as any).grecaptcha.reset(widgetId);
                    }
                }).catch(e => console.error("Error resetting reCAPTCHA widget:", e));
            }
          }
        });
        recaptchaVerifierRef.current.render().catch(err => {
          console.error("Error rendering reCAPTCHA in useEffect:", err);
          toast({title: "reCAPTCHA Render Error", description: `Could not render reCAPTCHA: ${err.message}. Try refreshing.`, variant: "destructive"});
        });
      } catch (e: any) {
        console.error("Error initializing RecaptchaVerifier for registration:", e);
        toast({title: "reCAPTCHA Init Error", description: `Could not initialize reCAPTCHA: ${e.message}`, variant: "destructive"});
      }
    }
    // No cleanup function for recaptchaVerifierRef.current.clear() here,
    // as it might interfere with ongoing operations if component re-renders.
    // It's cleared if registration completes or on unmount if needed.
  }, [auth, registrationStep, toast]); 

  useEffect(() => {
    // Cleanup reCAPTCHA on component unmount if it was initialized
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
        console.log("RecaptchaVerifier cleared on component unmount");
      }
    };
  }, []);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !db) {
      toast({ title: "Registration Error", description: "Firebase services not initialized. Please check server logs (terminal) and browser console for Firebase initialization details, and ensure your environment variables are correctly set.", variant: "destructive", duration: 10000 });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);

    if (registrationStep === 'initial') {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const firebaseUser = userCredential.user;
        await updateFirebaseUserProfile(firebaseUser, { displayName: values.name });
        setFirebaseUserForLinking(firebaseUser); // Store the user for phone linking

        const userProfile: any = {
          uid: firebaseUser.uid,
          name: values.name,
          email: values.email,
          role: values.role as UserRole,
          createdAt: serverTimestamp(),
          status: (values.role === 'driver' || values.role === 'operator') ? 'Pending Approval' : 'Active',
          ...(values.role === 'driver' && values.vehicleCategory && { vehicleCategory: values.vehicleCategory }),
          ...(values.phoneNumber && values.phoneNumber.trim() !== "" && { phoneNumberInput: values.phoneNumber.trim() }), // Store intended phone
        };
        
        if (values.role === 'passenger' && values.phoneNumber && values.phoneNumber.trim() !== "") {
            userProfile.phoneVerified = false;
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 7); // Example: 7-day deadline
            userProfile.phoneVerificationDeadline = Timestamp.fromDate(deadline);
        }

        await setDoc(doc(db, "users", firebaseUser.uid), userProfile);

        if (values.role === 'passenger' && values.phoneNumber && values.phoneNumber.trim() !== "" && recaptchaVerifierRef.current) {
          toast({ title: "Account Created!", description: "Next, verify your phone number."});
          const appVerifier = recaptchaVerifierRef.current;
          
          try {
            const result = await linkWithPhoneNumber(firebaseUser, values.phoneNumber, appVerifier);
            setConfirmationResult(result);
            setRegistrationStep('verifyingPhone');
            setIsSubmitting(false); 
            form.setFocus("verificationCode");
          } catch (phoneLinkError: any) {
            console.error("Error during linkWithPhoneNumber:", phoneLinkError);
            // Attempt to clear reCAPTCHA if it failed, so user can try again
            if (recaptchaVerifierRef.current) {
              recaptchaVerifierRef.current.render().then((widgetId) => { // Re-render can sometimes reset
                if (typeof window !== 'undefined' && (window as any).grecaptcha) {
                  (window as any).grecaptcha.reset(widgetId);
                }
              }).catch(e => console.error("Error resetting reCAPTCHA widget after phone link error:", e));
            }
            handleRegistrationError(phoneLinkError); // Use the generalized error handler
            setIsSubmitting(false);
            setFirebaseUserForLinking(null); // Clear stored user if phone linking setup failed
          }
        } else {
          // Not a passenger or no phone number provided, or reCAPTCHA not ready
          contextLogin(
            firebaseUser.email || values.email, 
            values.name, 
            values.role as UserRole, 
            values.role === 'driver' ? values.vehicleCategory : undefined,
            values.phoneNumber, 
            false, // Phone not verified
            userProfile.status,
            (values.role === 'passenger' && userProfile.phoneVerificationDeadline) ? userProfile.phoneVerificationDeadline : null
          );
          toast({ title: "Registration Successful!", description: `Welcome, ${values.name}! Your account has been created.` });
          setIsSubmitting(false);
        }

      } catch (error: any) {
        handleRegistrationError(error);
        setIsSubmitting(false);
        setFirebaseUserForLinking(null);
      }
    } else if (registrationStep === 'verifyingPhone' && firebaseUserForLinking) {
      if (!values.verificationCode || !confirmationResult) {
        toast({ title: "Missing Info", description: "Please enter the verification code.", variant: "default" });
        setIsSubmitting(false);
        return;
      }
      try {
        const phoneCredential = PhoneAuthProvider.credential(confirmationResult.verificationId, values.verificationCode);
        await linkWithCredential(firebaseUserForLinking, phoneCredential);
        
        const userDocRef = doc(db, "users", firebaseUserForLinking.uid);
        await updateDoc(userDocRef, {
          phoneNumber: firebaseUserForLinking.phoneNumber, // This is the E.164 formatted number from Firebase
          phoneVerified: true,
          phoneVerificationDeadline: deleteField(), // Remove deadline once verified
        });

        // Update context immediately
        updateUserProfileInContext({ 
            phoneNumber: firebaseUserForLinking.phoneNumber, 
            phoneVerified: true,
            phoneVerificationDeadline: null, // Reflect in context
        });

        toast({ title: "Phone Verified!", description: "Your phone number has been successfully linked." });
        
        // Final login to context with all details
        const userProfileSnapshot = await getDoc(userDocRef);
        const userProfileData = userProfileSnapshot.data();

        contextLogin(
            firebaseUserForLinking.email || form.getValues("email"), 
            firebaseUserForLinking.displayName || form.getValues("name"), 
            form.getValues("role") as UserRole,
            form.getValues("role") === 'driver' ? form.getValues("vehicleCategory") : undefined,
            firebaseUserForLinking.phoneNumber,
            true, // Phone is now verified
            userProfileData?.status as User['status'] || 'Active',
            null // No deadline
        );
        setIsSubmitting(false);
      } catch (error: any) {
        console.error("Phone verification error:", error);
        toast({ title: "Phone Verification Failed", description: error.message || "Invalid code or error linking.", variant: "destructive" });
        setIsSubmitting(false);
      }
    }
  }

  function handleRegistrationError(error: any) {
    let errorMessage = "An unknown error occurred during registration.";
    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-in-use': errorMessage = 'This email is already in use.'; break;
        case 'auth/invalid-email': errorMessage = 'The email address is not valid.'; break;
        case 'auth/operation-not-allowed': errorMessage = 'Email/password accounts are not enabled. Please check Firebase console settings.'; break;
        case 'auth/weak-password': errorMessage = 'Password is too weak.'; break;
        case 'auth/missing-phone-number': errorMessage = 'Phone number is missing for verification.'; break;
        case 'auth/invalid-phone-number': errorMessage = 'The phone number is invalid. Ensure it is in E.164 format (e.g., +14155552671).'; break;
        case 'auth/quota-exceeded': errorMessage = 'SMS quota exceeded. Try again later.'; break;
        case 'auth/user-disabled': errorMessage = 'This user account has been disabled.'; break;
        case 'auth/captcha-check-failed': errorMessage = 'reCAPTCHA verification failed. Please try again.'; break;
        case 'auth/missing-verification-code': errorMessage = 'Verification code is missing.'; break;
        case 'auth/invalid-verification-code': errorMessage = 'The verification code is invalid.'; break;
        case 'auth/session-expired': errorMessage = 'The SMS code has expired. Please request a new one.'; break;
        default: errorMessage = `Auth error: ${error.message} (Code: ${error.code})`;
      }
    } else if (error.message?.includes('firestore')) {
       errorMessage = `Profile creation error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    console.error("Registration error details:", error);
    toast({ title: "Registration Failed", description: errorMessage, variant: "destructive" });
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {registrationStep === 'initial' && (
          <>
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="your@email.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Register as:</FormLabel><FormControl><RadioGroup onValueChange={(value) => { field.onChange(value); if (value !== 'driver') { form.setValue('vehicleCategory', undefined); form.clearErrors('vehicleCategory'); } else { form.setValue('vehicleCategory', 'car');}}} defaultValue={field.value} className="flex flex-col space-y-1 md:flex-row md:space-y-0 md:space-x-4" disabled={isSubmitting}>
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="passenger" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Passenger</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="driver" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Driver</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="operator" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Taxi Base Operator</FormLabel></FormItem>
                </RadioGroup></FormControl><FormMessage /></FormItem>
            )} />
            {watchedRole === "driver" && (
            <FormField control={form.control} name="vehicleCategory" render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-1"><Car className="w-4 h-4 text-muted-foreground" /> Vehicle Category</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value || "car"} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select vehicle category" /></SelectTrigger></FormControl><SelectContent>
                    <SelectItem value="car">Car (Standard)</SelectItem><SelectItem value="estate">Estate Car</SelectItem><SelectItem value="minibus_6">Minibus (6 people)</SelectItem><SelectItem value="minibus_8">Minibus (8 people)</SelectItem>
                </SelectContent></Select><FormMessage /></FormItem>
            )} />
            )}
            <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone Number {watchedRole === 'passenger' && <span className="text-destructive font-bold">*</span>} (e.g., +16505551234)
                  </FormLabel>
                  <FormControl><Input type="tel" placeholder="Enter your phone number" {...field} disabled={isSubmitting} /></FormControl>
                  <FormMessage />
                </FormItem>
            )} />
          </>
        )}

        {registrationStep === 'verifyingPhone' && (
          <>
            <p className="text-sm text-muted-foreground">
              A verification code has been sent to {form.getValues("phoneNumber")}. Please enter it below.
            </p>
            <FormField control={form.control} name="verificationCode" render={({ field }) => (
                <FormItem><FormLabel>Verification Code</FormLabel><FormControl><Input type="text" placeholder="Enter 6-digit code" {...field} disabled={isSubmitting} maxLength={6} /></FormControl><FormMessage /></FormItem>
            )} />
          </>
        )}
        
        {registrationStep === 'initial' && <div ref={recaptchaContainerRef} id="recaptcha-container-register"></div>}


        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? (registrationStep === 'initial' ? 'Creating Account...' : 'Verifying...') : (registrationStep === 'initial' ? 'Create Account' : 'Verify & Complete Registration')}
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


    