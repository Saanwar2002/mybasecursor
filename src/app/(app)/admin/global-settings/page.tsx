
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, AlertTriangle } from "lucide-react";

export default function AdminGlobalSettingsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" /> Global Platform Settings
          </CardTitle>
          <CardDescription>
            Configure core platform-wide settings, default policies, and integrations.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Area</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-8 bg-muted/50 rounded-lg">
            <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Global Settings Under Construction</h3>
            <p className="text-muted-foreground max-w-md">
              This section will allow platform administrators to configure various global parameters,
              such as default commission rates, API keys for third-party services,
              feature toggles, and platform-wide policies.
            </p>
            <p className="text-muted-foreground mt-2 max-w-md">
              Please check back later for more specific configuration options.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
