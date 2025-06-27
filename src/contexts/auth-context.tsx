
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
  loginWithEmail: (email: string, pass: string) => Promise<void>; 
  loginAsGuest: (role: UserRole) => Promise<void>; 
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
      id: `guest-${role}-${Date.now().toString().slice(-6)}`, 
      email: `guest.${role}@example.com`,
      phoneVerified: true,
      status: 'Active' as const,
      phoneVerificationDeadline: null,
      phoneNumber: `+155501${Math.floor(Math.random()*90)+10}`,
      avatarUrl: null,
    };

    switch (role) {
      case 'passenger':
        guestUser = { ...baseGuestData, name: 'Guest Passenger', role: 'passenger', preferredPaymentMethod: 'card' };
        break;
      case 'driver':
        const isMyBaseDriver = Math.random() < 0.3;
        const guestOperatorCode = isMyBaseDriver ? PLATFORM_OPERATOR_CODE : `OP-GUEST-${Math.floor(Math.random()*900)+100}`;
        guestUser = {
          ...baseGuestData,
          name: `Guest Driver (${guestOperatorCode})`,
          role: 'driver',
          operatorCode: guestOperatorCode,
          driverIdentifier: `DR-GUEST-${Math.floor(Math.random()*9000)+1000}`,
          vehicleCategory: 'car',
          customId: `DR-GUEST-${Math.floor(Math.random()*9000)+1000}`, 
          acceptsPetFriendlyJobs: Math.random() < 0.5,
          acceptsPlatformJobs: guestOperatorCode === PLATFORM_OPERATOR_CODE ? true : Math.random() < 0.7,
          maxJourneyDistance: "no_limit", 
          acceptsAccountJobs: true, 
          vehicleMakeModel: 'Toyota Prius (Guest)',
          vehicleRegistration: 'GUEST123',
          vehicleColor: 'Silver',
          insurancePolicyNumber: 'POL-GUEST-123',
          insuranceExpiryDate: '2025-12-31',
          motExpiryDate: '2025-06-30',
          taxiLicenseNumber: 'PLATE-GUEST-789',
          taxiLicenseExpiryDate: '2026-03-31',
        };
        break;
      case 'operator':
        guestUser = {
          ...baseGuestData,
          name: 'Guest Operator',
          role: 'operator',
          customId: `OP-GUEST-${Math.floor(Math.random()*900)+100}`, 
          operatorCode: `OP-GUEST-${Math.floor(Math.random()*900)+100}`,
          dispatchMode: 'auto', 
        };
        break;
      case 'admin':
        guestUser = { ...baseGuestData, name: 'Guest Admin', role: 'admin', operatorCode: PLATFORM_OPERATOR_CODE };
        break;
      default:
        toast({ title: "Error", description: "Invalid guest role specified.", variant: "destructive" });
        setLoading(false);
        return;
    }

    if (guestUser) {
      setUser(guestUser); 
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

export { PLATFORM_OPERATOR_CODE };
