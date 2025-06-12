
"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, LifeBuoy, MessageSquare, ShieldQuestion, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

const faqItems = [
  {
    id: "faq1",
    question: "How do I book a ride?",
    answer: "You can book a ride directly from your dashboard using the 'Book a New Ride' button or the AI Taxi Search feature. Enter your pickup and drop-off locations, select a vehicle, and confirm your booking. You can also schedule rides for later."
  },
  {
    id: "faq2",
    question: "How can I track my taxi?",
    answer: "Once your ride is confirmed and a driver is assigned, you can track their location in real-time on the 'My Active Ride' page on your dashboard."
  },
  {
    id: "faq3",
    question: "What if I need to cancel a ride?",
    answer: "You can cancel a pending ride from the 'My Active Ride' page. Please note that cancellation policies may apply if a driver is already on their way."
  },
  {
    id: "faq4",
    question: "How is the fare calculated?",
    answer: "Fares are estimated based on distance, time, vehicle type, and current demand (surge pricing may apply). You'll see an estimate before confirming your ride."
  },
  {
    id: "faq5",
    question: "Can I add multiple stops to my journey?",
    answer: "Yes, the booking form allows you to add multiple stops to your journey. The fare will be adjusted accordingly."
  },
  {
    id: "faq6",
    question: "What payment methods are accepted?",
    answer: "We typically support cash and card payments directly to the driver. Some corporate accounts may have direct billing. Check the payment options when booking."
  }
];

const passengerFeedbackFormSchema = z.object({
  category: z.string({ required_error: "Please select a category." }),
  details: z.string().min(20, { message: "Please provide at least 20 characters of detail." }).max(1000, { message: "Details cannot exceed 1000 characters."}),
  rideId: z.string().optional(), // Optional ride ID for specific issues
});

type PassengerFeedbackFormValues = z.infer<typeof passengerFeedbackFormSchema>;

const passengerFeedbackCategories = [
  { value: "booking_issue", label: "Booking Issue" },
  { value: "driver_complaint", label: "Driver Complaint" },
  { value: "driver_compliment", label: "Driver Compliment" },
  { value: "app_suggestion", label: "App Suggestion / Bug" },
  { value: "payment_problem", label: "Payment Problem" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "general_inquiry", label: "General Inquiry" },
  { value: "other", label: "Other" },
];


export default function PassengerHelpSupportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PassengerFeedbackFormValues>({
    resolver: zodResolver(passengerFeedbackFormSchema),
    defaultValues: {
      category: "",
      details: "",
      rideId: "",
    },
  });

  async function onSubmit(values: PassengerFeedbackFormValues) {
    if (!user) {
      toast({ title: "Not Logged In", description: "You need to be logged in to submit feedback.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitterId: user.id,
          submitterName: user.name,
          submitterEmail: user.email, // Adding email
          submitterRole: user.role,
          category: values.category,
          details: values.details,
          rideId: values.rideId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({message: "Submission failed with no error details."}));
        throw new Error(errorData.message || `Feedback submission failed: ${response.status}`);
      }

      toast({
        title: "Feedback Submitted!",
        description: "Thank you for your feedback. We'll get back to you if needed.",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "Could not submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <HelpCircle className="w-8 h-8 text-primary" /> Help & Support
          </CardTitle>
          <CardDescription>
            Find answers to common questions or get in touch with our support team.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <ShieldQuestion className="w-6 h-6 text-accent"/> Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {faqItems.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem value={item.id} key={item.id}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground whitespace-pre-line">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-muted-foreground">No FAQs available at the moment.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-accent" /> Contact Us / Report Issue
          </CardTitle>
          <CardDescription>
            Can&apos;t find your answer? Send us a message.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {passengerFeedbackCategories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="rideId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Ride ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., BOOKING123XYZ" {...field} disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please describe your issue or feedback in detail..."
                        className="min-h-[150px]"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
                <LifeBuoy className="w-6 h-6 text-destructive"/> Emergency Contact
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                If this is an emergency or a safety-critical issue, please contact local emergency services immediately.
                For urgent MyBase platform issues, call our (mock) support line: <strong className="text-destructive">0800 123 4567</strong> (UK).
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
