"use client";

import React from 'react'; // Ensure React is imported
import Link from 'next/link';
import Image from 'next/image'; // Added Image import
import { Button } from '@/components/ui/button'; // Import the actual Button component

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="MyBase Home">
          <Image src="/mybase-logo.png" alt="MyBase Logo" width={120} height={30} priority />
        </Link>
        <nav className="flex items-center space-x-4 sm:space-x-6">
          <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Login
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Sign Up</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
