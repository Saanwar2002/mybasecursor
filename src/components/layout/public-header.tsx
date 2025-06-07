
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Car } from 'lucide-react';

export function PublicHeader() {
  return (
    <header className="py-4 px-6 border-b bg-card shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary-foreground bg-primary py-2 px-3 rounded-md hover:bg-primary/90 transition-colors">
          <Car className="h-6 w-6 shrink-0" />
          <span className="font-headline hidden sm:inline">Link Cabs</span>
        </Link>
        <nav className="flex items-center space-x-3 sm:space-x-4">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline underline-offset-4 whitespace-nowrap">
            Login
          </Link>
          <Link href="/register" className="text-sm font-medium text-primary hover:underline underline-offset-4 whitespace-nowrap">
            Sign Up
          </Link>
        </nav>
      </div>
    </header>
  );
}
