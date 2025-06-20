"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Incentive {
  id: number;
  title: string;
  description: string;
  rideTarget: number;
  rewardAmount: number;
  dateRange: DateRange;
}

export default function DriverIncentivesPage() {
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [newIncentive, setNewIncentive] = useState<Omit<Incentive, 'id'>>({
    title: '',
    description: '',
    rideTarget: 0,
    rewardAmount: 0,
    dateRange: { from: new Date(), to: addDays(new Date(), 7) }
  });
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/admin/incentives')
      .then(res => res.json())
      .then(data => setIncentives(data));
  }, []);

  const handleAddIncentive = async () => {
    const res = await fetch('/api/admin/incentives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIncentive),
    });
    if (res.ok) {
      const { incentive } = await res.json();
      setIncentives([...incentives, incentive]);
      setNewIncentive({ title: '', description: '', rideTarget: 0, rewardAmount: 0, dateRange: { from: new Date(), to: addDays(new Date(), 7) }});
      toast({ title: "Incentive Added!", description: "The new driver incentive has been created." });
    } else {
      toast({ title: "Error", description: "Failed to add incentive.", variant: "destructive" });
    }
  };
  
  const handleRemoveIncentive = async (id: number) => {
    const res = await fetch(`/api/admin/incentives?id=${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setIncentives(incentives.filter(inc => inc.id !== id));
      toast({ title: "Incentive Removed", description: "The incentive has been deleted." });
    } else {
      toast({ title: "Error", description: "Failed to remove incentive.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Driver Incentives</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create New Incentive</CardTitle>
          <CardDescription>Set up a new bonus for drivers to encourage more activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Incentive Title</Label>
              <Input id="title" placeholder="e.g., Weekend Warrior" value={newIncentive.title} onChange={e => setNewIncentive({...newIncentive, title: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input id="description" placeholder="Short description of the goal" value={newIncentive.description} onChange={e => setNewIncentive({...newIncentive, description: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rideTarget">Ride Target</Label>
              <Input id="rideTarget" type="number" value={newIncentive.rideTarget} onChange={e => setNewIncentive({...newIncentive, rideTarget: Number(e.target.value)})} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rewardAmount">Reward Amount (£)</Label>
              <Input id="rewardAmount" type="number" value={newIncentive.rewardAmount} onChange={e => setNewIncentive({...newIncentive, rewardAmount: Number(e.target.value)})} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Incentive Period</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newIncentive.dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newIncentive.dateRange?.from ? (
                        newIncentive.dateRange.to ? (
                          <>
                            {format(newIncentive.dateRange.from, "LLL dd, y")} -{" "}
                            {format(newIncentive.dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(newIncentive.dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={newIncentive.dateRange?.from}
                      selected={newIncentive.dateRange}
                      onSelect={(range) => setNewIncentive({...newIncentive, dateRange: range || {from: new Date(), to: new Date()}})}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
            </div>
          </div>
          <Button onClick={handleAddIncentive}><PlusCircle className="mr-2 h-4 w-4" /> Add Incentive</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Active & Upcoming Incentives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {incentives.map(incentive => (
            <div key={incentive.id} className="p-4 border rounded-lg flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{incentive.title}</h3>
                <p className="text-muted-foreground">{incentive.description}</p>
                <p className="text-sm">
                  <strong>Goal:</strong> {incentive.rideTarget} rides for <strong className="text-green-600">£{incentive.rewardAmount}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                    Active: {format(incentive.dateRange.from!, "PPP")} - {format(incentive.dateRange.to!, "PPP")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon"><Edit className="h-4 w-4" /></Button>
                <Button variant="destructive" size="icon" onClick={() => handleRemoveIncentive(incentive.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
