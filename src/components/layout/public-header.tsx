
"use client";

import Link from 'next/link';
// import Image from 'next/image'; // Temporarily commented out

export function PublicHeader() {
  return (
    <header className="py-4 px-6 border-b bg-card shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center" aria-label="MyBase Home">
          {/* <Image src="/mybase-logo.png" alt="MyBase Logo" width={120} height={40} className="shrink-0" /> */}
          <span className="text-xl font-bold text-primary">MyBase (Logo Placeholder)</span>
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
