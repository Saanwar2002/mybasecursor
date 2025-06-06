
"use client"; // Add "use client" if using client-side hooks or event handlers, otherwise optional

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Car } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <Car className="w-20 h-20 mb-6 text-primary" />
      <h1 className="text-4xl font-bold mb-4">Link Cabs Root Page</h1>
      <p className="text-lg text-muted-foreground mb-8">
        This is a test page directly in src/app/page.tsx.
      </p>
      <div className="space-x-4">
        <Button asChild>
          <Link href="/login">Login</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/register">Register</Link>
        </Button>
      </div>
    </div>
  );
}
