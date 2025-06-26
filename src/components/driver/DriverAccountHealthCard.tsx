
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Star, TrendingUp, CheckCircle, AlertTriangle, MessageSquareQuote, ArrowRight, ShieldCheck, UserX, TrafficCone, ThumbsUp, AlertCircle as AlertCircleIcon, Loader2 } from "lucide-react"; // Added Loader2
import { Progress } from "@/components/ui/progress"; 
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import ShadCN Alert components
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useEffect, useState } from "react";


interface HealthMetricProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  unit?: string;
  variant?: "default" | "positive" | "negative" | "neutral";
}

const HealthMetric: React.FC<HealthMetricProps> = ({ label, value, icon: Icon, unit, variant = "default" }) => {
  const valueColor = 
    variant === "positive" ? "text-green-600 dark:text-green-400" :
    variant === "negative" ? "text-red-600 dark:text-red-400" :
    "text-foreground";

  return (
    <div className="flex flex-col py-1.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </span>
      <span className={`text-base font-semibold ${valueColor}`}>
        {value}{unit}
      </span>
    </div>
  );
};

export function DriverAccountHealthCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    overallHealth: { status: "Good", score: 0 },
    averageRating: 0,
    completionRate: 0,
    acceptanceRate: 0
  });

  useEffect(() => {
    async function fetchMetrics() {
      if (!user?.id) return;
      setLoading(true);
      try {
        // Fetch driver profile
        const driverRes = await fetch(`/api/operator/drivers/${user.id}`);
        const driverData = await driverRes.json();
        // Fetch ride history
        const ridesRes = await fetch(`/api/driver/ride-history?driverId=${user.id}`);
        const ridesData = await ridesRes.json();
        const rides = Array.isArray(ridesData) ? ridesData : ridesData.rides || [];
        // Compute metrics
        let completed = 0, accepted = 0, total = 0, ratingSum = 0, ratingCount = 0;
        rides.forEach(ride => {
          if (ride.status === "completed") completed++;
          if (ride.status === "completed" || ride.status === "cancelled_by_passenger" || ride.status === "cancelled_no_show") accepted++;
          total++;
          if (ride.ratingByPassenger) {
            ratingSum += ride.ratingByPassenger;
            ratingCount++;
          }
        });
        const averageRating = ratingCount ? ratingSum / ratingCount : 0;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        const acceptanceRate = total ? Math.round((accepted / total) * 100) : 0;
        const overallScore = Math.round((averageRating * 20 + completionRate + acceptanceRate) / 3);
        setMetrics({
          overallHealth: { status: overallScore >= 80 ? "Good" : overallScore >= 60 ? "Fair" : "Poor", score: overallScore },
          averageRating,
          completionRate,
          acceptanceRate
        });
      } catch (e) {
        setMetrics(m => ({ ...m, overallHealth: { status: "N/A", score: 0 } }));
      }
      setLoading(false);
    }
    fetchMetrics();
  }, [user?.id]);

  if (loading) {
    return (
      <Card className="shadow-lg w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-headline flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Your Account Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center justify-center h-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        </CardContent>
      </Card>
    );
  }

  const { overallHealth, averageRating, completionRate, acceptanceRate } = metrics;
  const getHealthStatusColor = () => {
    if (overallHealth.score >= 80) return "text-green-600 dark:text-green-400";
    if (overallHealth.score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };
  const getHealthStatusIcon = () => {
    if (overallHealth.score >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (overallHealth.score >= 60) return <Activity className="w-5 h-5 text-yellow-500" />;
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  };

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Your Account Health
            </CardTitle>
            <Badge variant={overallHealth.score >= 80 ? "default" : overallHealth.score >= 60 ? "secondary" : "destructive"} className={cn(
                "text-xs",
                overallHealth.score >= 80 && "bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700",
                overallHealth.score >= 60 && overallHealth.score < 80 && "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700",
                overallHealth.score < 60 && "bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700"
            )}>
                {overallHealth.status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="text-center mb-2">
          <Progress value={overallHealth.score} className="h-2 my-1" indicatorClassName={
              overallHealth.score >= 80 ? "bg-green-500" : 
              overallHealth.score >= 60 ? "bg-yellow-500" : "bg-red-500"
            } 
          />
          <p className="text-xs text-muted-foreground">Overall Score: {overallHealth.score}/100</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border p-2 rounded-md bg-muted/30">
            <HealthMetric label="Avg. Rating" value={`${averageRating.toFixed(1)}/5`} icon={Star} variant={averageRating >= 4.5 ? "positive" : averageRating >= 4.0 ? "neutral" : "negative"} />
            <HealthMetric label="Completion" value={completionRate} unit="%" icon={TrendingUp} variant={completionRate >= 90 ? "positive" : completionRate >= 80 ? "neutral" : "negative"}/>
            <HealthMetric label="Acceptance" value={acceptanceRate} unit="%" icon={CheckCircle} variant={acceptanceRate >= 85 ? "positive" : "neutral"}/>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button variant="outline" size="sm" className="w-full text-xs h-8" disabled>
          View Full Performance Report (Soon)
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}
