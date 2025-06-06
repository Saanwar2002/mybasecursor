
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Car, LogIn, UserPlus, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    // Removed PublicHeader, PublicFooter, and outer layout divs as they are handled by src/app/(marketing)/layout.tsx
    <div className="flex flex-col"> {/* Removed items-center justify-center text-center */}
      <Car className="w-24 h-24 text-primary mb-6 self-center md:self-start" /> {/* Added self-center for mobile, self-start for md and up */}
      <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-center md:text-left">
        Welcome to Link Cabs
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 text-center md:text-left">
        Your reliable and efficient taxi service, connecting you to your destination with ease and comfort.
      </p>
      <div className="space-y-4 md:space-y-0 md:flex md:items-center md:space-x-6 mb-10 justify-center md:justify-start">
        <Link href="/register" className="inline-flex items-center text-primary hover:underline underline-offset-4 font-medium text-lg">
          <UserPlus className="mr-2 h-5 w-5" /> Get Started - Sign Up <ArrowRight className="ml-1 h-5 w-5" />
        </Link>
        <Link href="/login" className="inline-flex items-center text-primary hover:underline underline-offset-4 font-medium text-lg">
          Already have an account? Login
        </Link>
      </div>
      <div className="p-6 bg-card rounded-lg shadow-md w-full">
        <h2 className="text-2xl font-semibold text-accent-foreground mb-3">Why Choose Link Cabs?</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Fast & Reliable Service</li>
          <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Competitive Pricing</li>
          <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Professional Drivers</li>
          <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Easy Booking via App</li>
        </ul>
      </div>
    </div>
  );
}
