
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
    name: 'Aisha K.',
    avatarText: 'AK',
    reviewText: "MyBase got me from Lindley to the station right on time! The car was spotless and the driver was so polite. Excellent service!",
    stars: 5,
    location: "Lindley, Huddersfield",
  },
  {
    id: 'review2',
    name: 'Tom P.',
    avatarText: 'TP',
    reviewText: "Fantastic trip to Holmfirth with MyBase. The driver knew all the shortcuts and the app made booking super easy. Will use again!",
    stars: 5,
    location: "Holmfirth",
  },
  {
    id: 'review3',
    name: 'Priya S.',
    avatarText: 'PS',
    reviewText: "Reliable service from Marsh to the town centre. Appreciate the clear pricing and friendly drivers. Much better than other local options.",
    stars: 4,
    location: "Marsh, Huddersfield",
  },
  {
    id: 'review4',
    name: 'David R.',
    avatarText: 'DR',
    reviewText: "Needed a quick ride from Almondbury and MyBase delivered. The driver was helpful with my shopping. Five stars!",
    stars: 5,
    location: "Almondbury, Huddersfield",
  },
  {
    id: 'review5',
    name: 'Chloe G.',
    avatarText: 'CG',
    reviewText: "Consistent and dependable. I use MyBase regularly for trips around Huddersfield. Always a pleasant experience.",
    stars: 5,
    location: "Huddersfield Town Centre",
  }
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
    <Card className="w-full max-w-md h-auto flex flex-col justify-between rounded-xl shadow-2xl overflow-hidden bg-gradient-to-br from-primary/10 via-card to-accent/10 border-2 border-primary/30">
      <CardHeader className="pt-4 pb-2 text-center">
        <CardTitle className="text-xl font-headline text-primary">What Our Passengers Say</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center text-center px-4 py-3 overflow-hidden">
        <div className={cn("transition-opacity duration-200 ease-in-out w-full", isTransitioning ? "opacity-0" : "opacity-100")}>
          {currentReview && (
            <>
              <Avatar className="w-16 h-16 mx-auto mb-3 border-2 border-accent shadow-md">
                <AvatarImage src={`https://placehold.co/64x64.png?text=${currentReview.avatarText}`} alt={currentReview.name} data-ai-hint="avatar person" />
                <AvatarFallback className="text-xl">{currentReview.avatarText}</AvatarFallback>
              </Avatar>
              <div className="flex justify-center mb-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-4 h-4",
                      i < currentReview.stars ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/50"
                    )}
                  />
                ))}
              </div>
              <p className="text-base italic text-foreground/90 mb-2 leading-snug">
                &ldquo;{currentReview.reviewText}&rdquo;
              </p>
              <p className="font-semibold text-sm text-primary">{currentReview.name}</p>
              {currentReview.location && <p className="text-xs text-muted-foreground">{currentReview.location}</p>}
            </>
          )}
        </div>
      </CardContent>
      <div className="flex items-center justify-between p-3 border-t bg-card/50 shrink-0">
        <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Previous review" className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
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
                "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-out",
                currentIndex === index ? "bg-primary w-3" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                aria-label={`Go to review ${index + 1}`}
            />
            ))}
        </div>
        <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Next review" className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
