
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, UserX, Shield, UserCircle, Car, Briefcase, Ban, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { useAuth, UserRole } from '@/contexts/auth-context';
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

interface UserBlockDisplay {
  id: string; // Block document ID
  blockerId: string;
  blockerName?: string;
  blockerRole?: UserRole;
  blockedId: string;
  blockedName?: string;
  blockedRole?: UserRole;
  createdAt: string; // ISO string
}

export default function AdminManageUserBlocksPage() {
  const { user: adminUser } = useAuth();
  const [blocks, setBlocks] = useState<UserBlockDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [unblockingBlockId, setUnblockingBlockId] = useState<string | null>(null);

  const fetchAllBlocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/blocks/list-all');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user blocks.');
      }
      const data = await response.json();
      setBlocks(data.blocks || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
      toast({ title: "Error Fetching Blocks", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (adminUser?.role === 'admin') {
      fetchAllBlocks();
    }
  }, [adminUser, fetchAllBlocks]);

  const handleAdminUnblock = async (blockId: string, blockedUserName?: string) => {
    setUnblockingBlockId(blockId);
    try {
      const response = await fetch(`/api/users/blocks?blockId=${blockId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to unblock user.');
      }
      toast({ title: "User Unblocked by Admin", description: `${blockedUserName || 'User'} has been unblocked.` });
      fetchAllBlocks(); // Refresh the list
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during unblock.";
      toast({ title: "Unblock Failed", description: message, variant: "destructive" });
    } finally {
      setUnblockingBlockId(null);
    }
  };

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'passenger': return <UserCircle className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      case 'driver': return <Car className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      case 'operator': return <Briefcase className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      case 'admin': return <Shield className="w-4 h-4 inline mr-1 text-muted-foreground" />;
      default: return <UserX className="w-4 h-4 inline mr-1 text-muted-foreground" />;
    }
  };

  if (adminUser?.role !== 'admin') {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Ban className="w-16 h-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You do not have permission to view this page.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <UserX className="w-8 h-8 text-primary" /> User Block Management
          </CardTitle>
          <CardDescription>View all user-initiated blocks on the platform and manage them if necessary.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Active User Blocks</CardTitle>
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
              <p className="font-semibold">Error loading blocks:</p>
              <p>{error}</p>
              <Button onClick={fetchAllBlocks} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
          {!isLoading && !error && blocks.length === 0 && (
             <p className="text-center text-muted-foreground py-8">No active user blocks found on the platform.</p>
          )}
          {!isLoading && !error && blocks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blocker</TableHead>
                  <TableHead>Blocked User</TableHead>
                  <TableHead>Date Blocked</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell>
                      <div className="font-medium">{block.blockerName || block.blockerId}</div>
                      <div className="text-xs text-muted-foreground capitalize flex items-center">{getRoleIcon(block.blockerRole)} {block.blockerRole || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{block.blockedName || block.blockedId}</div>
                      <div className="text-xs text-muted-foreground capitalize flex items-center">{getRoleIcon(block.blockedRole)} {block.blockedRole || 'N/A'}</div>
                    </TableCell>
                    <TableCell>{format(parseISO(block.createdAt), "PPpp")}</TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            disabled={unblockingBlockId === block.id}
                          >
                            {unblockingBlockId === block.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">Admin Unblock</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Unblock</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this block between {block.blockerName || 'User'} and {block.blockedName || 'User'}? This action cannot be undone by you directly, though users can re-block.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleAdminUnblock(block.id, block.blockedName)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Confirm Unblock
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
