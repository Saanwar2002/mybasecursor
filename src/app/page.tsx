
"use client";

import React from 'react';

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-6">
      <div className="text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold">
          Minimal Test Page
        </h1>
        <p className="text-lg md:text-xl">
          If you see this, the basic page component is working.
        </p>
      </div>
    </main>
  );
}
