
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Star, Gift, Users, TrendingUp, AlertTriangle, CheckCircle, Edit, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Mock Data
const mockProgramStats = {
  activeMembers: 1234,
  totalPointsEarned: 5678900,
  totalRewardsRedeemed: 456,
  averagePointsPerUser: 4600,
};

const mockRecentActivity = [
  { id: "act1", type: "Earned", user: "Alice M.", points: 150, description: "Ride completed" },
  { id: "act2", type: "Redeemed", user: "Bob T.", points: -1000, description: "£5 Ride Credit" },
  { id: "act3", type: "Earned", user: "Charlie P.", points: 80, description: "Ride completed" },
];

export default function PassengerLoyaltyProgramPage() {
  const { toast } = useToast();
  const [programActive, setProgramActive] = useState(true);
  const [pointsPerPound, setPointsPerPound] = useState(10);
  const [welcomeBonus, setWelcomeBonus] = useState(100);
  const [rewardTiers, setRewardTiers] = useState(
    "Bronze (1000 pts): £5 ride credit\nSilver (5000 pts): 10% off next 3 rides\nGold (10000 pts): Free airport transfer (up to £30)"
  );
  const [isEditingConfig, setIsEditingConfig] = useState(false);

  const handleSaveChanges = () => {
    // Mock save action
    console.log("Saving loyalty program settings:", { programActive, pointsPerPound, welcomeBonus, rewardTiers });
    toast({
      title: "Settings Saved (Mock)",
      description: "Loyalty program configuration has been updated.",
    });
    setIsEditingConfig(false);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Star className="w-8 h-8 text-primary" /> Passenger Loyalty Program
          </CardTitle>
          <CardDescription>
            Design, manage, and track the passenger loyalty program to reward frequent riders and boost engagement.
          </CardDescription>
        </CardHeader>
      </Card>

      <Alert variant="default" className="bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700">
        <AlertTriangle className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="font-semibold text-sky-700 dark:text-sky-300">Conceptual Planning Page</AlertTitle>
        <AlertDescription className="text-sm text-sky-600 dark:text-sky-400">
          This page is a conceptual outline for managing a passenger loyalty program. Full backend integration for point tracking, reward redemption, and automated tier management is planned.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-headline flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-accent" /> Program Configuration
            </CardTitle>
            <CardDescription>Set the rules and rewards for your loyalty program.</CardDescription>
          </div>
           <Button variant={isEditingConfig ? "destructive" : "outline"} size="sm" onClick={() => setIsEditingConfig(!isEditingConfig)}>
            {isEditingConfig ? <><XCircle className="mr-2 h-4 w-4" />Cancel</> : <><Edit className="mr-2 h-4 w-4" />Edit Config</>}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
            <Label htmlFor="programActive" className="text-base font-medium">Program Active Status</Label>
            <Switch id="programActive" checked={programActive} onCheckedChange={setProgramActive} disabled={!isEditingConfig} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pointsPerPound">Points per £ Spent</Label>
              <Input id="pointsPerPound" type="number" value={pointsPerPound} onChange={(e) => setPointsPerPound(Number(e.target.value))} disabled={!isEditingConfig} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="welcomeBonus">Welcome Bonus Points</Label>
              <Input id="welcomeBonus" type="number" value={welcomeBonus} onChange={(e) => setWelcomeBonus(Number(e.target.value))} disabled={!isEditingConfig} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rewardTiers">Reward Tiers & Benefits</Label>
            <Textarea
              id="rewardTiers"
              value={rewardTiers}
              onChange={(e) => setRewardTiers(e.target.value)}
              placeholder="e.g., Bronze (1000 pts): £5 credit..."
              className="min-h-[100px]"
              disabled={!isEditingConfig}
            />
          </div>
          {isEditingConfig && (
            <Button onClick={handleSaveChanges} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Save className="mr-2 h-4 w-4" /> Save Configuration Changes
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Program Statistics (Mock Data)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatDisplay label="Active Members" value={mockProgramStats.activeMembers.toLocaleString()} icon={Users} />
            <StatDisplay label="Total Points Earned" value={mockProgramStats.totalPointsEarned.toLocaleString()} icon={Star} />
            <StatDisplay label="Rewards Redeemed" value={mockProgramStats.totalRewardsRedeemed.toLocaleString()} icon={Gift} />
            <StatDisplay label="Avg. Points/User" value={mockProgramStats.averagePointsPerUser.toLocaleString()} icon={TrendingUp} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-headline">Recent Loyalty Activity (Mock Data)</CardTitle>
        </CardHeader>
        <CardContent>
            <ul className="space-y-2">
                {mockRecentActivity.map(activity => (
                    <li key={activity.id} className="flex justify-between items-center p-2 border rounded-md bg-card hover:bg-muted/50">
                        <div>
                            <span className={`font-semibold ${activity.type === "Earned" ? "text-green-600" : "text-red-600"}`}>{activity.type}</span> by {activity.user}
                            <p className="text-xs text-muted-foreground">{activity.description}</p>
                        </div>
                        <Badge variant={activity.type === "Earned" ? "default" : "destructive"} className={activity.type === "Earned" ? "bg-green-100 text-green-700" : ""}>
                            {activity.type === "Earned" ? "+" : ""}{activity.points} pts
                        </Badge>
                    </li>
                ))}
            </ul>
        </CardContent>
         <CardFooter>
            <Button variant="outline" disabled>View Full Activity Log (Placeholder)</Button>
        </CardFooter>
      </Card>

    </div>
  );
}

interface StatDisplayProps {
    label: string;
    value: string;
    icon: React.ElementType;
}
const StatDisplay: React.FC<StatDisplayProps> = ({ label, value, icon: Icon }) => (
    <div className="p-3 border rounded-lg bg-muted/20 flex flex-col items-center text-center">
        <Icon className="w-6 h-6 text-primary mb-1.5" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-primary">{value}</p>
    </div>
);

