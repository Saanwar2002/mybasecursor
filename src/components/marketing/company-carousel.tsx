
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Target, Users, TrendingUp, ShieldCheck, Smartphone } from 'lucide-react';
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
    id: 'safety-main', // Changed id for clarity, was 'mission'
    title: "Safety Features", // CHANGED
    description: "Your safety is our priority. We implement comprehensive safety measures, from rigorous driver background checks to well-maintained vehicles, ensuring your peace of mind on every ride.", // CHANGED
    icon: ShieldCheck, // CHANGED
    imageUrl: "/images/carousel/Slide10.JPG", // This is the image from user's context
    imageHint: "driver car interior" // Updated hint
  },
  {
    id: 'community',
    title: "Your Huddersfield, Your MyBase",
    description: "Deeply rooted in Huddersfield, MyBase is committed to supporting our local community and providing top-notch service to its residents.",
    icon: Users,
    imageUrl: "/images/carousel/community-slide.jpg",
    imageHint: "Huddersfield landmark"
  },
  {
    id: 'technology',
    title: "Smart Rides with MyBase",
    description: "Experience seamless booking and efficient journeys with MyBase's advanced technology platform, designed for your convenience.",
    icon: Smartphone,
    imageUrl: "https://placehold.co/600x300/B08BCD/FFFFFF.png?text=600%20x%20300",
    imageHint: "smartphone app interface"
  },
  {
    id: 'original-mission', // If there was another mission slide, it needs a new image
    title: "Our Mission at MyBase",
    description: "Connecting Huddersfield with safe, reliable, and affordable rides. MyBase is your partner in every journey.",
    icon: Target,
    // This slide would need a different image if Slide10.JPG is now for safety.
    // For now, using a generic placeholder. User might want to remove or update this slide.
    imageUrl: "https://placehold.co/600x300/0EA5E9/FFFFFF.png?text=Our%20Mission", // Placeholder for mission
    imageHint: "team planning office"
  },
  // The original 'safety' slide definition might be redundant if Slide10.JPG is the primary safety image.
  // If the user had a different image for '/images/carousel/safety-slide.png' and wants two safety slides,
  // that's fine. Otherwise, it might be a duplicate or an old entry.
  // For now, I'm leaving it as it was, but its text is now the same as the first slide's.
  // The user may want to remove or change this if Slide10.JPG is the *only* safety image.
  // {
  //   id: 'safety_duplicate_text_check', // This was the original 'safety' id
  //   title: "Safety Features",
  //   description: "Your safety is our priority. We implement comprehensive safety measures, from rigorous driver background checks to well-maintained vehicles, ensuring your peace of mind on every ride.",
  //   icon: ShieldCheck,
  //   imageUrl: "/images/carousel/safety-slide.png", // This is a different image path
  //   imageHint: "safety shield"
  // },
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

  // Autoplay effect
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 7000); // Change slide every 7 seconds
    return () => clearInterval(interval); // Clear interval on component unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const currentSlide = slidesData[currentIndex];
  const IconComponent = currentSlide.icon;

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
                  layout="fill"
                  objectFit="cover"
                  data-ai-hint={slide.imageHint}
                  priority={index === 0}
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
