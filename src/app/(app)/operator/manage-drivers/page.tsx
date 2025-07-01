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
import { useAuth } from '@/contexts/auth-context'; // To potentially get current operator's code
import { Checkbox } from '@/components/ui/checkbox';

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
  operatorCode?: string; // Added for operator association
  driverIdentifier?: string;
  customId?: string;
}

export default function OperatorManageDriversPage() {
  const { user: currentOperatorUser } = useAuth(); // Get the currently logged-in operator
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
  // --- Moved hooks for edit/delete dialog logic here ---
  const [isEditDriverDialogOpen, setIsEditDriverDialogOpen] = useState(false);
  const [editDriverData, setEditDriverData] = useState<Driver | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isDriverDetailsModalOpen, setIsDriverDetailsModalOpen] = useState(false);
  const DRIVERS_PER_PAGE = 10;
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const allDriversSelected = drivers.length > 0 && selectedDriverIds.length === drivers.length;
  const toggleSelectAllDrivers = () => setSelectedDriverIds(allDriversSelected ? [] : drivers.map(d => d.id));
  const toggleSelectDriver = (id: string) => setSelectedDriverIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);

  // For demo purposes, assume the logged-in operator's code.
  // In a real app, this would come from currentOperatorUser.operatorCode or similar.
  const currentOperatorCodeForDemo = currentOperatorUser?.operatorCode || currentOperatorUser?.customId || "OP001"; // Fallback if not set

  const fetchDrivers = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(DRIVERS_PER_PAGE));
      if (cursor) {
        params.append('startAfter', cursor);
      }
      params.append('operatorCode', currentOperatorCodeForDemo);
      if (filterStatus !== "all") {
        params.append('status', filterStatus);
      }
      if (searchTerm.trim() !== "") {
        params.append('searchName', searchTerm.trim());
      }
      const response = await fetch(`/api/operator/drivers?${params.toString()}`);
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
  }, [filterStatus, searchTerm, toast, drivers, currentOperatorCodeForDemo]); 

  useEffect(() => {
    fetchDrivers(null, 'filter');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, searchTerm]);


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
      operatorCode: currentOperatorUser?.operatorCode || currentOperatorUser?.customId || undefined,
      vehicleCategory: formData.get('vehicleCategory') as string,
      arNumber: formData.get('arNumber') as string,
      insuranceNumber: formData.get('insuranceNumber') as string,
    };

    try {
      const response = await fetch('/api/operator/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDriverData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add driver.');
      }
      const result = await response.json();
      toast({ title: 'Driver Added', description: `${result.driver.name} added and is pending approval under operator ${result.driver.operatorCode}.` });
      setIsAddDriverDialogOpen(false);
      (event.target as HTMLFormElement).reset();
      fetchDrivers(null, 'filter');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error adding driver.';
      toast({ title: 'Add Driver Failed', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(prev => ({ ...prev, addDriver: false }));
    }
  };
  
  const handleDriverStatusUpdate = async (driverId: string, newStatus: Driver['status'], reason?: string) => {
    setActionLoading(prev => ({ ...prev, [driverId]: true }));
    try {
        const payload: any = { status: newStatus };
        if (newStatus === 'Suspended' && reason) {
            payload.statusReason = reason;
        }

        const response = await fetch(`/api/operator/drivers/${driverId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
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

  function openEditDriverDialog(driver: Driver) {
    setEditDriverData(driver);
    setIsEditDriverDialogOpen(true);
  }

  const handleEditDriverSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDriverData) return;
    setActionLoading(prev => ({ ...prev, editDriver: true }));
    const formData = new FormData(event.currentTarget);
    const updatedData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      vehicleModel: formData.get('vehicleModel') as string,
      licensePlate: formData.get('licensePlate') as string,
      vehicleCategory: formData.get('vehicleCategory') as string,
      arNumber: formData.get('arNumber') as string,
      insuranceNumber: formData.get('insuranceNumber') as string,
    };
    // Remove undefined, empty string, or null fields
    Object.keys(updatedData).forEach(
      key => (
        updatedData[key] === undefined ||
        updatedData[key] === '' ||
        updatedData[key] === null
      ) && delete updatedData[key]
    );
    // Prevent sending an empty payload
    if (Object.keys(updatedData).length === 0) {
      toast({ title: 'No Changes', description: 'Please update at least one field before saving.', variant: 'destructive' });
      setActionLoading(prev => ({ ...prev, editDriver: false }));
      return;
    }
    try {
      const response = await fetch(`/api/operator/drivers/${editDriverData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update driver.');
      }
      toast({ title: 'Driver Updated', description: `${updatedData.name} updated successfully.` });
      setIsEditDriverDialogOpen(false);
      setEditDriverData(null);
      fetchDrivers(null, 'filter');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating driver.';
      toast({ title: 'Update Driver Failed', description: message, variant: 'destructive' });
    } finally {
      setActionLoading(prev => ({ ...prev, editDriver: false }));
    }
  };

  const handleBulkDriverUpdate = async (status: string) => {
    if (selectedDriverIds.length === 0) return;
    const confirmMsg = `Are you sure you want to set status to '${status}' for ${selectedDriverIds.length} driver(s)?`;
    if (!window.confirm(confirmMsg)) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedDriverIds, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bulk update failed');
      toast({ title: 'Bulk Update Complete', description: `${data.results.filter((r: any) => r.success).length} succeeded, ${data.results.filter((r: any) => !r.success).length} failed.`, variant: 'default' });
      setSelectedDriverIds([]);
      fetchDrivers(null, 'filter');
    } catch (err) {
      toast({ title: 'Bulk Update Failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
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
            <CardDescription>Onboard, view, and manage your fleet of drivers. (Demo Operator: {currentOperatorCodeForDemo})</CardDescription>
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
                  Fill in the details to onboard a new driver. They will be set to 'Pending Approval' under your operator code: {currentOperatorCodeForDemo}.
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
                  <Label htmlFor="licensePlate" className="text-right">License</Label>
                  <Input id="licensePlate" name="licensePlate" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vehicleCategory" className="text-right">Vehicle Category</Label>
                  <Input id="vehicleCategory" name="vehicleCategory" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="arNumber" className="text-right">AR Number</Label>
                  <Input id="arNumber" name="arNumber" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="insuranceNumber" className="text-right">Insurance Number</Label>
                  <Input id="insuranceNumber" name="insuranceNumber" className="col-span-3" disabled={actionLoading['addDriver']} />
                </div>
                <div className="flex items-center gap-4 mt-4">
                  <Label htmlFor="statusFilter" className="text-right">Status</Label>
                  <Select value={filterStatus} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                      <SelectItem value="Suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" disabled={actionLoading['addDriver']}>Cancel</Button></DialogClose>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={actionLoading['addDriver']}>
                    {actionLoading['addDriver'] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Driver
                  </Button>
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
                    <SelectItem value="Suspended">Suspended</SelectItem>
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
              {/* Bulk Actions Bar */}
              {selectedDriverIds.length > 0 && (
                <div className="flex items-center gap-4 mb-2 p-2 bg-muted rounded shadow">
                  <span className="font-semibold text-sm">{selectedDriverIds.length} selected</span>
                  <Button size="sm" variant="outline" className="bg-green-100 text-green-800 border-green-300 hover:bg-green-200" onClick={() => handleBulkDriverUpdate('Active')}>Approve</Button>
                  <Button size="sm" variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200" onClick={() => handleBulkDriverUpdate('Suspended')}>Suspend</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedDriverIds([])}>Clear</Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Checkbox checked={allDriversSelected} onCheckedChange={toggleSelectAllDrivers} aria-label="Select all" />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Driver ID</TableHead>
                    <TableHead>Operator Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <Checkbox checked={selectedDriverIds.includes(driver.id)} onCheckedChange={() => toggleSelectDriver(driver.id)} aria-label={`Select ${driver.name}`} />
                      </TableCell>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>
                        <div>{driver.email}</div>
                        <div className="text-xs text-muted-foreground">{driver.phone || 'N/A'}</div>
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                          onClick={() => {
                            setSelectedDriver(driver);
                            setIsDriverDetailsModalOpen(true);
                          }}
                        >
                          {driver.driverIdentifier || driver.customId || 'N/A'}
                        </button>
                      </TableCell>
                      <TableCell>{driver.operatorCode || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          driver.status === 'Active' ? 'default' :
                          driver.status === 'Pending Approval' ? 'secondary' :
                          driver.status === 'Suspended' ? 'destructive' :
                          'outline' 
                        }
                        className={
                            driver.status === 'Active' ? 'bg-green-500/80 text-green-950 hover:bg-green-500/70' :
                            driver.status === 'Pending Approval' ? 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70' :
                            driver.status === 'Suspended' ? 'bg-red-600 text-white hover:bg-red-700' : 
                            'border-slate-500 text-slate-500 hover:bg-slate-500/10'
                        }
                        >
                          {driver.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        {actionLoading[driver.id] ? (
                            <Loader2 className="h-5 w-5 animate-spin inline-block" />
                        ) : (
                            <>
                                {driver.status === 'Pending Approval' && driver.operatorCode === currentOperatorCodeForDemo && (
                                    <Button variant="outline" size="sm" className="h-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" title="Approve Driver" onClick={() => handleDriverStatusUpdate(driver.id, 'Active')}>
                                        <CheckCircle className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Approve</span>
                                    </Button>
                                )}
                                {driver.status === 'Active' && (
                                    <Button variant="outline" size="sm" className="h-8 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white" title="Suspend Driver" onClick={() => {
                                        const reason = prompt("Reason for suspension (optional):");
                                        handleDriverStatusUpdate(driver.id, 'Suspended', reason || undefined);
                                    }}>
                                        <ShieldAlert className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Suspend</span>
                                    </Button>
                                )}
                                {(driver.status === 'Inactive' || driver.status === 'Suspended') && (
                                    <Button variant="outline" size="sm" className="h-8 border-sky-500 text-sky-500 hover:bg-sky-500 hover:text-white" title="Activate Driver" onClick={() => handleDriverStatusUpdate(driver.id, 'Active')}>
                                        <UserPlus className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Activate</span>
                                    </Button>
                                )}
                                <Button variant="outline" size="icon" className="h-8 w-8" title="Edit Driver" onClick={() => openEditDriverDialog(driver)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" title="Delete Driver" onClick={() => handleDeleteDriver(driver.id)}>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                            </>
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
                  disabled={currentPage === 1 && prevCursors.length === 0 || isLoading}
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
            </>
          )}
        </CardContent>
      </Card>
      {/* Edit Driver Dialog */}
      <Dialog open={isEditDriverDialogOpen} onOpenChange={setIsEditDriverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
            <DialogDescription>
              Update the details for this driver.
            </DialogDescription>
          </DialogHeader>
          {editDriverData && (
            <form onSubmit={handleEditDriverSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" className="col-span-3" defaultValue={editDriverData.name} required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">Email</Label>
                <Input id="email" name="email" type="email" className="col-span-3" defaultValue={editDriverData.email} required />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">Phone</Label>
                <Input id="phone" name="phone" type="tel" className="col-span-3" defaultValue={editDriverData.phone} />
              </div>
              {/* Add more fields as needed */}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {/* Driver Details Modal */}
      <Dialog open={isDriverDetailsModalOpen} onOpenChange={setIsDriverDetailsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Driver Details</DialogTitle>
          </DialogHeader>
          {selectedDriver ? (
            <div className="space-y-2">
              <div><strong>Name:</strong> {selectedDriver.name}</div>
              <div><strong>Email:</strong> {selectedDriver.email}</div>
              <div><strong>Phone:</strong> {selectedDriver.phone || 'N/A'}</div>
              <div><strong>Driver ID:</strong> {selectedDriver.driverIdentifier || selectedDriver.customId || 'N/A'}</div>
              <div><strong>Operator Code:</strong> {selectedDriver.operatorCode || 'N/A'}</div>
              <div><strong>Status:</strong> {selectedDriver.status}</div>
              {/* Add more fields or quick actions as needed */}
            </div>
          ) : (
            <div>No driver selected.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function handleDeleteDriver(driverId: string) {
  if (!window.confirm('Are you sure you want to delete this driver? This action cannot be undone.')) return;
  setActionLoading(prev => ({ ...prev, [driverId]: true }));
  try {
    const response = await fetch(`/api/operator/drivers/${driverId}`, { method: 'DELETE' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete driver.');
    }
    toast({ title: 'Driver Deleted', description: `Driver deleted successfully.` });
    fetchDrivers(null, 'filter');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error deleting driver.';
    toast({ title: 'Delete Driver Failed', description: message, variant: 'destructive' });
  } finally {
    setActionLoading(prev => ({ ...prev, [driverId]: false }));
  }
}