"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RewardTier {
  id: number;
  points: number;
  reward: string;
}

export default function LoyaltyProgramPage() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [pointsPerRide, setPointsPerRide] = useState(10);
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/admin/loyalty-program/save')
      .then(res => res.json())
      .then(data => {
        setIsEnabled(data.isEnabled);
        setPointsPerRide(data.pointsPerRide);
        setRewardTiers(data.rewardTiers);
      });
  }, []);

  const handleAddTier = () => {
    setRewardTiers([...rewardTiers, { id: Date.now(), points: 0, reward: "" }]);
  };

  const handleRemoveTier = (id: number) => {
    setRewardTiers(rewardTiers.filter((tier) => tier.id !== id));
  };

  const handleTierChange = (id: number, field: keyof Omit<RewardTier, 'id'>, value: string | number) => {
    const newTiers = rewardTiers.map(tier => {
      if (tier.id === id) {
        return { ...tier, [field]: value };
      }
      return tier;
    });
    setRewardTiers(newTiers);
  };

  const handleSaveChanges = async () => {
    const res = await fetch('/api/admin/loyalty-program/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isEnabled,
        pointsPerRide,
        rewardTiers,
      }),
    });

    if (res.ok) {
      toast({
        title: "Settings Saved!",
        description: "Loyalty program settings have been updated.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Loyalty Program Management</h1>
            <p className="text-muted-foreground mt-1">Configure and manage your customer loyalty and rewards program.</p>
        </header>
        <div className="space-y-8">
            <Card>
                <CardHeader>
                <CardTitle>Program Status</CardTitle>
                <CardDescription>Enable or disable the loyalty program for all users.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="flex items-center space-x-3">
                    <Switch id="loyalty-status" checked={isEnabled} onCheckedChange={setIsEnabled} />
                    <Label htmlFor="loyalty-status" className="text-base">{isEnabled ? "Enabled" : "Disabled"}</Label>
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Points Configuration</CardTitle>
                <CardDescription>Set how many points passengers earn per completed ride.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="grid gap-2 max-w-sm">
                    <Label htmlFor="points-per-ride">Points per Ride</Label>
                    <Input
                    id="points-per-ride"
                    type="number"
                    value={pointsPerRide}
                    onChange={(e) => setPointsPerRide(Number(e.target.value))}
                    disabled={!isEnabled}
                    placeholder="e.g. 10"
                    />
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle>Reward Tiers</CardTitle>
                <CardDescription>Define the rewards passengers can get by accumulating points.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                {rewardTiers.map((tier) => (
                    <div key={tier.id} className="flex items-end gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="grid gap-1.5 flex-1">
                        <Label htmlFor={`tier-points-${tier.id}`}>Points Threshold</Label>
                        <Input
                        id={`tier-points-${tier.id}`}
                        type="number"
                        placeholder="e.g. 100"
                        value={tier.points}
                        onChange={(e) => handleTierChange(tier.id, 'points', Number(e.target.value))}
                        disabled={!isEnabled}
                        />
                    </div>
                    <div className="grid gap-1.5 flex-1">
                        <Label htmlFor={`tier-reward-${tier.id}`}>Reward Description</Label>
                        <Input
                        id={`tier-reward-${tier.id}`}
                        type="text"
                        placeholder="e.g. 10% off next ride"
                        value={tier.reward}
                        onChange={(e) => handleTierChange(tier.id, 'reward', e.target.value)}
                        disabled={!isEnabled}
                        />
                    </div>
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveTier(tier.id)}
                        disabled={!isEnabled}
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Tier</span>
                    </Button>
                    </div>
                ))}
                <Button onClick={handleAddTier} variant="outline" disabled={!isEnabled} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Reward Tier
                </Button>
                </CardContent>
            </Card>
            
            <div className="flex justify-end">
                <Button onClick={handleSaveChanges} size="lg">Save Changes</Button>
            </div>
        </div>
    </div>
  );
}

