"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  status: string;
  operatorCode?: string;
}

export default function DriversAwaitingApprovalPage() {
  const { user: currentOperatorUser } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPendingDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const operatorCode = currentOperatorUser?.operatorCode || currentOperatorUser?.customId || "OP001";
      const params = new URLSearchParams({
        status: "Pending Approval",
        operatorCode,
        limit: "50"
      });
      const response = await fetch(`/api/operator/drivers?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch drivers: ${response.status}`);
      }
      const data = await response.json();
      setDrivers(data.drivers || []);
    } catch (err) {
      toast({ title: "Error Fetching Pending Drivers", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      setDrivers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOperatorUser, toast]);

  useEffect(() => {
    fetchPendingDrivers();
  }, [fetchPendingDrivers]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <UserCheck className="w-8 h-8 text-primary" /> Drivers Awaiting Approval
            </CardTitle>
            <CardDescription>Review and manage all drivers who are pending approval for your operator account.</CardDescription>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pending Approval Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin h-6 w-6 mr-2" /> Loading...</div>
          ) : drivers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No drivers awaiting approval.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operator</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map(driver => (
                  <TableRow key={driver.id}>
                    <TableCell>{driver.operatorCode || "N/A"}</TableCell>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>{driver.phone || "N/A"}</TableCell>
                    <TableCell>{driver.vehicleModel || "N/A"}</TableCell>
                    <TableCell>{driver.status}</TableCell>
                    <TableCell>
                      <button
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                        disabled={driver.status !== "Pending Approval"}
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/operator/drivers/${driver.id}`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ status: "Active" })
                            });
                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.message || `Failed to approve driver: ${response.status}`);
                            }
                            toast({ title: "Driver Approved", description: `${driver.name} has been approved.` });
                            fetchPendingDrivers();
                          } catch (err) {
                            toast({ title: "Error Approving Driver", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
                          }
                        }}
                      >
                        Approve
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}