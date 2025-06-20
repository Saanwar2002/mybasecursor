"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, Trash2, Car, Info, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface FavoriteDriver {
  id: string;
  name: string;
  avatarText: string;
  vehicleInfo: string;
}

export default function FavoriteDriversPage() {
  const { toast } = useToast();
  const [favoriteDrivers, setFavoriteDrivers] = useState<FavoriteDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingDriverId, setRemovingDriverId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFavoriteDrivers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/users/favorite-drivers/list');
        if (!response.ok) {
          throw new Error('Failed to fetch favorite drivers.');
        }
        const data = await response.json();
        setFavoriteDrivers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        toast({
          title: "Error",
          description: "Could not load your favorite drivers.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavoriteDrivers();
  }, [toast]);

  const handleRemoveFavorite = async (driverId: string) => {
    setRemovingDriverId(driverId);
    try {
      const response = await fetch('/api/users/favorite-drivers/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove driver.');
      }
      
      setFavoriteDrivers(prev => prev.filter(driver => driver.id !== driverId));
      toast({
        title: "Driver Removed",
        description: "The driver has been removed from your favorites.",
      });

    } catch (error) {
       toast({
        title: "Error",
        description: "Could not remove the driver from your favorites.",
        variant: "destructive"
      });
    } finally {
      setRemovingDriverId(null);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-md">
              <CardHeader className="flex flex-row items-center gap-4 pb-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </CardHeader>
              <CardFooter className="pt-3 border-t">
                 <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
       return (
         <Alert variant="destructive">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error</AlertTitle>
           <AlertDescription>
             {error} Please try refreshing the page.
           </AlertDescription>
         </Alert>
       );
    }
    
    if (favoriteDrivers.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>You haven't added any favorite drivers yet.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {favoriteDrivers.map(driver => (
          <Card key={driver.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center gap-4 pb-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={`https://placehold.co/48x48.png?text=${driver.avatarText}`} alt={driver.name} data-ai-hint="driver avatar" />
                <AvatarFallback>{driver.avatarText}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{driver.name}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-1">
                  <Car className="w-3 h-3"/> {driver.vehicleInfo}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter className="pt-3 border-t">
              <Button
                variant="destructive"
                size="sm"
                className="w-full bg-destructive/90 hover:bg-destructive"
                onClick={() => handleRemoveFavorite(driver.id)}
                disabled={removingDriverId === driver.id}
              >
                {removingDriverId === driver.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove from Favorites
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <ThumbsUp className="w-8 h-8 text-primary" /> My Favorite Drivers
          </CardTitle>
          <CardDescription>
            Manage your list of preferred drivers. Rides may be prioritized with these drivers when they are available.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">How to Add Favorites</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          You can add drivers to your favorites from your <strong className="font-medium">Rides History</strong> page after completing a ride with them.
          This feature helps us try to match you with drivers you prefer.
        </AlertDescription>
      </Alert>

      {renderContent()}
    </div>
  );
}
