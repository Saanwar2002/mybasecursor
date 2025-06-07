
// src/components/icons/my-base-logo-icon.tsx
import type { SVGProps } from 'react';

export function MyBaseLogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64" // Adjusted viewBox for more detail
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Wings - Simplified */}
      <path d="M6 28 Q12 24 20 26 L20 38 Q12 40 6 36 Z" fill="#4A4A4A" stroke="#333333" strokeWidth="1" />
      <path d="M10 30 L18 31.5" stroke="#FFD700" strokeWidth="1.5" />
      <path d="M10 34 L18 35.5" stroke="#FFD700" strokeWidth="1.5" />
      
      <path d="M58 28 Q52 24 44 26 L44 38 Q52 40 58 36 Z" fill="#4A4A4A" stroke="#333333" strokeWidth="1" />
      <path d="M54 30 L46 31.5" stroke="#FFD700" strokeWidth="1.5" />
      <path d="M54 34 L46 35.5" stroke="#FFD700" strokeWidth="1.5" />

      {/* Map Pin Body */}
      <path
        d="M32 2 C22.059 2 14 10.059 14 20 C14 31.021 32 50 32 50 S50 31.021 50 20 C50 10.059 41.941 2 32 2 Z"
        fill="#FF6B6B" // Red-ish color for pin
        stroke="#D9534F"
        strokeWidth="1.5"
      />
      {/* Inner circle of pin (optional, for depth) */}
      <circle cx="32" cy="20" r="4" fill="#FFF" opacity="0.5" />

      {/* Simplified Taxi inside the pin */}
      {/* Taxi Body */}
      <rect x="24" y="16" width="16" height="8" rx="1" fill="#FFD700" stroke="#B8860B" strokeWidth="1"/>
      {/* Taxi Roof */}
      <rect x="27" y="13" width="10" height="3" rx="0.5" fill="#FFD700" stroke="#B8860B" strokeWidth="0.5"/>
      {/* Taxi Sign */}
      <rect x="29.5" y="10.5" width="5" height="2.5" fill="#F0E68C" stroke="#B8860B" strokeWidth="0.5"/>
      {/* Wheels (simplified) */}
      <circle cx="27" cy="25" r="2.5" fill="#555555" stroke="#333333" strokeWidth="0.5"/>
      <circle cx="37" cy="25" r="2.5" fill="#555555" stroke="#333333" strokeWidth="0.5"/>
    </svg>
  );
}
