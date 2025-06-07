
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button"; // Still imported but not used in minimal test
import {
  Form, // Still imported but not used in minimal test
} from "@/components/ui/form";
import { Input } from "@/components/ui/input"; // Still imported but not used in minimal test
import { useAuth, UserRole, User } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Still imported
import Link from "next/link";
import { User as UserIconLucide, Briefcase, CarIcon as CarIconLucide, Loader2, Shield, KeyRound, AlertTriangle, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator"; // Still imported
import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Still imported


// Schemas are kept for when we uncomment the forms
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
  const { toast } = useToast(); // Kept for when we uncomment
  const [isLoading, setIsLoading] = useState(false); // Kept for when we uncomment
  const [loginMode, setLoginMode] = useState<'email' | 'pin'>('email'); // Kept
  const [storedPinUser, setStoredPinUser] = useState<StoredPinUser | null>(null); // Kept
  const [pinInputValue, setPinInputValue] = useState(""); // Kept

  // Test 1: Alert on component mount
  useEffect(() => {
    alert('LoginForm component has mounted!');
    console.log('LoginForm component has mounted! (console)');
  }, []);


  // Schemas and form instances are kept for when we uncomment the forms
   const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "", role: "passenger" },
  });

  const pinForm = useForm<z.infer<typeof pinFormSchema>>({
    resolver: zodResolver(pinFormSchema),
    defaultValues: { pin: "" },
  });

  // onSubmit, onPinSubmit, handleGuestLogin are kept for when we uncomment
  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Original logic will be here
    console.log("Original onSubmit called with:", values);
    toast({title: "Email/Pass Submit (Placeholder)", description: "Original onSubmit was called."});
  }

  async function onPinSubmit(values: z.infer<typeof pinFormSchema>) {
    // Original logic will be here
    console.log("Original onPinSubmit called with:", values);
    toast({title: "PIN Submit (Placeholder)", description: "Original onPinSubmit was called."});
  }

  const handleGuestLogin = (role: UserRole) => {
    console.log(`Guest login attempt for role: ${role}`);
    toast({ title: `Guest Login: ${role}`, description: "Original handleGuestLogin was called." });
    // Original logic will be here
  };

  return (
    <>
      <div style={{ padding: '20px', border: '2px solid red', margin: '20px' }}>
        <h1>Minimal Test Page</h1>
        <p>If you see this, React is rendering.</p>

        {/* Test 2: Simplest HTML button with inline alert */}
        <button
          onClick={() => alert('Minimal HTML button clicked!')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            margin: '10px',
            border: '1px solid blue',
            backgroundColor: 'lightblue',
          }}
        >
          Test Basic HTML Button
        </button>
        <p>
          <Link href="/register" style={{color: 'blue', textDecoration: 'underline'}}>Go to Register Page (Test Link)</Link>
        </p>
      </div>
    </>
  );
}
