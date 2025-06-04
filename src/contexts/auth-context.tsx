
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking

export type UserRole = 'passenger' | 'driver' | 'operator';

// Ensure User interface includes all fields that might be set
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  vehicleCategory?: string;
  phoneNumber?: string | null;
  phoneVerified?: boolean;
  status?: 'Active' | 'Pending Approval' | 'Suspended'; // Added
  phoneVerificationDeadline?: string | null; // Store as ISO string
}

interface AuthContextType {
  user: User | null;
  login: (
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
    // This effect establishes the initial auth state from localStorage
    let isMounted = true;
    try {
      const storedUserJson = localStorage.getItem('linkCabsUser');
      if (storedUserJson) {
        const storedUserObject = JSON.parse(storedUserJson) as User;
        // Ensure all fields align, especially that phoneVerificationDeadline is a string or null
        if (isMounted) {
          setUser(storedUserObject);
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
        // Check if it's already a valid ISO string, otherwise try parsing if it's from older format
        try {
            if (new Date(phoneVerificationDeadlineInput).toISOString() === phoneVerificationDeadlineInput) {
                 deadlineISO = phoneVerificationDeadlineInput;
            } else {
                 // Attempt to parse if it might be non-ISO date string, though less reliable
                 const parsedDate = new Date(phoneVerificationDeadlineInput);
                 if (!isNaN(parsedDate.getTime())) deadlineISO = parsedDate.toISOString();
            }
        } catch (e) { /* ignore if not a valid date string */ }

      } else if (phoneVerificationDeadlineInput instanceof Date) {
        deadlineISO = phoneVerificationDeadlineInput.toISOString();
      } else if (typeof phoneVerificationDeadlineInput === 'object' && ('seconds' in phoneVerificationDeadlineInput || '_seconds' in phoneVerificationDeadlineInput)) {
        // Handle Firestore Timestamp-like object from JSON.parse or direct Timestamp
        const seconds = (phoneVerificationDeadlineInput as any).seconds ?? (phoneVerificationDeadlineInput as any)._seconds;
        const nanoseconds = (phoneVerificationDeadlineInput as any).nanoseconds ?? (phoneVerificationDeadlineInput as any)._nanoseconds ?? 0;
        if (typeof seconds === 'number') {
            deadlineISO = new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
        }
      }
    }

    const newUser: User = {
      id: user?.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Preserve ID if updating, else new robust temp ID
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

    if (pathname.includes('/login') || pathname.includes('/register')) {
        if (role === 'passenger') router.push('/dashboard');
        else if (role === 'driver') router.push('/driver');
        else if (role === 'operator') router.push('/operator');
        else router.push('/');
    }
  };

  const updateUserProfileInContext = (updatedProfileData: Partial<User>) => {
    setUser(currentUser => {
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updatedProfileData };
        localStorage.setItem('linkCabsUser', JSON.stringify(updatedUser));
        return updatedUser;
      }
      return null;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('linkCabsUser');
    router.push('/login');
  };

  useEffect(() => {
    // This effect handles redirection after loading is complete and user state is established
    if (loading) {
      return; // Don't do anything until initial loading is done
    }

    const publicPaths = ['/login', '/register', '/'];
    const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith('/_next/');

    if (!user && !isPublicPath) {
      router.push('/login');
    }
    // Optional: Redirect logged-in users away from login/register
    // else if (user && (pathname === '/login' || pathname === '/register')) {
    //   if (user.role === 'passenger') router.push('/dashboard');
    //   else if (user.role === 'driver') router.push('/driver');
    //   else if (user.role === 'operator') router.push('/operator');
    //   else router.push('/'); // Fallback
    // }
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
