
"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Trash2, Filter, Search, Loader2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval';
  rating?: number;
  totalRides?: number;
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
}

// Mock add driver functionality - in a real app, this would call a backend API
const mockAddDriverToLocalState = (newDriverData: Omit<Driver, 'id' | 'rating' | 'totalRides' | 'createdAt'>, currentDrivers: Driver[]): Driver[] => {
  const newDriver: Driver = {
    id: `mock-${Date.now()}`,
    ...newDriverData,
    status: 'Pending Approval', // Default status for new mock driver
    rating: 0,
    totalRides: 0,
    createdAt: { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0},
  };
  return [newDriver, ...currentDrivers];
};


export default function OperatorManageDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDriverDialogOpen, setIsAddDriverDialogOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);

  const DRIVERS_PER_PAGE = 10;

  const fetchDrivers = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(DRIVERS_PER_PAGE));
      if (cursor) {
        params.append('startAfter', cursor);
      }
      if (filterStatus !== "all") {
        params.append('status', filterStatus);
      }
      if (searchTerm.trim() !== "") {
        params.append('searchName', searchTerm.trim());
      }
      // Add sortBy and sortOrder if needed, default is 'name', 'asc' in API
      // params.append('sortBy', 'createdAt');
      // params.append('sortOrder', 'desc');

      const response = await fetch(`/api/operator/drivers?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch drivers: ${response.status}`);
      }
      const data = await response.json();
      
      setDrivers(data.drivers || []);
      setNextCursor(data.nextCursor || null);

      if (direction === 'filter') {
        setCurrentPage(1);
        setPrevCursors([]);
      } else if (direction === 'next') {
        // The cursor for 'prev' should be the ID of the first item of the *previous* page.
        // This is tricky with server-side cursors without knowing the previous page's first item ID.
        // For now, we'll manage prevCursors stack.
        // This would be the current first item ID before fetching the next page.
        if (drivers.length > 0 && cursor) { // only add if we are moving from a populated page
           // Add the first ID of the *current* set of drivers before fetching the next set
           setPrevCursors(prev => [...prev, drivers[0]?.id || null]);
        }
      } else if (direction === 'prev') {
        // prevCursors stack is managed by handlePrevPage
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Drivers", description: message, variant: "destructive" });
      setDrivers([]); // Clear drivers on error
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchTerm, toast, drivers]); // Added drivers to dep array for prevCursors logic

  useEffect(() => {
    fetchDrivers(null, 'filter'); // Fetch initial page on filter/search change
  }, [filterStatus, searchTerm, fetchDrivers]);


  const handleNextPage = () => {
    if (nextCursor) {
      setCurrentPage(p => p + 1);
      fetchDrivers(nextCursor, 'next');
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const lastPrevCursor = prevCursors[prevCursors.length - 1];
      setPrevCursors(prev => prev.slice(0, -1));
      setCurrentPage(p => Math.max(1, p - 1));
      fetchDrivers(lastPrevCursor, 'prev');
    } else if (currentPage > 1) { // Fallback if prevCursors is empty but not on page 1
        setCurrentPage(1);
        fetchDrivers(null, 'filter'); // Go to first page
    }
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // Fetching is handled by useEffect watching searchTerm
  };

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
    // Fetching is handled by useEffect watching filterStatus
  };

  const handleAddDriverSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newDriverData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      vehicleModel: formData.get('vehicleModel') as string,
      licensePlate: formData.get('licensePlate') as string,
    };
    // Mocking: In a real app, this would be an API call.
    // const updatedDrivers = mockAddDriverToLocalState(newDriverData, drivers);
    // setDrivers(updatedDrivers); 
    // For now, just show a toast and close, then re-fetch to simulate
    toast({ title: "Driver Submitted (Mock)", description: `${newDriverData.name} would be sent for approval.`});
    setIsAddDriverDialogOpen(false);
    fetchDrivers(null, 'filter'); // Re-fetch to see if a real API was hit or to reset view
  };
  
  const handleApproveDriver = async (driverId: string) => {
    try {
        setIsLoading(true); // You might want a specific loading state for this action
        const response = await fetch(`/api/operator/drivers/${driverId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Active' })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to approve driver.');
        }
        toast({ title: "Driver Approved", description: `Driver ${driverId} is now Active.`});
        fetchDrivers(prevCursors.length > 0 ? prevCursors[prevCursors.length-1] : null); // Re-fetch current page
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error during approval.";
        toast({ title: "Approval Failed", description: message, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" /> Manage Drivers
            </CardTitle>
            <CardDescription>Onboard, view, and manage your fleet of drivers.</CardDescription>
          </div>
          <Dialog open={isAddDriverDialogOpen} onOpenChange={setIsAddDriverDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground mt-2 md:mt-0">
                <UserPlus className="mr-2 h-4 w-4" /> Add New Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Driver</DialogTitle>
                <DialogDescription>
                  Fill in the details to onboard a new driver. They will be set to 'Pending Approval'.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDriverSubmit} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" name="email" type="email" className="col-span-3" required />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <Input id="phone" name="phone" type="tel" className="col-span-3" required />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vehicleModel" className="text-right">Vehicle</Label>
                  <Input id="vehicleModel" name="vehicleModel" className="col-span-3" required />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="licensePlate" className="text-right">License</Label>
                  <Input id="licensePlate" name="licensePlate" className="col-span-3" required />
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">Add Driver</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Search by driver name..." 
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full md:max-w-xs"
                />
            </div>
            <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                  </SelectContent>
                </Select>
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
              <p className="font-semibold">Error loading drivers:</p>
              <p>{error}</p>
              <Button onClick={() => fetchDrivers(null, 'filter')} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && drivers.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No drivers match your criteria.</p>
          )}
          {!isLoading && !error && drivers.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                    <TableHead className="text-right">Total Rides</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>
                        <div>{driver.email}</div>
                        <div className="text-xs text-muted-foreground">{driver.phone || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                         <div>{driver.vehicleModel || 'N/A'}</div>
                         <div className="text-xs text-muted-foreground">{driver.licensePlate || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          driver.status === 'Active' ? 'default' :
                          driver.status === 'Pending Approval' ? 'secondary' :
                          'outline' 
                        }
                        className={
                            driver.status === 'Active' ? 'bg-green-500/80 text-green-950 hover:bg-green-500/70' :
                            driver.status === 'Pending Approval' ? 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70' :
                            'border-red-500 text-red-500 hover:bg-red-500/10'
                        }
                        >
                          {driver.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{driver.rating && driver.rating > 0 ? driver.rating.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell className="text-right">{driver.totalRides || 0}</TableCell>
                      <TableCell className="text-center space-x-1">
                         <Button variant="outline" size="icon" className="h-8 w-8" title="Edit Driver (Placeholder)">
                            <Edit className="h-4 w-4" />
                        </Button>
                         <Button variant="outline" size="icon" className="h-8 w-8 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" title="Remove Driver (Placeholder)">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        {driver.status === 'Pending Approval' && (
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" 
                                title="Approve Driver"
                                onClick={() => handleApproveDriver(driver.id)}
                                disabled={isLoading}
                            >
                                <UserPlus className="h-4 w-4"/>
                            </Button>
                        )}
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

