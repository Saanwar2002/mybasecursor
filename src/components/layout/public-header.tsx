
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Car } from 'lucide-react';

export function PublicHeader() {
  return (
    <header className="py-4 px-6 border-b bg-card shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary-foreground bg-primary py-2 px-3 rounded-md hover:bg-primary/90 transition-colors">
          <Car className="h-6 w-6" />
          <span className="font-headline">Link Cabs</span>
        </Link>
        <nav className="space-x-2 sm:space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button variant="default" asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/register">Sign Up</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
