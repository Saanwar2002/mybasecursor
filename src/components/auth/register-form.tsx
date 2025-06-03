
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
} from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["passenger", "driver", "operator"], { required_error: "You must select a role." }),
  vehicleCategory: z.string().optional(),
  phoneNumber: z.string().optional().refine(value => !value || phoneRegex.test(value), {
    message: "Invalid phone number format (e.g., +14155552671)."
  }),
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
});

type RegistrationStep = 'initial' | 'verifyingPhone';

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
  const watchedPhoneNumber = form.watch("phoneNumber");

  useEffect(() => {
    if (auth && recaptchaContainerRef.current && !recaptchaVerifierRef.current && registrationStep === 'initial' && watchedPhoneNumber && watchedPhoneNumber.trim() !== "") {
      // Initialize reCAPTCHA for phone verification step if phone number is present
      // This might need to be re-initialized or triggered differently if a separate "Send Code" button is used.
      // For now, it's set up to be available if we proceed to phone verification.
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          'size': 'invisible',
          'callback': (response: any) => {
            // reCAPTCHA solved, allow signInWithPhoneNumber.
            // console.log("reCAPTCHA solved:", response);
          },
          'expired-callback': () => {
            // Response expired. Ask user to solve reCAPTCHA again.
            toast({ title: "reCAPTCHA Expired", description: "Please try sending the code again.", variant: "default"});
            // Potentially reset reCAPTCHA here if needed
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.render().then((widgetId) => {
                    (window as any).grecaptcha.reset(widgetId);
                });
            }
          }
        });
        recaptchaVerifierRef.current.render(); // Render it invisibly
      } catch (e: any) {
        console.error("Error initializing RecaptchaVerifier:", e);
        toast({title: "reCAPTCHA Error", description: `Could not initialize reCAPTCHA: ${e.message}`, variant: "destructive"});
      }
    }
    // Cleanup reCAPTCHA on unmount
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  // Watch registrationStep and watchedPhoneNumber to re-init if needed, though typically init once.
  }, [auth, registrationStep, watchedPhoneNumber, toast]); 


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !db) {
      toast({ title: "Registration Error", description: "Firebase services not initialized.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    if (registrationStep === 'initial') {
      try {
        // Step 1: Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const firebaseUser = userCredential.user;

        // Update Firebase Auth profile with name (optional but good practice)
        await updateFirebaseUserProfile(firebaseUser, { displayName: values.name });
        setFirebaseUserForLinking(firebaseUser); // Store for potential phone linking

        // Step 2: Store additional profile information in Firestore
        const userProfile: any = {
          uid: firebaseUser.uid, // Store UID
          name: values.name,
          email: values.email,
          role: values.role as UserRole,
          createdAt: serverTimestamp(),
          status: (values.role === 'driver' || values.role === 'operator') ? 'Pending Approval' : 'Active',
          ...(values.role === 'driver' && values.vehicleCategory && { vehicleCategory: values.vehicleCategory }),
        };
        await setDoc(doc(db, "users", firebaseUser.uid), userProfile);

        if (values.phoneNumber && values.phoneNumber.trim() !== "" && recaptchaVerifierRef.current) {
          toast({ title: "Account Created!", description: "Next, verify your phone number."});
          const appVerifier = recaptchaVerifierRef.current;
          const result = await linkWithPhoneNumber(firebaseUser, values.phoneNumber, appVerifier);
          setConfirmationResult(result);
          setRegistrationStep('verifyingPhone');
          setIsSubmitting(false); // Allow user to enter code
          form.setFocus("verificationCode");
        } else {
          // No phone number or reCAPTCHA not ready, complete registration
          contextLogin(firebaseUser.email || values.email, values.name, values.role as UserRole, values.role === 'driver' ? values.vehicleCategory : undefined);
          toast({ title: "Registration Successful!", description: `Welcome, ${values.name}! Your account created.` });
          setIsSubmitting(false);
        }
      } catch (error: any) {
        // Handle Firebase Auth and Firestore errors
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
        await confirmationResult.confirm(values.verificationCode);
        
        // Phone linked successfully, update Firestore profile
        const userDocRef = doc(db, "users", firebaseUserForLinking.uid);
        await updateDoc(userDocRef, {
          phoneNumber: firebaseUserForLinking.phoneNumber, // Get from firebaseUser after linking
          phoneVerified: true,
        });

        // Update auth context with potentially new info
        updateUserProfileInContext({ 
            phoneNumber: firebaseUserForLinking.phoneNumber, 
            phoneVerified: true 
        });

        toast({ title: "Phone Verified!", description: "Your phone number has been successfully linked." });
        // contextLogin was already called if registration part succeeded, now just ensure UI consistency if needed
        // Usually, contextLogin handles redirect, so if user is already "logged in" in context, redirect happens.
        // If not, need to call contextLogin again with full info
        if (!contextLogin) console.error("Auth context login function is not available after phone verification");
        
        const finalRole = form.getValues("role") as UserRole;
        const finalVehicleCategory = form.getValues("vehicleCategory");
        contextLogin(
            firebaseUserForLinking.email || form.getValues("email"), 
            firebaseUserForLinking.displayName || form.getValues("name"), 
            finalRole, 
            finalRole === 'driver' ? finalVehicleCategory : undefined,
            firebaseUserForLinking.phoneNumber,
            true
        );
        // Redirect is handled by contextLogin

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
        case 'auth/operation-not-allowed': errorMessage = 'Email/password accounts are not enabled.'; break;
        case 'auth/weak-password': errorMessage = 'Password is too weak.'; break;
        default: errorMessage = `Auth error: ${error.message} (Code: ${error.code})`;
      }
    } else if (error.message?.includes('firestore')) {
       errorMessage = `Profile creation error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    console.error("Registration error:", error);
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
                <FormItem><FormLabel>Phone Number (Optional, e.g., +16505551234)</FormLabel><FormControl><Input type="tel" placeholder="Enter your phone number" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
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
        
        {/* This div is used by RecaptchaVerifier. It can be hidden if using invisible reCAPTCHA. */}
        <div ref={recaptchaContainerRef} id="recaptcha-container-register"></div>

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
