
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Car, LogOut, Menu, Settings, UserCircle, ChevronDown, ChevronUp, ListChecks, CheckCircle, ShieldAlert, DatabaseZap, UserCog as UserCogIcon, Layers, Wrench, MessageSquareHeart, Palette, BrainCircuit, Activity, Users, Lightbulb, TrendingUp, Flag } from 'lucide-react';
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
import { getAdminActionItems, type AdminActionItemsInput, type ActionItem as AiActionItem } from '@/ai/flows/admin-action-items-flow';
import * as LucideIcons from 'lucide-react';


interface TaskItem {
  id: string;
  label: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
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

// Default icon for AI-generated tasks if no specific one is provided
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
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  const [adminToDoList, setAdminToDoList] = useState<TaskCategory[]>([]);
  const [isLoadingAdminTasks, setIsLoadingAdminTasks] = useState(false);

  const toggleAdminTaskCompletion = (taskId: string) => {
    setAdminToDoList(prevList =>
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

   useEffect(() => {
    if (user?.role === 'admin' && !loading) {
      const fetchAdminTasks = async () => {
        setIsLoadingAdminTasks(true);
        try {
          const mockInput: AdminActionItemsInput = {
            pendingOperatorApprovals: Math.floor(Math.random() * 10),
            activeSystemAlerts: Math.floor(Math.random() * 3),
            unresolvedSupportTickets: Math.floor(Math.random() * 15),
            recentFeatureFeedbackCount: Math.floor(Math.random() * 20),
            platformLoadPercentage: Math.floor(Math.random() * 101),
          };
          const output = await getAdminActionItems(mockInput);
          
          const aiTasksByCategory = output.actionItems.reduce((acc, item) => {
            const categoryName = item.category || "General Tasks";
            if (!acc[categoryName]) {
              const IconComponent = item.iconName && (LucideIcons as any)[item.iconName] ? (LucideIcons as any)[item.iconName] : DefaultAiTaskIcon;
              acc[categoryName] = {
                id: categoryName.toLowerCase().replace(/\s+/g, '-'),
                name: categoryName,
                icon: IconComponent,
                tasks: [],
              };
            }
            acc[categoryName].tasks.push({
              id: item.id,
              label: item.label,
              completed: false, 
              priority: item.priority,
            });
            return acc;
          }, {} as Record<string, TaskCategory>);
          
          setAdminToDoList(Object.values(aiTasksByCategory));
        } catch (error) {
          console.error("AppLayout: Failed to fetch or process admin action items. Full error object:", error);
          let errorMessage = "Could not load AI-suggested admin tasks.";
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
          // Check if error has network-related properties (like from a fetch response)
          if (error && typeof error === 'object') {
            if ('status' in error && 'statusText' in error) {
                 errorMessage += ` (Status: ${error.status} ${error.statusText})`;
            } else if ('message' in error && typeof error.message === 'string' && error.message.toLowerCase().includes('failed to fetch')) {
                // This is already a "Failed to fetch", make it more specific
                errorMessage = `Network error fetching AI tasks: ${error.message}`;
            }
          }
          
          setAdminToDoList([{ 
            id: 'ai-task-error', 
            name: "Task Loading Error", 
            icon: ShieldAlert, 
            tasks: [{id: 'err-detail', label: errorMessage, completed: false, priority: 'high'}] 
          }]);
        } finally {
          setIsLoadingAdminTasks(false);
        }
      };
      fetchAdminTasks();
    }
  }, [user, loading]);


  useEffect(() => {
    if (!loading && !user && !['/login', '/register', '/'].includes(pathname) && !pathname.startsWith('/_next/')) {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  useEffect(() => {
    if (user) {
      const navItems = getNavItemsForRole(user.role);
      const newOpenSubMenus: Record<string, boolean> = {};
      navItems.forEach(item => {
        if (item.subItems && item.subItems.some(subItem => pathname.startsWith(subItem.href))) {
          newOpenSubMenus[item.href] = true;
        }
      });
      setOpenSubMenus(newOpenSubMenus);
    }
  }, [pathname, user, loading]);


  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Skeleton className="h-8 w-32" />
          <div className="relative ml-auto flex-1 md:grow-0">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <div className="flex flex-1">
          <aside className="hidden md:block w-64 border-r bg-card p-4">
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          </aside>
          <main className="flex-1 p-6">
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navItems = getNavItemsForRole(user.role);

  const toggleSubMenu = (href: string) => {
    setOpenSubMenus(prev => ({ ...prev, [href]: !prev[href] }));
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      <nav className="grid gap-1 text-sm font-medium">
        {navItems.map((item) => 
          item.subItems && item.subItems.length > 0 ? (
            <Collapsible key={item.href} open={openSubMenus[item.href]} onOpenChange={() => toggleSubMenu(item.href)} className="w-full">
              <CollapsibleTrigger asChild>
                <div className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-all hover:text-sidebar-primary hover:bg-sidebar-primary/10 w-full cursor-pointer",
                  (pathname.startsWith(item.href) && item.href !== '/') || item.subItems.some(sub => pathname.startsWith(sub.href)) ? 'bg-sidebar-primary/10 text-sidebar-primary' : 'text-sidebar-foreground/80 hover:text-sidebar-primary'
                )}>
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  {openSubMenus[item.href] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-7 pt-1 space-y-1">
                {item.subItems.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-sidebar-primary hover:bg-sidebar-primary/10 ${
                      pathname === subItem.href || (pathname.startsWith(subItem.href) && subItem.href !== '/') ? 'bg-sidebar-primary/10 text-sidebar-primary' : 'text-sidebar-foreground/80 hover:text-sidebar-primary'
                    }`}
                    onClick={isMobile ? () => document.dispatchEvent(new CustomEvent('closeSheet')) : undefined}
                  >
                    <subItem.icon className="h-4 w-4" />
                    {subItem.label}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-sidebar-primary hover:bg-sidebar-primary/10 ${
                pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/') ? 'bg-sidebar-primary/10 text-sidebar-primary' : 'text-sidebar-foreground/80 hover:text-sidebar-primary'
              }`}
              onClick={isMobile ? () => document.dispatchEvent(new CustomEvent('closeSheet')) : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        )}
      </nav>

      {user.role === 'admin' && (
        <div className="mt-auto pt-4"> 
          <Card className="bg-sidebar-accent/10 border-sidebar-accent shadow-md">
            <CardHeader className="p-3">
              <CardTitle className="text-base font-headline flex items-center gap-2 text-sidebar-foreground">
                <ListChecks className="w-5 h-5" /> Admin Action Items
              </CardTitle>
              <CardDescription className="text-xs text-sidebar-foreground/80">AI Suggested Tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-72 overflow-y-auto">
              {isLoadingAdminTasks ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : adminToDoList.length === 0 && !isLoadingAdminTasks ? (
                 <p className="text-sidebar-foreground/50 text-xs text-center p-3">No specific action items from AI. System looks good!</p>
              ) : (
              <Accordion type="multiple" className="w-full text-xs">
                {adminToDoList.map((category) => (
                  <AccordionItem value={category.id} key={category.id} className="border-sidebar-border last:border-b-0">
                    <AccordionTrigger className="text-xs hover:no-underline font-semibold px-3 py-2 text-sidebar-foreground hover:text-sidebar-primary">
                      <div className="flex items-center gap-1.5">
                        {category.icon && <category.icon className="w-3.5 h-3.5" />}
                        {category.name}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-sidebar-background/50"> 
                      {category.tasks && category.tasks.length > 0 ? (
                        <ul className="space-y-1.5 p-3">
                          {category.tasks.map(task => (
                            <li key={task.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`sidebar-task-${task.id}`}
                                checked={task.completed}
                                onCheckedChange={() => toggleAdminTaskCompletion(task.id)}
                                className="border-sidebar-primary data-[state=checked]:bg-sidebar-primary data-[state=checked]:text-sidebar-primary-foreground"
                              />
                              <Label
                                htmlFor={`sidebar-task-${task.id}`}
                                className={cn(
                                  'text-xs cursor-pointer',
                                  task.completed ? 'line-through text-sidebar-foreground/50' : 'text-sidebar-foreground/90',
                                  mapPriorityToStyle(task.priority)
                                )}
                              >
                                {task.label}
                              </Label>
                            </li>
                          ))}
                        </ul>
                      ) : (
                         <p className="text-xs text-sidebar-foreground/50 pl-3 py-2">No tasks in this category.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              )}
            </CardContent>
             <CardFooter className="p-2 border-t border-sidebar-border">
                  <p className="text-xs text-sidebar-foreground/80 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      Tasks are AI-generated based on simulated metrics.
                  </p>
              </CardFooter>
          </Card>
        </div>
      )}
    </>
  );


  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground sm:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sidebar-primary">
            <Car className="h-6 w-6" />
            <span className="font-headline text-lg">Link Cabs</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 py-4 px-2"> 
          <SidebarContent />
        </ScrollArea>
      </aside>

      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs w-60 p-0 bg-sidebar text-sidebar-foreground" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-16 items-center border-b border-sidebar-border px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold text-sidebar-primary">
                  <Car className="h-6 w-6" />
                  <span className="font-headline text-lg">Link Cabs</span>
                </Link>
              </div>
              <ScrollArea className="h-[calc(100vh-4rem)] py-4 px-2"> 
                 <SidebarContent isMobile={true} />
              </ScrollArea>
            </SheetContent>
          </Sheet>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                <Avatar>
                  <AvatarImage src={`https://placehold.co/40x40.png?text=${user.name.charAt(0)}`} alt={user.name} data-ai-hint="avatar profile"/>
                  <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.name} ({user.role})</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile"><UserCircle className="mr-2 h-4 w-4" />Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 space-y-4">
          {children}
        </main>
      </div>
    </div>
  );
}
  
