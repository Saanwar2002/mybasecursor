
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut } from 'firebase/auth'; 
import { doc, getDoc, Timestamp } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast'; 

export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin';

export interface User {
  id: string; 
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
  phoneVerificationDeadline?: string | null; 
}

interface AuthContextType {
  user: User | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>; 
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

  const setUserContextAndRedirect = async (firebaseUser: FirebaseUser | null, isInitialLoad: boolean = false) => {
    if (firebaseUser) {
      console.log(`AuthContext.setUserContextAndRedirect: Starting for UID ${firebaseUser.uid}. InitialLoad: ${isInitialLoad}`);
      try {
        if (!db) {
          console.error("AuthContext.setUserContextAndRedirect: Firestore (db) is not initialized.");
          toast({ title: "Critical Error", description: "Database connection failed. Please contact support.", variant: "destructive" });
          if(auth) await signOut(auth);
          setUser(null);
          setLoading(false);
          if (!isInitialLoad) router.push('/login'); // Avoid redirect loop on initial load if db fails early
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
            phoneVerified: firestoreUser.phoneVerified || false,
            status: firestoreUser.status || 'Active',
            phoneVerificationDeadline: firestoreUser.phoneVerificationDeadline
              ? (firestoreUser.phoneVerificationDeadline as Timestamp).toDate().toISOString()
              : null,
          };
          setUser(userData);
          console.log("AuthContext.setUserContextAndRedirect: Firestore profile found. User context set:", userData.email, userData.role);

          if (!isInitialLoad) { // Only redirect on manual login/action, not initial auth state check causing redirect.
            if (userData.role === 'admin') router.push('/admin');
            else if (userData.role === 'operator') router.push('/operator');
            else if (userData.role === 'driver') router.push('/driver');
            else router.push('/dashboard');
          }
        } else {
          console.error(`AuthContext.setUserContextAndRedirect: User ${firebaseUser.uid} profile NOT FOUND in Firestore.`);
          toast({ title: "Profile Error", description: "Your user profile is incomplete or not found. Logging out.", variant: "destructive" });
          if (auth) await signOut(auth);
          setUser(null);
          if (!isInitialLoad || pathname !== '/login') router.push('/login');
        }
      } catch (error) {
        console.error("AuthContext.setUserContextAndRedirect: Error fetching/setting profile:", error);
        toast({ title: "Login Error", description: "Could not retrieve your profile details. Logging out.", variant: "destructive" });
        if (auth) await signOut(auth);
        setUser(null);
        if (!isInitialLoad || pathname !== '/login') router.push('/login');
      } finally {
        setLoading(false);
      }
    } else {
      console.log("AuthContext.setUserContextAndRedirect: No Firebase user provided. Setting context user to null.");
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) {
      console.warn("AuthContext: Firebase auth is not initialized. Auth state will not be monitored.");
      setLoading(false);
      if (!publicPaths.some(p => pathname.startsWith(p)) && pathname !== '/') {
        router.push('/login');
      }
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("AuthContext: onAuthStateChanged event. Firebase user UID:", firebaseUser ? firebaseUser.uid : "null");
      await setUserContextAndRedirect(firebaseUser, true);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const loginWithEmail = async (email: string, pass: string) => {
    if (!auth) {
      toast({ title: "Error", description: "Authentication service not ready.", variant: "destructive" });
      throw new Error("Auth service not ready");
    }

    console.log("AuthContext.loginWithEmail: Attempting explicit signOut before new login...");
    try {
      await signOut(auth);
      console.log("AuthContext.loginWithEmail: Pre-login signOut successful or no user was signed in.");
    } catch (signOutError) {
      console.warn("AuthContext.loginWithEmail: Error during pre-emptive signOut (continuing with login):", signOutError);
    }

    setLoading(true);
    try {
      console.log(`AuthContext.loginWithEmail: Attempting signInWithEmailAndPassword for ${email}`);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      console.log("AuthContext.loginWithEmail: signInWithEmailAndPassword SUCCESS for UID:", userCredential.user.uid);
      
      // Call setUserContextAndRedirect. It handles its own loading state for profile fetch.
      // onAuthStateChanged will also fire, but calling this ensures immediate profile fetch & redirect logic.
      await setUserContextAndRedirect(userCredential.user, false); 
      
      // Success toast should only be shown if the entire process, including profile fetch, is successful.
      // setUserContextAndRedirect handles errors internally and logs out if profile fetch fails.
      // So, if we reach here, it means profile was likely okay (or user was logged out by it already).
      // Check if user is set to current user, if so, profile fetch was good.
      if (auth.currentUser && auth.currentUser.uid === userCredential.user.uid) {
           toast({ title: "Login Successful!", description: `Welcome back!` });
      } else {
          console.warn("AuthContext.loginWithEmail: User state mismatch after profile fetch or user signed out by profile fetch error. No success toast.");
      }

    } catch (error: any) {
      setLoading(false); // Ensure loading is false if an error occurs here.
      console.error("AuthContext.loginWithEmail CAUGHT ERROR. Code:", error.code, "Message:", error.message);
      let specificErrorMessage = "An unexpected login error occurred.";
      let errorSource = "Unknown";

      if (error.code && typeof error.code === 'string' && error.code.startsWith('auth/')) {
        errorSource = "Firebase Auth";
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            specificErrorMessage = "Invalid email or password. Please try again.";
            break;
          case 'auth/invalid-email':
            specificErrorMessage = "The email address provided is not valid.";
            break;
          case 'auth/user-disabled':
            specificErrorMessage = "This user account has been disabled by an administrator.";
            break;
          default:
            specificErrorMessage = error.message || "An unknown Firebase Auth error occurred.";
        }
      } else if (error.message) {
        errorSource = "Profile Fetch/Set or Other";
        specificErrorMessage = `Login process error: ${error.message}`;
      }
      
      console.log(`AuthContext.loginWithEmail: Displaying 'Login Failed' toast. Source: ${errorSource}, Message: ${specificErrorMessage}`);
      toast({ title: "Login Failed", description: specificErrorMessage, variant: "destructive" });
      // Do not re-throw the error from here for now to let this context handle the toast.
      // throw error; 
    }
  };

  const logout = async () => {
    if (!auth) {
      console.warn("AuthContext.logout: Auth service not initialized. Clearing local state.");
      setUser(null);
      setLoading(false); // Ensure loading is false
      router.push('/login');
      return;
    }
    console.log("AuthContext.logout: Attempting signOut.");
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setting user to null and setLoading(false)
      router.push('/login'); // Explicit redirect
      toast({title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error) {
      console.error("AuthContext.logout: Error signing out:", error);
      toast({title: "Logout Error", description: "Failed to log out properly.", variant: "destructive"});
      setUser(null); // Force clear local state
      setLoading(false);
      router.push('/login');
    }
  };
  
  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updatedProfileData, id: currentUser.id };
        console.log("AuthContext.updateUserProfileInContext: User profile updated in context.", updatedUser);
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

    if (!user && !isPublicPath) {
      console.log(`AuthContext: Path protection. No user & not public path (${pathname}). Redirecting to /login.`);
      router.push('/login');
    } else if (user && (isPublicPath && pathname !== '/')) { // Allow user to be on '/' briefly before redirect if they landed there
      console.log(`AuthContext: Path protection. User exists & on auth/public path (${pathname}). Redirecting based on role: ${user.role}.`);
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'operator') router.push('/operator');
      else if (user.role === 'driver') router.push('/driver');
      else router.push('/dashboard');
    } else if (user && isMarketingRoot) { // If user is on '/' (marketing root)
        console.log(`AuthContext: Path protection. User exists & on marketing root path ('/'). Redirecting based on role: ${user.role}.`);
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
