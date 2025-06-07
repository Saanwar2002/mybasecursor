
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Target, Users, TrendingUp, ShieldCheck } from 'lucide-react';
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
    id: 'mission',
    title: "Our Mission",
    description: "To provide safe, reliable, and affordable transportation for everyone, connecting communities seamlessly.",
    icon: Target,
    imageUrl: "https://placehold.co/600x300.png",
    imageHint: "team collaboration"
  },
  {
    id: 'community',
    title: "Community Focused",
    description: "We're proud to serve our local community, support local events, and build lasting connections with our passengers.",
    icon: Users,
    imageUrl: "https://placehold.co/600x300.png",
    imageHint: "community event"
  },
  {
    id: 'innovation',
    title: "Future Forward",
    description: "Innovating with cutting-edge technology to make your journeys smoother, greener, and more efficient.",
    icon: TrendingUp,
    imageUrl: "https://placehold.co/600x300.png",
    imageHint: "futuristic city"
  },
  {
    id: 'safety',
    title: "Safety First",
    description: "Your safety is our top priority, with regularly inspected vehicles and professional, vetted drivers.",
    icon: ShieldCheck,
    imageUrl: "https://placehold.co/600x300.png",
    imageHint: "car safety"
  },
];

export function CompanyCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? slidesData.length - 1 : prevIndex - 1
    );
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === slidesData.length - 1 ? 0 : prevIndex + 1
    );
  };

  // Uncomment for autoplay functionality
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     nextSlide();
  //   }, 7000); // Change slide every 7 seconds
  //   return () => clearInterval(interval);
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [currentIndex]); // Reset interval if currentIndex changes manually

  const currentSlide = slidesData[currentIndex];
  const IconComponent = currentSlide.icon;

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl overflow-hidden border-2 border-primary/20">
      <CardHeader className="text-center pb-3 pt-4 bg-primary/5">
        <CardTitle className="text-xl md:text-2xl font-bold text-primary">
          Discover Link Cabs
        </CardTitle>
      </CardHeader>
      <CardContent className="relative p-0">
        <div className="aspect-[16/7] overflow-hidden relative bg-muted"> {/* Parent needs to be relative for absolute children */}
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
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint={slide.imageHint}
                  priority={index === 0} // Prioritize loading the first image
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-end text-center p-4 md:p-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                {slide.icon && <slide.icon className="w-8 h-8 md:w-10 md:h-10 text-white mb-1.5 drop-shadow-lg" />}
                <h3 className="text-lg md:text-xl font-semibold text-white mb-1 drop-shadow-md">{slide.title}</h3>
                <p className="text-xs md:text-sm text-gray-200 max-w-md leading-snug drop-shadow">{slide.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={prevSlide}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/90 rounded-full shadow-md"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={nextSlide}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/90 rounded-full shadow-md"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>

        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 p-1 bg-black/30 backdrop-blur-sm rounded-full">
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
      </CardContent>
    </Card>
  );
}

