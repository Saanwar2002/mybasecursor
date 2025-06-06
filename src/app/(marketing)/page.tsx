
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Clock, Shield, Sparkles, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="flex-grow flex flex-col items-center justify-center text-center py-16 md:py-24 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold font-headline mb-6 text-foreground">
            Your Journey, Simplified.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experience seamless cab booking with Link Cabs. Fast, reliable, and
            just a tap away. Get where you need to go, effortlessly.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 shadow-lg transition-transform hover:scale-105" asChild>
              <Link href="/dashboard/book-ride">Book Your Ride Now</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 shadow-lg transition-transform hover:scale-105" asChild>
              <Link href="/register">Become a Driver</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 font-headline text-card-foreground">
            Why Choose Link Cabs?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureItem
              icon={<Clock className="w-10 h-10 text-primary" />}
              title="Quick & Easy Booking"
              description="Book your ride in seconds with our intuitive app or website."
            />
            <FeatureItem
              icon={<Sparkles className="w-10 h-10 text-accent" />}
              title="AI-Powered Suggestions"
              description="Our smart AI helps you find the perfect taxi based on your needs."
            />
            <FeatureItem
              icon={<Users className="w-10 h-10 text-primary" />}
              title="Professional Drivers"
              description="Verified and experienced drivers ensuring a safe and comfortable journey."
            />
            <FeatureItem
              icon={<Shield className="w-10 h-10 text-green-500" />}
              title="Safety First"
              description="Track your ride in real-time and share your journey with loved ones."
            />
             <FeatureItem
              icon={<CheckCircle className="w-10 h-10 text-primary" />}
              title="Transparent Pricing"
              description="Know your fare upfront with no hidden charges. Fair and transparent."
            />
             <FeatureItem
              icon={<Users className="w-10 h-10 text-accent" />}
              title="Multiple Roles"
              description="Tailored experiences for passengers, drivers, operators, and administrators."
            />
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 md:py-24 bg-muted/40">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 font-headline text-foreground">
            Ready to Ride with Link Cabs?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Download our app or sign up today to start your journey.
          </p>
          <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-10 py-6 shadow-xl transition-transform hover:scale-105" asChild>
            <Link href="/register">Get Started Now</Link>
          </Button>
        </div>
      </section>

       {/* Image Placeholder Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-headline mb-8 text-foreground">
                See Our Modern Fleet
            </h2>
            <Image 
                src="https://placehold.co/800x450.png" 
                alt="Modern taxi fleet" 
                width={800} 
                height={450}
                className="rounded-lg shadow-xl mx-auto"
                data-ai-hint="taxi fleet modern cars"
            />
        </div>
      </section>
    </div>
  );
}

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <Card className="text-center p-6 hover:shadow-xl transition-shadow duration-300 bg-background">
      <CardHeader className="items-center pb-4">
        <div className="p-3 rounded-full bg-primary/10 mb-4 inline-block">
          {icon}
        </div>
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
