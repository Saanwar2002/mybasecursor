
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Star, TrendingUp, CheckCircle, AlertTriangle, MessageSquareQuote, ArrowRight, ShieldCheck, UserX, TrafficCone, ThumbsUp, AlertCircle as AlertCircleIcon } from "lucide-react"; // Added ThumbsUp, AlertCircleIcon
import { Progress } from "@/components/ui/progress"; 
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import ShadCN Alert components
import { cn } from "@/lib/utils";


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
  const overallHealth = { status: "Good", score: 85 }; 
  const averageRating = 4.7;
  const completionRate = 92; 
  const acceptanceRate = 88; 
  const safetyScore = "98/100";
  const passengerBlocks = 1; 
  const positiveFeedback = "Passengers consistently praise your friendly demeanor and safe driving.";
  const areaForImprovement = "Consider reducing waiting times at pickup locations where possible.";

  const getHealthStatusColor = () => {
    if (overallHealth.score >= 80) return "text-green-600 dark:text-green-400";
    if (overallHealth.score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };
  
  const getHealthStatusIcon = () => {
    if (overallHealth.score >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (overallHealth.score >= 60) return <Activity className="w-5 h-5 text-yellow-500" />;
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }

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
