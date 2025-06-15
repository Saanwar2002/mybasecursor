
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  // console.log("DEBUG: (app)/layout.tsx is rendering.");
  return (
    // The div with the purple border and the debug paragraph have been removed.
    <AppLayout>{children}</AppLayout>
  );
}
