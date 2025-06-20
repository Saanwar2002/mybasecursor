"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Target, Users, Smartphone, ShieldCheck, Car, MapPin, Clock, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CarouselSlide {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  imageUrl?: string;
  imageHint?: string;
}

const slidesData: CarouselSlide[] = [
  {
    id: 'instant-booking',
    title: "Instant Booking",
    description: "Book your ride in seconds with our AI-powered platform. Available 24/7 across Huddersfield.",
    icon: Clock,
    imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=600&h=300&fit=crop&crop=center",
    imageHint: "modern taxi booking app interface"
  },
  {
    id: 'safety-first',
    title: "Safety First",
    description: "Every driver is verified and insured. Real-time tracking and SOS features for your peace of mind.",
    icon: ShieldCheck,
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=300&fit=crop&crop=center",
    imageHint: "professional taxi driver in uniform"
  },
  {
    id: 'huddersfield-community',
    title: "Your Huddersfield, Your MyBase",
    description: "Supporting local drivers and serving the Huddersfield community with reliable, friendly service.",
    icon: MapPin,
    imageUrl: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600&h=300&fit=crop&crop=center",
    imageHint: "Huddersfield town center and landmarks"
  },
  {
    id: 'vehicle-options',
    title: "Multiple Vehicle Options",
    description: "Choose from standard cars, estates, minibuses, or luxury vehicles to match your needs and budget.",
    icon: Car,
    imageUrl: "https://images.unsplash.com/photo-1549924231-f129b911e442?w=600&h=300&fit=crop&crop=center",
    imageHint: "variety of taxi vehicles lined up"
  },
  {
    id: 'transparent-pricing',
    title: "Transparent Pricing",
    description: "Know your fare upfront with no hidden charges. Competitive rates with clear, honest pricing.",
    icon: Star,
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop&crop=center",
    imageHint: "taxi meter and pricing display"
  },
  {
    id: 'smart-technology',
    title: "Smart Technology",
    description: "AI-powered matching, real-time tracking, and seamless communication for the best experience.",
    icon: Smartphone,
    imageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&h=300&fit=crop&crop=center",
    imageHint: "smartphone with taxi app interface"
  },
];

export function CompanyCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? slidesData.length - 1 : prevIndex - 1
    );
  };

  const nextSlide = useCallback(() => {
    setCurrentIndex((prevIndex) =>
      prevIndex === slidesData.length - 1 ? 0 : prevIndex + 1
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 5000); 
    return () => clearInterval(interval);
  }, [nextSlide]);

  const currentSlide = slidesData[currentIndex];

  if (!currentSlide) {
    return (
      <Card className="w-full max-w-3xl mx-auto shadow-xl overflow-hidden border-2 border-primary/20">
        <CardHeader className="text-center pb-3 pt-4 bg-primary/5">
          <CardTitle className="text-xl md:text-2xl font-bold text-primary">
            Discover MyBase
          </CardTitle>
        </CardHeader>
        <CardContent className="relative p-0">
          <div className="aspect-[16/7] overflow-hidden relative bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">Loading slides...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl overflow-hidden border-2 border-primary/20">
      <CardHeader className="text-center pb-3 pt-4 bg-primary/5">
        <CardTitle className="text-xl md:text-2xl font-bold text-primary">
          Discover MyBase
        </CardTitle>
      </CardHeader>
      <CardContent className="relative p-0">
        <div className="aspect-[16/7] overflow-hidden relative bg-muted">
          {slidesData.map((slide, index) => (
            <div
              key={slide.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-in-out",
                index === currentIndex ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {slide.imageUrl && (
                <Image
                  src={slide.imageUrl}
                  alt={slide.title}
                  width={600}
                  height={300}
                  className="object-cover w-full h-full"
                  data-ai-hint={slide.imageHint}
                  priority={index === 0}
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-end text-center p-4 md:p-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                {slide.icon && <slide.icon className="w-8 h-8 md:w-10 md:h-10 text-white mb-2 drop-shadow-lg" />}
                <h3 className="text-lg md:text-xl font-semibold text-white mb-2 drop-shadow-md">{slide.title}</h3>
                <p className="text-xs md:text-sm text-gray-200 max-w-md leading-snug drop-shadow">{slide.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={prevSlide}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/95 rounded-full shadow-lg backdrop-blur-sm border-white/20"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={nextSlide}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/95 rounded-full shadow-lg backdrop-blur-sm border-white/20"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>

        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 p-1 bg-black/40 backdrop-blur-sm rounded-full">
          {slidesData.map((_, index) => (
            <button
              key={`dot-${index}`}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300 ease-out",
                currentIndex === index ? "bg-primary w-4" : "bg-gray-300/70 hover:bg-gray-200"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Slide counter */}
        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-white">
          {currentIndex + 1} / {slidesData.length}
        </div>
      </CardContent>
    </Card>
  );
}
