
"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";

export default function DriverDashboardPage() {
  const { user } = useAuth();

  useEffect(() => {
    console.log("DriverDashboardPage: Rendered. User:", user);
  }, [user]);

  if (!user) {
    console.log("DriverDashboardPage: No user, rendering loading or redirect state.");
    return <div className="p-4">Loading driver dashboard or redirecting...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-green-100 dark:bg-green-900/30">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">
            DRIVER DASHBOARD - TEST VIEW
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>If you see this, the Driver Dashboard page component is rendering!</p>
          <p>User: {user.name}</p>
          <p>Role: {user.role}</p>
          <p>Operator Code: {user.operatorCode || "N/A"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
