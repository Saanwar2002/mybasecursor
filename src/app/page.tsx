"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Car, LogIn, UserPlus } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PublicHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Car className="w-24 h-24 text-primary mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Welcome to Link Cabs
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
            Your reliable and efficient taxi service, connecting you to your destination with ease and comfort.
          </p>
          <div className="space-y-4 md:space-y-0 md:space-x-4">
            <Button size="lg" className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/register">
                <UserPlus className="mr-2 h-5 w-5" /> Get Started - Sign Up
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full md:w-auto" asChild>
              <Link href="/login">
                <LogIn className="mr-2 h-5 w-5" /> Already have an account? Login
              </Link>
            </Button>
          </div>
          <div className="mt-10 p-6 bg-card rounded-lg shadow-md w-full max-w-md">
            <h2 className="text-2xl font-semibold text-accent-foreground mb-3">Why Choose Link Cabs?</h2>
            <ul className="text-left space-y-2 text-muted-foreground">
              <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Fast & Reliable Service</li>
              <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Competitive Pricing</li>
              <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Professional Drivers</li>
              <li className="flex items-center"><Car className="w-5 h-5 mr-2 text-accent" /> Easy Booking via App</li>
            </ul>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
