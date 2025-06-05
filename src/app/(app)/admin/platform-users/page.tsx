
"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Filter, Search, Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert, Eye, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context';
import { format } from 'date-fns';
import Link from 'next/link';

// UID of THE platform administrator who can change status of other admins (if needed in future)
const SUPER_ADMIN_UID = "qWDHrEVDBfWu3A2F5qY6N9tGgnI3"; // Example, adjust as needed

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string; // 'Active', 'Inactive', 'Pending Approval', 'Suspended'
  createdAt?: { _seconds: number; _nanoseconds: number } | null;
  lastLogin?: { _seconds: number; _nanoseconds: number } | null;
  phone?: string;
  operatorCode?: string;
  customId?: string;
}

const formatDateFromTimestamp = (timestamp?: { _seconds: number; _nanoseconds: number } | null): string => {
  if (!timestamp || typeof timestamp._seconds !== 'number' || typeof timestamp._nanoseconds !== 'number') return 'N/A';
  try {
    const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
    return format(date, "P"); // Changed format from "PPpp" to "P"
  } catch (e) {
    return 'Date Error';
  }
};


export default function PlatformUsersPage() {
  const { user: currentAdminUser } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchName, setSearchName] = useState<string>("");
  const [searchEmail, setSearchEmail] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);
  const USERS_PER_PAGE = 15;

  const isSuperAdmin = currentAdminUser?.id === SUPER_ADMIN_UID;

  const fetchUsers = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(USERS_PER_PAGE));
      if (cursor) {
        params.append('startAfter', cursor);
      }
      if (filterRole !== "all") {
        params.append('role', filterRole);
      }
      if (filterStatus !== "all") {
        params.append('status', filterStatus);
      }
      if (searchName.trim() !== "") {
        params.append('searchName', searchName.trim());
      }
      if (searchEmail.trim() !== "") {
        params.append('searchEmail', searchEmail.trim());
      }
      
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch users: ${response.status}`);
      }
      const data = await response.json();
      
      setUsers(data.users || []);
      setNextCursor(data.nextCursor || null);

      if (direction === 'filter') {
        setCurrentPage(1);
        setPrevCursors([]);
      } else if (direction === 'next') {
        if (users.length > 0 && cursor) {
           setPrevCursors(prev => [...prev, users[0]?.id || null]);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Users", description: message, variant: "destructive" });
      setUsers([]); 
    } finally {
      setIsLoading(false);
    }
  }, [filterRole, filterStatus, searchName, searchEmail, toast, users]); // `users` in dep for prevCursors

  useEffect(() => {
    if (currentAdminUser) { 
      fetchUsers(null, 'filter');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, filterStatus, searchName, searchEmail, currentAdminUser]); // removed fetchUsers from dep


  const handleNextPage = () => {
    if (nextCursor) {
      setCurrentPage(p => p + 1);
      fetchUsers(nextCursor, 'next');
    }
  };

  const handlePrevPage = () => {
    if (prevCursors.length > 0) {
      const lastPrevCursor = prevCursors[prevCursors.length - 1];
      setPrevCursors(prev => prev.slice(0, -1));
      setCurrentPage(p => Math.max(1, p - 1));
      fetchUsers(lastPrevCursor, 'prev');
    } else if (currentPage > 1) { 
        setCurrentPage(1);
        fetchUsers(null, 'filter');
    }
  };
  
  const handleUserStatusUpdate = async (userIdToUpdate: string, targetUserRole: UserRole, newStatus: PlatformUser['status'], reason?: string) => {
    if (targetUserRole === 'admin' && userIdToUpdate !== SUPER_ADMIN_UID && !isSuperAdmin) {
        toast({ title: "Permission Denied", description: "Only the super admin can change the status of other administrators.", variant: "destructive"});
        return;
    }
    if (userIdToUpdate === currentAdminUser?.id && newStatus !== 'Active') {
        toast({ title: "Action Not Allowed", description: "You cannot change your own status to non-active.", variant: "destructive"});
        return;
    }

    setActionLoading(prev => ({ ...prev, [userIdToUpdate]: true }));
    try {
        const payload: any = { status: newStatus };
        if (newStatus === 'Suspended' && reason) {
            payload.statusReason = reason;
        }
        
        // Use the generic user update endpoint (which is /api/operator/drivers/[driverId] for now)
        // This should ideally be a dedicated /api/admin/users/[userId]/status endpoint
        const response = await fetch(`/api/operator/drivers/${userIdToUpdate}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to update user status to ${newStatus}.`);
        }
        const updatedUserData = await response.json();
        
        setUsers(prevUsers => prevUsers.map(u => u.id === userIdToUpdate ? { ...u, status: updatedUserData.driver.status } : u));
        toast({ title: "User Status Updated", description: `User ${updatedUserData.driver.name || userIdToUpdate} status set to ${newStatus}.`});
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error during status update.";
        toast({ title: "Status Update Failed", description: message, variant: "destructive" });
    } finally {
        setActionLoading(prev => ({ ...prev, [userIdToUpdate]: false }));
    }
  };

  if (currentAdminUser?.role !== 'admin') {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You do not have permission to access this page.</p>
            <Button asChild className="mt-6">
                <Link href="/">Go to Dashboard</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" /> Platform Users
          </CardTitle>
          <CardDescription>View, search, and manage all user accounts across the platform.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-1">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name..." 
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="h-9 text-sm"
                />
            </div>
            <div className="flex items-center gap-1">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by email..." 
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="h-9 text-sm"
                />
            </div>
            <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Filter by role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="passenger">Passenger</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Filter by status" /></SelectTrigger>
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
            <div className="flex justify-center items-center py-10"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          )}
          {error && !isLoading && (
            <div className="text-center py-10 text-destructive">
              <AlertTriangle className="mx-auto h-12 w-12 mb-2" /><p className="font-semibold">Error loading users:</p><p>{error}</p>
              <Button onClick={() => fetchUsers(null, 'filter')} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && users.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No users match your criteria.</p>
          )}
          {!isLoading && !error && users.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email / Custom ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead> {/* Changed header text */}
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userToList) => (
                    <TableRow key={userToList.id} className={userToList.id === currentAdminUser?.id ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">{userToList.name} {userToList.id === currentAdminUser?.id && <Badge variant="outline" className="ml-1 border-primary text-primary text-xs">You</Badge>}</TableCell>
                      <TableCell>
                        <div>{userToList.email}</div>
                        <div className="text-xs text-muted-foreground">{userToList.customId || userToList.operatorCode || userToList.id}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{userToList.role}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={
                          userToList.status === 'Active' ? 'default' :
                          userToList.status === 'Pending Approval' ? 'secondary' :
                          userToList.status === 'Suspended' ? 'destructive' : 'outline' 
                        } className={
                            userToList.status === 'Active' ? 'bg-green-500/80 text-green-950 hover:bg-green-500/70' :
                            userToList.status === 'Pending Approval' ? 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70' :
                            userToList.status === 'Suspended' ? 'bg-red-600 text-white hover:bg-red-700' : 'border-slate-500 text-slate-500 hover:bg-slate-500/10'
                        }>
                          {userToList.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateFromTimestamp(userToList.createdAt)}</TableCell>
                      <TableCell className="text-center space-x-1">
                        {actionLoading[userToList.id] ? (<Loader2 className="h-5 w-5 animate-spin inline-block" />) : (
                            <>
                                {userToList.id !== currentAdminUser?.id && userToList.role !== 'admin' && userToList.status === 'Pending Approval' && (
                                    <Button variant="outline" size="xs" className="h-7 px-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" title="Approve User" onClick={() => handleUserStatusUpdate(userToList.id, userToList.role, 'Active')}>
                                        <CheckCircle className="h-3.5 w-3.5"/> <span className="ml-1 hidden sm:inline">Approve</span>
                                    </Button>
                                )}
                                {userToList.id !== currentAdminUser?.id && (isSuperAdmin || userToList.role !== 'admin') && userToList.status === 'Active' && (
                                    <Button variant="outline" size="xs" className="h-7 px-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white" title="Suspend User" onClick={() => {
                                        const reason = prompt("Reason for suspension (optional):");
                                        handleUserStatusUpdate(userToList.id, userToList.role, 'Suspended', reason || undefined);
                                    }}>
                                        <ShieldAlert className="h-3.5 w-3.5"/> <span className="ml-1 hidden sm:inline">Suspend</span>
                                    </Button>
                                )}
                                 {userToList.id !== currentAdminUser?.id && (isSuperAdmin || userToList.role !== 'admin') && (userToList.status === 'Inactive' || userToList.status === 'Suspended') && (
                                    <Button variant="outline" size="xs" className="h-7 px-2 border-sky-500 text-sky-500 hover:bg-sky-500 hover:text-white" title="Activate User" onClick={() => handleUserStatusUpdate(userToList.id, userToList.role, 'Active')}>
                                        <UserPlus className="h-3.5 w-3.5"/> <span className="ml-1 hidden sm:inline">Activate</span>
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="View Details (Placeholder)" onClick={() => toast({title: "Info", description: `Details for ${userToList.name} would show here.`})}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1 && prevCursors.length === 0 || isLoading}>Previous</Button>
                <span className="text-sm text-muted-foreground">Page {currentPage}</span>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!nextCursor || isLoading}>Next</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

