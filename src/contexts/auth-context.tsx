
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking

export type UserRole = 'passenger' | 'driver' | 'operator';

interface User {
  id: string; // Firebase UID for registered users, or a temp ID for guests
  email: string;
  name: string;
  role: UserRole;
  vehicleCategory?: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  status?: 'Active' | 'Pending Approval' | 'Suspended';
  phoneVerificationDeadline?: string | null; // Store as ISO string
}

interface AuthContextType {
  user: User | null;
  login: (
    id: string, // Now a mandatory parameter, should be Firebase UID for real users
    email: string,
    name: string,
    role: UserRole,
    vehicleCategory?: string,
    phoneNumber?: string | null,
    phoneVerified?: boolean,
    status?: 'Active' | 'Pending Approval' | 'Suspended',
    phoneVerificationDeadlineInput?: Date | string | null | { seconds: number, nanoseconds: number } | Timestamp
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
          // Basic validation for critical fields from localStorage
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
    phoneVerificationDeadlineInput?: Date | string | null | { seconds: number, nanoseconds: number } | Timestamp
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
      id, // Use the provided ID (Firebase UID for real users)
      email,
      name,
      role,
      ...(role === 'driver' && vehicleCategory && { vehicleCategory }),
      ...(phoneNumber && { phoneNumber }),
      ...(phoneVerified !== undefined && { phoneVerified }),
      ...(status && { status }),
      ...(deadlineISO && { phoneVerificationDeadline: deadlineISO }),
    };
    setUser(newUser);
    localStorage.setItem('linkCabsUser', JSON.stringify(newUser));

    // Only redirect if currently on a public page after successful login
    if (pathname.includes('/login') || pathname.includes('/register') || pathname === '/') {
        if (role === 'passenger') router.push('/dashboard');
        else if (role === 'driver') router.push('/driver/available-rides'); // Changed this line
        else if (role === 'operator') router.push('/operator');
        else router.push('/'); // Fallback to a sensible default if role is unexpected
    }
  };

  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        // Ensure the ID is not accidentally changed by the partial update
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
    // Optional: Firebase sign out if you integrate Firebase Auth more directly for session state
    // if (auth) auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    if (loading) {
      return;
    }

    const publicPaths = ['/login', '/register', '/forgot-password', '/']; // Added forgot-password
    // More robust check for public paths, allowing for sub-paths like /_next/*
    const isPublicPath = publicPaths.some(p => pathname === p) || pathname.startsWith('/_next/');


    if (!user && !isPublicPath) {
      router.push('/login');
    }
    // Commenting out the redirect from login/register if user exists,
    // as the login function itself handles redirection upon successful login.
    // This prevents potential redirect loops if user lands on /login but localStorage still has data.
    /*
    else if (user && (pathname === '/login' || pathname === '/register')) {
      if (user.role === 'passenger') router.push('/dashboard');
      else if (user.role === 'driver') router.push('/driver');
      else if (user.role === 'operator') router.push('/operator');
      else router.push('/'); 
    }
    */
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

