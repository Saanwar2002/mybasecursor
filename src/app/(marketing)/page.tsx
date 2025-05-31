
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, MapPin, ShieldCheck, MessagesSquare, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-12 bg-primary/10 rounded-lg shadow-lg">
        <h1 className="text-5xl font-bold font-headline text-primary mb-4">Welcome to TaxiNow</h1>
        <p className="text-xl text-foreground mb-8 max-w-2xl mx-auto">
          Your next ride is just a click away. Experience seamless, safe, and smart taxi services.
        </p>
        <div className="space-x-4">
          <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/register">Get Started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
        <div className="mt-10 relative aspect-video max-w-3xl mx-auto rounded-lg overflow-hidden shadow-2xl">
           <Image src="https://placehold.co/800x450.png" alt="Taxi illustration" data-ai-hint="city taxi" fill={true} />
        </div>
      </section>

      <section className="py-12">
        <h2 className="text-3xl font-bold font-headline text-center mb-10">Why Choose TaxiNow?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: Car, title: "Easy Booking", description: "Book your ride in seconds with our intuitive interface." },
            { icon: MapPin, title: "Real-Time Tracking", description: "Track your taxi in real-time and know exactly when it arrives." },
            { icon: ShieldCheck, title: "Safe & Secure", description: "Verified drivers and secure payment options for your peace of mind." },
            { icon: MessagesSquare, title: "In-App Chat", description: "Communicate easily with your driver directly through the app." },
            { icon: Sparkles, title: "AI-Powered Search", description: "Let our AI find the perfect taxi based on your needs." },
            { icon: Car, title: "Multiple User Roles", description: "Separate interfaces for Passengers, Drivers, and Taxi Base Operators." }
          ].map((feature, index) => (
            <Card key={index} className="hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="items-center">
                <feature.icon className="w-12 h-12 text-accent mb-2" />
                <CardTitle className="font-headline">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-12 text-center bg-card rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold font-headline mb-4">Ready to Ride?</h2>
        <p className="text-lg text-muted-foreground mb-6">
          Join thousands of satisfied passengers and drivers.
        </p>
        <Button size="lg" asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/register">Sign Up Now</Link>
        </Button>
      </section>
    </div>
  );
}
