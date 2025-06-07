
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MyBaseLogoIcon } from '@/components/icons/my-base-logo-icon';

export function PublicHeader() {
  return (
    <header className="py-4 px-6 border-b bg-card shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center" aria-label="MyBase Home">
          <MyBaseLogoIcon className="h-10 w-28 md:w-32 shrink-0" priority />
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
