
"use client";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Shield, Building, Users, BarChart3, Settings, ListChecks, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";

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

const initialToDoData: TaskCategory[] = [
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


export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [toDoList, setToDoList] = useState<TaskCategory[]>(initialToDoData);

  const toggleTaskCompletion = (taskId: string) => {
    setToDoList(prevList =>
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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Dashboard Content Column */}
      <div className="lg:w-2/3 space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-headline flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" /> Platform Administration
            </CardTitle>
            <CardDescription>Welcome, {user?.name || 'Administrator'}. Oversee and manage the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg">
              This is the central hub for managing platform operators, all users, viewing system-wide analytics,
              and configuring core platform settings.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Manage Operators"
            description="Approve new operators, view operator details, and manage their status on the platform."
            icon={Building}
            link="/admin/manage-operators"
            actionText="Go to Operator Management"
          />
          <FeatureCard
            title="Platform Users"
            description="Search and manage all user accounts across roles (passengers, drivers, operators, admins)."
            icon={Users}
            link="/admin/platform-users"
            actionText="View All Users"
            disabled={false}
          />
          <FeatureCard
            title="System Analytics"
            description="Access comprehensive analytics for the entire platform, including overall ride volume, revenue, and growth trends."
            icon={BarChart3}
            link="/admin/analytics"
            actionText="View Platform Analytics"
            disabled={false}
          />
          <FeatureCard
            title="Global Settings"
            description="Configure platform-wide settings, commission rates, and default policies."
            icon={Settings}
            link="/admin/global-settings"
            actionText="Configure Settings"
            disabled={false}
          />
        </div>
      </div>

      {/* "To Be Done" Side Panel Column */}
      <div className="lg:w-1/3 space-y-6">
        <Card className="shadow-lg sticky top-6"> {/* Adjusted top value */}
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-accent" /> Admin To-Do List
            </CardTitle>
            <CardDescription>Key tasks and reminders for platform administration.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {toDoList.map((category) => (
                <AccordionItem value={category.id} key={category.id}>
                  <AccordionTrigger className="text-base hover:no-underline font-semibold">
                    {category.name}
                  </AccordionTrigger>
                  <AccordionContent>
                    {category.tasks && category.tasks.length > 0 && (
                      <ul className="space-y-2 pl-2">
                        {category.tasks.map(task => (
                          <li key={task.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={task.id}
                              checked={task.completed}
                              onCheckedChange={() => toggleTaskCompletion(task.id)}
                            />
                            <Label
                              htmlFor={task.id}
                              className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                            >
                              {task.label}
                            </Label>
                          </li>
                        ))}
                      </ul>
                    )}
                    {category.subCategories && category.subCategories.length > 0 && (
                      <Accordion type="multiple" className="w-full pl-2">
                        {category.subCategories.map(subCat => (
                          <AccordionItem value={subCat.id} key={subCat.id} className="border-l-2 border-primary/20 pl-2 my-1 rounded-r-md">
                            <AccordionTrigger className="text-sm hover:no-underline py-2 font-medium">
                              {subCat.name}
                            </AccordionTrigger>
                            <AccordionContent>
                              <ul className="space-y-2 pl-2">
                                {subCat.tasks.map(task => (
                                  <li key={task.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={task.id}
                                      checked={task.completed}
                                      onCheckedChange={() => toggleTaskCompletion(task.id)}
                                    />
                                    <Label
                                      htmlFor={task.id}
                                      className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
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
                        <p className="text-xs text-muted-foreground pl-2 py-2">No tasks in this category.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {toDoList.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">All tasks completed!</p>
            )}
          </CardContent>
           <CardFooter className="border-t pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Stay organized with your admin tasks.
                </div>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  actionText: string;
  disabled?: boolean;
}

function FeatureCard({ title, description, icon: Icon, link, actionText, disabled }: FeatureCardProps) {
  return (
    <Card className={`hover:shadow-xl transition-shadow duration-300 ${disabled ? 'opacity-60' : ''}`}>
      <CardHeader className="items-center pb-4">
        <Icon className="w-10 h-10 text-accent mb-3" />
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground" asChild disabled={disabled}>
          <Link href={link}>{actionText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
