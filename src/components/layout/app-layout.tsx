
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Added Image import
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
import { getAdminActionItems, type AdminActionItemsInput } from '@/ai/flows/admin-action-items-flow';
import type { ActionItem as AiActionItem } from '@/ai/flows/admin-action-items-flow';
import * as LucideIcons from 'lucide-react';
import { Separator } from '@/components/ui/separator';


interface TaskItem {
  id: string;
  label: string;
  completed: boolean; // For checkbox state
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

const initialDriverToDoData: TaskCategory[] = [
  {
    id: 'cat1',
    name: 'Vehicle Maintenance Checks',
    icon: Wrench,
    tasks: [
      { id: 't1', label: 'Check Tire Pressure (Weekly)', completed: true, priority: 'medium' },
      { id: 't2', label: 'Top Up Windscreen Washer Fluid', completed: true },
      { id: 't2a', label: 'Inspect Wiper Blades', completed: true, priority: 'low' },
    ]
  },
  {
    id: 'cat2',
    name: 'Driver Documentation',
    icon: UserCogIcon,
    subCategories: [
      {
        id: 'sc1',
        name: 'License & Permits',
        tasks: [
          { id: 't3', label: 'Driving License Renewal (Due: Jan 2025)', completed: true, priority: 'high' },
          { id: 't4', label: 'Taxi Permit Check (Due: Mar 2025)', completed: true, priority: 'medium' },
        ]
      },
      {
        id: 'sc2',
        name: 'Insurance Policy',
        tasks: [
          { id: 't5', label: 'Vehicle Insurance Renewal (Due: Jun 2024)', completed: true, priority: 'high' },
          { id: 't5a', label: 'Public Liability Insurance (Due: Aug 2024)', completed: true, priority: 'medium' },
        ]
      }
    ]
  },
  {
    id: 'cat3',
    name: 'Account & Platform Setup',
    icon: Settings,
    tasks: [
        { id: 't6', label: 'Upload Updated Profile Picture', completed: true, priority: 'low' },
        { id: 't7', label: 'Link Bank Account for Payouts', completed: true },
        { id: 't8', label: 'Complete Platform Training Module', completed: true, priority: 'medium' },
    ]
  }
];


export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  const [adminToDoList, setAdminToDoList] = useState<TaskCategory[]>([]);
  const [isLoadingAdminTasks, setIsLoadingAdminTasks] = useState(false);

  const [driverToDoList, setDriverToDoList] = useState<TaskCategory[]>(initialDriverToDoData);

  const toggleDriverTaskCompletion = (taskId: string) => {
    setDriverToDoList(prevList =>
      prevList.map(category => ({
        ...category,
        tasks: category.tasks?.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        ),
        subCategories: category.subCategories?.map(subCategory => ({
          ...subCategory,
          tasks: subCategory.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        })),
      }))
    );
  };


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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);


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

  const navItemsForRole = getNavItemsForRole(user.role);
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
          onClick={() => isMobileView && setIsMobileSheetOpen(false)} // Close sheet on mobile nav click
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
                <CardHeader className="p-3">
                  <CardTitle className="text-base font-headline flex items-center gap-1.5">
                    <DatabaseZap className="w-5 h-5 text-accent" /> Admin To-Do
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 max-h-60 overflow-y-auto text-xs">
                  {isLoadingAdminTasks ? <Skeleton className="h-20 w-full" /> :
                  adminToDoList.length > 0 ? ( <Accordion type="multiple" className="w-full">
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
                                    <Checkbox id={`admin-task-${task.id}`} checked={task.completed} onCheckedChange={() => {
                                        setAdminToDoList(prev => prev.map(cat => ({
                                            ...cat,
                                            tasks: cat.tasks?.map(t => t.id === task.id ? {...t, completed: !t.completed} : t)
                                        })));
                                    }} className="w-3.5 h-3.5" />
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
                  ) : (<p className="text-muted-foreground text-center text-xs py-2">No urgent admin tasks from AI.</p>)
                }
                </CardContent>
              </Card>
            )}
            {user.role === 'driver' && shouldShowLabels && (
              <Card className="my-2 mx-0 bg-card/50">
                <CardHeader className="p-3">
                  <CardTitle className="text-base font-headline flex items-center gap-1.5">
                    <ListChecks className="w-5 h-5 text-accent" /> Driver To-Do
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 max-h-60 overflow-y-auto text-xs">
                  {driverToDoList.length > 0 ? (  <Accordion type="multiple" className="w-full" defaultValue={driverToDoList.map(c => c.id)}>
                      {driverToDoList.map((category) => (
                        <AccordionItem value={category.id} key={category.id} className="border-b-0">
                          <AccordionTrigger className="text-xs hover:no-underline font-medium py-1.5">
                            <span className="flex items-center gap-1.5">
                              {category.icon ? <category.icon className="w-3.5 h-3.5 text-muted-foreground" /> : <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />}
                              <span>{category.name}</span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-1">
                            {category.tasks && category.tasks.length > 0 && (
                              <ul className="space-y-1 pl-1">
                                {category.tasks.map(task => (
                                  <li key={task.id} className="flex items-center space-x-1.5">
                                    <Checkbox id={`driver-task-${task.id}`} checked={task.completed} onCheckedChange={() => toggleDriverTaskCompletion(task.id)} className="w-3.5 h-3.5" />
                                    <Label htmlFor={`driver-task-${task.id}`} className={cn("text-xs cursor-pointer", mapPriorityToStyle(task.priority), task.completed && "line-through text-muted-foreground/70")}>
                                      {task.label}
                                    </Label>
                                  </li>
                                ))}
                              </ul>
                            )}
                             {category.subCategories && category.subCategories.map(subCat => (
                              <Accordion key={subCat.id} type="single" collapsible className="w-full pl-1 my-0.5">
                                  <AccordionItem value={subCat.id} className="border-l-2 border-primary/20 pl-1.5 rounded-r-md">
                                      <AccordionTrigger className="text-xs hover:no-underline py-1 font-normal">
                                          {subCat.name}
                                      </AccordionTrigger>
                                      <AccordionContent className="pb-1">
                                          <ul className="space-y-1 pl-1.5">
                                              {subCat.tasks.map(task => (
                                                  <li key={task.id} className="flex items-center space-x-1.5">
                                                      <Checkbox id={`driver-task-${task.id}`} checked={task.completed} onCheckedChange={() => toggleDriverTaskCompletion(task.id)} className="w-3.5 h-3.5"/>
                                                      <Label htmlFor={`driver-task-${task.id}`} className={cn("text-xs cursor-pointer", mapPriorityToStyle(task.priority), task.completed && "line-through text-muted-foreground/70")}>
                                                          {task.label}
                                                      </Label>
                                                  </li>
                                              ))}
                                          </ul>
                                      </AccordionContent>
                                  </AccordionItem>
                              </Accordion>
                             ))}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (<p className="text-muted-foreground text-center text-xs py-2">No tasks for you currently.</p>) }
                </CardContent>
                <CardFooter className="border-t pt-2 pb-2 p-3 text-xs text-muted-foreground">
                  Document and maintenance reminders.
                </CardFooter>
              </Card>
            )}

            {(roleSpecificMainItems.length > 0 || (user.role === 'admin' && shouldShowLabels) || (user.role === 'driver' && shouldShowLabels)) && commonBottomItems.length > 0 && shouldShowLabels && (
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
                <AvatarImage src={user?.avatarUrl || `https://placehold.co/32x32.png?text=${user.name.charAt(0)}`} alt={user.name} />
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
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <span className="flex items-center gap-2 w-full">
                  <UserCircle className="h-4 w-4" /> Profile
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <span className="flex items-center gap-2 w-full">
                  <Settings className="h-4 w-4" /> Settings
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
               <span className="flex items-center gap-2 w-full">
                <LogOut className="h-4 w-4" /> Logout
               </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-1 overflow-hidden"> {/* Added overflow-hidden here */}
        <aside className={cn("hidden md:flex flex-col border-r bg-card transition-all duration-300", isSidebarExpanded ? "w-64" : "w-16")}>
          {sidebarContent(false)}
        </aside>
        {/* Changed main tag for AppLayout */}
        <main className="flex-1 flex flex-col overflow-hidden"> {/* Removed padding and space-y, added flex flex-col */}
          {children}
        </main>
      </div>
    </div>
  );
}

