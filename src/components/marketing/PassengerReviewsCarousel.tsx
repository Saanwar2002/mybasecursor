
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  name: string;
  avatarText: string;
  reviewText: string;
  stars: number;
  location?: string;
}

const mockReviews: Review[] = [
  {
    id: 'review1',
    name: 'Sarah L.',
    avatarText: 'SL',
    reviewText: "MyBase is my go-to for airport transfers! Always on time, clean cars, and friendly drivers. Booking is a breeze too.",
    stars: 5,
    location: "London",
  },
  {
    id: 'review2',
    name: 'John B.',
    avatarText: 'JB',
    reviewText: "Used MyBase for a night out and was very impressed. The driver was professional and the fare was reasonable. Highly recommend!",
    stars: 5,
    location: "Manchester",
  },
  {
    id: 'review3',
    name: 'Emily K.',
    avatarText: 'EK',
    reviewText: "Great service! The app is easy to use and I love that I can track my ride. Drivers are always courteous.",
    stars: 4,
    location: "Birmingham",
  },
  {
    id: 'review4',
    name: 'David P.',
    avatarText: 'DP',
    reviewText: "Reliable and efficient. I've never had an issue with MyBase. The cars are always clean and the drivers know the best routes.",
    stars: 5,
    location: "Leeds",
  },
];

export function PassengerReviewsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const navigate = (direction: 'prev' | 'next') => {
    setIsTransitioning(true);
    setTimeout(() => {
      if (direction === 'prev') {
        setCurrentIndex((prevIndex) =>
          prevIndex === 0 ? mockReviews.length - 1 : prevIndex - 1
        );
      } else {
        setCurrentIndex((prevIndex) =>
          prevIndex === mockReviews.length - 1 ? 0 : prevIndex + 1
        );
      }
      setIsTransitioning(false);
    }, 200); // Match CSS transition duration
  };

  // Autoplay effect
  useEffect(() => {
    const timer = setInterval(() => {
      navigate('next');
    }, 7000); // Change review every 7 seconds
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const currentReview = mockReviews[currentIndex];

  return (
    <Card className="w-full max-w-lg h-[400px] flex flex-col justify-between rounded-xl shadow-2xl overflow-hidden bg-gradient-to-br from-primary/10 via-card to-accent/10 border-2 border-primary/30">
      <CardHeader className="pt-6 pb-3 text-center">
        <CardTitle className="text-2xl font-headline text-primary">What Our Passengers Say</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center text-center px-6 py-4 overflow-hidden">
        <div className={cn("transition-opacity duration-200 ease-in-out w-full", isTransitioning ? "opacity-0" : "opacity-100")}>
          {currentReview && (
            <>
              <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-accent shadow-md">
                <AvatarImage src={`https://placehold.co/80x80.png?text=${currentReview.avatarText}`} alt={currentReview.name} data-ai-hint="avatar person" />
                <AvatarFallback className="text-2xl">{currentReview.avatarText}</AvatarFallback>
              </Avatar>
              <div className="flex justify-center mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-5 h-5",
                      i < currentReview.stars ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50"
                    )}
                  />
                ))}
              </div>
              <p className="text-lg italic text-foreground/90 mb-3 leading-relaxed">
                &ldquo;{currentReview.reviewText}&rdquo;
              </p>
              <p className="font-semibold text-primary">{currentReview.name}</p>
              {currentReview.location && <p className="text-xs text-muted-foreground">{currentReview.location}</p>}
            </>
          )}
        </div>
      </CardContent>
      <div className="flex items-center justify-between p-4 border-t bg-card/50 shrink-0">
        <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Previous review">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex space-x-1.5">
            {mockReviews.map((_, index) => (
            <button
                key={`dot-${index}`}
                onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                        setCurrentIndex(index);
                        setIsTransitioning(false);
                    }, 200);
                }}
                className={cn(
                "w-2 h-2 rounded-full transition-all duration-300 ease-out",
                currentIndex === index ? "bg-primary w-4" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                aria-label={`Go to review ${index + 1}`}
            />
            ))}
        </div>
        <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Next review">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </Card>
  );
}
