
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, Menu, Settings, UserCircle, ChevronDown, ChevronUp, ListChecks, CheckCircle, ShieldAlert, DatabaseZap, UserCog as UserCogIcon, Layers, Wrench, MessageSquareHeart, Palette, BrainCircuit, Activity, Users, Lightbulb, TrendingUp, Flag, Briefcase, Bell } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getNavItemsForRole, NavItem } from './sidebar-nav-items';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import * as LucideIcons from 'lucide-react';
import { Separator } from '@/components/ui/separator';


interface TaskItem {
  id: string;
  label: string;
  completed: boolean; 
  priority?: 'high' | 'medium' | 'low';
  iconName?: string;
  category?: string;
}

interface TaskSubCategory {
  id: string;
  name: string;
  tasks: TaskItem[];
}

interface TaskCategory {
  id: string;
  name: string;
  icon?: React.ElementType;
  subCategories?: TaskSubCategory[];
  tasks?: TaskItem[];
}

const DefaultAiTaskIcon = Lightbulb;

const mapPriorityToStyle = (priority?: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high': return 'font-bold text-destructive';
    case 'medium': return 'font-semibold text-orange-600 dark:text-orange-400';
    default: return '';
  }
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  
  const [adminToDoList, setAdminToDoList] = useState<TaskCategory[]>([]);
  const [isLoadingAdminTasks, setIsLoadingAdminTasks] = useState(false);
  // const [driverToDoList, setDriverToDoList] = useState<TaskCategory[]>(simplifiedInitialDriverToDoData); // Temporarily removed

  useEffect(() => {
    console.log("AppLayout: Effect triggered. User:", user?.email, "Loading:", loading, "Pathname:", pathname);
  }, [user, loading, pathname]);

  // const toggleDriverTaskCompletion = (taskId: string) => { // Temporarily removed
  //   console.log("Toggled driver task (mock):", taskId);
  // };


  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebarState') !== 'collapsed';
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarState', isSidebarExpanded ? 'expanded' : 'collapsed');
    }
  }, [isSidebarExpanded]);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  if (loading) {
    console.log("AppLayout: In loading state, rendering skeletons.");
    return (
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:justify-end">
          <Skeleton className="h-8 w-24" /> <Skeleton className="h-10 w-10 rounded-full" />
        </header>
        <div className="flex flex-1">
          <aside className={cn("hidden md:flex flex-col border-r bg-card transition-all duration-300", isSidebarExpanded ? "w-64" : "w-16")}>
            <div className="p-4"><Skeleton className="h-10 w-full" /></div>
            <nav className="flex-1 space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </nav>
          </aside>
          <main className="flex-1 p-4 sm:px-6 sm:py-0 space-y-4"><Skeleton className="h-screen w-full" /></main>
        </div>
      </div>
    );
  }

  if (!user) {
    console.warn("AppLayout: User is null after loading state. AuthProvider should have redirected.");
    return <div className="flex items-center justify-center h-screen"><div>AppLayout: User is null. Redirecting...</div></div>;
  }

  const navItemsForRole = getNavItemsForRole(user.role);
  const toggleSubMenu = (label: string) => setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));

  const renderNavItems = (items: NavItem[], isSubItem = false, isMobileView = false) => {
    return items.map((item) => {
      const isActive = pathname === item.href || (item.href !== '/' && item.href !== '#' && pathname.startsWith(item.href + '/'));
      const Icon = item.icon;
      const shouldShowLabels = isSidebarExpanded || isMobileView;

      if (item.subItems && item.subItems.length > 0) {
        const isSubMenuOpen = openSubMenus[item.label] ?? false;
        return (
          <Collapsible key={item.label} open={isSubMenuOpen} onOpenChange={() => toggleSubMenu(item.label)} className="w-full">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-base gap-3 px-3",
                  isActive && "bg-primary/10 text-primary",
                  !shouldShowLabels && "justify-center px-0"
                )}
              >
                <Icon className={cn("h-5 w-5", !shouldShowLabels && "h-6 w-6")} />
                {shouldShowLabels && <span>{item.label}</span>}
                {shouldShowLabels && (isSubMenuOpen ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />)}
              </Button>
            </CollapsibleTrigger>
            {shouldShowLabels && (
              <CollapsibleContent className="pl-7 space-y-1 mt-1">
                {renderNavItems(item.subItems, true, isMobileView)}
              </CollapsibleContent>
            )}
          </Collapsible>
        );
      }

      return (
        <Button
          key={item.href}
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start text-base px-3",
            isActive && "bg-primary/10 text-primary font-semibold",
            isSubItem && "text-sm h-9",
            !shouldShowLabels && "justify-center px-0"
          )}
          title={!shouldShowLabels ? item.label : undefined}
          onClick={() => isMobileView && setIsMobileSheetOpen(false)}
        >
          <Link href={item.href}>
            <span className={cn(
              "flex items-center w-full",
              shouldShowLabels ? "gap-3" : ""
            )}>
              <Icon className={cn("h-5 w-5 shrink-0", !shouldShowLabels && "h-6 w-6", isSubItem && "h-4 w-4")} />
              {(shouldShowLabels || (isSubItem && shouldShowLabels)) && <span className="truncate">{item.label}</span>}
            </span>
          </Link>
        </Button>
      );
    });
  };

  const sidebarContent = (isMobileView = false) => {
    const shouldShowLabels = isSidebarExpanded || isMobileView;
    const allNavsForRole = getNavItemsForRole(user.role);
    const roleSpecificMainItems = allNavsForRole.filter(item => item.href !== '/profile' && item.href !== '/settings');
    const commonBottomItems = allNavsForRole.filter(item => item.href === '/profile' || item.href === '/settings');

    return (
      <>
        <div className={cn("p-4 border-b flex items-center", shouldShowLabels ? "justify-between" : "justify-center")}>
          {shouldShowLabels && (
            <Link href="/" className="flex items-center" aria-label="MyBase Home" onClick={() => isMobileView && setIsMobileSheetOpen(false)}>
              <Image src="/mybase-logo.png" alt="MyBase Logo" width={100} height={30} className="shrink-0" priority />
            </Link>
          )}
          {!isMobileView && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className={cn(shouldShowLabels ? "" : "mx-auto")}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <nav className={cn("grid items-start gap-1 p-2 text-sm font-medium", shouldShowLabels ? "px-4" : "px-2")}>
            {renderNavItems(roleSpecificMainItems, false, isMobileView)}

            {user.role === 'admin' && shouldShowLabels && (
              <Card className="my-2 mx-0 bg-card/50">
                <CardHeader className="p-3"><CardTitle className="text-base">Admin Tasks (Debug)</CardTitle></CardHeader>
                <CardContent className="p-3 pt-0 text-xs">
                  {isLoadingAdminTasks ? <p>Loading admin tasks...</p> : <p>Admin tasks placeholder.</p>}
                </CardContent>
              </Card>
            )}
            {/* Driver ToDo List Removed for debugging */}

            {(roleSpecificMainItems.length > 0) && commonBottomItems.length > 0 && shouldShowLabels && (
              <Separator className="my-2" />
            )}
            {renderNavItems(commonBottomItems, false, isMobileView)}
          </nav>
        </ScrollArea>
      </>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:justify-end">
        <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs p-0 flex flex-col">
            {sidebarContent(true)}
          </SheetContent>
        </Sheet>
        <div className="flex-1 md:grow-0"></div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
              <Avatar>
                <AvatarImage src={user?.avatarUrl || `https://placehold.co/32x32.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile" />
                <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/profile"><span className="flex items-center gap-2 w-full"><UserCircle className="h-4 w-4" /> Profile</span></Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/settings"><span className="flex items-center gap-2 w-full"><Settings className="h-4 w-4" /> Settings</span></Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive"><span className="flex items-center gap-2 w-full"><LogOut className="h-4 w-4" /> Logout</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className={cn("hidden md:flex flex-col border-r bg-card transition-all duration-300", isSidebarExpanded ? "w-64" : "w-16")}>
          {sidebarContent(false)}
        </aside>
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6">
           <div style={{ border: '3px dashed blue', padding: '10px', marginBlockEnd: '1rem', backgroundColor: 'rgba(0,0,255,0.05)' }}>
            <p style={{ color: 'blue', fontWeight: 'bold', fontSize: '10px' }}>
              DEBUG: AppLayout (BLUE BORDER) rendering children... User: {user?.email || 'None'}, Role: {user?.role || 'None'}. Pathname: {pathname}
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

