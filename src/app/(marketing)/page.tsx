
import React from 'react';

export default function LandingPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-blue-700 mb-4">Minimal Landing Page</h1>
      <p className="text-lg text-gray-700">If you see this styled, Tailwind is working.</p>
      <div className="mt-6 p-4 bg-blue-500 text-white rounded-md shadow-lg">
        This is a styled box.
      </div>
      <div className="mt-2 p-4 bg-green-500 text-white rounded-md">
        Another styled box.
      </div>
    </div>
  );
}
