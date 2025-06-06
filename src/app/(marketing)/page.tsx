
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Car, ShieldCheck, Smartphone, Star, Users } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-br from-primary/10 via-background to-accent/10">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold font-headline mb-6 text-foreground">
              Your Journey, Simplified.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Experience seamless cab booking with Link Cabs. Fast, reliable, and always there when you need us. Get a ride in minutes.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-lg" asChild>
              <Link href="/register">Get Started Now</Link>
            </Button>
            <div className="mt-16">
              <Image
                src="https://placehold.co/800x450.png"
                alt="Link Cabs app interface showing a map with a taxi"
                width={800}
                height={450}
                className="rounded-xl shadow-2xl mx-auto"
                data-ai-hint="app interface map taxi"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold font-headline text-center mb-16 text-foreground">
              Why Choose Link Cabs?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Smartphone className="w-10 h-10 text-primary" />}
                title="Easy Booking"
                description="Book your ride in seconds with our intuitive app. Quick, simple, and hassle-free."
              />
              <FeatureCard
                icon={<Car className="w-10 h-10 text-primary" />}
                title="Reliable Rides"
                description="Count on us for punctual pickups and safe journeys with our professional drivers."
              />
              <FeatureCard
                icon={<ShieldCheck className="w-10 h-10 text-primary" />}
                title="Safety First"
                description="Your safety is our priority. All drivers are verified, and rides are tracked."
              />
              <FeatureCard
                icon={<Star className="w-10 h-10 text-primary" />}
                title="Transparent Pricing"
                description="Know your fare upfront. No hidden charges, just clear and fair pricing."
              />
              <FeatureCard
                icon={<Users className="w-10 h-10 text-primary" />}
                title="Various Vehicle Options"
                description="Choose from a range of vehicles to suit your needs, from solo trips to group travel."
              />
              <FeatureCard
                icon={<Car className="w-10 h-10 text-primary" />}
                title="24/7 Availability"
                description="Day or night, Link Cabs is ready to serve you. Book a ride anytime, anywhere."
              />
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-16 md:py-24 bg-muted/40">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline mb-6 text-foreground">
              Ready to Ride with Link Cabs?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Download our app or sign up today to start enjoying convenient and reliable taxi services.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-md" asChild>
                <Link href="/register">Sign Up Free</Link>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 shadow-md border-primary text-primary hover:bg-primary/10">
                Learn More (Placeholder)
                </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out bg-card">
      <CardHeader className="items-center">
        <div className="p-4 bg-primary/10 rounded-full mb-4">
          {icon}
        </div>
        <CardTitle className="text-2xl font-semibold font-headline">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base text-muted-foreground">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
