"use client";

import { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Car, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { suggestTaxiOnDescription, SuggestTaxiOnDescriptionInput, SuggestTaxiOnDescriptionOutput } from '@/ai/flows/suggest-taxi-on-description';
import { Skeleton } from '../ui/skeleton';

const formSchema = z.object({
  taxiDescription: z.string().min(10, { message: "Please provide a more detailed description (at least 10 characters)." }),
});

export function TaxiSuggester() {
  const [suggestion, setSuggestion] = useState<SuggestTaxiOnDescriptionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taxiDescription: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setSuggestion(null);
    try {
      const result = await suggestTaxiOnDescription(values as SuggestTaxiOnDescriptionInput);
      setSuggestion(result);
      toast({
        title: "AI Suggestion Ready!",
        description: "We found a taxi suggestion for you.",
      });
    } catch (error) {
      console.error("Error fetching AI suggestion:", error);
      toast({
        title: "Error",
        description: "Could not fetch AI suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-accent" /> AI Taxi Finder
        </CardTitle>
        <CardDescription>Describe your ideal taxi and requirements, and our AI will suggest the best option for you.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="taxiDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Describe your taxi needs:</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., I need a spacious SUV for 4 people with luggage, preferably with a child seat, for a trip to the airport around 3 PM."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              {isLoading ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Finding Taxi...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Get AI Suggestion
                </>
              )}
            </Button>
          </form>
        </Form>

        {isLoading && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        )}

        {suggestion && !isLoading && (
          <Card className="mt-6 bg-primary/5 border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary font-headline">
                <CheckCircle2 className="w-6 h-6" /> AI Suggestion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold flex items-center gap-1"><Car className="w-5 h-5" /> Suggested Taxi:</h4>
                <p className="text-foreground ml-1">{suggestion.suggestedTaxi}</p>
              </div>
              <div>
                <h4 className="font-semibold">Reason:</h4>
                <p className="text-muted-foreground ml-1">{suggestion.reason}</p>
              </div>
               <Button variant="outline" className="w-full mt-4" onClick={() => alert(`Booking ${suggestion.suggestedTaxi}... (Demo)`)}>
                Book This Taxi
              </Button>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
