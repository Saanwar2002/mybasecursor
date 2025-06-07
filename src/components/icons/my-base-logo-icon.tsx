
// src/components/icons/my-base-logo-icon.tsx
import Image from 'next/image';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface MyBaseLogoIconProps extends HTMLAttributes<HTMLDivElement> {
  priority?: boolean;
}

export function MyBaseLogoIcon({ className, priority = false, ...props }: MyBaseLogoIconProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      <Image
        src="/mybase-logo.png" 
        alt="MyBase Logo"
        layout="fill"
        objectFit="contain"
        priority={priority}
      />
    </div>
  );
}
