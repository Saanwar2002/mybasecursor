
"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";

const feedbackFormSchema = z.object({
  category: z.string({ required_error: "Please select a category." }),
  details: z.string().min(20, { message: "Please provide at least 20 characters of detail." }).max(1000, { message: "Details cannot exceed 1000 characters."}),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

const feedbackCategories = [
  { value: "app_issue", label: "App Issue / Bug Report" },
  { value: "operator_concern", label: "Operator Concern" },
  { value: "payment_query", label: "Payment Query" },
  { value: "work_condition", label: "Work Condition Feedback" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "general_feedback", label: "General Feedback / Suggestion" },
  { value: "other", label: "Other" },
];

export default function DriverHelpSupportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      category: "",
      details: "",
    },
  });

  async function onSubmit(values: FeedbackFormValues) {
    setIsSubmitting(true);
    console.log("Driver Feedback Submitted (Mock):", {
      driverId: user?.id || "unknown_driver",
      driverName: user?.name || "Unknown Driver",
      ...values,
      submittedAt: new Date().toISOString(),
    });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "Feedback Submitted (Mock)",
      description: "Thank you! Your feedback has been recorded. We will review it shortly.",
    });
    form.reset();
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <HelpCircle className="w-8 h-8 text-primary" /> Help & Support
          </CardTitle>
          <CardDescription>
            Have an issue or feedback? Let us know. We&apos;re here to help.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Submit Feedback or Report an Issue</CardTitle>
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
                          <SelectValue placeholder="Select a category for your feedback" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {feedbackCategories.map(cat => (
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
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide as much detail as possible about your feedback or issue..."
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
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
