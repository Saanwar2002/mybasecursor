
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MessageSquareWarning, Trash2, Edit, Loader2, CheckCircle, Clock, Briefcase, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';

interface SupportTicket {
  id: string;
  submitterId: string;
  submitterName: string;
  submitterRole: 'driver' | 'passenger' | 'operator';
  driverOperatorCode?: string;
  driverOperatorName?: string;
  category: string;
  details: string;
  submittedAt: string; // ISO string
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Closed';
  lastUpdated?: string; // ISO string
  assignedTo?: string; // Admin/Operator User ID
}

const ticketStatusOptions: SupportTicket['status'][] = ['Pending', 'In Progress', 'Resolved', 'Closed'];

export default function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/support-tickets');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch tickets: ${response.status}`);
      }
      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Tickets", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleStatusChange = async (ticketId: string, newStatus: SupportTicket['status']) => {
    setActionLoading(prev => ({ ...prev, [`status-${ticketId}`]: true }));
    try {
      const response = await fetch(`/api/admin/support-tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update status: ${response.status}`);
      }
      const updatedTicket = await response.json();
      setTickets(prevTickets =>
        prevTickets.map(ticket =>
          ticket.id === ticketId ? { ...updatedTicket, submittedAt: ticket.submittedAt } : ticket // Preserve original submittedAt if not returned by API
        )
      );
      toast({ title: "Status Updated", description: `Ticket ${ticketId} status changed to ${newStatus}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      toast({ title: "Status Update Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`status-${ticketId}`]: false }));
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    setActionLoading(prev => ({ ...prev, [`delete-${ticketId}`]: true }));
    try {
      const response = await fetch(`/api/admin/support-tickets/${ticketId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete ticket: ${response.status}`);
      }
      setTickets(prevTickets => prevTickets.filter(ticket => ticket.id !== ticketId));
      toast({ title: "Ticket Deleted", description: `Ticket ${ticketId} has been removed.`, variant: "destructive" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      toast({ title: "Delete Failed", description: message, variant: "destructive" });
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete-${ticketId}`]: false }));
    }
  };
  
  const getStatusBadgeVariant = (status: SupportTicket['status']) => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'In Progress': return 'default';
      case 'Resolved': return 'outline';
      case 'Closed': return 'destructive';
      default: return 'secondary';
    }
  };
  const getStatusBadgeClass = (status: SupportTicket['status']) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70';
      case 'In Progress': return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'Resolved': return 'border-green-500 text-green-600 bg-green-500/10 hover:bg-green-500/20';
      case 'Closed': return 'bg-slate-500 text-white hover:bg-slate-600';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <MessageSquareWarning className="w-8 h-8 text-primary" /> Support Tickets
          </CardTitle>
          <CardDescription>
            View, manage, and resolve support tickets and feedback from platform users.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Submitted Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : error ? (
             <div className="text-center py-10 text-destructive">
              <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
              <p className="font-semibold">Error loading tickets:</p>
              <p>{error}</p>
              <Button onClick={fetchTickets} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No support tickets found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Submitter</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Driver's Operator</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-xs">{ticket.id}</TableCell>
                      <TableCell>{ticket.submitterName}</TableCell>
                      <TableCell className="capitalize">{ticket.submitterRole}</TableCell>
                      <TableCell>
                        {ticket.submitterRole === 'driver' && ticket.driverOperatorCode ? (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Briefcase className="w-3 h-3"/> 
                            {ticket.driverOperatorCode}
                            {ticket.driverOperatorName && ` - ${ticket.driverOperatorName}`}
                          </Badge>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>{ticket.category}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(ticket.submittedAt), "PPpp")}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(ticket.status)} className={getStatusBadgeClass(ticket.status)}>
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={ticket.details}>{ticket.details}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <Select
                          value={ticket.status}
                          onValueChange={(value) => handleStatusChange(ticket.id, value as SupportTicket['status'])}
                          disabled={actionLoading[`status-${ticket.id}`] || actionLoading[`delete-${ticket.id}`]}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            {actionLoading[`status-${ticket.id}`] && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            <SelectValue placeholder="Change status" />
                          </SelectTrigger>
                          <SelectContent>
                            {ticketStatusOptions.map(option => (
                              <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={actionLoading[`delete-${ticket.id}`] || actionLoading[`status-${ticket.id}`]} title="Delete Ticket">
                              {actionLoading[`delete-${ticket.id}`] ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete ticket {ticket.id}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

    