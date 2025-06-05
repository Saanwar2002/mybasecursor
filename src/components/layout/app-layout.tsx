
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Car, LogOut, Menu, Settings, UserCircle, ChevronDown, ChevronUp, ListChecks, CheckCircle } from 'lucide-react';
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

interface TaskItem {
  id: string;
  label: string;
  completed: boolean;
}

interface TaskSubCategory {
  id: string;
  name: string;
  tasks: TaskItem[];
}

interface TaskCategory {
  id: string;
  name: string;
  subCategories?: TaskSubCategory[];
  tasks?: TaskItem[];
}

// Moved from admin/page.tsx
const initialAdminToDoData: TaskCategory[] = [
  {
    id: 'admin_cat1',
    name: 'Platform Configuration',
    tasks: [
      { id: 'admin_t1', label: 'Review & Approve new Operator Applications (3)', completed: false },
      { id: 'admin_t2', label: 'Set global commission rates for Q3', completed: true },
      { id: 'admin_t2a', label: 'Update Terms of Service link', completed: false },
    ]
  },
  {
    id: 'admin_cat2',
    name: 'User Management',
    subCategories: [
      {
        id: 'admin_sc1',
        name: 'High-Priority Flags',
        tasks: [
          { id: 'admin_t3', label: 'Investigate user report #1023 (Driver related)', completed: false },
          { id: 'admin_t4', label: 'Verify ID for Admin candidate (John K.)', completed: false },
        ]
      },
      {
        id: 'admin_sc2',
        name: 'Account Reviews',
        tasks: [
          { id: 'admin_t5', label: 'Audit suspicious login attempts (Last 7 days)', completed: false },
          { id: 'admin_t5a', label: 'Process data deletion request (User ID: xyz789)', completed: false },
        ]
      }
    ]
  },
  {
    id: 'admin_cat3',
    name: 'System Health & Marketing',
    tasks: [
        { id: 'admin_t6', label: 'Check server performance logs', completed: true },
        { id: 'admin_t7', label: 'Plan next promotional campaign', completed: false },
        { id: 'admin_t8', label: 'Review API integration for payment gateway', completed: false },
    ]
  }
];


export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
  const [adminToDoList, setAdminToDoList] = useState<TaskCategory[]>(initialAdminToDoData);

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
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary hover:bg-primary/10 w-full cursor-pointer",
                  (pathname.startsWith(item.href) && item.href !== '/') || item.subItems.some(sub => pathname.startsWith(sub.href)) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary hover:bg-primary/10 ${
                      pathname === subItem.href || (pathname.startsWith(subItem.href) && subItem.href !== '/') ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary hover:bg-primary/10 ${
                pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/') ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
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
              <CardTitle className="text-base font-headline flex items-center gap-2 text-sidebar-accent-foreground/90">
                <ListChecks className="w-5 h-5" /> Admin To-Do
              </CardTitle>
              <CardDescription className="text-xs text-sidebar-accent-foreground/70">Key administrative tasks.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-60 overflow-y-auto"> {/* Added max-h and overflow for long lists */}
              <Accordion type="multiple" className="w-full text-xs">
                {adminToDoList.map((category) => (
                  <AccordionItem value={category.id} key={category.id} className="border-sidebar-border last:border-b-0">
                    <AccordionTrigger className="text-xs hover:no-underline font-semibold px-3 py-2 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground">
                      {category.name}
                    </AccordionTrigger>
                    <AccordionContent className="bg-sidebar-background/50"> {/* Slightly different background for content */}
                      {category.tasks && category.tasks.length > 0 && (
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
                                className={`text-xs ${task.completed ? 'line-through text-sidebar-foreground/50' : 'text-sidebar-foreground/70'}`}
                              >
                                {task.label}
                              </Label>
                            </li>
                          ))}
                        </ul>
                      )}
                      {category.subCategories && category.subCategories.length > 0 && (
                        <Accordion type="multiple" className="w-full pl-3">
                          {category.subCategories.map(subCat => (
                            <AccordionItem value={subCat.id} key={subCat.id} className="border-l-2 border-sidebar-primary/20 pl-2 my-0.5 rounded-r-md">
                              <AccordionTrigger className="text-xs hover:no-underline py-1.5 font-medium text-sidebar-foreground/80 hover:text-sidebar-accent-foreground">
                                {subCat.name}
                              </AccordionTrigger>
                              <AccordionContent className="bg-sidebar-background/30">
                                <ul className="space-y-1.5 p-3">
                                  {subCat.tasks.map(task => (
                                    <li key={task.id} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`sidebar-task-${task.id}`}
                                        checked={task.completed}
                                        onCheckedChange={() => toggleAdminTaskCompletion(task.id)}
                                        className="border-sidebar-primary data-[state=checked]:bg-sidebar-primary data-[state=checked]:text-sidebar-primary-foreground"
                                      />
                                      <Label
                                        htmlFor={`sidebar-task-${task.id}`}
                                        className={`text-xs ${task.completed ? 'line-through text-sidebar-foreground/50' : 'text-sidebar-foreground/70'}`}
                                      >
                                        {task.label}
                                      </Label>
                                    </li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                       {(!category.tasks || category.tasks.length === 0) && (!category.subCategories || category.subCategories.length === 0) && (
                          <p className="text-xs text-sidebar-foreground/50 pl-3 py-2">No tasks in this category.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {adminToDoList.length === 0 && (
                <p className="text-sidebar-foreground/50 text-xs text-center p-3">All tasks completed!</p>
              )}
            </CardContent>
             <CardFooter className="p-2 border-t border-sidebar-border">
                  <p className="text-xs text-sidebar-accent-foreground/60 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      Mock tasks for demo.
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
        <ScrollArea className="flex-1 py-4 px-2"> {/* Added px-2 for sidebar content padding */}
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
              <ScrollArea className="h-[calc(100vh-4rem)] py-4 px-2"> {/* Added px-2 */}
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
