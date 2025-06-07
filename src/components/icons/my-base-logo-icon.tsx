// src/components/icons/my-base-logo-icon.tsx
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface MyBaseLogoIconProps extends HTMLAttributes<HTMLDivElement> {
  priority?: boolean; // Kept for interface consistency, but not used in this version
}

export function MyBaseLogoIcon({ className, priority, ...props }: MyBaseLogoIconProps) {
  // Temporarily always render the text fallback to avoid any issues with image loading
  // while troubleshooting the 500 error.
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-transparent text-foreground font-bold", // Removed bg-muted for better theme adaptability
        className
      )}
      style={{ fontSize: 'clamp(0.9em, 2.5vw, 1.1em)' }} // Adjusted font size to be relative to parent
      {...props}
    >
      MyBase
    </div>
  );
}
