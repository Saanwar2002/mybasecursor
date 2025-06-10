
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, DollarSign, Target, PlusCircle, TrendingUp, CalendarDays, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge"; // Added Badge import
import { useAuth } from "@/contexts/auth-context"; // Added useAuth

// Mock Data - Scoped to this operator
const mockOperatorPrograms = [
  { id: "op_prog1", name: "High Earner Weekly Bonus (My Fleet)", metric: "Top 3 Drivers by Fare (Weekly)", reward: "£30 Fuel Voucher", status: "Active", participants: 12 },
  { id: "op_prog2", name: "Night Owl Challenge (My Fleet)", metric: "Most Rides (10PM-4AM, Mon-Fri)", reward: "Reduced Commission Next Week", status: "Active", participants: 8 },
  { id: "op_prog3", name: "Weekend Peak Performer (My Fleet)", metric: "Highest Acceptance Rate (Fri 6PM - Sun 10PM)", reward: "£20 Service Credit", status: "Expired", participants: 5 },
];

export default function OperatorDriverIncentivesPage() {
  const { toast } = useToast();
  const { user } = useAuth(); // Get operator user details

  const handleCreateOperatorProgram = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: "Operator Program Creation (Mock)",
      description: `A new incentive program for your drivers (Operator: ${user?.operatorCode || 'Your Fleet'}) would be created.`,
    });
    (event.target as HTMLFormElement).reset();
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Award className="w-8 h-8 text-primary" /> My Fleet: Driver Incentives
          </CardTitle>
          <CardDescription>
            Create and manage incentive programs specifically for drivers in your fleet ({user?.operatorCode || 'Your Company'}).
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Operator-Specific Incentives</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This page is for managing incentive programs exclusive to your drivers. Full backend integration for program creation, targetting drivers under your operator code, tracking, and reward distribution is planned.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-accent" /> Create New Program for Your Fleet (Mock UI)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOperatorProgram} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="programNameOp">Program Name</Label>
                <Input id="programNameOp" placeholder="e.g., My Fleet Top Performer" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targetMetricOp">Target Metric</Label>
                <Select>
                  <SelectTrigger id="targetMetricOp">
                    <SelectValue placeholder="Select metric (e.g., Rides, Rating)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rides_completed_fleet">Rides Completed (Fleet)</SelectItem>
                    <SelectItem value="hours_online_fleet">Hours Online (Peak - Fleet)</SelectItem>
                    <SelectItem value="acceptance_rate_fleet">Acceptance Rate (Fleet)</SelectItem>
                    <SelectItem value="avg_rating_fleet">Avg. Passenger Rating (Fleet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rewardTypeOp">Reward Type</Label>
                <Select>
                  <SelectTrigger id="rewardTypeOp">
                    <SelectValue placeholder="Select reward (e.g., Bonus, Badge)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monetary_bonus_op">Monetary Bonus (£)</SelectItem>
                    <SelectItem value="commission_reduction_op">Commission Reduction (%)</SelectItem>
                    <SelectItem value="local_voucher_op">Local Business Voucher</SelectItem>
                    <SelectItem value="recognition_op">Company Recognition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rewardValueOp">Reward Value / Details</Label>
                <Input id="rewardValueOp" placeholder="e.g., 25 (for £25) or 'Dinner for Two'" />
              </div>
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="programCriteriaOp">Criteria / Thresholds for Your Fleet</Label>
                <Textarea id="programCriteriaOp" placeholder="e.g., Top 2 drivers with most completed rides this month within our fleet." />
              </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="startDateOp">Start Date</Label>
                    <Input id="startDateOp" type="date" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="endDateOp">End Date (Optional)</Label>
                    <Input id="endDateOp" type="date" />
                </div>
            </div>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Save Program for My Fleet (Mock)
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Your Fleet's Programs (Mock Data)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program Name</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Participants</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOperatorPrograms.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="font-medium">{program.name}</TableCell>
                  <TableCell>{program.metric}</TableCell>
                  <TableCell>{program.reward}</TableCell>
                  <TableCell>
                    <Badge variant={program.status === "Active" ? "default" : "outline"}
                           className={program.status === "Active" ? "bg-green-100 text-green-700 border-green-300" : "text-muted-foreground"}>
                      {program.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{program.participants}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-destructive" /> My Fleet Program Performance (Placeholder)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/50 rounded-lg">
            <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
            <p className="text-muted-foreground max-w-md">
              This section will display analytics on your fleet-specific programs: effectiveness, driver participation, and impact on your local operations.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
