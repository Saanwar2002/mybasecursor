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
}

interface AuthContextType {
  user: User | null;
  login: (email: string, name: string, role: UserRole) => void;
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
    const storedUser = localStorage.getItem('taxiNowUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (email: string, name: string, role: UserRole) => {
    const newUser: User = { id: Date.now().toString(), email, name, role };
    setUser(newUser);
    localStorage.setItem('taxiNowUser', JSON.stringify(newUser));
    // Redirect based on role
    if (role === 'passenger') router.push('/dashboard');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'operator') router.push('/operator');
    else router.push('/');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('taxiNowUser');
    router.push('/login');
  };
  
  useEffect(() => {
    if (!loading && !user && !['/login', '/register', '/'].includes(pathname) && !pathname.startsWith('/_next/')) {
      // Allow access to root path for landing page
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
