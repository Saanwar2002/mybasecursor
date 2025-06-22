"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Trash2, Filter, Search, Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context';

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval' | 'Suspended';
  rating?: number;
  totalRides?: number;
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  role: UserRole;
  operatorCode?: string;
}

export default function OperatorManageDriversPage() {
  const { user: currentOperatorUser, getAuthToken } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDriverDialogOpen, setIsAddDriverDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);

  const DRIVERS_PER_PAGE = 10;

  const fetchDrivers = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    if (!currentOperatorUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not available.");

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
      
      const response = await fetch(`/api/operator/drivers?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch drivers: ${response.status}`);
      }
      const data = await response.json();
      
      const fetchedDrivers = (data.drivers || []).map((d: any) => ({
        ...d,
        status: d.status || 'Inactive' 
      }));
      setDrivers(fetchedDrivers);
      setNextCursor(data.nextCursor || null);

      if (direction === 'filter') {
        setCurrentPage(1);
        setPrevCursors([]);
      } else if (direction === 'next') {
        if (drivers.length > 0 && cursor) {
           setPrevCursors(prev => [...prev, drivers[0]?.id || null]);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Drivers", description: message, variant: "destructive" });
      setDrivers([]); 
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchTerm, toast, currentOperatorUser, getAuthToken]);

  useEffect(() => {
    if (currentOperatorUser) {
        fetchDrivers(null, 'filter');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, searchTerm, currentOperatorUser]);


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
    } else if (currentPage > 1) { 
        setCurrentPage(1);
        fetchDrivers(null, 'filter');
    }
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
  };

  const handleAddDriverSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionLoading(prev => ({ ...prev, addDriver: true }));
    const formData = new FormData(event.currentTarget);
    const newDriverData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      vehicleModel: formData.get('vehicleModel') as string,
      licensePlate: formData.get('licensePlate') as string,
      status: 'Pending Approval', 
      role: 'driver' as UserRole,
      operatorCode: currentOperatorUser?.operatorCode,
    };

    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      
      toast({ title: "Driver Submitted (Mock)", description: `${newDriverData.name} added and is pending approval under operator ${newDriverData.operatorCode}.`});
      setIsAddDriverDialogOpen(false);
      (event.target as HTMLFormElement).reset();
      fetchDrivers(null, 'filter'); 
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error adding driver.";
        toast({ title: "Add Driver Failed", description: message, variant: "destructive"});
    } finally {
        setActionLoading(prev => ({ ...prev, addDriver: false }));
    }
  };
  
  const handleDriverStatusUpdate = async (driverId: string, newStatus: Driver['status'], reason?: string) => {
    if (!currentOperatorUser) {
      toast({ title: "Authentication Error", description: "Cannot update status. Operator not logged in.", variant: "destructive" });
      return;
    }
    setActionLoading(prev => ({ ...prev, [driverId]: true }));
    try {
        const token = await getAuthToken();
        if (!token) throw new Error("Authentication token not available.");

        const payload: any = { status: newStatus };
        if (newStatus === 'Suspended' && reason) {
            payload.statusReason = reason;
        }

        const response = await fetch(`/api/operator/drivers/${driverId}`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch (e) {
              errorData = { message: await response.text() };
            }
            throw new Error(errorData.message || `Failed to update driver status to ${newStatus}.`);
        }
        const updatedDriverData = await response.json();
        
        setDrivers(prevDrivers => prevDrivers.map(d => d.id === driverId ? { ...d, status: updatedDriverData.driver.status } : d));
        toast({ title: "Driver Status Updated", description: `Driver ${updatedDriverData.driver.name || driverId} status set to ${newStatus}.`});
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error during status update.";
        toast({ title: "Status Update Failed", description: message, variant: "destructive" });
    } finally {
        setActionLoading(prev => ({ ...prev, [driverId]: false }));
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
            <CardDescription>Onboard, view, and manage your fleet of drivers. (Operator Code: {currentOperatorUser?.operatorCode || 'N/A'})</CardDescription>
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
                  Fill in the details to onboard a new driver. They will be set to 'Pending Approval' under your operator code: {currentOperatorUser?.operatorCode || 'N/A'}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDriverSubmit} className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" name="name" className="col-span-3" required disabled={actionLoading['addDriver']} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input id="email" name="email" type="email" className="col-span-3" required disabled={actionLoading['addDriver']} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">Phone</Label>
                  <Input id="phone" name="phone" type="tel" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vehicleModel" className="text-right">Vehicle</Label>
                  <Input id="vehicleModel" name="vehicleModel" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="licensePlate" className="text-right">License Plate</Label>
                  <Input id="licensePlate" name="licensePlate" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost" disabled={actionLoading['addDriver']}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={actionLoading['addDriver']}>
                        {actionLoading['addDriver'] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Driver
                    </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-bold">Error loading drivers:</p>
                <p>{error}</p>
                <Button variant="link" onClick={() => fetchDrivers()} className="p-0 h-auto mt-1 text-red-700 dark:text-red-200">Try Again</Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by driver name..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-8"
                disabled={isLoading}
              />
            </div>
            <Select onValueChange={handleFilterChange} defaultValue="all" disabled={isLoading}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Operator Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`loader-${i}`}>
                      <TableCell colSpan={5} className="text-center p-8">
                         <div className="flex justify-center items-center gap-2">
                           <Loader2 className="w-6 h-6 animate-spin text-primary"/>
                           <span className="text-muted-foreground">Loading drivers...</span>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : drivers.length > 0 ? (
                  drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>
                        <div>{driver.email}</div>
                        <div className="text-xs text-muted-foreground">{driver.phone || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline">{driver.operatorCode || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          driver.status === 'Active' ? 'default' :
                          driver.status === 'Pending Approval' ? 'secondary' :
                          driver.status === 'Suspended' ? 'destructive' : 'outline'
                        }>{driver.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {driver.status === 'Pending Approval' && (
                           <Button size="sm" variant="outline" onClick={() => handleDriverStatusUpdate(driver.id, 'Active')} disabled={actionLoading[driver.id]}>
                            {actionLoading[driver.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Approve
                          </Button>
                        )}
                        {driver.status === 'Active' && (
                           <Button size="sm" variant="destructive" onClick={() => handleDriverStatusUpdate(driver.id, 'Suspended', 'Manual suspension by operator.')} disabled={actionLoading[driver.id]}>
                             {actionLoading[driver.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                             Suspend
                           </Button>
                        )}
                         {driver.status === 'Inactive' && (
                           <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleDriverStatusUpdate(driver.id, 'Active')} disabled={actionLoading[driver.id]}>
                             {actionLoading[driver.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                             Activate
                           </Button>
                        )}
                        {driver.status === 'Suspended' && (
                          <Button size="sm" variant="outline" onClick={() => handleDriverStatusUpdate(driver.id, 'Active')} disabled={actionLoading[driver.id]}>
                            {actionLoading[driver.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            Re-activate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No drivers found for the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || isLoading}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {currentPage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!nextCursor || isLoading}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}