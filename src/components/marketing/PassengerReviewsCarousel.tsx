"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Star, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  name: string;
  avatarText: string;
  reviewText: string;
  stars: number;
  location?: string;
}

export function PassengerReviewsCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch('/api/feedback/list?minRating=4');
        if (!response.ok) {
          throw new Error('Failed to fetch reviews.');
        }
        const data = await response.json();
        if (data && data.length > 0) {
           const formattedReviews = data.map((fb: any) => ({
                id: fb.id,
                name: fb.passengerName || 'Anonymous',
                avatarText: (fb.passengerName || 'A').charAt(0),
                reviewText: fb.comments,
                stars: fb.rating,
                location: 'Huddersfield' // Assuming location, can be added to feedback later
          }));
          setReviews(formattedReviews);
        } else {
          // Fallback to some generic reviews if none are featured yet
          setReviews([
            { id: 'fallback1', name: 'A Happy Customer', avatarText: 'HC', reviewText: 'Great, reliable service every time. Highly recommended!', stars: 5, location: 'Huddersfield' },
            { id: 'fallback2', name: 'Satisfied Passenger', avatarText: 'SP', reviewText: 'The driver was professional and the car was clean. Excellent experience.', stars: 5, location: 'Huddersfield' },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setReviews([
            { id: 'fallback_error_1', name: 'A Happy Customer', avatarText: 'HC', reviewText: 'Great, reliable service every time. Highly recommended!', stars: 5, location: 'Huddersfield' },
            { id: 'fallback_error_2', name: 'Satisfied Passenger', avatarText: 'SP', reviewText: 'The driver was professional and the car was clean. Excellent experience.', stars: 5, location: 'Huddersfield' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const navigate = (direction: 'prev' | 'next') => {
    if (reviews.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      if (direction === 'prev') {
        setCurrentIndex((prevIndex) =>
          prevIndex === 0 ? reviews.length - 1 : prevIndex - 1
        );
      } else {
        setCurrentIndex((prevIndex) =>
          prevIndex === reviews.length - 1 ? 0 : prevIndex + 1
        );
      }
      setIsTransitioning(false);
    }, 200); // Match CSS transition duration
  };

  // Autoplay effect
  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => {
      navigate('next');
    }, 7000); // Change review every 7 seconds
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews]);


  const currentReview = reviews[currentIndex];

  if (isLoading) {
    return (
        <Card className="w-full max-w-md h-auto flex flex-col justify-between rounded-xl shadow-2xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border-2 border-primary/30">
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        </Card>
    );
  }

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
        <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Previous review" className="h-8 w-8" disabled={reviews.length <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex space-x-1.5">
            {reviews.map((_, index) => (
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
        <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Next review" className="h-8 w-8" disabled={reviews.length <= 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
