
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Car } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-4">
      <Car className="w-24 h-24 text-primary mb-6" />
      <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl font-headline">
        Link Cabs: Your Journey, Simplified.
      </h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl">
        Fast, reliable, and always ready to take you where you need to go. 
        Experience seamless bookings and comfortable rides with Link Cabs.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg">
          <Link href="/register">
            Get Started
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="px-8 py-3 text-lg">
          <Link href="/login">
            Log In <span aria-hidden="true" className="ml-1">&rarr;</span>
          </Link>
        </Button>
      </div>
      <div className="mt-16">
        <h2 className="text-3xl font-bold mb-8 text-foreground font-headline">Why Choose Link Cabs?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-card rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2 text-primary">Quick & Easy Booking</h3>
            <p className="text-muted-foreground">Book your ride in seconds with our intuitive app.</p>
          </div>
          <div className="p-6 bg-card rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2 text-primary">Reliable Drivers</h3>
            <p className="text-muted-foreground">Professional and vetted drivers for your safety.</p>
          </div>
          <div className="p-6 bg-card rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2 text-primary">Transparent Pricing</h3>
            <p className="text-muted-foreground">Know your fare upfront, no hidden charges.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
