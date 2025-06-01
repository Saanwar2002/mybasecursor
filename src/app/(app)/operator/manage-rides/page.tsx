
"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Filter, Car, Users, MapPin, Edit, Trash2, Eye, Loader2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';

interface LocationPoint {
  address: string;
  latitude: number;
  longitude: number;
}

interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
}

interface Ride {
  id: string;
  passengerName: string; // From bookingData
  driverId?: string;
  driverName?: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Completed' | 'Cancelled' | 'pending_assignment';
  fareEstimate: number;
  bookingTimestamp?: SerializedTimestamp | null; // Changed from requestedAt
  scheduledPickupAt?: string | null;
  vehicleType?: string;
}

const formatDateFromTimestamp = (timestamp?: SerializedTimestamp | null): string => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, "PPpp"); // e.g., Sep 27, 2023, 10:30 AM
  } catch (e) {
    return 'Date Error';
  }
};

const formatDateFromISO = (isoString?: string | null): string => {
  if (!isoString) return 'N/A';
  try {
    const date = parseISO(isoString);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, "PPpp");
  } catch (e) {
    return 'Date Error';
  }
};


export default function OperatorManageRidesPage() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1); // For conceptual page tracking, API uses cursors
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]); // Stack of previous cursors

  const RIDES_PER_PAGE = 10;

  const fetchRides = useCallback(async (cursor?: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(RIDES_PER_PAGE));
      if (cursor) {
        params.append('startAfter', cursor);
      }
      if (filterStatus !== "all") {
        params.append('status', filterStatus);
      }
      if (searchTerm.trim() !== "") {
        // The backend /api/operator/bookings expects 'passengerName' for searching by name.
        // Adjust if your backend API supports broader search terms.
        params.append('passengerName', searchTerm.trim());
      }
      // Add other params like sortBy, sortOrder, dateFrom, dateTo as needed

      const response = await fetch(`/api/operator/bookings?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch rides: ${response.status}`);
      }
      const data = await response.json();
      
      // Adapt fetched data to Ride interface
      const fetchedRides = data.bookings.map((b: any) => ({
        id: b.id,
        passengerName: b.passengerName || 'N/A',
        driverId: b.driverId,
        driverName: b.driverName,
        pickupLocation: b.pickupLocation,
        dropoffLocation: b.dropoffLocation,
        stops: b.stops,
        status: b.status || 'Pending', // Default if status is missing
        fareEstimate: b.fareEstimate || 0,
        bookingTimestamp: b.bookingTimestamp,
        scheduledPickupAt: b.scheduledPickupAt,
        vehicleType: b.vehicleType,
      }));
      
      setRides(fetchedRides);
      setNextCursor(data.nextCursor || null);

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Rides", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchTerm, toast]);

  useEffect(() => {
    fetchRides(null); // Fetch initial page
    setCurrentPage(1);
    setPrevCursors([]);
  }, [fetchRides]); // Re-fetch when filters or search term change (due to fetchRides dependency)


  const handleNextPage = () => {
    if (nextCursor) {
      setPrevCursors(prev => [...prev, rides.length > 0 ? rides[0].id : null]); // Store current first item ID as a potential prev cursor
      setCurrentPage(p => p + 1);
      fetchRides(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const lastPrevCursor = prevCursors[prevCursors.length - 1];
      setPrevCursors(prev => prev.slice(0, -1));
      setCurrentPage(p => Math.max(1, p - 1));
      fetchRides(lastPrevCursor);
    } else if (currentPage > 1) { // Fallback for first page if prevCursors is empty but not on page 1
        setCurrentPage(1);
        fetchRides(null);
    }
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
  };
  
  const assignDriver = async (rideId: string) => {
    // Placeholder: In a real app, this would open a dialog to select a driver
    const driverIdToAssign = prompt("Enter Driver ID to assign (e.g., mockDriver123):");
    if (!driverIdToAssign) return;

    try {
      const response = await fetch(`/api/operator/bookings/${rideId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driverIdToAssign, driverName: `Driver ${driverIdToAssign.slice(-3)}`, status: 'Assigned' }), 
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign driver.');
      }
      const updatedRide = await response.json();
      setRides(prevRides => prevRides.map(r => r.id === rideId ? { ...r, driverId: updatedRide.booking.driverId, driverName: updatedRide.booking.driverName, status: updatedRide.booking.status } : r));
      toast({ title: "Driver Assigned", description: `Driver ${updatedRide.booking.driverName} assigned to ride ${rideId}.` });
    } catch (error) {
      toast({ title: "Assignment Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Car className="w-8 h-8 text-primary" /> Manage All Rides
          </CardTitle>
          <CardDescription>Oversee, assign, and track all ride requests and ongoing journeys.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_assignment">Pending Assignment</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input 
            placeholder="Search by Passenger Name..." 
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full md:max-w-sm"
          />
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
              <p className="font-semibold">Error loading rides:</p>
              <p>{error}</p>
              <Button onClick={() => fetchRides(null)} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && rides.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No rides match your criteria.</p>
          )}
          {!isLoading && !error && rides.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Dropoff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead>Booked/Scheduled</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rides.map((ride) => (
                  <TableRow key={ride.id}>
                    <TableCell className="font-medium">{ride.passengerName || 'N/A'}</TableCell>
                    <TableCell>{ride.driverName || 'N/A'}</TableCell>
                    <TableCell>{ride.pickupLocation.address}</TableCell>
                    <TableCell>{ride.dropoffLocation.address}</TableCell>
                    <TableCell>
                      <Badge variant={
                        ride.status === 'Completed' ? 'default' :
                        ride.status === 'Cancelled' ? 'destructive' :
                        ride.status === 'In Progress' || ride.status === 'in_progress' ? 'outline' 
                        : 'secondary'
                      }
                      className={
                        ride.status === 'In Progress' || ride.status === 'in_progress' ? 'border-blue-500 text-blue-500' : 
                        ride.status === 'Pending' || ride.status === 'pending_assignment' ? 'bg-yellow-400/80 text-yellow-900' :
                        ride.status === 'Assigned' ? 'bg-sky-400/80 text-sky-900' : ''
                      }
                      >
                        {ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">£{(ride.fareEstimate || 0).toFixed(2)}</TableCell>
                    <TableCell>{ride.scheduledPickupAt ? `Scheduled: ${formatDateFromISO(ride.scheduledPickupAt)}` : `Booked: ${formatDateFromTimestamp(ride.bookingTimestamp)}`}</TableCell>
                    <TableCell className="text-center space-x-1">
                      {(ride.status === 'Pending' || ride.status === 'pending_assignment') && (
                        <Button variant="outline" size="sm" className="h-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" onClick={() => assignDriver(ride.id)}>
                          <Users className="mr-1 h-3 w-3" /> Assign
                        </Button>
                      )}
                       <Button variant="outline" size="icon" className="h-8 w-8">
                          <Eye className="h-4 w-4" title="View Details"/>
                      </Button>
                      {/* <Button variant="outline" size="icon" className="h-8 w-8">
                          <Edit className="h-4 w-4" title="Edit Ride"/>
                      </Button> */}
                      {/* {ride.status !== 'Completed' && ride.status !== 'Cancelled' && (
                         <Button variant="outline" size="icon" className="h-8 w-8 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
                          <Trash2 className="h-4 w-4" title="Cancel Ride"/>
                      </Button>
                      )} */}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
        </CardContent>
      </Card>
    </div>
  );
}

    
