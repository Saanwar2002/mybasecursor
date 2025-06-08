
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

  // Conceptual fields for Fair Ride Assignment (populated by backend)
  currentSessionId?: string | null;
  lastLoginAt?: string | null; // ISO string representation of Timestamp
  totalEarningsCurrentSession?: number | null; // In smallest currency unit (e.g., pence)
  totalDurationOnlineCurrentSessionSeconds?: number | null;
  currentHourlyRate?: number | null; // Calculated: totalEarningsCurrentSession / (totalDurationOnlineCurrentSessionSeconds / 3600)
}

interface AuthContextType {
  user: User | null;
  loginWithEmail: (email: string, pass: string) => Promise<void>; 
  loginAsGuest: (role: UserRole) => Promise<void>; // Added for guest login
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

  const setUserContextAndRedirect = async (firebaseUser: FirebaseUser | null, isInitialLoad: boolean = false, isGuestLogin: boolean = false, guestRole?: UserRole) => {
    if (firebaseUser && !isGuestLogin) {
      console.log(`AuthContext.setUserContextAndRedirect: Starting for Firebase UID ${firebaseUser.uid}. InitialLoad: ${isInitialLoad}`);
      try {
        if (!db) {
          console.error("AuthContext.setUserContextAndRedirect: Firestore (db) is not initialized.");
          toast({ title: "Critical Error", description: "Database connection failed. Please contact support.", variant: "destructive" });
          if(auth) await signOut(auth);
          setUser(null);
          setLoading(false);
          if (!isInitialLoad) router.push('/login');
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
            // Initialize conceptual fields for fairness system (backend would populate these)
            currentSessionId: firestoreUser.currentSessionId || null,
            lastLoginAt: firestoreUser.lastLoginAt ? (firestoreUser.lastLoginAt as Timestamp).toDate().toISOString() : null,
            totalEarningsCurrentSession: firestoreUser.totalEarningsCurrentSession || null,
            totalDurationOnlineCurrentSessionSeconds: firestoreUser.totalDurationOnlineCurrentSessionSeconds || null,
            currentHourlyRate: firestoreUser.currentHourlyRate || null,
          };
          setUser(userData);
          console.log("AuthContext.setUserContextAndRedirect: Firestore profile found. User context set:", userData.email, userData.role);

          // Redirection logic moved to useEffect watching `user` and `loading`
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
        if (!isGuestLogin) setLoading(false); // setLoading(false) for guest login is handled in loginAsGuest
      }
    } else if (!isGuestLogin) { // Only set user to null if it's not a guest login flow that will set it
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
    setLoading(true);
    console.log("AuthContext.loginWithEmail: Explicit signOut before new login attempt...");
    try {
      await signOut(auth);
      console.log("AuthContext.loginWithEmail: Pre-login signOut successful or no user was signed in.");
    } catch (signOutError) {
      console.warn("AuthContext.loginWithEmail: Error during pre-emptive signOut (continuing with login):", signOutError);
    }

    try {
      console.log(`AuthContext.loginWithEmail: Attempting signInWithEmailAndPassword for ${email}`);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      console.log("AuthContext.loginWithEmail: signInWithEmailAndPassword SUCCESS for UID:", userCredential.user.uid);
      // `onAuthStateChanged` will pick up the new user and call `setUserContextAndRedirect`
      // For a more immediate feel, we could call it here too, but it might lead to double processing.
      // Let's rely on onAuthStateChanged primarily.
      // setLoading(false) will be handled by onAuthStateChanged's call to setUserContextAndRedirect
    } catch (error: any) {
      setLoading(false);
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
    }
  };

  const loginAsGuest = async (role: UserRole) => {
    console.log(`AuthContext: loginAsGuest called for role: ${role}`);
    setLoading(true);
    if (auth) {
      try {
        await signOut(auth);
        console.log("AuthContext.loginAsGuest: Signed out any existing Firebase user.");
      } catch (e) {
        console.warn("AuthContext.loginAsGuest: Error signing out Firebase user before guest login", e);
      }
    }

    let guestUser: User | null = null;
    const baseGuestData = {
      id: `guest-${role}-${Date.now().toString().slice(-6)}`, // More concise unique ID for session
      email: `guest.${role}@example.com`,
      phoneVerified: true,
      status: 'Active' as 'Active',
      phoneVerificationDeadline: null,
      phoneNumber: `+155501${Math.floor(Math.random()*90)+10}` // mock phone for passenger
    };

    switch (role) {
      case 'passenger':
        guestUser = { ...baseGuestData, name: 'Guest Passenger', role: 'passenger' };
        break;
      case 'driver':
        guestUser = {
          ...baseGuestData,
          name: 'Guest Driver',
          role: 'driver',
          operatorCode: 'OP-GUEST',
          driverIdentifier: 'DR-GUEST',
          vehicleCategory: 'car',
          customId: 'DR-GUEST', // drivers usually have customId as their driver ID
        };
        break;
      case 'operator':
        guestUser = {
          ...baseGuestData,
          name: 'Guest Operator',
          role: 'operator',
          customId: 'OP-GUEST', // operators often use customId for their operator code
          operatorCode: 'OP-GUEST',
        };
        break;
      case 'admin':
        guestUser = { ...baseGuestData, name: 'Guest Admin', role: 'admin' };
        break;
      default:
        toast({ title: "Error", description: "Invalid guest role specified.", variant: "destructive" });
        setLoading(false);
        return;
    }

    if (guestUser) {
      setUser(guestUser); // This will trigger the useEffect for redirection
      toast({ title: "Guest Login Successful", description: `Logged in as ${guestUser.name} (${guestUser.role})` });
    }
    setLoading(false); 
  };

  const logout = async () => {
    if (!auth) {
      console.warn("AuthContext.logout: Auth service not initialized. Clearing local state.");
      setUser(null);
      setLoading(false);
      router.push('/login');
      return;
    }
    console.log("AuthContext.logout: Attempting signOut.");
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null and setLoading to false.
      // Explicit redirect happens in useEffect.
      toast({title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error) {
      console.error("AuthContext.logout: Error signing out:", error);
      toast({title: "Logout Error", description: "Failed to log out properly.", variant: "destructive"});
      setUser(null); 
      setLoading(false);
      router.push('/login'); // Ensure redirect even on error
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
    
    console.log(`AuthContext Path Check: Path='${pathname}', User='${user ? user.email : 'null'}', Loading=${loading}, IsPublic=${isPublicPath}`);

    if (!user && !isPublicPath) {
      console.log(`AuthContext: No user & not public path (${pathname}). Redirecting to /login.`);
      router.push('/login');
    } else if (user && (isPublicPath && pathname !== '/')) { 
      console.log(`AuthContext: User exists & on auth/public path (${pathname}). Redirecting to role dashboard.`);
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'operator') router.push('/operator');
      else if (user.role === 'driver') router.push('/driver');
      else router.push('/dashboard');
    } else if (user && isMarketingRoot) { 
        console.log(`AuthContext: User exists & on marketing root path ('/'). Redirecting to role dashboard.`);
        if (user.role === 'admin') router.push('/admin');
        else if (user.role === 'operator') router.push('/operator');
        else if (user.role === 'driver') router.push('/driver');
        else router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);


  return (
    <AuthContext.Provider value={{ user, loginWithEmail, loginAsGuest, logout, loading, updateUserProfileInContext }}>
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

