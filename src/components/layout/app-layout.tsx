
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Car, LogOut, Menu, Settings, UserCircle, ChevronDown, ChevronUp, ListChecks, CheckCircle, ShieldAlert, DatabaseZap, UserCog as UserCogIcon, Layers, Wrench, MessageSquareHeart, Palette, Server, Lock, Mail, PhoneCall, CreditCard, LineChart, FileText, MessageSquare, Construction, Route, Bell } from 'lucide-react';
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
  icon?: React.ElementType;
  subCategories?: TaskSubCategory[];
  tasks?: TaskItem[];
}

const initialAdminToDoData: TaskCategory[] = [
  {
    id: 'security_auth',
    name: 'Security & Authentication',
    icon: Lock,
    tasks: [
      { id: 'sec_admin_api', label: 'Secure all Admin API endpoints (RBAC)', completed: false },
      { id: 'sec_operator_api', label: 'Secure Operator-specific API endpoints', completed: false },
      { id: 'sec_op_pwd_flow', label: 'Implement robust new operator password setup/reset flow', completed: false },
      { id: 'sec_email_verify', label: 'Add Email Verification for new accounts (all roles)', completed: false },
      { id: 'sec_pin_login', label: 'Secure PIN Login feature (replace localStorage mock)', completed: false },
      { id: 'sec_csrf_xss', label: 'Review and implement CSRF, XSS protections', completed: false },
      { id: 'sec_phone_verify_backend', label: 'Implement backend logic for phone number verification process', completed: false },
    ]
  },
  {
    id: 'backend_core',
    name: 'Core Backend Systems',
    icon: Server,
    subCategories: [
      {
        id: 'be_db_api',
        name: 'Database & APIs',
        tasks: [
          { id: 'be_indexes', label: 'Create/Verify all necessary Firestore indexes for queries', completed: false },
          { id: 'be_error_reporting', label: 'Implement robust server-side error logging/reporting (e.g., Sentry)', completed: false },
          { id: 'be_analytics_real', label: 'Replace mock data in all Analytics APIs (Admin & Operator) with real Firestore queries', completed: false },
        ]
      },
      {
        id: 'be_ride_system',
        name: 'Ride & Booking System',
        tasks: [
          { id: 'be_driver_location', label: 'Implement real-time driver location updates & storage', completed: false },
          { id: 'be_ride_dispatch', label: 'Develop real-time ride offer dispatch system to drivers', completed: false },
          { id: 'be_driver_assign', label: 'Implement actual driver assignment logic for operators', completed: false },
          { id: 'be_ride_rating', label: 'Implement backend for ride rating system (Passenger & Driver)', completed: false },
          { id: 'be_promo_codes', label: 'Store and manage promo codes effectively in backend', completed: false },
          { id: 'be_fare_recalc', label: 'Handle fare recalculation if booking details are changed by passenger/operator', completed: false },
          { id: 'be_cancel_reasons_op', label: 'Backend for ride cancellation by operators (with reasons)', completed: false },
        ]
      },
      {
        id: 'be_communication_sys',
        name: 'Communication Services',
        tasks: [
          { id: 'be_chat_realtime', label: 'Implement backend for real-time Chat functionality', completed: false },
          { id: 'be_sms_email_integration', label: 'Integrate real SMS/Email services (e.g., Twilio, SendGrid)', completed: false },
        ]
      },
      {
        id: 'be_payments',
        name: 'Payment Processing',
        tasks: [
          { id: 'be_stripe_integration', label: 'Implement actual Payment Processing (e.g., Stripe)', completed: false },
          { id: 'be_payout_drivers', label: 'Develop system for driver payouts/settlements', completed: false },
        ]
      }
    ]
  },
  {
    id: 'admin_panel',
    name: 'Admin Panel Features',
    icon: UserCogIcon,
    subCategories: [
      {
        id: 'admin_op_manage',
        name: 'Operator Management',
        tasks: [
          { id: 'admin_op_edit', label: 'Implement "Edit Operator" details functionality', completed: false },
          { id: 'admin_op_suspend_reason_clear', label: 'Ensure suspension reason is stored and cleared on activation for operators', completed: false },
        ]
      },
      {
        id: 'admin_user_manage',
        name: 'Platform User Management',
        tasks: [
          { id: 'admin_user_edit', label: 'Enable "Edit User Details" for all roles', completed: false },
          { id: 'admin_user_history', label: 'Implement "View Detailed User Activity/History"', completed: false },
          { id: 'admin_driver_suspend_reason_clear', label: 'Ensure suspension reason is stored and cleared on activation for drivers (via admin)', completed: false },
        ]
      },
      {
        id: 'admin_global_settings',
        name: 'Global Settings',
        tasks: [
          { id: 'admin_settings_ui', label: 'Add UI for more global settings (API Keys, Feature Toggles, Currency etc.)', completed: false },
          { id: 'admin_settings_commission_override', label: 'Allow operator-specific commission rate overrides', completed: false },
        ]
      }
    ]
  },
  {
    id: 'operator_panel',
    name: 'Operator Panel Features',
    icon: Layers,
    subCategories: [
        {
            id: 'op_driver_manage',
            name: 'Driver Management',
            tasks: [
                 { id: 'op_driver_add_api', label: 'Connect "Add New Driver" (by Operator) to a real API endpoint', completed: false },
                 { id: 'op_driver_edit', label: 'Implement "Edit Driver" details for Operators', completed: false },
                 { id: 'op_driver_approve', label: 'Allow operators to approve/reject drivers *they* added (if status=Pending Approval)', completed: false },
                 { id: 'op_driver_suspend_reason_clear', label: 'Ensure suspension reason is stored and cleared on activation for drivers (via operator)', completed: false },
            ]
        },
        {
            id: 'op_ride_manage',
            name: 'Ride Management',
            tasks: [
                { id: 'op_ride_view_details', label: 'Enable "View Details" for rides in Operator Panel', completed: false },
                { id: 'op_ride_edit', label: 'Implement "Edit Ride" for operators (if allowed, with rules)', completed: false },
                { id: 'op_ride_cancel', label: 'Implement "Cancel Ride" by operator (with reasons)', completed: false },
            ]
        },
        {
            id: 'op_communications',
            name: 'Communications',
            tasks: [
                { id: 'op_comms_backend', label: 'Connect Operator Communications UI to real messaging backend', completed: false },
            ]
        },
        {
            id: 'op_analytics',
            name: 'Analytics',
            tasks: [
                { id: 'op_analytics_real', label: 'Populate Operator Analytics with real data queries', completed: false },
            ]
        }
    ]
  },
  {
    id: 'driver_panel',
    name: 'Driver Panel Features',
    icon: Car,
    tasks: [
      { id: 'driver_earnings_real', label: 'Replace mock earnings data with actual calculations', completed: false },
      { id: 'driver_ride_history_real', label: 'Fetch and display actual ride history for drivers', completed: false },
      { id: 'driver_chat_real', label: 'Connect Driver Chat UI to real-time backend', completed: false },
      { id: 'driver_ratings_real', label: 'Implement submission of passenger ratings by driver', completed: false },
    ]
  },
  {
    id: 'passenger_dashboard',
    name: 'Passenger Dashboard Features',
    icon: UserCircle,
    tasks: [
      { id: 'pass_myrides_rating_save', label: 'Store and retrieve actual ride ratings submitted by passengers', completed: false },
      { id: 'pass_profile_save', label: 'Implement backend for saving passenger profile field changes', completed: false },
      { id: 'pass_track_ride_real', label: 'Use real driver location for passenger ride tracking', completed: false },
      { id: 'pass_chat_real', label: 'Connect Passenger Chat UI to real-time backend', completed: false },
      { id: 'pass_payment_methods_ui', label: 'Implement UI for adding/managing payment methods (Stripe)', completed: false },
    ]
  },
  {
    id: 'general_ux_quality',
    name: 'General & UI/UX Quality',
    icon: Wrench,
    tasks: [
      { id: 'gen_phone_verify_flow', label: 'Implement full phone number verification flow for all relevant user roles', completed: false },
      { id: 'gen_ui_testing', label: 'Conduct comprehensive UI testing & bug fixing across all roles and devices', completed: false },
      { id: 'gen_accessibility', label: 'Accessibility (ARIA attributes) review & improvements', completed: false },
      { id: 'gen_x_browser_test', label: 'Cross-browser compatibility testing', completed: false },
      { id: 'gen_placeholder_images', label: 'Replace all placeholder images with a real image solution or more specific placeholders', completed: false },
      { id: 'gen_i18n_l10n', label: 'Plan and implement Internationalization (i18n) & Localization (L10n) if needed', completed: false },
      { id: 'gen_loading_states', label: 'Implement consistent loading states and optimistic updates across the app', completed: false },
      { id: 'gen_form_validation', label: 'Refine form validations and error messages for clarity and UX', completed: false },
      { id: 'gen_push_notifications', label: 'Implement push notifications for ride updates, chat, etc.', completed: false },
      { id: 'gen_map_interactions', label: 'Enhance map interactions (e.g., route display, dynamic marker updates)', completed: false },
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
                <ListChecks className="w-5 h-5" /> Admin To-Do
              </CardTitle>
              <CardDescription className="text-xs text-sidebar-foreground/80">Key platform development tasks.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-60 overflow-y-auto">
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
                                className={`text-xs ${task.completed ? 'line-through text-sidebar-foreground/50' : 'text-sidebar-foreground/90'}`}
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
                              <AccordionTrigger className="text-xs hover:no-underline py-1.5 font-medium text-sidebar-foreground hover:text-sidebar-primary">
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
                                        className={`text-xs ${task.completed ? 'line-through text-sidebar-foreground/50' : 'text-sidebar-foreground/90'}`}
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
                  <p className="text-xs text-sidebar-foreground/80 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      Tasks reflect development priorities.
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

    
