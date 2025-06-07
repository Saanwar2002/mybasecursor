
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking

export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin';

interface User {
  id: string; // Firebase UID
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
  login: (
    id: string,
    email: string,
    name: string,
    role: UserRole,
    vehicleCategory?: string,
    phoneNumber?: string | null,
    phoneVerified?: boolean,
    status?: 'Active' | 'Pending Approval' | 'Suspended',
    phoneVerificationDeadlineInput?: Date | string | null | { seconds: number, nanoseconds: number } | Timestamp,
    customId?: string,
    operatorCode?: string,
    driverIdentifier?: string
  ) => void;
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

  useEffect(() => {
    console.log("AuthProvider: useEffect running to check localStorage.");
    let isMounted = true;
    if (typeof window !== 'undefined') {
      try {
        const storedUserJson = localStorage.getItem('linkCabsUser');
        console.log("AuthProvider: localStorage.getItem('linkCabsUser') retrieved:", storedUserJson ? "Data found" : "No data");
        if (storedUserJson) {
          const storedUserObject = JSON.parse(storedUserJson) as User;
          console.log("AuthProvider: Parsed user from localStorage:", storedUserObject);
          if (isMounted) {
            if (storedUserObject && storedUserObject.id && storedUserObject.email && storedUserObject.role) {
              setUser(storedUserObject);
              console.log("AuthProvider: User set from localStorage.");
            } else {
              console.warn("AuthProvider: Stored user object from localStorage is missing critical fields. Clearing.");
              localStorage.removeItem('linkCabsUser');
              setUser(null);
            }
          }
        } else {
           if (isMounted) setUser(null); // Ensure user is null if nothing in localStorage
        }
      } catch (error) {
        console.error("AuthProvider: Error processing stored user in AuthProvider:", error);
        localStorage.removeItem('linkCabsUser');
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) {
            setLoading(false);
            console.log("AuthProvider: Loading set to false.");
        }
      }
    } else {
        console.log("AuthProvider: window is undefined, skipping localStorage access during SSR or early client render.");
        if (isMounted) {
            setLoading(false); // Still need to set loading to false if window is not available
        }
    }
    return () => {
        isMounted = false;
        console.log("AuthProvider: useEffect cleanup.");
    };
  }, []);


  const login = (
    id: string,
    email: string,
    name: string,
    role: UserRole,
    vehicleCategory?: string,
    phoneNumber?: string | null,
    phoneVerified?: boolean,
    status?: 'Active' | 'Pending Approval' | 'Suspended',
    phoneVerificationDeadlineInput?: Date | string | null | { seconds: number, nanoseconds: number } | Timestamp,
    customId?: string,
    operatorCode?: string,
    driverIdentifier?: string
  ) => {
    console.log("AuthProvider: login function called for user:", email, "role:", role);
    let deadlineISO: string | null = null;
    if (phoneVerificationDeadlineInput) {
      if (typeof phoneVerificationDeadlineInput === 'string') {
        try {
            const parsedDate = new Date(phoneVerificationDeadlineInput);
            if (!isNaN(parsedDate.getTime())) deadlineISO = parsedDate.toISOString();
        } catch (e) { /* ignore if not a valid date string */ }
      } else if (phoneVerificationDeadlineInput instanceof Date) {
        deadlineISO = phoneVerificationDeadlineInput.toISOString();
      } else if (typeof phoneVerificationDeadlineInput === 'object' && ('seconds' in phoneVerificationDeadlineInput || '_seconds' in phoneVerificationDeadlineInput)) {
        const seconds = (phoneVerificationDeadlineInput as any).seconds ?? (phoneVerificationDeadlineInput as any)._seconds;
        const nanoseconds = (phoneVerificationDeadlineInput as any).nanoseconds ?? (phoneVerificationDeadlineInput as any)._nanoseconds ?? 0;
        if (typeof seconds === 'number') {
            deadlineISO = new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
        }
      }
    }

    const newUser: User = {
      id,
      email,
      name,
      role,
      ...(customId && { customId }),
      ...(operatorCode && { operatorCode }),
      ...(driverIdentifier && { driverIdentifier }),
      ...(role === 'driver' && vehicleCategory && { vehicleCategory }),
      ...(phoneNumber && { phoneNumber }),
      ...(phoneVerified !== undefined && { phoneVerified }),
      ...(status && { status }),
      ...(deadlineISO && { phoneVerificationDeadline: deadlineISO }),
    };
    setUser(newUser);
    if (typeof window !== 'undefined') {
        localStorage.setItem('linkCabsUser', JSON.stringify(newUser));
        console.log("AuthProvider: User saved to localStorage.");
    }


    if (pathname.includes('/login') || pathname.includes('/register') || pathname === '/') {
        if (role === 'passenger') router.push('/dashboard');
        else if (role === 'driver') router.push('/driver');
        else if (role === 'operator') router.push('/operator');
        else if (role === 'admin') router.push('/admin');
        else router.push('/');
    }
  };

  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updatedProfileData, id: currentUser.id };
        if (typeof window !== 'undefined') {
            localStorage.setItem('linkCabsUser', JSON.stringify(updatedUser));
        }
        return updatedUser;
      }
      return null;
    });
  };

  const logout = () => {
    console.log("AuthProvider: logout function called.");
    if (typeof window !== 'undefined') {
        localStorage.removeItem('linkCabsUser');
        localStorage.removeItem('linkCabsUserWithPin');
        console.log("AuthProvider: User data removed from localStorage.");
    }
    setUser(null); // This state update will trigger the redirection useEffect
    // The redirection useEffect will handle router.push('/login') if on a protected path.
  };

  const handleGuestLogin = (role: UserRole) => {
    let email = "";
    let name = "";
    const guestId = `guest-${Date.now()}`;
    let operatorCodeForGuest: string | undefined = undefined;
    let customIdForGuest: string | undefined = undefined;

    switch (role) {
      case "passenger":
        email = "guest-passenger@taxinow.com";
        name = "Guest Passenger";
        customIdForGuest = `CU-${guestId.slice(-6)}`;
        break;
      case "driver":
        email = "guest-driver@taxinow.com";
        name = "Guest Driver";
        operatorCodeForGuest = "OP001";
        customIdForGuest = `DR-${guestId.slice(-6)}`;
        break;
      case "operator":
        email = "guest-operator@taxinow.com";
        name = "Guest Operator";
        operatorCodeForGuest = "OP001";
        customIdForGuest = `OP-${guestId.slice(-6)}`;
        break;
      case "admin":
        email = "guest-admin@taxinow.com";
        name = "Guest Platform Admin";
        customIdForGuest = `AD-${guestId.slice(-6)}`;
        break;
    }
    login(guestId, email, name, role, undefined, undefined, true, 'Active', null, customIdForGuest, operatorCodeForGuest);
  };


  useEffect(() => {
    if (loading) {
      console.log("AuthProvider Redirection: Still loading, skipping redirection logic.");
      return;
    }
    const publicPaths = ['/login', '/register', '/forgot-password'];
    const isMarketingRoot = pathname === '/';
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p)) || isMarketingRoot;

    if (!user && !isPublicPath) {
      console.log("AuthProvider: User not found and not on public path, redirecting to /login. Current path:", pathname);
      router.push('/login');
    } else if (user && (isMarketingRoot || pathname.startsWith('/login') || pathname.startsWith('/register'))) {
      console.log("AuthProvider: User found and on public/auth path, redirecting to role-specific dashboard. Role:", user.role, "Path:", pathname);
      if (user.role === 'passenger') router.push('/dashboard');
      else if (user.role === 'driver') router.push('/driver');
      else if (user.role === 'operator') router.push('/operator');
      else if (user.role === 'admin') router.push('/admin');
      else router.push('/');
    }
  }, [user, loading, router, pathname]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUserProfileInContext }}>
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

