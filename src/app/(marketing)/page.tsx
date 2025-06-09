
import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LandingPage() {
  console.log("Minimal Marketing LandingPage rendering...");
  return (
    <div className="container mx-auto px-4 py-10 text-center"> {/* Removed blue border */}
      <h1 className="text-5xl font-bold text-primary mb-6">MyBase Minimal Landing</h1>
      <p className="text-xl text-muted-foreground mb-8">
        This is a test to see if basic styling and routing works.
      </p>
      <Button size="lg" asChild className="bg-accent hover:bg-accent/80">
        <Link href="/login">Go to Login</Link>
      </Button>
      <div className="mt-8 p-4 bg-secondary text-secondary-foreground rounded-md">
        This box should have accent colors if Tailwind is working.
      </div>
      <p className="text-red-500 p-2 mt-2">This text should be red if Tailwind text color works.</p>
    </div>
  );
}
