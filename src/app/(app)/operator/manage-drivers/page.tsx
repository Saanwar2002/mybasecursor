"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Edit, Trash2, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleModel: string;
  licensePlate: string;
  status: 'Active' | 'Inactive' | 'Pending Approval';
  rating: number;
  totalRides: number;
}

const mockDrivers: Driver[] = [
  { id: 'd1', name: 'John Doe', email: 'john.doe@example.com', phone: '555-1234', vehicleModel: 'Toyota Camry', licensePlate: 'ABC 123', status: 'Active', rating: 4.8, totalRides: 152 },
  { id: 'd2', name: 'Jane Smith', email: 'jane.smith@example.com', phone: '555-5678', vehicleModel: 'Honda CRV', licensePlate: 'XYZ 789', status: 'Active', rating: 4.9, totalRides: 205 },
  { id: 'd3', name: 'Mike Brown', email: 'mike.brown@example.com', phone: '555-9012', vehicleModel: 'Ford Transit', licensePlate: 'DEF 456', status: 'Inactive', rating: 4.5, totalRides: 88 },
  { id: 'd4', name: 'Sarah Wilson', email: 'sarah.wilson@example.com', phone: '555-3456', vehicleModel: 'Tesla Model 3', licensePlate: 'GHI 789', status: 'Pending Approval', rating: 0, totalRides: 0 },
];

export default function OperatorManageDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isAddDriverDialogOpen, setIsAddDriverDialogOpen] = useState(false);

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Placeholder for form handling
  const handleAddDriver = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const newDriver: Driver = {
      id: `d${drivers.length + 1}`,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      vehicleModel: formData.get('vehicleModel') as string,
      licensePlate: formData.get('licensePlate') as string,
      status: 'Pending Approval',
      rating: 0,
      totalRides: 0,
    };
    setDrivers(prev => [newDriver, ...prev]);
    setIsAddDriverDialogOpen(false);
    // Add toast
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" /> Manage Drivers
            </CardTitle>
            <CardDescription>Onboard, view, and manage your fleet of drivers.</CardDescription>
          </div>
          <Dialog open={isAddDriverDialogOpen} onOpenChange={setIsAddDriverDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <UserPlus className="mr-2 h-4 w-4" /> Add New Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Driver</DialogTitle>
                <DialogDescription>
                  Fill in the details to onboard a new driver.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddDriver} className="grid gap-4 py-4">
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
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">Add Driver</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search drivers (name, email, license plate...)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
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
              {filteredDrivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">{driver.name}</TableCell>
                  <TableCell>
                    <div>{driver.email}</div>
                    <div className="text-xs text-muted-foreground">{driver.phone}</div>
                  </TableCell>
                  <TableCell>
                     <div>{driver.vehicleModel}</div>
                     <div className="text-xs text-muted-foreground">{driver.licensePlate}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      driver.status === 'Active' ? 'default' :
                      driver.status === 'Pending Approval' ? 'secondary' :
                      'outline' /* For Inactive */
                    }
                    className={
                        driver.status === 'Active' ? 'bg-green-500/80 text-green-950' :
                        driver.status === 'Pending Approval' ? 'bg-yellow-400/80 text-yellow-900' :
                        'border-red-500 text-red-500'
                    }
                    >
                      {driver.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{driver.rating > 0 ? driver.rating.toFixed(1) : 'N/A'}</TableCell>
                  <TableCell className="text-right">{driver.totalRides}</TableCell>
                  <TableCell className="text-center space-x-1">
                     <Button variant="outline" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" title="Edit Driver"/>
                    </Button>
                     <Button variant="outline" size="icon" className="h-8 w-8 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
                        <Trash2 className="h-4 w-4" title="Remove Driver"/>
                    </Button>
                    {driver.status === 'Pending Approval' && (
                        <Button variant="outline" size="icon" className="h-8 w-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white">
                            <UserPlus className="h-4 w-4" title="Approve Driver"/>
                        </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredDrivers.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No drivers match your criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
