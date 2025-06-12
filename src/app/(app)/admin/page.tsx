
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Shield, Building, Users, BarChart3, Settings, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useState, useEffect } from 'react';
import { getAdminActionItems, type AdminActionItemsInput, type ActionItem as AiActionItemType } from '@/ai/flows/admin-action-items-flow';
import { AdminActionItemsDisplay } from '@/components/admin/AdminActionItemsDisplay';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [adminActionItems, setAdminActionItems] = useState<AiActionItemType[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [pendingOperatorCount, setPendingOperatorCount] = useState<number>(0);

  useEffect(() => {
    const fetchTasks = async () => {
      setIsLoadingTasks(true);
      setTasksError(null);
      try {
        // Mock input data for the AI flow
        const mockInput: AdminActionItemsInput = {
          pendingOperatorApprovals: Math.floor(Math.random() * 5), // 0 to 4
          activeSystemAlerts: Math.floor(Math.random() * 3),       // 0 to 2
          unresolvedSupportTickets: Math.floor(Math.random() * 10), // 0 to 9
          recentFeatureFeedbackCount: Math.floor(Math.random() * 25),// 0 to 24
          platformLoadPercentage: Math.floor(Math.random() * 70) + 20, // 20 to 89
        };
        setPendingOperatorCount(mockInput.pendingOperatorApprovals); 
        const result = await getAdminActionItems(mockInput);
        setAdminActionItems(result.actionItems || []);
      } catch (error) {
        console.error("Failed to fetch admin action items:", error);
        setTasksError(error instanceof Error ? error.message : "An unknown error occurred while fetching tasks.");
        setAdminActionItems([]);
        setPendingOperatorCount(0);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    fetchTasks();
  }, []);


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" /> Platform Administration
          </CardTitle>
          <CardDescription>Welcome, {user?.name || 'Administrator'}. Oversee and manage the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg">
            This is the central hub for managing platform operators, all users, viewing system-wide analytics,
            and configuring core platform settings.
          </p>
        </CardContent>
      </Card>

      {/* Admin Action Items Display */}
      <div className="my-6">
        {isLoadingTasks && (
          <Card>
            <CardHeader><CardTitle>Loading AI Action Items...</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center p-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </CardContent>
          </Card>
        )}
        {tasksError && !isLoadingTasks && (
          <Card className="border-destructive">
            <CardHeader><CardTitle className="text-destructive">Error Loading Tasks</CardTitle></CardHeader>
            <CardContent className="text-destructive-foreground bg-destructive/10 p-4 rounded-md">
              <p className="flex items-center gap-2"><AlertTriangle /> {tasksError}</p>
            </CardContent>
          </Card>
        )}
        {!isLoadingTasks && !tasksError && (
          <AdminActionItemsDisplay items={adminActionItems} />
        )}
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Manage Operators"
          description="Approve new operators, view operator details, and manage their status on the platform."
          icon={Building}
          link="/admin/manage-operators"
          actionText="Go to Operator Management"
          notificationCount={pendingOperatorCount}
        />
        <FeatureCard
          title="Platform Users"
          description="Search and manage all user accounts across roles (passengers, drivers, operators, admins)."
          icon={Users}
          link="/admin/platform-users"
          actionText="View All Users"
        />
        <FeatureCard
          title="System Analytics"
          description="Access comprehensive analytics for the entire platform, including overall ride volume, revenue, and growth trends."
          icon={BarChart3}
          link="/admin/analytics"
          actionText="View Platform Analytics"
        />
        <FeatureCard
          title="Global Settings"
          description="Configure platform-wide settings, commission rates, and default policies."
          icon={Settings}
          link="/admin/global-settings"
          actionText="Configure Settings"
        />
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
  notificationCount?: number;
}

function FeatureCard({ title, description, icon: Icon, link, actionText, notificationCount }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="items-center pb-4">
        <div className="relative">
          <Icon className="w-10 h-10 text-accent mb-3" />
          {notificationCount && notificationCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-2 text-xs px-1.5 py-0.5 h-5 min-w-[1.25rem] flex items-center justify-center rounded-full">
              {notificationCount}
            </Badge>
          )}
        </div>
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
