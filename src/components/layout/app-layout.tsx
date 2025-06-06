
"use client";

import type { ReactNode } from 'react';
// import Link from 'next/link';
// import { useRouter, usePathname } from 'next/navigation';
// import { useAuth, UserRole } from '@/contexts/auth-context';
// import { Button } from '@/components/ui/button';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
// import { Car, LogOut, Menu, Settings, UserCircle, ChevronDown, ChevronUp, ListChecks, CheckCircle, ShieldAlert, DatabaseZap, UserCog as UserCogIcon, Layers, Wrench, MessageSquareHeart, Palette, BrainCircuit, Activity, Users, Lightbulb, TrendingUp, Flag } from 'lucide-react';
// import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
// import { ScrollArea } from '@/components/ui/scroll-area';
// import { getNavItemsForRole, NavItem } from './sidebar-nav-items';
// import { Skeleton } from '../ui/skeleton';
// import React, { useEffect, useState } from 'react';
// import { cn } from '@/lib/utils';
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Label } from "@/components/ui/label";
// import { getAdminActionItems, type AdminActionItemsInput, type ActionItem as AiActionItem } from '@/ai/flows/admin-action-items-flow';
// import * as LucideIcons from 'lucide-react';

// interface TaskItem {
//   id: string;
//   label: string;
//   completed: boolean;
//   priority?: 'high' | 'medium' | 'low';
// }

// interface TaskSubCategory {
//   id: string;
//   name: string;
//   tasks: TaskItem[];
// }

// interface TaskCategory {
//   id: string;
//   name: string;
//   icon?: React.ElementType;
//   subCategories?: TaskSubCategory[];
//   tasks?: TaskItem[];
// }

// const DefaultAiTaskIcon = Lightbulb;

// const mapPriorityToStyle = (priority?: 'high' | 'medium' | 'low') => {
//   switch (priority) {
//     case 'high': return 'font-bold text-destructive';
//     case 'medium': return 'font-semibold text-orange-600 dark:text-orange-400';
//     default: return '';
//   }
// };

// TEMPORARY PLACEHOLDER LAYOUT
export function AppLayout({ children }: { children: ReactNode }) {
  // const { user, logout, loading } = useAuth(); // Temporarily commented out
  // const router = useRouter();
  // const pathname = usePathname();
  // const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  // const [adminToDoList, setAdminToDoList] = useState<TaskCategory[]>([]);
  // const [isLoadingAdminTasks, setIsLoadingAdminTasks] = useState(false);

  // Temporarily return a very simple layout to avoid useAuth errors
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:justify-end">
        <div>App Header (Auth Disabled)</div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden md:block w-60 border-r bg-card p-4">
          <div>Sidebar (Auth Disabled)</div>
        </aside>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 space-y-4">
          {children}
        </main>
      </div>
    </div>
  );
}
