
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking

export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin'; // Added 'admin' role

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
    let isMounted = true;
    try {
      const storedUserJson = localStorage.getItem('linkCabsUser');
      if (storedUserJson) {
        const storedUserObject = JSON.parse(storedUserJson) as User;
        if (isMounted) {
          if (storedUserObject && storedUserObject.id && storedUserObject.email && storedUserObject.role) {
            setUser(storedUserObject);
          } else {
            console.warn("Stored user object from localStorage is missing critical fields. Clearing.");
            localStorage.removeItem('linkCabsUser');
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error("Error processing stored user in AuthProvider:", error);
      localStorage.removeItem('linkCabsUser');
      if (isMounted) setUser(null);
    } finally {
      if (isMounted) setLoading(false);
    }
    return () => { isMounted = false; };
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
    localStorage.setItem('linkCabsUser', JSON.stringify(newUser));

    // This redirection should happen AFTER successful login from the login page
    // The useEffect below will handle redirects from '/' if already logged in.
    if (pathname.includes('/login') || pathname.includes('/register')) {
        if (role === 'passenger') router.push('/dashboard');
        else if (role === 'driver') router.push('/driver/available-rides');
        else if (role === 'operator') router.push('/operator');
        else if (role === 'admin') router.push('/admin');
        else router.push('/');
    }
  };

  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updatedProfileData, id: currentUser.id };
        localStorage.setItem('linkCabsUser', JSON.stringify(updatedUser));
        return updatedUser;
      }
      return null;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('linkCabsUser');
    localStorage.removeItem('linkCabsUserWithPin');
    router.push('/login');
  };
  
  const handleGuestLogin = (role: UserRole) => {
    let email = "";
    let name = "";
    const guestId = `guest-${Date.now()}`;
    let operatorCodeForGuest: string | undefined = undefined;

    switch (role) {
      case "passenger":
        email = "guest-passenger@taxinow.com";
        name = "Guest Passenger";
        break;
      case "driver":
        email = "guest-driver@taxinow.com";
        name = "Guest Driver";
        operatorCodeForGuest = "OP001"; 
        break;
      case "operator":
        email = "guest-operator@taxinow.com";
        name = "Guest Operator";
        operatorCodeForGuest = "OP001";
        break;
      case "admin":
        email = "guest-admin@taxinow.com";
        name = "Guest Platform Admin";
        break;
    }
    login(guestId, email, name, role, undefined, undefined, true, 'Active', null, undefined, operatorCodeForGuest);
  };


  useEffect(() => {
    if (loading) {
      return;
    }
    const publicPaths = ['/login', '/register', '/forgot-password', '/'];
    const isAuthPage = ['/login', '/register', '/forgot-password'].includes(pathname);
    const isRootMarketingPage = pathname === '/';
    const isPublicPath = publicPaths.some(p => pathname === p) || pathname.startsWith('/_next/');


    if (!user && !isPublicPath) {
      // If not logged in and not on a public path, redirect to login
      router.push('/login');
    } else if (user && isRootMarketingPage) {
      // If logged in and on the root marketing page, redirect to the appropriate dashboard
      if (user.role === 'passenger') router.push('/dashboard');
      else if (user.role === 'driver') router.push('/driver/available-rides');
      else if (user.role === 'operator') router.push('/operator');
      else if (user.role === 'admin') router.push('/admin');
      else router.push('/'); // Fallback, though should be covered by roles
    }
    // If user is logged in and on /login, /register, /forgot-password (isAuthPage = true),
    // DO NOT redirect from here. Let them stay on the page.
    // The login() function itself will handle redirection after a successful login attempt.
    
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
