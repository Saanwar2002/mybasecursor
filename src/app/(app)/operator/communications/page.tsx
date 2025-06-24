
"use client";

import { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, AlertTriangle, User, Users, Mail, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const communicationsFormSchema = z.object({
  targetAudience: z.enum(["all", "inactive", "specific"], {
    required_error: "You must select a target audience.",
  }),
  passengerIdInput: z.string().optional(),
  channelSms: z.boolean().default(false),
  channelEmail: z.boolean().default(false),
  emailSubject: z.string().optional(),
  messageBody: z.string().min(10, { message: "Message body must be at least 10 characters." }),
  discountCode: z.string().optional(),
}).refine(data => data.channelSms || data.channelEmail, {
  message: "At least one channel (SMS or Email) must be selected.",
  path: ["channelSms"], // You can put this error on either, or a general one
}).refine(data => {
  if (data.targetAudience === "specific") {
    return !!data.passengerIdInput && data.passengerIdInput.trim() !== "";
  }
  return true;
}, {
  message: "Passenger ID is required for specific targeting.",
  path: ["passengerIdInput"],
}).refine(data => {
  if (data.channelEmail) {
    return !!data.emailSubject && data.emailSubject.trim() !== "";
  }
  return true;
}, {
  message: "Email subject is required if Email channel is selected.",
  path: ["emailSubject"],
});

type CommunicationsFormValues = z.infer<typeof communicationsFormSchema>;

export default function OperatorCommunicationsPage() {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const form = useForm<CommunicationsFormValues>({
    resolver: zodResolver(communicationsFormSchema),
    defaultValues: {
      targetAudience: "all",
      passengerIdInput: "",
      channelSms: false,
      channelEmail: true, // Default to email
      emailSubject: "",
      messageBody: "",
      discountCode: "",
    },
  });

  const watchedTargetAudience = form.watch("targetAudience");
  const watchedChannelEmail = form.watch("channelEmail");

  async function onSubmit(values: CommunicationsFormValues) {
    setIsSending(true);
    try {
      const response = await fetch("/api/operator/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (response.ok) {
        toast({
          title: "Messages Queued for Delivery",
          description: `Messages have been queued for delivery. Audience: ${result.details.targetAudience}. Channels: ${[result.details.channelSms ? 'SMS' : '', result.details.channelEmail ? 'Email' : ''].filter(Boolean).join(' & ')}. Discount: ${result.details.discountCode || 'None'}.`,
          duration: 7000,
        });
        form.reset();
      } else {
        toast({
          title: "Failed to Send Messages",
          description: result.error || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Network Error",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Send className="w-8 h-8 text-primary" /> Passenger Communications
          </CardTitle>
          <CardDescription>
            Compose and send promotional messages or reminders to passengers. No actual messages will be sent unless backend integration is configured.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Create New Communication</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Users className="w-4 h-4 text-muted-foreground" /> Target Audience</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target audience" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Passengers</SelectItem>
                        <SelectItem value="inactive">Inactive - Last 90 days</SelectItem>
                        <SelectItem value="specific">Specific Passenger ID</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedTargetAudience === "specific" && (
                <FormField
                  control={form.control}
                  name="passengerIdInput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><User className="w-4 h-4 text-muted-foreground" /> Passenger ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Passenger ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormItem>
                <FormLabel className="text-base">Channels</FormLabel>
                <div className="flex items-center space-x-4">
                  <FormField
                    control={form.control}
                    name="channelSms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-1">
                          <MessageSquare className="w-4 h-4"/> SMS
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelEmail"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal flex items-center gap-1">
                          <Mail className="w-4 h-4"/> Email
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
                 <FormMessage>{form.formState.errors.channelSms?.message}</FormMessage> {/* Display channel selection error here */}
              </FormItem>

              {watchedChannelEmail && (
                <FormField
                  control={form.control}
                  name="emailSubject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Exciting news from Link Cabs!" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="messageBody"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message Body</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Dear [PassengerName], we miss you! Here's a 10% discount on your next ride: [DiscountCode]"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Placeholders like [PassengerName] and [DiscountCode] would be replaced in a real system.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., WELCOME10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isSending}>
                {isSending ? (
                     <>
                        <Send className="mr-2 h-4 w-4 animate-pulse" />
                        Sending...
                    </>
                ) : (
                    <>
                        <Send className="mr-2 h-4 w-4" /> Send Messages
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

