"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
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

export default function OperatorDriverIncentivesPage() {
  const [incentives, setIncentives] = useState<Incentive[]>([]);

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
            Available Driver Incentives
          </CardTitle>
          <CardDescription>
            These are the current and upcoming incentive programs available to all drivers.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Incentive Programs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {incentives.length > 0 ? (
            incentives.map(incentive => (
              <div key={incentive.id} className="p-4 border rounded-lg">
                <h3 className="font-bold text-lg">{incentive.title}</h3>
                <p className="text-muted-foreground">{incentive.description}</p>
                <p className="text-sm mt-2">
                  <strong>Goal:</strong> Complete {incentive.rideTarget} rides to earn <strong className="text-green-600">£{incentive.rewardAmount}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Active Period: {incentive.dateRange.from ? format(new Date(incentive.dateRange.from), "PPP") : 'N/A'} - {incentive.dateRange.to ? format(new Date(incentive.dateRange.to), "PPP") : 'N/A'}
                </p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No active incentive programs at the moment.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
