
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

import { useEffect, useState } from "react";

export default function DriverIncentivesPage() {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/operator/driver-incentives")
      .then(res => res.json())
      .then(data => setPrograms(data.programs || []))
      .catch(() => toast({ title: "Error", description: "Failed to load incentive programs." }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleCreateProgram = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("programName") || "",
      metric: formData.get("targetMetric") || "",
      reward: formData.get("rewardType") || "",
      rewardValue: formData.get("rewardValue") || "",
      criteria: formData.get("programCriteria") || "",
      startDate: formData.get("startDate") || "",
      endDate: formData.get("endDate") || "",
      operatorCode: "ADMIN"
    };
    try {
      const res = await fetch("/api/operator/driver-incentives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to create program");
      const { program } = await res.json();
      setPrograms(prev => [program, ...prev]);
      toast({ title: "Program Created", description: `Incentive program '${payload.name}' created successfully.` });
      form.reset();
    } catch (err) {
      toast({ title: "Error", description: "Failed to create incentive program." });
    }
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Award className="w-8 h-8 text-primary" /> Driver Incentive & Rewards Programs
          </CardTitle>
          <CardDescription>
            Design, manage, and track the performance of driver incentive programs to boost engagement and service quality.
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Feature Placeholder</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This page is a conceptual outline for managing driver incentive programs. Full backend integration for program creation, tracking, and automated reward distribution is planned.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-accent" /> Create New Incentive Program (Mock UI)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateProgram} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="programName">Program Name</Label>
                <Input id="programName" placeholder="e.g., Peak Hour Power Driver" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targetMetric">Target Metric</Label>
                <Select>
                  <SelectTrigger id="targetMetric">
                    <SelectValue placeholder="Select metric (e.g., Rides, Rating)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rides_completed">Rides Completed</SelectItem>
                    <SelectItem value="hours_online">Hours Online (Peak)</SelectItem>
                    <SelectItem value="acceptance_rate">Acceptance Rate</SelectItem>
                    <SelectItem value="avg_rating">Average Passenger Rating</SelectItem>
                    <SelectItem value="referrals">Driver Referrals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rewardType">Reward Type</Label>
                <Select>
                  <SelectTrigger id="rewardType">
                    <SelectValue placeholder="Select reward (e.g., Bonus, Badge)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monetary_bonus">Monetary Bonus (£)</SelectItem>
                    <SelectItem value="commission_reduction">Commission Reduction (%)</SelectItem>
                    <SelectItem value="priority_access">Priority Ride Access</SelectItem>
                    <SelectItem value="digital_badge">Digital Badge/Recognition</SelectItem>
                    <SelectItem value="gift_voucher">Gift Voucher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rewardValue">Reward Value / Details</Label>
                <Input id="rewardValue" placeholder="e.g., 50 (for £50) or 5 (for 5%)" />
              </div>
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="programCriteria">Criteria / Thresholds</Label>
                <Textarea id="programCriteria" placeholder="e.g., Complete 20 rides during weekend peak hours (Fri 6PM - Sun 11PM) with an average rating of 4.7+." />
              </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input id="endDate" type="date" />
                </div>
            </div>
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Save Program (Mock)
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Current & Past Programs (Mock Data)
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
              {loading ? (
                <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
              ) : programs.length === 0 ? (
                <TableRow><TableCell colSpan={5}>No incentive programs found.</TableCell></TableRow>
              ) : (
                programs.map((program) => (
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
                    <TableCell className="text-right">{program.participants ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-destructive" /> Program Performance & ROI (Placeholder)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/50 rounded-lg">
            <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
            <p className="text-muted-foreground max-w-md">
              This section will display detailed analytics on program effectiveness, cost vs. benefit, driver participation rates, impact on retention, and overall return on investment.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
