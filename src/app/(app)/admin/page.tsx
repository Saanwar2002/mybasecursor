
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Building, Users, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export default function AdminDashboardPage() {
  const { user } = useAuth();

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
            This is the central hub for managing platform operators, all users, viewing system-wide analytics (soon),
            and configuring core platform settings (soon).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Manage Operators"
          description="Approve new operators, view operator details, and manage their status on the platform."
          icon={Building}
          link="/admin/manage-operators"
          actionText="Go to Operator Management"
        />
        <FeatureCard
          title="Platform Users"
          description="Search and manage all user accounts across roles (passengers, drivers, operators, admins)."
          icon={Users}
          link="/admin/platform-users" 
          actionText="View All Users"
          disabled={false} // Enabled this feature
        />
        <FeatureCard
          title="System Analytics (Soon)"
          description="Access comprehensive analytics for the entire platform, including overall ride volume, revenue, and growth trends."
          icon={BarChart3}
          link="#" // Placeholder
          actionText="View Platform Analytics"
          disabled
        />
         <FeatureCard
          title="Global Settings (Soon)"
          description="Configure platform-wide settings, commission rates, and default policies."
          icon={Settings}
          link="#" // Placeholder
          actionText="Configure Settings"
          disabled
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
  disabled?: boolean;
}

function FeatureCard({ title, description, icon: Icon, link, actionText, disabled }: FeatureCardProps) {
  return (
    <Card className={`hover:shadow-xl transition-shadow duration-300 ${disabled ? 'opacity-60' : ''}`}>
      <CardHeader className="items-center pb-4">
        <Icon className="w-10 h-10 text-accent mb-3" />
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" asChild disabled={disabled}>
          <Link href={link}>{actionText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
