
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Car, LogIn, UserPlus, ArrowRight } from 'lucide-react';
import Image from 'next/image'; // Added Image for consistency

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-6 md:p-12 bg-gradient-to-br from-background to-muted/30">
      <div className="container max-w-4xl text-center space-y-8">
        <div className="flex justify-center">
          <Car className="w-24 h-24 text-primary" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight">
          Link Cabs: Your Journey, Simplified.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Reliable, comfortable, and efficient taxi services at your fingertips. Book your next ride with Link Cabs and experience seamless travel.
        </p>
        <div className="hidden md:block my-8">
            <Image
              src="https://placehold.co/700x300.png"
              alt="Taxi illustration on a city background"
              data-ai-hint="taxi city modern"
              width={700}
              height={300}
              className="rounded-xl shadow-2xl object-cover mx-auto"
            />
          </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg px-8 py-6" asChild>
            <Link href="/register">
              <UserPlus className="mr-2 h-5 w-5" /> Sign Up Now
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="text-lg px-8 py-6" asChild>
            <Link href="/login">
              <LogIn className="mr-2 h-5 w-5" /> Login to Your Account
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground pt-4">
          Need help? Contact our support team 24/7.
        </p>
      </div>
    </main>
  );
}
