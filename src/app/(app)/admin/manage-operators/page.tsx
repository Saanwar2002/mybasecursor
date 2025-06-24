
"use client";
import { useState, useEffect, useCallback, Suspense } from 'react'; // Added Suspense
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Filter, Search, Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert, Briefcase, Building as BuildingIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserRole } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/auth-context'; 
import Link from 'next/link';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useSearchParams } from 'next/navigation'; // Added useSearchParams

const PLATFORM_ADMIN_UID = "qWDHrEVDBfWu3A2F5qY6N9tGgnI3"; 

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
  customId?: string;
}

const addOperatorFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().optional(),
  operatorCode: z.string().min(3, {message: "Operator Code must be at least 3 characters (e.g., OP002)."}).regex(/^OP\d{3,}$/, {message: "Operator Code must be in format OPXXX (e.g. OP001)"}),
});
type AddOperatorFormValues = z.infer<typeof addOperatorFormSchema>;

function ManagePlatformOperatorsContent() {
  const { user: currentAdminUser } = useAuth(); 
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict
  const statusFromUrl = searchParamsHook.get('status');

  const [operators, setOperators] = useState<OperatorUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>(statusFromUrl || "all");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [isAddOperatorDialogOpen, setIsAddOperatorDialogOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<Array<string | null>>([]);
  const OPERATORS_PER_PAGE = 10;

  const isPlatformAdminUser = currentAdminUser?.id === PLATFORM_ADMIN_UID && currentAdminUser?.role === 'admin';

  const addOperatorForm = useForm<AddOperatorFormValues>({
    resolver: zodResolver(addOperatorFormSchema),
    defaultValues: { name: "", email: "", phone: "", operatorCode: "" },
  });

  const fetchOperators = useCallback(async (cursor?: string | null, direction: 'next' | 'prev' | 'filter' = 'filter') => {
    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(OPERATORS_PER_PAGE));
      if (cursor) params.append('startAfter', cursor);
      if (filterStatus !== "all") params.append('status', filterStatus);
      if (searchTerm.trim() !== "") params.append('searchName', searchTerm.trim());
      
      const response = await fetch(`/api/operator/operators-list?${params.toString()}`);
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Failed to fetch operators: ${response.status}`); }
      const data = await response.json();
      
      const fetchedOperators = (data.operators || []).map((op: any) => ({ ...op, status: op.status || 'Inactive' }));
      setOperators(fetchedOperators);
      setNextCursor(data.nextCursor || null);

      if (direction === 'filter') { setCurrentPage(1); setPrevCursors([]); }
      else if (direction === 'next' && operators.length > 0 && cursor) { setPrevCursors(prev => [...prev, operators[0]?.id || null]); }

    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Operators", description: message, variant: "destructive" });
      setOperators([]); 
    } finally { setIsLoading(false); }
  }, [filterStatus, searchTerm, toast, operators]); // `operators` is a dependency for prevCursor logic

  useEffect(() => {
    const newStatusFromUrl = searchParamsHook.get('status');
    if (newStatusFromUrl && newStatusFromUrl !== filterStatus) {
        setFilterStatus(newStatusFromUrl);
    }
  }, [searchParamsHook, filterStatus]);

  useEffect(() => {
    if (currentAdminUser) fetchOperators(null, 'filter');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, searchTerm, currentAdminUser]);

  const handleNextPage = () => { if (nextCursor) { setCurrentPage(p => p + 1); fetchOperators(nextCursor, 'next'); } };
  const handlePrevPage = () => {
    if (prevCursors.length > 0) { const lastPrevCursor = prevCursors[prevCursors.length - 1]; setPrevCursors(prev => prev.slice(0, -1)); setCurrentPage(p => Math.max(1, p - 1)); fetchOperators(lastPrevCursor, 'prev'); }
    else if (currentPage > 1) { setCurrentPage(1); fetchOperators(null, 'filter'); }
  };
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(event.target.value);
  const handleFilterChange = (value: string) => setFilterStatus(value);
  
  const handleOperatorStatusUpdate = async (operatorId: string, newStatus: OperatorUser['status'], reason?: string) => {
    if (!isPlatformAdminUser) { toast({ title: "Unauthorized", description: "Only the designated platform admin can update operator statuses.", variant: "destructive"}); return; }
    setActionLoading(prev => ({ ...prev, [operatorId]: true }));
    try {
        const payload: any = { status: newStatus };
        if (newStatus === 'Suspended' && reason) payload.statusReason = reason;
        
        const response = await fetch(`/api/operator/drivers/${operatorId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || `Failed to update operator status to ${newStatus}.`); }
        const updatedOperatorData = await response.json();
        
        setOperators(prevOperators => prevOperators.map(op => op.id === operatorId ? { ...op, status: updatedOperatorData.driver.status } : op));
        toast({ title: "Operator Status Updated", description: `Operator ${updatedOperatorData.driver.name || operatorId} status set to ${newStatus}.`});
    } catch (err) { const message = err instanceof Error ? err.message : "Unknown error during status update."; toast({ title: "Status Update Failed", description: message, variant: "destructive" });
    } finally { setActionLoading(prev => ({ ...prev, [operatorId]: false })); }
  };

  async function onAddOperatorSubmit(values: AddOperatorFormValues) {
    setActionLoading(prev => ({...prev, addNewOperator: true}));
    try {
      const response = await fetch('/api/admin/operators/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || `Failed to add operator: ${response.status}`);
      toast({ title: "Operator Submitted", description: responseData.message || `${values.name} with code ${values.operatorCode} created and set to 'Pending Approval'.`, duration: 7000 });
      setIsAddOperatorDialogOpen(false); addOperatorForm.reset(); fetchOperators(null, 'filter');
    } catch (err) { const message = err instanceof Error ? err.message : "An unknown error occurred while adding operator."; toast({ title: "Add Operator Failed", description: message, variant: "destructive" });
    } finally { setActionLoading(prev => ({...prev, addNewOperator: false})); }
  }

  if (currentAdminUser?.role !== 'admin') {
    return ( <div className="flex flex-col items-center justify-center h-full text-center p-8"> <ShieldAlert className="w-16 h-16 text-destructive mb-4" /> <h1 className="text-2xl font-bold mb-2">Access Denied</h1> <p className="text-muted-foreground">You do not have permission to access this page.</p> <Button asChild className="mt-6"><Link href="/">Go to Dashboard</Link></Button> </div> );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2"> <BuildingIcon className="w-8 h-8 text-primary" /> Manage Operators </CardTitle>
            <CardDescription> View, approve, and manage platform operators. {isPlatformAdminUser ? " As platform admin, you can approve new operators." : " (Approval rights restricted)"} </CardDescription>
          </div>
          <Dialog open={isAddOperatorDialogOpen} onOpenChange={setIsAddOperatorDialogOpen}>
            <DialogTrigger asChild> <Button className="bg-primary hover:bg-primary/90 text-primary-foreground mt-2 md:mt-0"> <UserPlus className="mr-2 h-4 w-4" /> Add New Operator </Button> </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <div>
                <DialogHeader> <DialogTitle>Add New Platform Operator</DialogTitle> <DialogDescription> Enter the details for the new taxi base operator. They will be created with 'Pending Approval' status. </DialogDescription> </DialogHeader>
                <Form {...addOperatorForm}>
                  <form onSubmit={addOperatorForm.handleSubmit(onAddOperatorSubmit)} className="space-y-4 py-2">
                    <FormField control={addOperatorForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Operator/Company Name</FormLabel><FormControl><Input placeholder="e.g., City Taxis Ltd" {...field} disabled={actionLoading['addNewOperator']} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={addOperatorForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" placeholder="contact@citytaxis.com" {...field} disabled={actionLoading['addNewOperator']} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={addOperatorForm.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Contact Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="01234 567890" {...field} disabled={actionLoading['addNewOperator']} /></FormControl><FormMessage /></FormItem> )} />
                     <FormField control={addOperatorForm.control} name="operatorCode" render={({ field }) => ( <FormItem> <FormLabel>Unique Operator Code</FormLabel> <FormControl><Input placeholder="e.g., OP002" {...field} disabled={actionLoading['addNewOperator']} /></FormControl> <FormDescription>Assign a unique code (e.g., OP002). This must not be in use.</FormDescription> <FormMessage /> </FormItem> )} />
                    <DialogFooter className="pt-4"> <DialogClose asChild><Button type="button" variant="outline" disabled={actionLoading['addNewOperator']}>Cancel</Button></DialogClose> <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={actionLoading['addNewOperator']}> {actionLoading['addNewOperator'] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Operator </Button> </DialogFooter>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2"> <Search className="w-5 h-5 text-muted-foreground" /> <Input placeholder="Search by operator name..." value={searchTerm} onChange={handleSearchChange} className="w-full md:max-w-xs" /> </div>
            <div className="flex items-center gap-2"> <Filter className="w-5 h-5 text-muted-foreground" /> <Select value={filterStatus} onValueChange={handleFilterChange}> <SelectTrigger className="w-full md:w-[180px]"> <SelectValue placeholder="Filter by status" /> </SelectTrigger> <SelectContent> <SelectItem value="all">All Statuses</SelectItem> <SelectItem value="Active">Active</SelectItem> <SelectItem value="Inactive">Inactive</SelectItem> <SelectItem value="Pending Approval">Pending Approval</SelectItem> <SelectItem value="Suspended">Suspended</SelectItem> </SelectContent> </Select> </div>
        </CardHeader>
        <CardContent>
           {isLoading && ( <div className="flex justify-center items-center py-10"> <Loader2 className="h-12 w-12 animate-spin text-primary" /> </div> )}
          {error && !isLoading && ( <div className="text-center py-10 text-destructive"> <AlertTriangle className="mx-auto h-12 w-12 mb-2" /> <p className="font-semibold">Error loading operators:</p> <p>{error}</p> <Button onClick={() => fetchOperators(null, 'filter')} variant="outline" className="mt-4">Try Again</Button> </div> )}
          {!isLoading && !error && operators.length === 0 && ( <p className="text-center text-muted-foreground py-8">No operators match your criteria or no other operators found.</p> )}
          {!isLoading && !error && operators.length > 0 && (
            <>
              <Table>
                <TableHeader> <TableRow> <TableHead>Name</TableHead> <TableHead>Email</TableHead> <TableHead>Operator Code</TableHead> <TableHead>Status</TableHead> <TableHead className="text-center">Actions</TableHead> </TableRow> </TableHeader>
                <TableBody>
                  {operators.map((operator) => (
                    <TableRow key={operator.id}>
                      <TableCell className="font-medium">{operator.name}</TableCell> <TableCell>{operator.email}</TableCell> <TableCell>{operator.customId || 'N/A'}</TableCell>
                      <TableCell> <Badge variant={ operator.status === 'Active' ? 'default' : operator.status === 'Pending Approval' ? 'secondary' : operator.status === 'Suspended' ? 'destructive' : 'outline' } className={ operator.status === 'Active' ? 'bg-green-500/80 text-green-950 hover:bg-green-500/70' : operator.status === 'Pending Approval' ? 'bg-yellow-400/80 text-yellow-900 hover:bg-yellow-400/70' : operator.status === 'Suspended' ? 'bg-red-600 text-white hover:bg-red-700' : 'border-slate-500 text-slate-500 hover:bg-slate-500/10' } > {operator.status} </Badge> </TableCell>
                      <TableCell className="text-center space-x-1">
                        {actionLoading[operator.id] ? ( <Loader2 className="h-5 w-5 animate-spin inline-block" /> ) : (
                            <>
                                {isPlatformAdminUser && operator.status === 'Pending Approval' && ( <Button variant="outline" size="sm" className="h-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" title="Approve Operator" onClick={() => handleOperatorStatusUpdate(operator.id, 'Active')}> <CheckCircle className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Approve</span> </Button> )}
                                {isPlatformAdminUser && operator.status === 'Active' && ( <Button variant="outline" size="sm" className="h-8 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white" title="Suspend Operator" onClick={() => { const reason = prompt("Reason for suspension (optional):"); handleOperatorStatusUpdate(operator.id, 'Suspended', reason || undefined); }}> <ShieldAlert className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Suspend</span> </Button> )}
                                {isPlatformAdminUser && (operator.status === 'Inactive' || operator.status === 'Suspended') && ( <Button variant="outline" size="sm" className="h-8 border-sky-500 text-sky-500 hover:bg-sky-500 hover:text-white" title="Activate Operator" onClick={() => handleOperatorStatusUpdate(operator.id, 'Active')}> <UserPlus className="h-4 w-4"/> <span className="ml-1 hidden sm:inline">Activate</span> </Button> )}
                                 {!isPlatformAdminUser && operator.status !== 'Active' && ( <span className="text-xs text-muted-foreground italic">Awaiting Platform Admin action</span> )}
                            </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end space-x-2 py-4"> <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1 && prevCursors.length === 0 || isLoading} > Previous </Button> <span className="text-sm text-muted-foreground">Page {currentPage}</span> <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!nextCursor || isLoading} > Next </Button> </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ManagePlatformOperatorsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <ManagePlatformOperatorsContent />
    </Suspense>
  )
}
