
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, Menu, Settings, UserCircle, ChevronDown, ChevronUp, ListChecks, CheckCircle, ShieldAlert, DatabaseZap, UserCog as UserCogIcon, Layers, Wrench, MessageSquareHeart, Palette, BrainCircuit, Activity, Users, Lightbulb, TrendingUp, Flag, Briefcase } from 'lucide-react';
import { MyBaseLogoIcon } from '@/components/icons/my-base-logo-icon';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getNavItemsForRole, NavItem } from './sidebar-nav-items';
import { Skeleton } from '../ui/skeleton';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
// import { getAdminActionItems, type AdminActionItemsInput, type ActionItem as AiActionItem } from '@/ai/flows/admin-action-items-flow';
// import * as LucideIcons from 'lucide-react';

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

// const DefaultAiTaskIcon = Lightbulb;

// const mapPriorityToStyle = (priority?: 'high' | 'medium' | 'low') => {
//   switch (priority) {
//     case 'high': return 'font-bold text-destructive';
//     case 'medium': return 'font-semibold text-orange-600 dark:text-orange-400';
//     default: return '';
//   }
// };


export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  // const [adminToDoList, setAdminToDoList] = useState<TaskCategory[]>([]);
  // const [isLoadingAdminTasks, setIsLoadingAdminTasks] = useState(false);
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

  /*
  useEffect(() => {
    if (user?.role === 'admin') {
      setIsLoadingAdminTasks(true);
      const mockAdminInput: AdminActionItemsInput = {
        pendingOperatorApprovals: Math.floor(Math.random() * 10),
        activeSystemAlerts: Math.floor(Math.random() * 3),
        unresolvedSupportTickets: Math.floor(Math.random() * 15),
        recentFeatureFeedbackCount: Math.floor(Math.random() * 20),
        platformLoadPercentage: Math.floor(Math.random() * 100),
      };
      getAdminActionItems(mockAdminInput)
        .then(output => {
          const groupedTasks: Record<string, TaskItem[]> = {};
          output.actionItems.forEach(item => {
            const category = item.category || 'General';
            if (!groupedTasks[category]) {
              groupedTasks[category] = [];
            }
            groupedTasks[category].push({
              id: item.id,
              label: item.label,
              completed: false, 
              priority: item.priority,
              iconName: item.iconName,
              category: item.category
            });
          });
          
          const taskCategories: TaskCategory[] = Object.entries(groupedTasks).map(([catName, tasks]) => ({
            id: catName.toLowerCase().replace(/\s+/g, '-'),
            name: catName,
            icon: tasks[0]?.iconName ? (LucideIcons[tasks[0].iconName as keyof typeof LucideIcons] as React.ElementType || DefaultAiTaskIcon) : DefaultAiTaskIcon,
            tasks: tasks,
          }));
          setAdminToDoList(taskCategories);
        })
        .catch(err => {
          console.error("Error fetching admin AI tasks:", err);
           setAdminToDoList([{ id: 'error', name: "AI Tasks Error", tasks: [{id: 'err-1', label: "Could not load AI tasks.", completed: false, priority: 'high'}]}]);
        })
        .finally(() => setIsLoadingAdminTasks(false));
    }
  }, [user?.role]); // eslint-disable-next-line react-hooks/exhaustive-deps
  */


  if (loading) {
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
    console.warn("AppLayout: User is null after loading state. AuthProvider should have redirected. Returning null.");
    return null;
  }

  const navItems = getNavItemsForRole(user.role);
  const toggleSubMenu = (label: string) => setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }));

  const renderNavItems = (items: NavItem[], isSubItem = false, isMobileView = false) => {
    return items.map((item) => {
      const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
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
          onClick={() => isMobileSheetOpen && setIsMobileSheetOpen(false)}
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
    return (
      <>
        <div className={cn("p-4 border-b flex items-center", shouldShowLabels ? "justify-between" : "justify-center")}>
          {shouldShowLabels && (
            <Link href="/" className="flex items-center" aria-label="MyBase Home">
              <MyBaseLogoIcon className="h-10 w-28 md:w-32 shrink-0" />
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
            {renderNavItems(navItems, false, isMobileView)}
          </nav>
        </ScrollArea>
        {/* 
        {user.role === 'admin' && shouldShowLabels && (
          <Card className="m-2 bg-card/50">
            <CardHeader className="p-3">
              <CardTitle className="text-base font-headline flex items-center gap-1.5">
                <DatabaseZap className="w-5 h-5 text-accent" /> Admin To-Do
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 max-h-60 overflow-y-auto text-xs">
              {isLoadingAdminTasks ? <Skeleton className="h-20 w-full" /> :
              adminToDoList.length > 0 ? (
                  <Accordion type="multiple" className="w-full">
                    {adminToDoList.map((category) => (
                      <AccordionItem value={category.id} key={category.id} className="border-b-0">
                        <AccordionTrigger className="text-xs hover:no-underline font-medium py-1.5">
                          <span className="flex items-center gap-1.5">
                            {category.icon ? <category.icon className="w-3.5 h-3.5 text-muted-foreground" /> : <DefaultAiTaskIcon className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span>{category.name} ({category.tasks?.length || 0})</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pb-1">
                          {category.tasks && category.tasks.length > 0 && (
                            <ul className="space-y-1 pl-1">
                              {category.tasks.map(task => (
                                <li key={task.id} className="flex items-center space-x-1.5">
                                  <Checkbox id={`admin-task-${task.id}`} checked={task.completed} onCheckedChange={() => {}} className="w-3.5 h-3.5" />
                                  <Label htmlFor={`admin-task-${task.id}`} className={cn("text-xs cursor-pointer", mapPriorityToStyle(task.priority), task.completed && "line-through text-muted-foreground/70")}>
                                    <span>{task.label}</span>
                                  </Label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (<p className="text-muted-foreground text-center">No urgent admin tasks from AI.</p>)
              }
            </CardContent>
          </Card>
        )}
        */}
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
                <AvatarImage src={user?.avatarUrl || `https://placehold.co/32x32.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile small" />
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
            <DropdownMenuItem asChild><Link href="/profile"><UserCircle className="mr-2" /> Profile</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2" /> Settings</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-1">
        <aside className={cn("hidden md:flex flex-col border-r bg-card transition-all duration-300", isSidebarExpanded ? "w-64" : "w-16")}>
          {sidebarContent(false)}
        </aside>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 space-y-4 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
    
