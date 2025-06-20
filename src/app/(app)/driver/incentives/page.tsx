"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

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
  
  // Mock driver progress
  const driverProgress = {
      '1': 15,
      '2': 5
  };

  useEffect(() => {
    fetch('/api/admin/incentives')
      .then(res => res.json())
      .then(data => setIncentives(data));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <Award className="w-8 h-8 text-primary" />
            My Incentives
          </CardTitle>
          <CardDescription>
            Track your progress towards earning extra rewards.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {incentives.map(incentive => {
            const progress = driverProgress[incentive.id as keyof typeof driverProgress] || 0;
            const progressPercentage = (progress / incentive.rideTarget) * 100;

            return (
                <Card key={incentive.id}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-6 h-6 text-primary" /> {incentive.title}
                        </CardTitle>
                        <CardDescription>{incentive.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">£{incentive.rewardAmount}</p>
                            <p className="text-sm text-muted-foreground">BONUS</p>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-medium">Progress</p>
                                <p className="text-sm font-bold">{progress} / {incentive.rideTarget} rides</p>
                            </div>
                            <Progress value={progressPercentage} />
                        </div>
                        <p className="text-xs text-muted-foreground text-center pt-2">
                            Active: {incentive.dateRange.from ? format(new Date(incentive.dateRange.from), "PPP") : 'N/A'} - {incentive.dateRange.to ? format(new Date(incentive.dateRange.to), "PPP") : 'N/A'}
                        </p>
                    </CardContent>
                </Card>
            )
          })}
      </div>
      {incentives.length === 0 && (
        <p className="text-muted-foreground text-center">No active incentive programs at the moment. Check back later!</p>
      )}
    </div>
  );
} 