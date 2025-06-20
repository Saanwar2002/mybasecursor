"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, CheckCircle, AlertTriangle, MessageSquareQuote, ArrowRight, UserX, ThumbsUp, AlertCircle as AlertCircleIcon, Clock, Smile } from "lucide-react";
import { Progress } from "@/components/ui/progress"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export function PassengerAccountHealthCard() {
  // Example metrics for a passenger
  const overallHealth = { status: "Active", score: 90 };
  const averageRating = 4.9; // Avg. rating given by drivers
  const completionRate = 98; // % of rides completed
  const onTimeRate = 95; // % of times passenger was on time
  const blocks = 0; // Number of drivers who blocked this passenger
  const positiveFeedback = "Drivers appreciate your punctuality and courtesy.";
  const areaForImprovement = "Remember to rate your rides to help improve the service.";

  const getHealthStatusColor = () => {
    if (overallHealth.score >= 80) return "text-green-600 dark:text-green-400";
    if (overallHealth.score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };
  
  const getHealthStatusIcon = () => {
    if (overallHealth.score >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (overallHealth.score >= 60) return <Smile className="w-5 h-5 text-yellow-500" />;
    return <AlertTriangle className="w-5 h-5 text-red-500" />;
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-headline flex items-center gap-2">
            <Smile className="w-5 h-5 text-primary" />
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
            <HealthMetric label="Avg. Rating by Drivers" value={`${averageRating.toFixed(1)}/5`} icon={Star} variant={averageRating >= 4.5 ? "positive" : averageRating >= 4.0 ? "neutral" : "negative"} />
            <HealthMetric label="Completion Rate" value={completionRate} unit="%" icon={TrendingUp} variant={completionRate >= 95 ? "positive" : completionRate >= 85 ? "neutral" : "negative"}/>
            <HealthMetric label="On-Time Rate" value={onTimeRate} unit="%" icon={Clock} variant={onTimeRate >= 90 ? "positive" : onTimeRate >= 80 ? "neutral" : "negative"}/>
            <HealthMetric label="Blocked By Drivers" value={blocks} icon={UserX} variant={blocks === 0 ? "positive" : blocks <= 2 ? "neutral" : "negative"} />
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
          View Full Account Report (Soon)
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
} 