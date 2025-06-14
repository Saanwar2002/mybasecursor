
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Car, DollarSign, History, MessageCircle, Navigation, Bell, Users, ListChecks, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from 'react';
// import Image from 'next/image'; // Not used in current version
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Not used
// import { Checkbox } from "@/components/ui/checkbox"; // Not used
import { DriverAccountHealthCard } from '@/components/driver/DriverAccountHealthCard';
import { useRouter } from 'next/navigation';

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const router = useRouter();

  // const activeRide = null; // This was hardcoded to null, so the section displaying it was effectively dead code.

  const [earningsTodayDisplay, setEarningsTodayDisplay] = useState<string | null>(null);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(true);

  useEffect(() => {
    setIsLoadingEarnings(true);
    const timerId = setTimeout(() => { // Store timer ID
      const fetchedEarnings = (Math.random() * 100 + 50).toFixed(2);
      setEarningsTodayDisplay(`£${fetchedEarnings}`);
      setIsLoadingEarnings(false);
    }, 1500);
    return () => clearTimeout(timerId); // Cleanup the timeout
  }, []);


  const handleOnlineStatusChange = (checked: boolean) => {
    setIsOnline(checked);
    if (checked) {
      router.push('/driver/available-rides');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-6" style={{ minHeight: 'calc(100vh - 7rem)', backgroundColor: 'rgba(200,255,200,0.1)' /* Debugging Background: Faint Green */ }}>
      {/* Main Dashboard Content Column */}
      <div className="lg:w-2/3 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-3xl font-headline">Welcome, {user?.name || 'Driver'}!</CardTitle>
              <div className="flex items-center space-x-2">
                <Switch
                  id="online-status"
                  checked={isOnline}
                  onCheckedChange={handleOnlineStatusChange}
                />
                <Label htmlFor="online-status" className={isOnline ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                  {isOnline ? "Online" : "Offline"}
                </Label>
              </div>
            </div>
            <CardDescription>Manage your rides, track earnings, and stay connected.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-6">
            <div className="w-full space-y-4">
              <p className="text-lg">You are currently <span className={isOnline ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{isOnline ? "Online and available" : "Offline"}</span> for new ride offers.</p>
              <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/driver/available-rides">
                  <Car className="mr-2 h-5 w-5" /> Check for Ride Offers
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <DriverAccountHealthCard />

        <div className="grid gap-6 md:grid-cols-2">
          {/* The activeRide display was here but activeRide was always null in this component */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" /> Earnings Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEarnings ? (
                <div className="flex items-center justify-center h-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <p className="text-3xl font-bold">{earningsTodayDisplay || "£0.00"}</p>
              )}
              <Link href="/driver/earnings" className="text-sm text-accent hover:underline">View Detailed Earnings</Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            title="Manage Current Ride"
            description="View details and manage your active ride."
            icon={Car}
            link="/driver/available-rides"
            actionText="View Current Status"
          />
          <FeatureCard
            title="Earnings & History"
            description="Track your earnings and view past rides."
            icon={History}
            link="/driver/earnings"
            actionText="View Earnings"
          />
          <FeatureCard
            title="In-App Chat"
            description="Communicate with passengers or support."
            icon={MessageCircle}
            link="/driver/chat"
            actionText="Open Chat"
          />
        </div>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  actionText: string;
}

function FeatureCard({ title, description, icon: Icon, link, actionText }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center pb-4">
        <Icon className="w-10 h-10 text-accent mb-3" />
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" asChild>
          <Link href={link}>{actionText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
    