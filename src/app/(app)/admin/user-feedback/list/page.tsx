
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MessageSquareHeart, Loader2, AlertTriangle, Eye, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

interface FeedbackItem {
  id: string;
  submitterId: string;
  submitterName: string;
  submitterEmail?: string | null;
  submitterRole: 'passenger' | 'driver' | 'operator' | 'admin';
  category: string;
  details: string;
  rideId?: string | null;
  status: 'New' | 'Investigating' | 'Resolved' | 'Closed';
  submittedAt: string; // ISO string
  updatedAt: string; // ISO string
}

const statusOptions: FeedbackItem['status'][] = ['New', 'Investigating', 'Resolved', 'Closed'];

export default function AdminUserFeedbackPage() {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTermSubmitter, setSearchTermSubmitter] = useState<string>("");

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Add query params for filtering when API supports it
      const response = await fetch('/api/admin/feedback/list');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch feedback list.'}));
        throw new Error(errorData.message);
      }
      const data = await response.json();
      setFeedbackItems(data.feedback || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Feedback", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const filteredFeedback = feedbackItems.filter(item => {
    const statusMatch = filterStatus === "all" || item.status === filterStatus;
    const categoryMatch = filterCategory === "all" || item.category === filterCategory;
    const submitterMatch = searchTermSubmitter === "" || 
                           item.submitterName.toLowerCase().includes(searchTermSubmitter.toLowerCase()) ||
                           (item.submitterEmail && item.submitterEmail.toLowerCase().includes(searchTermSubmitter.toLowerCase()));
    return statusMatch && categoryMatch && submitterMatch;
  });

  const allCategories = Array.from(new Set(feedbackItems.map(item => item.category))).sort();

  const handleStatusChange = async (feedbackId: string, newStatus: FeedbackItem['status']) => {
    setIsUpdatingStatus(true);
    console.log(`Mock: Updating feedback ${feedbackId} to status ${newStatus}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 750));
    setFeedbackItems(prev => prev.map(item => item.id === feedbackId ? { ...item, status: newStatus, updatedAt: new Date().toISOString() } : item));
    if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : null);
    }
    toast({ title: "Status Updated (Mock)", description: `Feedback ${feedbackId} moved to ${newStatus}.`});
    setIsUpdatingStatus(false);
  };


  const getStatusBadgeVariant = (status: FeedbackItem['status']) => {
    switch (status) {
      case 'New': return 'secondary';
      case 'Investigating': return 'default';
      case 'Resolved': return 'outline';
      case 'Closed': return 'destructive';
      default: return 'secondary';
    }
  };
   const getStatusBadgeClass = (status: FeedbackItem['status']) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'Investigating': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-300';
      case 'Closed': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <MessageSquareHeart className="w-8 h-8 text-primary" /> User Feedback & Reports
          </CardTitle>
          <CardDescription>Review and manage feedback submitted by passengers, drivers, and operators.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Filter by Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="Filter by Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input 
            placeholder="Search by Submitter Name/Email..."
            value={searchTermSubmitter}
            onChange={(e) => setSearchTermSubmitter(e.target.value)}
          />
        </CardHeader>
        <CardContent>
          {isLoading && <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}
          {error && !isLoading && (
            <div className="text-center py-10 text-destructive">
              <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
              <p className="font-semibold">Error loading feedback:</p><p>{error}</p>
              <Button onClick={fetchFeedback} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && filteredFeedback.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No feedback items match your criteria.</p>
          )}
          {!isLoading && !error && filteredFeedback.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details (Snippet)</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{format(parseISO(item.submittedAt), "dd MMM yy, HH:mm")}</TableCell>
                    <TableCell>
                      <div>{item.submitterName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{item.submitterRole}</div>
                    </TableCell>
                    <TableCell className="text-xs">{item.category}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.status)} className={getStatusBadgeClass(item.status)}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={item.details}>{item.details}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setSelectedFeedback(item); setIsDetailsModalOpen(true); }}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Feedback Details: {selectedFeedback?.id}</DialogTitle>
            <DialogDescription>
              Submitted by {selectedFeedback?.submitterName} ({selectedFeedback?.submitterRole})
            </DialogDescription>
          </DialogHeader>
          {selectedFeedback && (
            <ScrollArea className="max-h-[60vh] p-1 -mx-1">
              <div className="space-y-3 pr-4">
                <p><strong>Category:</strong> {selectedFeedback.category}</p>
                <p><strong>Status:</strong>
                  <Select
                    value={selectedFeedback.status}
                    onValueChange={(newStatus) => handleStatusChange(selectedFeedback.id, newStatus as FeedbackItem['status'])}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs ml-2 inline-flex">
                      {isUpdatingStatus && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(sOpt => <SelectItem key={sOpt} value={sOpt} className="text-xs">{sOpt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </p>
                <p><strong>Submitted:</strong> {format(parseISO(selectedFeedback.submittedAt), "PPPpp")}</p>
                <p><strong>Last Updated:</strong> {format(parseISO(selectedFeedback.updatedAt), "PPPpp")}</p>
                {selectedFeedback.submitterEmail && <p><strong>Email:</strong> {selectedFeedback.submitterEmail}</p>}
                {selectedFeedback.rideId && <p><strong>Ride ID:</strong> {selectedFeedback.rideId}</p>}
                <p className="font-semibold mt-2">Details:</p>
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap border">
                  {selectedFeedback.details}
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
