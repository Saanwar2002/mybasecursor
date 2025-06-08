
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; // Import db and auth
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut } from 'firebase/auth'; // Import Firebase Auth functions
import { doc, getDoc, Timestamp } from 'firebase/firestore'; // Import Firestore functions
import { useToast } from '@/hooks/use-toast'; // Assuming you have a toast hook

export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin';

export interface User {
  id: string; // This is firebaseUser.uid
  email: string;
  name: string;
  role: UserRole;
  customId?: string;
  operatorCode?: string;
  driverIdentifier?: string;
  vehicleCategory?: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  status?: 'Active' | 'Pending Approval' | 'Suspended';
  phoneVerificationDeadline?: string | null; // ISO string or null
}

interface AuthContextType {
  user: User | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>; // Specific to email/pass login
  logout: () => void;
  loading: boolean;
  updateUserProfileInContext: (updatedProfileData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const setUserContextAndRedirect = async (firebaseUser: FirebaseUser | null, initialLoad: boolean = false) => {
    if (firebaseUser) {
      try {
        if (!db) {
          console.error("Firestore (db) is not initialized. Cannot fetch user profile.");
          toast({ title: "Critical Error", description: "Database connection failed. Please contact support.", variant: "destructive" });
          await signOut(auth); // Log out from Firebase Auth
          setUser(null);
          setLoading(false);
          router.push('/login');
          return;
        }
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const firestoreUser = userDocSnap.data();
          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || firestoreUser.email || "",
            name: firestoreUser.name || firebaseUser.displayName || "User",
            role: firestoreUser.role || 'passenger',
            customId: firestoreUser.customId,
            operatorCode: firestoreUser.operatorCode,
            driverIdentifier: firestoreUser.driverIdentifier,
            vehicleCategory: firestoreUser.vehicleCategory,
            phoneNumber: firestoreUser.phoneNumber || firebaseUser.phoneNumber,
            phoneVerified: firestoreUser.phoneVerified,
            status: firestoreUser.status || 'Active',
            phoneVerificationDeadline: firestoreUser.phoneVerificationDeadline
              ? (firestoreUser.phoneVerificationDeadline as Timestamp).toDate().toISOString()
              : null,
          };
          setUser(userData);
          console.log("AuthContext: User profile fetched and set:", userData);

          if (!initialLoad) { // Only redirect if it's a manual login, not initial auth state check
            if (userData.role === 'admin') router.push('/admin');
            else if (userData.role === 'operator') router.push('/operator');
            else if (userData.role === 'driver') router.push('/driver');
            else router.push('/dashboard');
          }
        } else {
          console.error(`User ${firebaseUser.uid} authenticated with Firebase Auth but no profile found in Firestore.`);
          toast({ title: "Profile Error", description: "Your user profile is incomplete or not found. Logging out.", variant: "destructive" });
          await signOut(auth); // Log out from Firebase Auth
          setUser(null);
          router.push('/login');
        }
      } catch (error) {
        console.error("Error fetching user profile from Firestore:", error);
        toast({ title: "Login Error", description: "Could not retrieve your profile details. Logging out.", variant: "destructive" });
        await signOut(auth); // Log out on error
        setUser(null);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) {
      console.error("AuthContext: Firebase auth is not initialized. User state will not be monitored.");
      setLoading(false);
      if (!publicPaths.some(p => pathname.startsWith(p)) && pathname !== '/') {
        router.push('/login');
      }
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthContext: onAuthStateChanged triggered. Firebase user:", firebaseUser ? firebaseUser.uid : "null");
      await setUserContextAndRedirect(firebaseUser, true); // true indicates initial load
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // router and pathname removed to prevent re-running on navigation for auth state check


  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      toast({ title: "Error", description: "Authentication service not ready.", variant: "destructive" });
      throw new Error("Auth service not ready");
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      // User profile fetching and redirection is handled by onAuthStateChanged listener
      // or by calling setUserContextAndRedirect directly if preferred after signIn
      await setUserContextAndRedirect(userCredential.user, false); // false indicates manual login
      toast({ title: "Login Successful!", description: `Welcome back!` });
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase login error in loginWithEmail:", error);
      let errorMessage = "Failed to log in.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = "Invalid email or password.";
            break;
          default:
            errorMessage = `Login error: ${error.message}`;
        }
      }
      toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
      throw error; // Re-throw to be caught by the form
    }
    // setLoading(false) is handled by setUserContextAndRedirect
  };

  const logout = async () => {
    if (!auth) {
      setUser(null);
      router.push('/login');
      return;
    }
    try {
      await signOut(auth);
      setUser(null); // onAuthStateChanged will also set user to null
      router.push('/login');
      toast({title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error) {
      console.error("Error signing out:", error);
      toast({title: "Logout Error", description: "Failed to log out properly.", variant: "destructive"});
      // Still attempt to clear local state and redirect
      setUser(null);
      router.push('/login');
    }
  };
  
  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updatedProfileData, id: currentUser.id };
        return updatedUser;
      }
      return null;
    });
  };
  
  const publicPaths = ['/login', '/register', '/forgot-password'];

  useEffect(() => {
    if (loading) return;

    const isMarketingRoot = pathname === '/';
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p)) || isMarketingRoot;

    console.log("AuthContext Redirection Check: User:", user ? user.email : "null", "Path:", pathname, "IsPublic:", isPublicPath);

    if (!user && !isPublicPath) {
      console.log("AuthContext: No user & not public path, redirecting to /login. Current:", pathname);
      router.push('/login');
    } else if (user && (isMarketingRoot || publicPaths.some(p => pathname.startsWith(p)))) {
      console.log("AuthContext: User exists & on public/auth path, redirecting. Role:", user.role, "Current:", pathname);
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'operator') router.push('/operator');
      else if (user.role === 'driver') router.push('/driver');
      else router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);


  return (
    <AuthContext.Provider value={{ user, loginWithEmail, logout, loading, updateUserProfileInContext }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

    