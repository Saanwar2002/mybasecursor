"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Star, TrendingUp, CheckCircle, AlertTriangle, MessageSquareQuote, ArrowRight, ShieldCheck, UserX, TrafficCone, ThumbsUp, AlertCircle as AlertCircleIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress"; 
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";


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

interface DriverHealthStats {
  averageRating: number;
  completionRate: number;
  acceptanceRate: number;
  safetyScore: string;
  passengerBlocks: number;
  positiveFeedback: string | null;
  areaForImprovement: string | null;
  overallScore: number;
  status: 'Good' | 'Fair' | 'Poor';
}

export function DriverAccountHealthCard() {
  const { user } = useAuth();
  const [healthStats, setHealthStats] = useState<DriverHealthStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      const fetchHealthStats = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/driver/account-health?driverId=${user.uid}`);
          if (!response.ok) {
            throw new Error('Failed to fetch account health data.');
          }
          const data: DriverHealthStats = await response.json();
          setHealthStats(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchHealthStats();
    }
  }, [user?.uid]);
  
  if (isLoading) {
    return (
      <Card className="shadow-lg w-full">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-8 w-full" />
        </CardFooter>
      </Card>
    );
  }

  if (error || !healthStats) {
    return (
      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle>Account Health</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error || "Could not load your account health data. Please try again later."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const {
    overallScore,
    status,
    averageRating,
    completionRate,
    acceptanceRate,
    safetyScore,
    passengerBlocks,
    positiveFeedback,
    areaForImprovement,
  } = healthStats;

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Your Account Health
            </CardTitle>
            <Badge variant={overallScore >= 80 ? "default" : overallScore >= 60 ? "secondary" : "destructive"} className={cn(
                "text-xs",
                overallScore >= 80 && "bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700",
                overallScore >= 60 && overallScore < 80 && "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700",
                overallScore < 60 && "bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700"
            )}>
                {status}
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="text-center mb-2">
          <Progress value={overallScore} className="h-2 my-1" indicatorClassName={
              overallScore >= 80 ? "bg-green-500" : 
              overallScore >= 60 ? "bg-yellow-500" : "bg-red-500"
            } 
          />
          <p className="text-xs text-muted-foreground">Overall Score: {overallScore}/100</p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border p-2 rounded-md bg-muted/30">
            <HealthMetric label="Avg. Rating" value={`${averageRating.toFixed(1)}/5`} icon={Star} variant={averageRating >= 4.5 ? "positive" : averageRating >= 4.0 ? "neutral" : "negative"} />
            <HealthMetric label="Completion" value={completionRate} unit="%" icon={TrendingUp} variant={completionRate >= 90 ? "positive" : completionRate >= 80 ? "neutral" : "negative"}/>
            <HealthMetric label="Acceptance" value={acceptanceRate} unit="%" icon={CheckCircle} variant={acceptanceRate >= 85 ? "positive" : "neutral"}/>
            <HealthMetric label="Safety Score" value={safetyScore} icon={ShieldCheck} variant={safetyScore === "100/100" || safetyScore === "99/100" || safetyScore === "98/100" ? "positive" : "neutral"} />
            <HealthMetric label="Blocked By" value={passengerBlocks} icon={UserX} variant={passengerBlocks === 0 ? "positive" : passengerBlocks <= 2 ? "neutral" : "negative"} />
        </div>
        
        {positiveFeedback && (
          <Alert variant="default" className="p-2.5 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
            <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-xs font-semibold text-green-700 dark:text-green-300">Positive Feedback</AlertTitle>
            <AlertDescription className="text-xs text-green-600 dark:text-green-500 italic">
             &ldquo;{positiveFeedback}&rdquo;
            </AlertDescription>
          </Alert>
        )}

        {areaForImprovement && (
           <Alert variant="default" className="p-2.5 bg-yellow-50 dark:bg-yellow-800/30 border-yellow-300 dark:border-yellow-600">
            <AlertCircleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">Area for Attention</AlertTitle>
            <AlertDescription className="text-xs text-yellow-600 dark:text-yellow-500">
              {areaForImprovement}
            </AlertDescription>
          </Alert>
        )}
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
