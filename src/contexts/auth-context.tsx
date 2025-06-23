"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; 
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, signOut, signInAnonymously, sendPasswordResetEmail } from 'firebase/auth'; 
import { doc, getDoc, Timestamp, setDoc } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast'; 
import { Firestore } from 'firebase/firestore';
import { PLATFORM_OPERATOR_CODE } from "@/lib/constants";

export { PLATFORM_OPERATOR_CODE };

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
  loginWithEmail: (email: string, pass: string, role: UserRole) => Promise<void>; 
  loginAsGuest: (role: UserRole) => Promise<User>; 
  logout: () => void;
  loading: boolean;
  updateUserProfileInContext: (updatedProfileData: Partial<User>) => void;
  getAuthToken: () => Promise<string | null>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const GUEST_DRIVER_ID = 'guest-driver';
export const driverPauseState = { isPaused: false };

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
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

          // Role verification for non-guest logins
          if (!isGuestLogin) {
            const tokenResult = await firebaseUser.getIdTokenResult(true);
            const claims = tokenResult.claims;
            const userRoleFromClaims = claims.admin ? 'admin' : claims.operator ? 'operator' : claims.driver ? 'driver' : 'passenger';
            
            console.log(`AuthContext: Role from claims: ${userRoleFromClaims}. Role from firestore: ${firestoreUser.role}`);

            if (firestoreUser.role !== userRoleFromClaims) {
              console.warn(`AuthContext: Mismatch between Firestore role (${firestoreUser.role}) and token claims role (${userRoleFromClaims}). Claims will be trusted.`);
            }

            if (guestRole && userRoleFromClaims !== guestRole) {
              console.error(`AuthContext: Role mismatch! User tried to log in as '${guestRole}' but their claim is '${userRoleFromClaims}'.`);
              toast({ title: "Access Denied", description: `You do not have permission to log in as a ${guestRole}.`, variant: "destructive" });
              if(auth) await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }
          }

          if (firestoreUser.isGuest) {
            console.log(`AuthContext.setUserContextAndRedirect: Detected guest user from Firestore doc for UID ${firebaseUser.uid}`);
            const guestUserData: User = {
              id: firestoreUser.role === 'driver' ? GUEST_DRIVER_ID : firebaseUser.uid,
              email: firestoreUser.email || `guest-${firebaseUser.uid.slice(0,5)}@example.com`,
              name: firestoreUser.name || 'Guest User',
              role: firestoreUser.role || 'passenger',
              status: 'Active',
              phoneVerified: true,
            };
            setUser(guestUserData);
            console.log("AuthContext.setUserContextAndRedirect: Guest user context set:", guestUserData.email, guestUserData.role, "with ID:", guestUserData.id);
          } else {
            console.log(`AuthContext.setUserContextAndRedirect: Detected regular user from Firestore doc for UID ${firebaseUser.uid}`);
            const userData: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || firestoreUser.email || "",
              name: firestoreUser.name || firebaseUser.displayName || "User",
              role: firestoreUser.role || 'passenger',
              operatorCode: (firestoreUser.role === 'operator' && !firestoreUser.operatorCode)
                ? PLATFORM_OPERATOR_CODE
                : firestoreUser.operatorCode,
              avatarUrl: firestoreUser.avatarUrl || null,
              preferredPaymentMethod: firestoreUser.preferredPaymentMethod || 'card',
              customId: firestoreUser.customId,
              driverIdentifier: firestoreUser.driverIdentifier,
              vehicleCategory: firestoreUser.vehicleCategory,
              phoneNumber: firestoreUser.phoneNumber || firebaseUser.phoneNumber,
              phoneVerified: firestoreUser.phoneVerified || false,
              status: firestoreUser.status || 'Active',
              phoneVerificationDeadline: firestoreUser.phoneVerificationDeadline
                ? (firestoreUser.phoneVerificationDeadline as Timestamp).toDate().toISOString()
                : null,
              acceptsPetFriendlyJobs: firestoreUser.acceptsPetFriendlyJobs || false,
              acceptsPlatformJobs: (firestoreUser.role === 'operator' && !firestoreUser.operatorCode)
                ? true
                : (firestoreUser.acceptsPlatformJobs || false),
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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log("AuthContext: onAuthStateChanged event. Firebase user UID:", fbUser ? fbUser.uid : "null");
      setFirebaseUser(fbUser);
      await setUserContextAndRedirect(fbUser, true);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const sendPasswordReset = async (email: string) => {
    if (!auth) {
      toast({ title: "Error", description: "Authentication service not ready.", variant: "destructive" });
      throw new Error("Auth service not ready");
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${email}, a password reset link has been sent to it.`,
      });
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      // Don't reveal if the user exists or not.
      toast({
        title: "Password Reset Email Sent",
        description: `If an account exists for ${email}, a password reset link has been sent to it.`,
      });
    }
  };

  const loginWithEmail = async (email: string, pass: string, role: UserRole) => {
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
      console.log(`AuthContext.loginWithEmail: Attempting signInWithEmailAndPassword for ${email} with intended role ${role}`);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      // After successful sign-in, onAuthStateChanged will trigger setUserContextAndRedirect
      // We pass the intended role to the redirect function to perform verification there.
      await setUserContextAndRedirect(userCredential.user, false, false, role);
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

  const getAuthToken = React.useCallback(async (): Promise<string | null> => {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken(true); // Force refresh
        return token;
      } catch (error) {
        console.error("Error getting auth token:", error);
        return null;
      }
    }
    return null;
  }, [firebaseUser]);

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
        driverIdentifier: role === 'driver' ? GUEST_DRIVER_ID : undefined,
      };

      // Create a basic user document in Firestore for the guest
      await setDoc(doc(db, "users", firebaseUser.uid), {
        name: guestUserData.name,
        email: guestUserData.email,
        role: guestUserData.role,
        isGuest: true,
        createdAt: Timestamp.now(),
      });

      setUser(guestUserData);
      setLoading(false);
      toast({
        title: "Logged in as Guest",
        description: `You are now browsing as a Guest ${role}.`
      });
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
    loginWithEmail,
    loginAsGuest,
    logout,
    updateUserProfileInContext,
    getAuthToken,
    sendPasswordReset
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

