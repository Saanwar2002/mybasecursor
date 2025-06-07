
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'passenger' | 'driver' | 'operator' | 'admin';

interface User {
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
  login: (...args: any[]) => void; // Simplified
  logout: () => void;
  loading: boolean;
  updateUserProfileInContext: (updatedProfileData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start as true, then set to false
  const router = useRouter();
  const pathname = usePathname();

  // Simulate loading completion
  useEffect(() => {
    console.log("Simplified AuthProvider: useEffect for loading runs.");
    const timer = setTimeout(() => {
      setLoading(false);
      console.log("Simplified AuthProvider: Loading set to false.");
    }, 100); // Short delay to mimic async loading
    return () => clearTimeout(timer);
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
    phoneVerificationDeadlineInput?: any,
    customId?: string,
    operatorCode?: string,
    driverIdentifier?: string
  ) => {
    console.log("Simplified AuthProvider: login called with", { id, email, name, role });
    const newUser: User = { id, email, name, role, status: status || 'Active' };
    setUser(newUser);
    // No localStorage interaction in this simplified version
    // No automatic routing in this simplified version
    if (role === 'passenger') router.push('/dashboard');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'operator') router.push('/operator');
    else if (role === 'admin') router.push('/admin');
    else router.push('/');
  };

  const logout = () => {
    console.log("Simplified AuthProvider: logout called.");
    setUser(null);
    router.push('/login');
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
  
  // Simplified redirection logic
   useEffect(() => {
    if (loading) {
      console.log("Simplified AuthProvider Redirection: Still loading, skipping redirection logic.");
      return;
    }
    const publicPaths = ['/login', '/register', '/forgot-password'];
    const isMarketingRoot = pathname === '/';
    const isPublicPath = publicPaths.some(p => pathname.startsWith(p)) || isMarketingRoot;

    console.log("Simplified AuthProvider Redirection Check: User:", user ? user.email : "null", "Loading:", loading, "Pathname:", pathname, "IsPublicPath:", isPublicPath);

    if (!user && !isPublicPath) {
      console.log("Simplified AuthProvider: User not found and not on public path, redirecting to /login. Current path:", pathname);
      router.push('/login');
    } else if (user && (isMarketingRoot || pathname.startsWith('/login') || pathname.startsWith('/register'))) {
      console.log("Simplified AuthProvider: User found and on public/auth path, redirecting to role-specific dashboard. Role:", user.role, "Path:", pathname);
      if (user.role === 'passenger') router.push('/dashboard');
      else if (user.role === 'driver') router.push('/driver');
      else if (user.role === 'operator') router.push('/operator');
      else if (user.role === 'admin') router.push('/admin');
      else router.push('/'); // Fallback if role is unexpected
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
