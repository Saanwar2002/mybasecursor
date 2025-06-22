
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
import { Bot, Loader2, Terminal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { parseBookingRequest, ParseBookingRequestInput, ParseBookingRequestOutput } from '@/ai/flows/parse-booking-request-flow';

const formSchema = z.object({
  userRequestText: z.string().min(10, { message: "Please provide a more detailed request (at least 10 characters)." }),
});

export default function TestAiBookingParserPage() {
  const [parsedOutput, setParsedOutput] = useState<ParseBookingRequestOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userRequestText: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setParsedOutput(null);
    setError(null);
    try {
      const result = await parseBookingRequest(values as ParseBookingRequestInput);
      setParsedOutput(result);
      toast({
        title: "AI Parsing Complete!",
        description: "The request has been processed.",
      });
    } catch (err) {
      console.error("Error fetching AI parsing result:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: `Could not parse request: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" /> Test AI Booking Parser
          </CardTitle>
          <CardDescription>
            Enter a natural language booking request to see how the AI interprets and structures it.
            This helps test the <code>parseBookingRequest</code> Genkit flow.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Input</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="userRequestText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enter your booking request:</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., I need a taxi for 2 people from King's Cross Station to Heathrow Terminal 5 ASAP, and I have two large bags."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing Request...
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" /> Parse with AI
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-6">
          <CardHeader><CardTitle>AI Output</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Waiting for AI response...</p>
          </CardContent>
        </Card>
      )}

      {error && !isLoading && (
        <Card className="mt-6 border-destructive">
          <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-destructive-foreground bg-destructive p-3 rounded-md">{error}</p>
          </CardContent>
        </Card>
      )}

      {parsedOutput && !isLoading && !error && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-6 h-6 text-accent" /> Structured AI Output
            </CardTitle>
            <CardDescription>This is the JSON object returned by the AI flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto">
              {JSON.stringify(parsedOutput, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
