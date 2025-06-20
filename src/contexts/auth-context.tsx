"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth'; 
import { doc, getDoc, Timestamp, setDoc } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast'; 
import { Firestore } from 'firebase/firestore';

export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin';

export interface User {
  id: string; 
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null; // Added avatarUrl
  preferredPaymentMethod?: 'card' | 'cash'; // Added passenger payment preference
  customId?: string;
  operatorCode?: string;
  driverIdentifier?: string;
  vehicleCategory?: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  status?: 'Active' | 'Pending Approval' | 'Suspended';
  phoneVerificationDeadline?: string | null; 
  acceptsPetFriendlyJobs?: boolean; 
  acceptsPlatformJobs?: boolean; 
  maxJourneyDistance?: string; 
  dispatchMode?: 'auto' | 'manual'; 
  acceptsAccountJobs?: boolean; 

  vehicleMakeModel?: string;
  vehicleRegistration?: string;
  vehicleColor?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string; 
  motExpiryDate?: string; 
  taxiLicenseNumber?: string;
  taxiLicenseExpiryDate?: string; 

  currentSessionId?: string | null;
  lastLoginAt?: string | null; 
  totalEarningsCurrentSession?: number | null; 
  totalDurationOnlineCurrentSessionSeconds?: number | null;
  currentHourlyRate?: number | null; 
}

interface AuthContextType {
  user: User | null;
  db: Firestore | null;
  login: (email: string, pass: string) => Promise<void>; 
  loginAsGuest: (role: UserRole) => Promise<User>; 
  logout: () => void;
  loading: boolean;
  updateUserProfileInContext: (updatedProfileData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PLATFORM_OPERATOR_CODE = "OP001"; 

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
            avatarUrl: firestoreUser.avatarUrl || null,
            preferredPaymentMethod: firestoreUser.preferredPaymentMethod || 'card',
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
            acceptsPetFriendlyJobs: firestoreUser.acceptsPetFriendlyJobs || false,
            acceptsPlatformJobs: firestoreUser.operatorCode === PLATFORM_OPERATOR_CODE ? true : (firestoreUser.acceptsPlatformJobs || false),
            maxJourneyDistance: firestoreUser.maxJourneyDistance || "no_limit", 
            dispatchMode: firestoreUser.dispatchMode || 'auto', 
            acceptsAccountJobs: firestoreUser.acceptsAccountJobs === undefined ? true : firestoreUser.acceptsAccountJobs, 
            vehicleMakeModel: firestoreUser.vehicleMakeModel,
            vehicleRegistration: firestoreUser.vehicleRegistration,
            vehicleColor: firestoreUser.vehicleColor,
            insurancePolicyNumber: firestoreUser.insurancePolicyNumber,
            insuranceExpiryDate: firestoreUser.insuranceExpiryDate, 
            motExpiryDate: firestoreUser.motExpiryDate, 
            taxiLicenseNumber: firestoreUser.taxiLicenseNumber,
            taxiLicenseExpiryDate: firestoreUser.taxiLicenseExpiryDate, 
            currentSessionId: firestoreUser.currentSessionId || null,
            lastLoginAt: firestoreUser.lastLoginAt ? (firestoreUser.lastLoginAt as Timestamp).toDate().toISOString() : null,
            totalEarningsCurrentSession: firestoreUser.totalEarningsCurrentSession || null,
            totalDurationOnlineCurrentSessionSeconds: firestoreUser.totalDurationOnlineCurrentSessionSeconds || null,
            currentHourlyRate: firestoreUser.currentHourlyRate || null,
          };
          setUser(userData);
          console.log("AuthContext.setUserContextAndRedirect: Firestore profile found. User context set:", userData.email, userData.role);

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
        if (!isGuestLogin) setLoading(false); 
      }
    } else if (!isGuestLogin) { 
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

  const loginAsGuest = async (role: UserRole): Promise<User> => {
    setLoading(true);
    if (!auth || !db) {
      const error = new Error("Authentication service not ready.");
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      throw error;
    }

    try {
      await signOut(auth);
      const userCredential = await signInAnonymously(auth);
      const firebaseUser = userCredential.user;
      
      const guestUserData: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || `guest-${firebaseUser.uid.slice(0,5)}@example.com`,
        name: `Guest ${role.charAt(0).toUpperCase() + role.slice(1)}`,
        role: role,
        status: 'Active',
        phoneVerified: true,
      };

      // Create a basic user document in Firestore for the guest
      await setDoc(doc(db, "users", firebaseUser.uid), {
        name: guestUserData.name,
        email: guestUserData.email,
        role: guestUserData.role,
        createdAt: Timestamp.now(),
      });

      setUser(guestUserData);
      setLoading(false);
      return guestUserData;

    } catch (error: any) {
      console.error("Error during guest login:", error);
      const errorMessage = error.message || "Could not sign in as guest.";
      toast({ title: "Guest Login Failed", description: errorMessage, variant: "destructive" });
      setLoading(false);
      throw error;
    }
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
      toast({title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error) {
      console.error("AuthContext.logout: Error signing out:", error);
      toast({title: "Logout Error", description: "Failed to log out properly.", variant: "destructive"});
    } finally {
      setUser(null); 
      setLoading(false);
      router.push('/login'); 
    }
  };
  
  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        let finalAcceptsPlatformJobs = currentUser.acceptsPlatformJobs;
        if ('operatorCode' in updatedProfileData && updatedProfileData.operatorCode === PLATFORM_OPERATOR_CODE) {
          finalAcceptsPlatformJobs = true;
        } else if (currentUser.operatorCode === PLATFORM_OPERATOR_CODE && !('acceptsPlatformJobs' in updatedProfileData)) {
          finalAcceptsPlatformJobs = true;
        }

        const updatedUser = { 
          ...currentUser, 
          ...updatedProfileData, 
          id: currentUser.id, 
          acceptsPlatformJobs: finalAcceptsPlatformJobs,
        };
        console.log("AuthContext.updateUserProfileInContext: User profile updated in context.", updatedUser);
        return updatedUser;
      }
      return null;
    });
  };
  
  const publicPaths = ['/login', '/register', '/forgot-password', '/test-marketing-layout'];

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

  const value = {
    user,
    db,
    loading,
    login: loginWithEmail,
    loginAsGuest,
    logout,
    updateUserProfileInContext,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { PLATFORM_OPERATOR_CODE };
