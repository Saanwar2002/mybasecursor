
import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { LogIn, UserPlus, Zap, ShieldCheck, ThumbsUp, Smartphone, ArrowRight, Target, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Removed CompanyCarousel import
import { PassengerReviewsCarousel } from '@/components/marketing/PassengerReviewsCarousel';

const features = [
  {
    icon: Zap,
    title: "Fast & Reliable",
    description: "Get to your destination quickly and dependably with our efficient service.",
  },
  {
    icon: ThumbsUp,
    title: "Competitive Pricing",
    description: "Enjoy affordable rates without compromising on quality or comfort.",
  },
  {
    icon: ShieldCheck,
    title: "Professional Drivers",
    description: "Our courteous and experienced drivers prioritize your safety and satisfaction.",
  },
  {
    icon: Smartphone,
    title: "Easy Booking",
    description: "Book your ride in seconds through our user-friendly app or website.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col space-y-10 md:space-y-16 pt-0 pb-6 md:pb-10">
      {/* Hero Section */}
      <section className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 items-center gap-8 md:gap-16">
          <div className="space-y-6 text-center md:text-left">

            <Image src="/mybase-logo.png" alt="MyBase Logo" width={300} height={75} className="mx-auto md:mx-0 mb-4" data-ai-hint="logo brand" />
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground tracking-tight">
              Welcome to MyBase
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto md:mx-0">
              Your reliable and efficient taxi service, connecting you to your destination with ease and comfort.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
              <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 text-base" asChild>
                <Link href="/register">
                  <UserPlus className="mr-2 h-5 w-5" /> Get Started - Sign Up
                </Link>
              </Button>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto text-base border border-accent text-accent hover:bg-accent/10" asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-5 w-5" /> Already have an account?
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center">
            <PassengerReviewsCarousel />
          </div>
        </div>
      </section>

      {/* Why Choose MyBase Section */}
      <section className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Why Choose MyBase?
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Experience the difference with our commitment to quality service.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-card hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="items-center text-center">
                <div className="p-3 bg-primary/10 rounded-full mb-3">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="font-semibold text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Company Carousel Section - REMOVED */}
      {/* 
      <section className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Get to Know Us Better
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A quick look into our values and commitment to you.
          </p>
        </div>
        <CompanyCarousel />
      </section>
      */}

    </div>
  );
}
