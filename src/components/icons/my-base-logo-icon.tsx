// src/components/icons/my-base-logo-icon.tsx
import Image from 'next/image';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface MyBaseLogoIconProps extends HTMLAttributes<HTMLDivElement> {
  priority?: boolean;
}

export function MyBaseLogoIcon({ className, priority /* Prop received but will be overridden below */, ...props }: MyBaseLogoIconProps) {
  return (
    <div className={cn("relative", className)} {...props}>
      <Image
        src="/mybase-logo.png"
        alt="MyBase Logo"
        fill={true}
        style={{ objectFit: 'contain' }}
        priority={false} // Force priority to false for diagnostic purposes
      />
    </div>
  );
}
