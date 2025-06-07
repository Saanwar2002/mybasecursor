
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DriverRideHistoryPage() {
  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Driver Ride History (Test)</CardTitle>
        </CardHeader>
        <CardContent>
          <p>If you can see this, the basic page is working!</p>
          <p>The route /driver/ride-history has been correctly recognized.</p>
        </CardContent>
      </Card>
    </div>
  );
}
