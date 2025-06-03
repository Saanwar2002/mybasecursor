
"use client"; // Required for using client components like GoogleMapDisplay

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, MapPin, ShieldCheck, MessagesSquare, Sparkles, Award, Users, Smartphone, CheckCircle2, Smile, DollarSign as DollarSignIcon } from 'lucide-react'; // Renamed DollarSign to avoid conflict
import Image from 'next/image'; // Keep Image for other images on page if any
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Use the new GoogleMapDisplay component
const GoogleMapDisplay = dynamic(() => import('@/components/ui/google-map-display'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[400px] rounded-xl shadow-2xl mx-auto" />,
});

const defaultMapCenter: google.maps.LatLngLiteral = { lat: 53.6450, lng: -1.7830 }; // Huddersfield HD1, UK

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center text-center space-y-16 py-8 md:py-12">
      {/* Hero Section */}
      <section className="w-full max-w-4xl mx-auto px-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tight mb-6">
          Link Cabs: Your <span className="text-primary">Local Ride</span>, Simplified.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Link Cabs: Connecting our neighborhood, one ride at a time. Fast, friendly, and always here for you. Your local journey, made easy.
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button asChild size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-lg transform hover:scale-105 transition-transform">
            <Link href="/register">Get Started Now</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6 shadow-md">
            <Link href="/login">Login to Your Account</Link>
          </Button>
        </div>
        <div className="mt-12">
          <div className="w-full max-w-[800px] h-[400px] rounded-xl shadow-2xl mx-auto overflow-hidden border border-muted">
            <GoogleMapDisplay
              center={defaultMapCenter}
              zoom={14} // Adjusted zoom for a more local view
              // markers={[{ position: defaultMapCenter, title: "Link Cabs Huddersfield" }]} // Optional: Add a marker
              className="w-full h-full"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-5xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold font-headline mb-4">Why Choose Link Cabs?</h2>
        <p className="text-md md:text-lg text-muted-foreground mb-12">
          We're committed to providing you with the best taxi experience.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={Car}
            title="Quick & Easy Booking"
            description="Book your ride in seconds with our intuitive app. No more waiting on hold!"
          />
          <FeatureCard
            icon={Sparkles}
            title="AI-Powered Suggestions"
            description="Let our smart AI find the perfect vehicle based on your needs and preferences."
          />
          <FeatureCard
            icon={MapPin}
            title="Real-Time Tracking"
            description="Track your taxi's arrival live on the map and get accurate ETAs."
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Safe & Reliable"
            description="All our drivers are vetted and our vehicles are regularly inspected for your safety."
          />
          <FeatureCard
            icon={MessagesSquare}
            title="In-App Chat"
            description="Easily communicate with your driver for smooth pickups and coordination."
          />
          <FeatureCard
            icon={DollarSignIcon} // Using the renamed import
            title="Transparent Pricing"
            description="Know your fare estimate upfront. No hidden charges, just fair pricing."
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full max-w-4xl mx-auto px-4 py-12 bg-muted/50 rounded-xl shadow-inner">
        <h2 className="text-3xl md:text-4xl font-bold font-headline mb-10">Get Going in 3 Easy Steps</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <StepCard
            step="01"
            title="Enter Your Destination"
            description="Use our simple interface to tell us where you're headed."
            icon={Smartphone}
          />
          <StepCard
            step="02"
            title="Confirm Your Ride"
            description="Review fare estimates, vehicle options, and confirm your booking."
            icon={CheckCircle2}
          />
          <StepCard
            step="03"
            title="Enjoy Your Journey"
            description="Your driver arrives, and you're on your way. It's that simple!"
            icon={Smile}
          />
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="w-full max-w-4xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold font-headline mb-6">
          Ready to Ride with Link Cabs?
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-8">
          Download our app or sign up today to experience the future of taxi services.
        </p>
        <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-10 py-6 shadow-lg transform hover:scale-105 transition-transform">
          <Link href="/register">Sign Up & Book Your First Ride</Link>
        </Button>
      </section>
    </div>
  );
}

// Helper components for structured feature display
interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card className="text-center p-6 hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1">
      <div className="mb-4 inline-flex items-center justify-center p-3 bg-primary/10 rounded-full">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <CardTitle className="text-xl font-semibold mb-2">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </Card>
  );
}

interface StepCardProps {
  step: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

function StepCard({ step, title, description, icon: Icon }: StepCardProps) {
  return (
    <div className="flex flex-col items-center md:items-start text-center md:text-left">
      <div className="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-full text-xl font-bold mb-4">
        {step}
      </div>
      <Icon className="w-10 h-10 text-accent mb-3 mx-auto md:mx-0" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
