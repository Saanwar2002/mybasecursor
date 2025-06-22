// "use client"; // Keep this if your original component needed it for hooks/interactivity

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Package, ShieldCheck, Smartphone, Users, Zap, Star, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import Image from 'next/image';
import { CompanyCarousel } from "@/components/marketing/company-carousel";
import { PassengerReviewsCarousel } from "@/components/marketing/PassengerReviewsCarousel";

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <Card className="w-full shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-2 bg-card/80 backdrop-blur-sm border-primary/20 hover:border-primary/40 feature-card animate-slide-up">
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

const StatCard = ({ label, icon: Icon }: { label: string, icon: React.ElementType }) => (
  <div className="text-center">
    <div className="flex items-center justify-center mb-2">
      <Icon className="w-5 h-5 text-primary mr-2" />
    </div>
    <p className="text-sm text-muted-foreground">{label}</p>
  </div>
);

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      {/* Hero Section */}
      <section className="relative pt-0 md:pt-1 lg:pt-1 pb-0 md:pb-1 lg:pb-1 bg-gradient-to-br from-primary/10 via-background to-primary/5 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <Image
            src="/mybase-logo.png"
            alt="MyBase Logo"
            width={500}
            height={80}
            className="mx-auto mb-4 animate-fade-in" 
            priority
            data-ai-hint="logo brand"
          />
          
          {/* Social Proof Badge */}
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-6">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
              ))}
            </div>
            <span className="text-sm font-medium text-green-800">4.9/5 from 500+ reviews</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tight text-primary mb-4 max-w-3xl mx-auto leading-tight">
            Your Journey, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">Simplified.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            The all-in-one taxi platform connecting passengers, drivers, and operators for a seamless, efficient, and reliable experience across Huddersfield.
          </p>

          {/* Stats Section */}
          <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-8">
            <StatCard label="Happy Customers" icon={Users} />
            <StatCard label="Verified Drivers" icon={ShieldCheck} />
            <StatCard label="24/7 Support Available" icon={Zap} />
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-lg mx-auto mb-8">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 group" asChild>
              <Link href="/register?role=passenger" className="flex items-center">
                Ride with MyBase
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-3 border-primary text-primary hover:bg-primary/10 active:bg-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95" asChild>
              <Link href="/register?role=driver">Drive for MyBase</Link>
            </Button>
            <Button size="lg" className="text-lg px-8 py-3 bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95" asChild>
              <Link href="/login">
                Login
              </Link>
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Verified Drivers</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Instant Booking</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-green-500" />
              <span>No Hidden Fees</span>
            </div>
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
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Why Choose MyBase?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience the difference with our comprehensive taxi platform designed for modern needs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Zap}
              title="Instant & Scheduled Bookings"
              description="Get a ride now or schedule one for later with just a few taps. AI-powered matching for the best experience."
            />
            <FeatureCard
              icon={Smartphone}
              title="User-Friendly App"
              description="Intuitive design for passengers, drivers, and operators. Real-time updates and seamless communication."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Safety First"
              description="Verified drivers, real-time tracking, SOS features, and comprehensive insurance for your peace of mind."
            />
             <FeatureCard
              icon={Users}
              title="Community Focused"
              description="Connecting local drivers with passengers, supporting the Huddersfield community with reliable service."
            />
            <FeatureCard
              icon={Package}
              title="Multiple Vehicle Options"
              description="Choose from standard cars, estates, minibuses, or luxury vehicles to suit your specific needs."
            />
             <FeatureCard
              icon={CheckCircle}
              title="Transparent Pricing"
              description="Know your fare upfront with clear, competitive pricing. No hidden charges, no surprises."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 md:py-16 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started with MyBase in just three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Book Your Ride</h3>
              <p className="text-muted-foreground">Enter your pickup and destination, choose your vehicle type, and get instant pricing.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Track Your Driver</h3>
              <p className="text-muted-foreground">Watch your driver approach in real-time with live GPS tracking and ETA updates.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Enjoy Your Journey</h3>
              <p className="text-muted-foreground">Relax and enjoy your ride with our professional drivers and comfortable vehicles.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Passenger Reviews Section */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4 flex flex-col items-center">
            <PassengerReviewsCarousel />
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-12 md:py-20 text-center bg-gradient-to-r from-primary to-purple-600 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
            Join thousands of satisfied customers who trust MyBase for their daily transportation needs.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button size="lg" className="bg-white text-primary hover:bg-gray-100 active:bg-gray-200 text-lg px-10 py-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95" asChild>
              <Link href="/register">Sign Up Now</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 active:bg-white/20 text-lg px-10 py-3 transition-all duration-300 transform active:scale-95" asChild>
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
