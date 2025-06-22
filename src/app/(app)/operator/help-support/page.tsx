
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  { value: "operator_panel_bug", label: "Operator Panel Bug/Issue" },
  { value: "platform_feature_request", label: "Platform Feature Request" },
  { value: "billing_commission_query", label: "Billing/Commission Inquiry" },
  { value: "driver_management_tool_issue", label: "Driver Management Tool Issue" },
  { value: "general_platform_feedback", label: "General Platform Feedback" },
  { value: "api_integration_query", label: "API/Integration Query (if applicable)" },
  { value: "other", label: "Other" },
];

const operatorFaqItems = [
  {
    id: "faq-op-1",
    question: "How do I manage driver payouts?",
    answer: "Driver payouts are typically handled by your own accounting systems. The platform provides ride and earnings data to facilitate this. For specific commission structures, refer to your agreement with the platform."
  },
  {
    id: "faq-op-2",
    question: "What are the key features of the Operator Panel?",
    answer: "The Operator Panel allows you to manage your drivers, view ride history for your fleet, access analytics specific to your operations, manage credit accounts (if enabled), and communicate with passengers/drivers related to your jobs."
  },
  {
    id: "faq-op-3",
    question: "How is platform commission calculated for my drivers?",
    answer: "Platform commission rates are set globally by the admin. You can view the default rate in Admin Global Settings. Specific agreements might override this. Any discrepancies should be raised with platform support."
  },
  {
    id: "faq-op-4",
    question: "Can I set custom surge pricing for my fleet?",
    answer: "Currently, surge pricing is a platform-wide setting managed by the administrator. You can see its status in your Operator Settings > Pricing page. Future enhancements may allow more granular control."
  },
];

export default function OperatorHelpSupportPage() {
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
    console.log("Operator Platform Feedback Submitted (Mock):", {
      operatorId: user?.id || "unknown_operator",
      operatorName: user?.name || "Unknown Operator",
      operatorCode: user?.operatorCode || "N/A",
      ...values,
      submittedAt: new Date().toISOString(),
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: "Feedback Sent to Platform Support (Mock)",
      description: "Thank you! Your feedback/issue has been recorded. Platform administrators will review it.",
    });
    form.reset();
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <HelpCircle className="w-8 h-8 text-primary" /> Operator Support & Platform Feedback
          </CardTitle>
          <CardDescription>
            Find answers to common questions or submit feedback/issues related to the MyBase platform itself.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-xl font-headline">Frequently Asked Questions</CardTitle></CardHeader>
        <CardContent>
          {operatorFaqItems.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {operatorFaqItems.map((item) => (
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
          <CardTitle className="text-xl font-headline">Submit Feedback or Report Platform Issue</CardTitle>
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
                          <SelectValue placeholder="Select a category for your feedback/issue" />
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
                        placeholder="Please provide as much detail as possible about your feedback or the platform issue..."
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
                    Submit to Platform Support
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
