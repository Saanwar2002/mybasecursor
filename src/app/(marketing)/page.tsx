
// "use client"; // Keep this if your original component needed it for hooks/interactivity

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Package, ShieldCheck, Smartphone, Users, Zap } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import { CompanyCarousel } from "@/components/marketing/company-carousel";
import { PassengerReviewsCarousel } from "@/components/marketing/PassengerReviewsCarousel";


const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <Card className="w-full shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 bg-card/80 backdrop-blur-sm border-primary/20">
    <CardHeader className="items-center text-center">
      <div className="p-3 bg-primary/10 rounded-full mb-3 inline-block border border-primary/30">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <CardTitle className="text-xl font-semibold text-primary">{title}</CardTitle>
    </CardHeader>
    <CardContent className="text-center">
      <p className="text-muted-foreground text-sm">{description}</p>
    </CardContent>
  </Card>
);

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      {/* Hero Section */}
      <section className="pt-1 md:pt-2 lg:pt-3 pb-4 md:pb-5 lg:pb-6 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <Image
            src="/mybase-logo.png"
            alt="MyBase Logo"
            width={500}
            height={80}
            className="mx-auto mb-6 rounded-lg shadow-lg"
            priority
          />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tight text-primary mb-6 max-w-2xl mx-auto">
            MyBase: Your Journey, Simplified.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8">
            The all-in-one taxi platform connecting passengers, drivers, and operators for a seamless, efficient, and reliable experience.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-lg mx-auto">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-3 shadow-md hover:shadow-lg transition-shadow" asChild>
              <Link href="/register?role=passenger">Ride with MyBase</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-primary text-primary hover:bg-primary/10 shadow-md hover:shadow-lg transition-shadow" asChild>
              <Link href="/register?role=driver">Drive for MyBase</Link>
            </Button>
            <Button size="lg" variant="secondary" className="text-lg px-8 py-3 shadow-md hover:shadow-lg transition-shadow" asChild>
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Carousel Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <CompanyCarousel />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10 text-foreground">Why Choose MyBase?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Zap}
              title="Instant & Scheduled Bookings"
              description="Get a ride now or schedule one for later with just a few taps."
            />
            <FeatureCard
              icon={Smartphone}
              title="User-Friendly App"
              description="Intuitive design for passengers, drivers, and operators for easy management."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Safety First"
              description="Verified drivers, real-time tracking, and SOS features for your peace of mind."
            />
             <FeatureCard
              icon={Users}
              title="Community Focused"
              description="Connecting local drivers with passengers, supporting the Huddersfield community."
            />
            <FeatureCard
              icon={Package}
              title="Multiple Vehicle Options"
              description="Choose from standard cars, estates, or minibuses to suit your needs."
            />
             <FeatureCard
              icon={CheckCircle}
              title="Transparent Pricing"
              description="Know your fare upfront with clear, competitive pricing. No hidden charges."
            />
          </div>
        </div>
      </section>

      {/* Passenger Reviews Section */}
      <section className="py-12 md:py-16 bg-primary/5">
        <div className="container mx-auto px-4 flex flex-col items-center">
            <PassengerReviewsCarousel />
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-12 md:py-20 text-center bg-accent text-accent-foreground">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg mb-8 max-w-xl mx-auto">
            Join the MyBase community today and experience the future of taxi services.
          </p>
          <Button size="lg" className="bg-background text-foreground hover:bg-background/90 text-lg px-10 py-3 shadow-lg hover:shadow-xl transition-shadow" asChild>
            <Link href="/register">Sign Up Now</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
