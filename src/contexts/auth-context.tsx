
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'passenger' | 'driver' | 'operator';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  vehicleCategory?: string; // Added for drivers
}

interface AuthContextType {
  user: User | null;
  login: (email: string, name: string, role: UserRole, vehicleCategory?: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('linkCabsUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Error processing stored user in AuthProvider:", error);
      // Attempt to clear potentially corrupted storage item
      localStorage.removeItem('linkCabsUser');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (email: string, name: string, role: UserRole, vehicleCategory?: string) => {
    const newUser: User = { 
      id: Date.now().toString(), 
      email, 
      name, 
      role,
      ...(role === 'driver' && vehicleCategory && { vehicleCategory }), // Add vehicleCategory if driver
    };
    setUser(newUser);
    localStorage.setItem('linkCabsUser', JSON.stringify(newUser));
    
    if (role === 'passenger') router.push('/dashboard');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'operator') router.push('/operator');
    else router.push('/');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('linkCabsUser');
    router.push('/login');
  };
  
  useEffect(() => {
    if (!loading && !user && !['/login', '/register', '/'].includes(pathname) && !pathname.startsWith('/_next/')) {
      if (pathname !== '/') {
          router.push('/login');
      }
    }
  }, [user, loading, router, pathname]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
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
