"use client"; // Added "use client"

import React from 'react';

export default function LandingPage() {
  console.log("Minimal Marketing LandingPage rendering for 404 debug...");
  return (
    <div className="container mx-auto px-4 py-10 text-center"> {/* Removed diagnostic border */}
      <h1 className="text-5xl font-bold text-primary mb-6">MyBase Minimal Landing (Debug)</h1>
      <p className="text-xl text-muted-foreground mb-8">
        This is a test to see if basic styling and routing works. If you see this, the route is found.
      </p>
      <div className="mt-8 p-4 bg-accent text-accent-foreground rounded-md">
        This box should have accent colors.
      </div>
      <p className="text-red-500 p-2 mt-2">This text should be red.</p>
    </div>
  );
}
