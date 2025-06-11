
"use client";

import { useState, useEffect } from 'react';
import type { ActionItem as AiActionItemType } from '@/ai/flows/admin-action-items-flow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import Link from 'next/link';

const DefaultAiTaskIcon = LucideIcons.ListChecks;

interface TaskItem extends AiActionItemType {
  completed: boolean;
}

interface ActionableCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  tasks: TaskItem[];
}

interface AdminActionItemsDisplayProps {
  items: AiActionItemType[];
  title?: string;
  description?: string;
}

const mapPriorityToStyle = (priority?: 'high' | 'medium' | 'low') => {
  switch (priority) {
    case 'high': return 'font-bold text-destructive';
    case 'medium': return 'font-semibold text-orange-600 dark:text-orange-400';
    default: return '';
  }
};

export function AdminActionItemsDisplay({
  items,
  title = "AI Generated Action Items",
  description = "Prioritized tasks and roadmap items suggested by AI."
}: AdminActionItemsDisplayProps) {
  const [categorizedTasks, setCategorizedTasks] = useState<ActionableCategory[]>([]);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  useEffect(() => {
    const groupedTasks: Record<string, TaskItem[]> = {};
    items.forEach(item => {
      const categoryName = item.category || 'General Tasks';
      if (!groupedTasks[categoryName]) {
        groupedTasks[categoryName] = [];
      }
      groupedTasks[categoryName].push({ ...item, completed: false });
    });

    const initialCategories = Object.entries(groupedTasks).map(([catName, tasks]) => {
        tasks.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const priorityA = a.priority ? priorityOrder[a.priority] : 3;
            const priorityB = b.priority ? priorityOrder[b.priority] : 3;
            return priorityA - priorityB;
        });

        return {
          id: catName.toLowerCase().replace(/\s+/g, '-'),
          name: catName,
          icon: tasks[0]?.iconName ? (LucideIcons[tasks[0].iconName as keyof typeof LucideIcons] as React.ElementType || DefaultAiTaskIcon) : DefaultAiTaskIcon,
          tasks: tasks,
        };
    });

    initialCategories.sort((a, b) => {
        if (a.name.includes('Operational') && !b.name.includes('Operational')) return -1;
        if (!a.name.includes('Operational') && b.name.includes('Operational')) return 1;
        if (a.name.includes('Post-Launch Roadmap') && !b.name.includes('Post-Launch Roadmap')) return -1;
        if (!a.name.includes('Post-Launch Roadmap') && b.name.includes('Post-Launch Roadmap')) return 1;
        return a.name.localeCompare(b.name);
    });

    setCategorizedTasks(initialCategories);
    const defaultOpen = initialCategories
        .filter(cat =>
            cat.tasks.some(task => task.priority === 'high' && !task.completed) ||
            cat.name.includes('Operational') ||
            cat.name.includes('Post-Launch Roadmap'))
        .map(cat => cat.id);
    setOpenAccordions(defaultOpen);

  }, [items]);

  const toggleTaskCompletion = (categoryId: string, taskId: string) => {
    setCategorizedTasks(prevCategories =>
      prevCategories.map(category =>
        category.id === categoryId
          ? {
              ...category,
              tasks: category.tasks.map(task =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
              ),
            }
          : category
      )
    );
  };

  const renderedContent = items.length === 0 ? (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">No action items generated at this time.</p>
      </CardContent>
    </Card>
  ) : (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-headline flex items-center gap-2">
          {categorizedTasks[0]?.icon ? <categorizedTasks[0].icon className="w-6 h-6 text-primary" /> : <DefaultAiTaskIcon className="w-6 h-6 text-primary" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" value={openAccordions} onValueChange={setOpenAccordions} className="w-full">
          {categorizedTasks.map((category) => {
            const CategoryIcon = category.icon || DefaultAiTaskIcon;
            const pendingTasksCount = category.tasks.filter(t => !t.completed).length;
            return (
              <AccordionItem value={category.id} key={category.id}>
                <AccordionTrigger className="text-base hover:no-underline font-semibold">
                  <span className="flex items-center gap-2">
                    <CategoryIcon className="w-5 h-5 text-muted-foreground" />
                    {category.name}
                    {pendingTasksCount > 0 && (
                        <Badge variant="secondary" className="ml-2">{pendingTasksCount} pending</Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {category.tasks.length > 0 ? (
                    <ul className="space-y-2.5 pl-2">
                      {category.tasks.map(task => {
                        const isReviewOpsTask = task.id === 'review-ops' || (task.category === 'Operator Management' && task.label.toLowerCase().includes('pending operator'));
                        const isSystemAlertsTask = task.id === 'check-alerts' || (task.category === 'System Monitoring' && task.label.toLowerCase().includes('system alert'));

                        return (
                          <li key={task.id} className="flex items-start space-x-2 p-1.5 rounded-md hover:bg-muted/50">
                            <Checkbox
                              id={`admin-task-${task.id}`}
                              checked={task.completed}
                              onCheckedChange={() => toggleTaskCompletion(category.id, task.id)}
                              className="mt-1 shrink-0"
                            />
                            <div className="flex-1">
                              {isReviewOpsTask ? (
                                <Link href="/admin/manage-operators?status=Pending%20Approval" className="hover:underline text-primary">
                                  <Label
                                    htmlFor={`admin-task-${task.id}`}
                                    className={cn(
                                      "text-sm cursor-pointer",
                                      mapPriorityToStyle(task.priority),
                                      task.completed && "line-through text-muted-foreground/70"
                                    )}
                                  >
                                    {task.label}
                                  </Label>
                                </Link>
                              ) : isSystemAlertsTask ? (
                                <Link href="/admin/ai-system-health" className="hover:underline text-primary">
                                  <Label
                                    htmlFor={`admin-task-${task.id}`}
                                    className={cn(
                                      "text-sm cursor-pointer",
                                      mapPriorityToStyle(task.priority),
                                      task.completed && "line-through text-muted-foreground/70"
                                    )}
                                  >
                                    {task.label}
                                  </Label>
                                </Link>
                              ) : (
                                <Label
                                  htmlFor={`admin-task-${task.id}`}
                                  className={cn(
                                    "text-sm cursor-pointer",
                                    mapPriorityToStyle(task.priority),
                                    task.completed && "line-through text-muted-foreground/70"
                                  )}
                                >
                                  {task.label}
                                </Label>
                              )}
                              {task.priority && !task.completed && (
                                <Badge variant={
                                  task.priority === 'high' ? 'destructive' :
                                  task.priority === 'medium' ? 'secondary' : 'outline'
                                } className="ml-2 text-xs capitalize py-0 px-1.5 h-5">
                                  {task.priority}
                                </Badge>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground pl-2 py-1">No tasks in this category.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );

  return renderedContent;
}
