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
import { Car, Loader2, Briefcase, Shield } from "lucide-react"; 
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

interface Operator {
  operatorCode: string;
  displayName: string;
}

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  role: z.enum(["passenger", "driver", "operator", "admin"], { required_error: "You must select a role." }), 
  vehicleCategory: z.string().optional(),
  selectedOperatorCode: z.string().optional(), 
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
  if (data.role === 'driver') {
    return !!data.selectedOperatorCode && data.selectedOperatorCode.trim() !== "";
  }
  return true;
}, {
  message: "Please select an operator for drivers.",
  path: ["selectedOperatorCode"],
}).refine(data => {
  if (data.role === 'passenger') {
    return !!data.phoneNumber && data.phoneNumber.trim() !== "" && phoneRegex.test(data.phoneNumber);
  }
  return !data.phoneNumber || data.phoneNumber.trim() === "" || phoneRegex.test(data.phoneNumber);
}, {
  message: "Valid phone number (e.g., +14155552671) is required for passengers.",
  path: ["phoneNumber"],
});

type RegistrationStep = 'initial' | 'verifyingPhone';

interface UserProfile { 
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: any; 
  status: 'Active' | 'Pending Approval' | 'Suspended';
  customId?: string; 
  operatorCode?: string; 
  driverIdentifier?: string; 
  vehicleCategory?: string; 
  phoneNumberInput?: string; 
  phoneNumber?: string | null; 
  phoneVerified?: boolean;
  phoneVerificationDeadline?: Timestamp | null;
}

// Helper function to generate driver ID with operator prefix
function generateDriverId(operatorCode: string, uid: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${operatorCode}/${timestamp}${randomSuffix}`;
}

export function RegisterForm() {
  const { loginWithEmail: contextLogin, updateUserProfileInContext } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<RegistrationStep>('initial');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [firebaseUserForLinking, setFirebaseUserForLinking] = useState<FirebaseUser | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  
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
      selectedOperatorCode: "",
      phoneNumber: "",
      verificationCode: "",
    },
  });

  const watchedRole = form.watch("role");

  // Fetch operators when driver role is selected
  useEffect(() => {
    if (watchedRole === 'driver' && operators.length === 0 && !isLoadingOperators) {
      fetchOperators();
    }
  }, [watchedRole, operators.length, isLoadingOperators]);

  const fetchOperators = async () => {
    setIsLoadingOperators(true);
    try {
      const response = await fetch('/api/operators/list');
      if (response.ok) {
        const data = await response.json();
        setOperators(data.operators);
      } else {
        console.error('Failed to fetch operators');
        toast({ 
          title: "Error", 
          description: "Could not load operator list. Please try again.", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Error fetching operators:', error);
      toast({ 
        title: "Error", 
        description: "Could not load operator list. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoadingOperators(false);
    }
  };

  useEffect(() => {
    if (auth && recaptchaContainerRef.current && !recaptchaVerifierRef.current && registrationStep === 'initial') {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          'size': 'invisible',
          'callback': (response: any) => {
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
  }, [auth, registrationStep, toast]); 

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !db) {
      toast({ title: "Registration Error", description: "Firebase services not initialized.", variant: "destructive", duration: 7000 });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);

    if (registrationStep === 'initial') {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const firebaseUser = userCredential.user;
        await updateFirebaseUserProfile(firebaseUser, { displayName: values.name });
        setFirebaseUserForLinking(firebaseUser);

        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: values.name,
          email: values.email,
          role: values.role as UserRole,
          createdAt: serverTimestamp(),
          status: (values.role === 'driver' || values.role === 'operator') ? 'Pending Approval' : 'Active',
        };
        
        if (values.role === 'passenger') userProfile.customId = `CU-mock-${firebaseUser.uid.slice(0,4)}`;
        if (values.role === 'operator') userProfile.customId = `OP-mock-${firebaseUser.uid.slice(0,4)}`;
        if (values.role === 'admin') userProfile.customId = `AD-mock-${firebaseUser.uid.slice(0,4)}`; 
        
        if (values.role === 'driver') {
          if (values.vehicleCategory) userProfile.vehicleCategory = values.vehicleCategory;
          if (values.selectedOperatorCode) userProfile.operatorCode = values.selectedOperatorCode;
          // Generate driver ID with operator prefix
          const driverId = generateDriverId(values.selectedOperatorCode!, firebaseUser.uid);
          userProfile.driverIdentifier = driverId;
          console.log(`Driver ID generated: ${driverId} for operator ${userProfile.operatorCode}`);
        }
        
        if (values.phoneNumber && values.phoneNumber.trim() !== "") {
            userProfile.phoneNumberInput = values.phoneNumber.trim(); 
        }

        if (values.role === 'passenger' && values.phoneNumber && values.phoneNumber.trim() !== "") {
            userProfile.phoneVerified = false;
            const deadline = new Date();
            deadline.setDate(deadline.getDate() + 7);
            userProfile.phoneVerificationDeadline = Timestamp.fromDate(deadline);
        }

        await setDoc(doc(db, "users", firebaseUser.uid), userProfile);

        const shouldVerifyPhone = (values.role === 'passenger' && values.phoneNumber && values.phoneNumber.trim() !== "") ||
                                  ((values.role === 'driver' || values.role === 'operator' || values.role === 'admin') && values.phoneNumber && values.phoneNumber.trim() !== "");

        if (shouldVerifyPhone && recaptchaVerifierRef.current) {
          toast({ title: "Account Created!", description: "Next, verify your phone number."});
          const appVerifier = recaptchaVerifierRef.current;
          
          try {
            const result = await linkWithPhoneNumber(firebaseUser, values.phoneNumber!, appVerifier);
            setConfirmationResult(result);
            setRegistrationStep('verifyingPhone');
            setIsSubmitting(false); 
            form.setFocus("verificationCode");
          } catch (phoneLinkError: any) {
            if (recaptchaVerifierRef.current) {
              recaptchaVerifierRef.current.render().then((widgetId) => {
                if (typeof window !== 'undefined' && (window as any).grecaptcha) {
                  (window as any).grecaptcha.reset(widgetId);
                }
              }).catch(e => console.error("Error resetting reCAPTCHA widget after phone link error:", e));
            }
            handleRegistrationError(phoneLinkError);
            setIsSubmitting(false);
            setFirebaseUserForLinking(null);
          }
        } else {
          contextLogin(userProfile as User);
          const successMessage = values.role === 'driver' 
            ? `Welcome, ${values.name}! Your MyBase account as a driver has been created. Your Driver ID is ${userProfile.driverIdentifier}. You are pending approval from your operator.`
            : `Welcome, ${values.name}! Your MyBase account as a ${values.role} has been created.`;
          toast({ title: "Registration Successful!", description: successMessage });
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
          phoneNumber: firebaseUserForLinking.phoneNumber, 
          phoneVerified: true,
          phoneVerificationDeadline: deleteField(),
        });

        updateUserProfileInContext({ 
            phoneNumber: firebaseUserForLinking.phoneNumber, 
            phoneVerified: true,
            phoneVerificationDeadline: null,
        });

        toast({ title: "Phone Verified!", description: "Your phone number has been successfully linked." });
        
        const userProfileSnapshot = await getDoc(userDocRef);
        const finalProfile = userProfileSnapshot.data() as UserProfile | undefined;

        if (finalProfile) {
          contextLogin(finalProfile as User);
        } else {
          // Fallback if the profile somehow isn't available
          const fallbackProfile: User = {
            id: firebaseUserForLinking.uid,
            email: firebaseUserForLinking.email || form.getValues("email"),
            name: firebaseUserForLinking.displayName || form.getValues("name"),
            role: form.getValues("role") as UserRole,
            phoneVerified: true,
            phoneNumber: firebaseUserForLinking.phoneNumber,
            status: 'Active',
          };
          contextLogin(fallbackProfile);
        }
        
        setIsSubmitting(false);
      } catch (error: any) {
        handleRegistrationError(error);
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
        case 'auth/missing-phone-number': errorMessage = 'Phone number is missing for verification.'; break;
        case 'auth/invalid-phone-number': errorMessage = 'The phone number is invalid (e.g., +14155552671).'; break;
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
                <FormItem>
                  <FormLabel>{watchedRole === 'operator' ? 'Company / Taxi Base Name' : 'Full Name'}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={watchedRole === 'operator' ? 'e.g., City Taxis Ltd' : 'John Doe'} 
                      {...field} 
                      disabled={isSubmitting} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="your@email.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem className="space-y-3"><FormLabel>Register as:</FormLabel><FormControl><RadioGroup onValueChange={(value) => { 
                    field.onChange(value); 
                    if (value !== 'driver') { 
                        form.setValue('vehicleCategory', undefined); 
                        form.clearErrors('vehicleCategory');
                        form.setValue('selectedOperatorCode', "");
                        form.clearErrors('selectedOperatorCode');
                    } else { 
                        form.setValue('vehicleCategory', 'car');
                    }
                    if (value !== 'passenger') {
                        form.setValue('phoneNumber', ""); 
                        form.clearErrors('phoneNumber'); 
                    }
                 }} defaultValue={field.value} className="flex flex-col space-y-1 md:flex-row md:flex-wrap md:space-y-0 md:space-x-2" disabled={isSubmitting}>
                    <FormItem className="flex items-center space-x-3 space-y-0 p-1"><FormControl><RadioGroupItem value="passenger" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Passenger</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0 p-1"><FormControl><RadioGroupItem value="driver" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Driver</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0 p-1"><FormControl><RadioGroupItem value="operator" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Taxi Base Operator</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0 p-1"><FormControl><RadioGroupItem value="admin" disabled={isSubmitting} /></FormControl><FormLabel className="font-normal">Platform Administrator</FormLabel></FormItem>
                </RadioGroup></FormControl><FormMessage /></FormItem>
            )} />
            {watchedRole === "driver" && (
              <>
                <FormField control={form.control} name="selectedOperatorCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4 text-muted-foreground" /> 
                        Select Your Operator <span className="text-destructive font-bold">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || isLoadingOperators}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingOperators ? "Loading operators..." : "Choose your operator"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {operators.map((operator) => (
                            <SelectItem key={operator.operatorCode} value={operator.operatorCode}>
                              {operator.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="vehicleCategory" render={({ field }) => (
                    <FormItem><FormLabel className="flex items-center gap-1"><Car className="w-4 h-4 text-muted-foreground" /> Vehicle Category <span className="text-destructive font-bold">*</span></FormLabel><Select onValueChange={field.onChange} defaultValue={field.value || "car"} disabled={isSubmitting}><FormControl><SelectTrigger><SelectValue placeholder="Select vehicle category" /></SelectTrigger></FormControl><SelectContent>
                        <SelectItem value="car">Car (Standard)</SelectItem><SelectItem value="estate">Estate Car</SelectItem><SelectItem value="minibus_6">Minibus (6 people)</SelectItem><SelectItem value="minibus_8">Minibus (8 people)</SelectItem>
                    </SelectContent></Select><FormMessage /></FormItem>
                )} />
              </>
            )}
            <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone Number {watchedRole === 'passenger' && <span className="text-destructive font-bold">*</span>} { (watchedRole === 'driver' || watchedRole === 'operator' || watchedRole === 'admin') && '(Optional)' }
                  </FormLabel>
                  <FormControl><Input type="tel" placeholder="+16505551234" {...field} disabled={isSubmitting || (watchedRole !== 'passenger' && !field.value && !form.formState.dirtyFields.phoneNumber) } /></FormControl>
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
