
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';

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
  passengerName: string;
  driverId?: string;
  driverName?: string;
  driverVehicleDetails?: string;
  pickupLocation: LocationPoint;
  dropoffLocation: LocationPoint;
  stops?: LocationPoint[];
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Completed' | 'Cancelled' | 'pending_assignment' | 'driver_assigned' | 'arrived_at_pickup';
  fareEstimate: number;
  bookingTimestamp?: SerializedTimestamp | null;
  scheduledPickupAt?: string | null;
  vehicleType?: string;
}

const formatDateFromTimestamp = (timestamp?: SerializedTimestamp | null): string => {
  if (!timestamp) return 'N/A';
  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, "PPpp");
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
  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedRideForAssignment, setSelectedRideForAssignment] = useState<Ride | null>(null);
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignDriverName, setAssignDriverName] = useState("");
  const [assignVehicleDetails, setAssignVehicleDetails] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);


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
        params.append('passengerName', searchTerm.trim());
      }
      
      const response = await fetch(`/api/operator/bookings?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch rides: ${response.status}`);
      }
      const data = await response.json();
      
      const fetchedRides = data.bookings.map((b: any) => ({
        id: b.id,
        passengerName: b.passengerName || 'N/A',
        driverId: b.driverId,
        driverName: b.driverName,
        driverVehicleDetails: b.driverVehicleDetails,
        pickupLocation: b.pickupLocation,
        dropoffLocation: b.dropoffLocation,
        stops: b.stops,
        status: b.status || 'Pending',
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
    fetchRides(null);
    setCurrentPage(1);
    setPrevCursors([]);
  }, [fetchRides]);


  const handleNextPage = () => {
    if (nextCursor) {
      setPrevCursors(prev => [...prev, rides.length > 0 ? rides[0].id : null]);
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
    } else if (currentPage > 1) {
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
  
  const openAssignDialog = (ride: Ride) => {
    setSelectedRideForAssignment(ride);
    setAssignDriverId("");
    setAssignDriverName("");
    setAssignVehicleDetails("");
    setIsAssignDialogOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!selectedRideForAssignment || !assignDriverId.trim() || !assignDriverName.trim()) {
      toast({ title: "Missing Information", description: "Driver ID and Name are required.", variant: "destructive" });
      return;
    }
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/operator/bookings/${selectedRideForAssignment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            driverId: assignDriverId.trim(), 
            driverName: assignDriverName.trim(),
            driverVehicleDetails: assignVehicleDetails.trim() || `${selectedRideForAssignment.vehicleType || 'Car'} - Reg N/A`, // Default vehicle details
            status: 'driver_assigned' // Changed from 'Assigned'
        }), 
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign driver.');
      }
      const updatedRideResult = await response.json();
      
      setRides(prevRides => prevRides.map(r => 
        r.id === selectedRideForAssignment.id ? 
        { ...r, 
          driverId: updatedRideResult.booking.driverId, 
          driverName: updatedRideResult.booking.driverName, 
          driverVehicleDetails: updatedRideResult.booking.driverVehicleDetails,
          status: updatedRideResult.booking.status as Ride['status'] 
        } : r
      ));
      toast({ title: "Driver Assigned", description: `Driver ${assignDriverName} assigned to ride ${selectedRideForAssignment.id}.` });
      setIsAssignDialogOpen(false);
    } catch (error) {
      toast({ title: "Assignment Failed", description: error instanceof Error ? error.message : "Unknown error.", variant: "destructive" });
    } finally {
      setIsAssigning(false);
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
                <SelectItem value="driver_assigned">Driver Assigned</SelectItem>
                <SelectItem value="arrived_at_pickup">Arrived At Pickup</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                  <TableHead>Vehicle Details</TableHead>
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
                    <TableCell>{ride.driverVehicleDetails || 'N/A'}</TableCell>
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
                        ride.status === 'Assigned' || ride.status === 'driver_assigned' ? 'bg-sky-400/80 text-sky-900' : 
                        ride.status === 'arrived_at_pickup' ? 'bg-indigo-400/80 text-indigo-900' : ''
                      }
                      >
                        {ride.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">£{(ride.fareEstimate || 0).toFixed(2)}</TableCell>
                    <TableCell>{ride.scheduledPickupAt ? `Scheduled: ${formatDateFromISO(ride.scheduledPickupAt)}` : `Booked: ${formatDateFromTimestamp(ride.bookingTimestamp)}`}</TableCell>
                    <TableCell className="text-center space-x-1">
                      {(ride.status === 'Pending' || ride.status === 'pending_assignment') && (
                        <Button variant="outline" size="sm" className="h-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" onClick={() => openAssignDialog(ride)}>
                          <Users className="mr-1 h-3 w-3" /> Assign
                        </Button>
                      )}
                       <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Info", description: `Viewing details for ride ${ride.id} (Placeholder)`})}>
                          <Eye className="h-4 w-4" title="View Details"/>
                      </Button>
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

      <AlertDialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Driver to Ride</AlertDialogTitle>
            <AlertDialogDescription>
              Assign a driver to ride ID: {selectedRideForAssignment?.id}. <br />
              Passenger: {selectedRideForAssignment?.passengerName} <br />
              From: {selectedRideForAssignment?.pickupLocation.address} <br/>
              To: {selectedRideForAssignment?.dropoffLocation.address}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="assignDriverId">Driver ID</Label>
              <Input 
                id="assignDriverId" 
                value={assignDriverId} 
                onChange={(e) => setAssignDriverId(e.target.value)}
                placeholder="Enter Driver ID (e.g., DR-mock-xyz)" 
              />
            </div>
            <div>
              <Label htmlFor="assignDriverName">Driver Name</Label>
              <Input 
                id="assignDriverName" 
                value={assignDriverName} 
                onChange={(e) => setAssignDriverName(e.target.value)}
                placeholder="Enter Driver's Name" 
              />
            </div>
             <div>
              <Label htmlFor="assignVehicleDetails">Driver Vehicle Details</Label>
              <Input 
                id="assignVehicleDetails" 
                value={assignVehicleDetails} 
                onChange={(e) => setAssignVehicleDetails(e.target.value)}
                placeholder="e.g., Toyota Prius - ABC 123" 
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsAssignDialogOpen(false)} disabled={isAssigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignDriver} disabled={isAssigning || !assignDriverId.trim() || !assignDriverName.trim()}>
              {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    
