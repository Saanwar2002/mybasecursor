"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Filter, Car, User, Users, MapPin, Edit, Trash2, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Ride {
  id: string;
  passenger: string;
  driver?: string;
  pickup: string;
  dropoff: string;
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Completed' | 'Cancelled';
  fare: number;
  requestedAt: string;
}

const mockOperatorRides: Ride[] = [
  { id: 'op1', passenger: 'David Lee', driver: 'John Doe', pickup: 'Downtown Hotel', dropoff: 'Airport T1', status: 'In Progress', fare: 35.00, requestedAt: '10:30 AM' },
  { id: 'op2', passenger: 'Emily Clark', pickup: 'West Suburbs', dropoff: 'City Center', status: 'Pending', fare: 22.50, requestedAt: '10:45 AM' },
  { id: 'op3', passenger: 'Michael Brown', driver: 'Jane Smith', pickup: 'North Mall', dropoff: 'South Station', status: 'Completed', fare: 18.75, requestedAt: '09:15 AM' },
  { id: 'op4', passenger: 'Sarah Wilson', pickup: 'University Campus', dropoff: 'Library', status: 'Pending', fare: 12.00, requestedAt: '11:00 AM' },
  { id: 'op5', passenger: 'Chris Green', driver: 'Robert Jones', pickup: 'Business Park', dropoff: 'Conference Center', status: 'Assigned', fare: 28.30, requestedAt: '10:50 AM' },
];

export default function OperatorManageRidesPage() {
  const [rides, setRides] = useState<Ride[]>(mockOperatorRides);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredRides = rides
    .filter(ride => filterStatus === "all" || ride.status.toLowerCase() === filterStatus)
    .filter(ride => 
      ride.passenger.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ride.driver && ride.driver.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ride.pickup.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ride.dropoff.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const assignDriver = (rideId: string) => {
    // Mock assigning a driver
    setRides(prevRides => prevRides.map(r => r.id === rideId ? {...r, driver: "Driver " + Math.floor(Math.random()*100), status: "Assigned"} : r));
    // Add toast
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input 
            placeholder="Search rides (passenger, driver, location...)" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passenger</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Fare</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRides.map((ride) => (
                <TableRow key={ride.id}>
                  <TableCell className="font-medium">{ride.passenger}</TableCell>
                  <TableCell>{ride.driver || 'N/A'}</TableCell>
                  <TableCell>{ride.pickup}</TableCell>
                  <TableCell>{ride.dropoff}</TableCell>
                  <TableCell>
                    <Badge variant={
                      ride.status === 'Completed' ? 'default' :
                      ride.status === 'Cancelled' ? 'destructive' :
                      ride.status === 'In Progress' ? 'outline' /* Using 'outline' as an example for 'In Progress' */ :
                      'secondary' /* For 'Pending' and 'Assigned' */
                    }
                    className={
                      ride.status === 'In Progress' ? 'border-blue-500 text-blue-500' : 
                      ride.status === 'Pending' ? 'bg-yellow-400/80 text-yellow-900' :
                      ride.status === 'Assigned' ? 'bg-sky-400/80 text-sky-900' : ''
                    }
                    >
                      {ride.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">${ride.fare.toFixed(2)}</TableCell>
                  <TableCell>{ride.requestedAt}</TableCell>
                  <TableCell className="text-center space-x-1">
                    {ride.status === 'Pending' && (
                      <Button variant="outline" size="icon" className="h-8 w-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" onClick={() => assignDriver(ride.id)}>
                        <Users className="h-4 w-4" title="Assign Driver" />
                      </Button>
                    )}
                     <Button variant="outline" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" title="View Details"/>
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" title="Edit Ride"/>
                    </Button>
                    {ride.status !== 'Completed' && ride.status !== 'Cancelled' && (
                       <Button variant="outline" size="icon" className="h-8 w-8 border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
                        <Trash2 className="h-4 w-4" title="Cancel Ride"/>
                    </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {filteredRides.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No rides match your criteria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
