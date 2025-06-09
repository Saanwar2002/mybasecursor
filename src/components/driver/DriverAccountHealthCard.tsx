
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Star, TrendingUp, CheckCircle, AlertTriangle, MessageSquareQuote, ArrowRight, ShieldCheck, UserX, TrafficCone } from "lucide-react";
import { Progress } from "@/components/ui/progress"; 
import { Separator } from "@/components/ui/separator";

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
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${valueColor}`}>
        {value}{unit}
      </span>
    </div>
  );
};

export function DriverAccountHealthCard() {
  // Mock Data (replace with actual data fetching later)
  const overallHealth = { status: "Good", score: 85 }; // Score out of 100
  const averageRating = 4.7;
  const completionRate = 92; // Percentage
  const acceptanceRate = 88; // Percentage
  const safetyScore = "98/100"; // Mock Driving Performance
  const passengerBlocks = 1; // Mock Passenger Blocks
  const positiveFeedback = "Passengers consistently praise your friendly demeanor and safe driving.";
  const areaForImprovement = "Consider reducing waiting times at pickup locations where possible.";

  const getHealthStatusColor = () => {
    if (overallHealth.score >= 80) return "text-green-600 dark:text-green-400";
    if (overallHealth.score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };
  
  const getHealthStatusIcon = () => {
    if (overallHealth.score >= 80) return <CheckCircle className="w-6 h-6 text-green-500" />;
    if (overallHealth.score >= 60) return <Activity className="w-6 h-6 text-yellow-500" />;
    return <AlertTriangle className="w-6 h-6 text-red-500" />;
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-headline flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Your Account Health
            </CardTitle>
            <Badge variant={overallHealth.score >= 80 ? "default" : overallHealth.score >= 60 ? "secondary" : "destructive"} className={
                overallHealth.score >= 80 ? "bg-green-500/80 text-green-950" :
                overallHealth.score >= 60 ? "bg-yellow-500/80 text-yellow-950" :
                "bg-red-600 text-white"
            }>
                {overallHealth.status}
            </Badge>
        </div>
        <CardDescription>
          An overview of your performance and passenger feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2 mb-1">
            {getHealthStatusIcon()}
            <p className={`text-2xl font-bold ${getHealthStatusColor()}`}>{overallHealth.status}</p>
          </div>
          <Progress value={overallHealth.score} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-primary/70 [&>div]:to-primary" indicatorClassName={
              overallHealth.score >= 80 ? "bg-green-500" : 
              overallHealth.score >= 60 ? "bg-yellow-500" : "bg-red-500"
            } 
          />
          <p className="text-xs text-muted-foreground mt-1">Overall Score: {overallHealth.score}/100</p>
        </div>

        <Separator />
        
        <HealthMetric label="Average Passenger Rating" value={`${averageRating.toFixed(1)}/5`} icon={Star} variant={averageRating >= 4.5 ? "positive" : averageRating >= 4.0 ? "neutral" : "negative"} />
        <HealthMetric label="Ride Completion Rate" value={completionRate} unit="%" icon={TrendingUp} variant={completionRate >= 90 ? "positive" : completionRate >= 80 ? "neutral" : "negative"}/>
        <HealthMetric label="Ride Acceptance Rate" value={acceptanceRate} unit="%" icon={CheckCircle} variant={acceptanceRate >= 85 ? "positive" : "neutral"}/>
        <HealthMetric label="Safety Score (Last 30d)" value={safetyScore} icon={ShieldCheck} variant={safetyScore === "100/100" || safetyScore === "99/100" || safetyScore === "98/100" ? "positive" : "neutral"} />
        <HealthMetric label="Passengers Who Blocked You" value={passengerBlocks} icon={UserX} variant={passengerBlocks === 0 ? "positive" : passengerBlocks <= 2 ? "neutral" : "negative"} />


        <Separator />

        {positiveFeedback && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded-r-md">
            <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1 flex items-center gap-1.5">
              <MessageSquareQuote className="w-4 h-4" /> Recent Positive Feedback
            </h4>
            <p className="text-xs text-green-600 dark:text-green-400 italic">&ldquo;{positiveFeedback}&rdquo;</p>
          </div>
        )}

        {areaForImprovement && (
           <div className="p-3 bg-yellow-50 dark:bg-yellow-800/30 border-l-4 border-yellow-500 rounded-r-md">
            <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Area for Attention
            </h4>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">{areaForImprovement}</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" disabled>
          View Full Performance Report (Coming Soon)
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
