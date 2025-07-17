
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
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { collection, query, where, onSnapshot, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SupportTicket } from "@/types/global";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

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
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      category: "",
      details: "",
    },
  });

  async function onSubmit(values: FeedbackFormValues) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submitterId: user?.id || "unknown_driver",
          submitterName: user?.name || "Unknown Driver",
          submitterEmail: user?.email || undefined,
          submitterRole: "driver",
          category: values.category,
          details: values.details,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Feedback Submitted",
          description: "Thank you! Your feedback has been recorded. We will review it shortly.",
        });
        form.reset();
      } else {
        toast({
          title: "Submission Failed",
          description: data.message || "Could not submit feedback. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Submission Error",
        description: "An error occurred while submitting feedback.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  }

  // Fetch driver's tickets
  useEffect(() => {
    if (!user?.id || !db) return;
    setTicketsLoading(true);
    const ticketsRef = collection(db, "userFeedback");
    const q = query(ticketsRef, where("submitterId", "==", user.id), where("submitterRole", "==", "driver"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const ticketsData = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let submittedAt = data.submittedAt;
        if (submittedAt instanceof Timestamp) submittedAt = submittedAt.toDate().toISOString();
        // Timeout logic: mark as timed out if >7 days and status is still Pending
        let timedOut = false;
        if (data.status === "Pending" && submittedAt) {
          const submittedTime = new Date(submittedAt).getTime();
          if (now - submittedTime > 7 * 24 * 60 * 60 * 1000) timedOut = true;
        }
        return {
          id: docSnap.id,
          category: data.category,
          details: data.details,
          status: timedOut ? "Timed Out" : data.status,
          submittedAt,
          lastUpdated: data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : undefined,
          canDelete: timedOut || ["Resolved", "Closed"].includes(data.status),
        };
      });
      setTickets(ticketsData);
      setTicketsLoading(false);
    });
    return () => unsubscribe();
  }, [user, db]);

  async function handleDeleteTicket(ticketId: string) {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }
      await deleteDoc(doc(db, "userFeedback", ticketId));
      toast({ title: "Ticket Deleted", description: `Your ticket has been deleted.` });
    } catch (error) {
      toast({ title: "Delete Failed", description: "Could not delete ticket.", variant: "destructive" });
    }
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
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Your Submitted Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No tickets submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map(ticket => (
                    <TableRow key={ticket.id}>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell><Badge>{ticket.status}</Badge></TableCell>
                      <TableCell className="text-xs">{ticket.submittedAt ? (
                        typeof ticket.submittedAt === 'object' && '_seconds' in ticket.submittedAt 
                          ? new Date(ticket.submittedAt._seconds * 1000).toLocaleString()
                          : new Date(ticket.submittedAt).toLocaleString()
                      ) : "-"}</TableCell>
                      <TableCell className="max-w-xs truncate" title={ticket.details}>{ticket.details}</TableCell>
                      <TableCell>
                        {ticket.canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Ticket</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this ticket?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
