
"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Filter, Search, Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context'; // To exclude current admin from list

// IMPORTANT: Replace this with the actual Firebase UID of your platform administrator user.
// This UID is used to determine who can approve new operators.
const PLATFORM_ADMIN_UID = "YOUR_FIREBASE_ADMIN_UID_HERE"; 

interface OperatorUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'Active' | 'Inactive' | 'Pending Approval' | 'Suspended';
  role: 'operator';
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  operatorUpdatedAt?: { _seconds: number; _nanoseconds: number } | null;
}

export default function OperatorManageOperatorsPage() {
  const { user: currentAdminUser } = useAuth(); // Get current admin user
  const [operators, setOperators] = useState<OperatorUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);
  const OPERATORS_PER_PAGE = 10;

  const isPlatformAdmin = currentAdminUser?.id === PLATFORM_ADMIN_UID;

  const fetchOperators = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(OPERATORS_PER_PAGE));
      if (cursor) {
        params.append('startAfter', cursor);
      }
      if (filterStatus !== "all") {
        params.append('status', filterStatus);
      }
      if (searchTerm.trim() !== "") {
        params.append('searchName', searchTerm.trim());
      }
      
      const response = await fetch(`/api/operator/operators-list?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch operators: ${response.status}`);
      }
      const data = await response.json();
      
      const fetchedOperators = (data.operators || [])
        .filter((op: OperatorUser) => op.id !== currentAdminUser?.id) // Exclude self
        .map((op: any) => ({
          ...op,
          status: op.status || 'Inactive'
        }));
      setOperators(fetchedOperators);
      setNextCursor(data.nextCursor || null);

      if (direction === 'filter') {
        setCurrentPage(1);
        setPrevCursors([]);
      } else if (direction === 'next') {
        if (operators.length > 0 && cursor) {
           setPrevCursors(prev => [...prev, operators[0]?.id || null]);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Operators", description: message, variant: "destructive" });
      setOperators([]); 
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchTerm, toast, currentAdminUser, operators]); 

  useEffect(() => {
    if (currentAdminUser) { 
      fetchOperators(null, 'filter');
    }
  }, [filterStatus, searchTerm, currentAdminUser]);


  const handleNextPage = () => {
    if (nextCursor) {
      setCurrentPage(p => p + 1);
      fetchOperators(nextCursor, 'next');
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const lastPrevCursor = prevCursors[prevCursors.length - 1];
      setPrevCursors(prev => prev.slice(0, -1));
      setCurrentPage(p => Math.max(1, p - 1));
      fetchOperators(lastPrevCursor, 'prev');
    } else if (currentPage > 1) { 
        setCurrentPage(1);
        fetchOperators(null, 'filter');
    }
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleFilterChange = (value: string) => {
    setFilterStatus(value);
  };
  
  const handleOperatorStatusUpdate = async (operatorId: string, newStatus: OperatorUser['status'], reason?: string) => {
    setActionLoading(prev => ({ ...prev, [operatorId]: true }));
    try {
        const payload: any = { status: newStatus };
        if (newStatus === 'Suspended' && reason) {
            payload.statusReason = reason;
        }

        // Using the existing driver update endpoint, which should be generalized for users.
        // In a real app, this might be /api/operator/users/[userId]/status or similar.
        const response = await fetch(`/api/operator/drivers/${operatorId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to update operator status to ${newStatus}.`);
        }
        const updatedOperatorData = await response.json();
        
        // Assuming the response from the drivers endpoint has a 'driver' object, 
        // even though we are updating an 'operator' role user.
        // Adapt if your API response structure differs.
        setOperators(prevOperators => prevOperators.map(op => op.id === operatorId ? { ...op, status: updatedOperatorData.driver.status } : op));
        toast({ title: "Operator Status Updated", description: `Operator ${updatedOperatorData.driver.name || operatorId} status set to ${newStatus}.`});
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error during status update.";
        toast({ title: "Status Update Failed", description: message, variant: "destructive" });
    } finally {
        setActionLoading(prev => ({ ...prev, [operatorId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <Briefcase className="w-8 h-8 text-primary" /> Manage Operators
            </CardTitle>
            <CardDescription>
              View and manage other operator accounts.
              {isPlatformAdmin ? " As platform admin, you can approve new operators." : " You can view operator statuses."}
            </CardDescription>
          </div>
           <Button className="bg-primary hover:bg-primary/90 text-primary-foreground mt-2 md:mt-0" disabled>
            <UserPlus className="mr-2 h-4 w-4" /> Add New Operator (Soon)
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Search by operator name..." 
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
              <p className="font-semibold">Error loading operators:</p>
              <p>{error}</p>
              <Button onClick={() => fetchOperators(null, 'filter')} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && operators.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No operators match your criteria or no other operators found.</p>
          )}
          {!isLoading && !error && operators.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operators.map((operator) => (
                    <TableRow key={operator.id}>
                      <TableCell className="font-medium">{operator.name}</TableCell>
                      <TableCell>{operator.email}</TableCell>
                      <TableCell>
                        <Badge variant={
                          operator.status === 'Active' ? 'default' :
                          operator.status === 'Pending Approval' ? 'secondary' :
                          operator.status === 'Suspended' ? 'destructive' :
                          'outline' 
                        }
                        className={
                            operator.status === 'Active' ? 'bg-green-500/80 text-green-950 hover:bg-green-500/70' :
                            operator.status === 'Pending Approval' ? 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70' :
                            operator.status === 'Suspended' ? 'bg-red-600 text-white hover:bg-red-700' : 
                            'border-slate-500 text-slate-500 hover:bg-slate-500/10'
                        }
                        >
                          {operator.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        {actionLoading[operator.id] ? (
                            <Loader2 className="h-5 w-5 animate-spin inline-block" />
                        ) : (
                            <>
                                {isPlatformAdmin && operator.status === 'Pending Approval' && (
                                    <Button variant="outline" size="sm" className="h-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" title="Approve Operator" onClick={() => handleOperatorStatusUpdate(operator.id, 'Active')}>
                                        <CheckCircle className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Approve</span>
                                    </Button>
                                )}
                                {isPlatformAdmin && operator.status === 'Active' && (
                                    <Button variant="outline" size="sm" className="h-8 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white" title="Suspend Operator" onClick={() => {
                                        const reason = prompt("Reason for suspension (optional):");
                                        handleOperatorStatusUpdate(operator.id, 'Suspended', reason || undefined);
                                    }}>
                                        <ShieldAlert className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Suspend</span>
                                    </Button>
                                )}
                                {isPlatformAdmin && (operator.status === 'Inactive' || operator.status === 'Suspended') && (
                                    <Button variant="outline" size="sm" className="h-8 border-sky-500 text-sky-500 hover:bg-sky-500 hover:text-white" title="Activate Operator" onClick={() => handleOperatorStatusUpdate(operator.id, 'Active')}>
                                        <UserPlus className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Activate</span>
                                    </Button>
                                )}
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
    </div>
  );
}
