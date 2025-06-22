"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Contact, Search, Loader2, AlertTriangle, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { auth } from '@/lib/firebase';

interface Passenger {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'passenger';
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
}

const formatDateFromTimestamp = (timestamp?: { _seconds: number; _nanoseconds: number } | null): string => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, "PPpp"); // e.g., Sep 27, 2023, 10:30 AM
  } catch (e) {
    return 'Date Error';
  }
};

export default function OperatorManagePassengersPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth(); // Get user from auth context

  const [searchName, setSearchName] = useState<string>("");
  const [searchEmail, setSearchEmail] = useState<string>("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);

  const PASSENGERS_PER_PAGE = 10;

  const fetchPassengers = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    setIsLoading(true);
    setError(null);

    if (!auth || !user) {
      setError("You must be logged in to view passengers.");
      setIsLoading(false);
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication token not available.");
      }
      const headers = { 'Authorization': `Bearer ${token}` };

      const params = new URLSearchParams();
      params.append('limit', String(PASSENGERS_PER_PAGE));
      if (cursor) {
        params.append('startAfter', cursor);
      }
      if (searchName.trim() !== "") {
        params.append('searchName', searchName.trim());
      }
      if (searchEmail.trim() !== "") {
        params.append('searchEmail', searchEmail.trim());
      }
      // Default sort: by name, asc. API uses this default.
      // params.append('sortBy', 'createdAt'); 
      // params.append('sortOrder', 'desc');

      const response = await fetch(`/api/operator/passengers?${params.toString()}`, { headers });
      if (!response.ok) {
        // Attempt to parse error as text first, as "Unauthorized" isn't JSON
        const errorText = await response.text();
        try {
            // See if the text is actually JSON
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.message || `Failed to fetch passengers: ${response.status}`);
        } catch (jsonError) {
            // If parsing fails, use the raw text
            throw new Error(errorText || `Failed to fetch passengers: ${response.status}`);
        }
      }
      const data = await response.json();
      
      setPassengers(data.passengers || []);
      setNextCursor(data.nextCursor || null);

      if (direction === 'filter') {
        setCurrentPage(1);
        setPrevCursors([]);
      } else if (direction === 'next') {
        if (passengers.length > 0 && cursor) {
           setPrevCursors(prev => [...prev, passengers[0]?.id || null]);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Passengers", description: message, variant: "destructive" });
      setPassengers([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchName, searchEmail, toast, user]);

  useEffect(() => {
    // Initial fetch or when search terms change, but only if user is logged in
    if (user) {
        fetchPassengers(null, 'filter');
    } else {
        // Handle case where user is not logged in on initial load
        setIsLoading(false);
        setError("Please log in to view passenger data.");
    }
  }, [searchName, searchEmail, user, fetchPassengers]);


  const handleNextPage = () => {
    if (nextCursor) {
      setCurrentPage(p => p + 1);
      fetchPassengers(nextCursor, 'next');
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const lastPrevCursor = prevCursors[prevCursors.length - 1];
      setPrevCursors(prev => prev.slice(0, -1));
      setCurrentPage(p => Math.max(1, p - 1));
      fetchPassengers(lastPrevCursor, 'prev');
    } else if (currentPage > 1) {
        setCurrentPage(1);
        fetchPassengers(null, 'filter');
    }
  };
  
  const handleSearchNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchName(event.target.value);
    // Fetching is handled by useEffect watching searchName
  };

  const handleSearchEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchEmail(event.target.value);
    // Fetching is handled by useEffect watching searchEmail
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Contact className="w-8 h-8 text-primary" /> Manage Passengers
          </CardTitle>
          <CardDescription>View and search registered passengers.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Search by passenger name..." 
                  value={searchName}
                  onChange={handleSearchNameChange}
                  className="w-full md:max-w-xs"
                />
            </div>
             <div className="flex items-center gap-2 w-full md:w-auto">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Search by passenger email..." 
                  value={searchEmail}
                  onChange={handleSearchEmailChange}
                  className="w-full md:max-w-xs"
                />
            </div>
        </CardHeader>
        <CardContent>
           {isLoading && (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
          {error && !isLoading && (
            <div className="text-center py-10 text-destructive">
              <AlertTriangle className="mx-auto h-12 w-12 mb-2" />
              <p className="font-semibold">Error loading passengers:</p>
              <p>{error}</p>
              <Button onClick={() => fetchPassengers(null, 'filter')} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && passengers.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No passengers match your criteria.</p>
          )}
          {!isLoading && !error && passengers.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Registered On</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passengers.map((passenger) => (
                    <TableRow key={passenger.id}>
                      <TableCell className="font-medium">{passenger.name}</TableCell>
                      <TableCell>{passenger.email}</TableCell>
                      <TableCell>{passenger.phone || 'N/A'}</TableCell>
                      <TableCell>{formatDateFromTimestamp(passenger.createdAt)}</TableCell>
                      <TableCell className="text-center space-x-1">
                         <Button variant="outline" size="icon" className="h-8 w-8" title="View Details (Placeholder)">
                            <Eye className="h-4 w-4" />
                        </Button>
                         {/* Add other actions like suspend, view ride history etc. later */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 && prevCursors.length === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!nextCursor}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
