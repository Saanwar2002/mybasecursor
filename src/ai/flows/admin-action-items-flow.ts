
'use server';
/**
 * @fileOverview An AI flow to suggest actionable to-do items for platform administrators
 * based on simulated current platform metrics.
 *
 * - getAdminActionItems - Fetches or generates admin tasks based on system state.
 * - AdminActionItemsInput - Input type for the action items flow.
 * - AdminActionItemsOutput - Output type for the action items flow.
 * - ActionItem - Represents a single to-do item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ActionItemSchema = z.object({
  id: z.string().describe("A unique identifier for the action item, e.g., 'review-op-apps'."),
  category: z.string().describe("The general category of the task, e.g., 'User Management', 'System Health', 'Support Queue', 'Performance Monitoring', 'Strategic Review'."),
  label: z.string().describe("A concise description of the task to be done."),
  priority: z.enum(['high', 'medium', 'low']).describe("The priority of the task."),
  iconName: z.string().optional().describe("An optional Lucide icon name (e.g., 'Users', 'ShieldAlert', 'ClipboardList', 'ServerCog', 'Lightbulb', 'MessageSquarePlus', 'BarChart3') relevant to the task. If unsure, omit.")
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

const AdminActionItemsInputSchema = z.object({
  pendingOperatorApprovals: z.number().int().min(0).describe("Number of taxi base operator accounts awaiting admin approval."),
  activeSystemAlerts: z.number().int().min(0).describe("Number of active critical or high-priority system alerts (e.g., from AI System Health)."),
  unresolvedSupportTickets: z.number().int().min(0).describe("Number of unresolved high-priority support tickets."),
  recentFeatureFeedbackCount: z.number().int().min(0).describe("Number of new feedback items on recently launched features."),
  platformLoadPercentage: z.number().min(0).max(100).describe("Current overall platform load or stress level as a percentage (0-100)."),
});
export type AdminActionItemsInput = z.infer<typeof AdminActionItemsInputSchema>;

const AdminActionItemsOutputSchema = z.object({
  actionItems: z.array(ActionItemSchema).describe("A list of 2 to 4 suggested operational action items for the administrator."),
});
export type AdminActionItemsOutput = z.infer<typeof AdminActionItemsOutputSchema>;

export async function getAdminActionItems(input: AdminActionItemsInput): Promise<AdminActionItemsOutput> {
  return getAdminActionItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adminActionItemsPrompt',
  input: { schema: AdminActionItemsInputSchema },
  output: { schema: AdminActionItemsOutputSchema },
  prompt: `
    You are an AI assistant for the TaxiNow platform administrator. Your role is to suggest a short list of 2 to 4 actionable operational to-do items based on the current platform status.
    Prioritize tasks that seem most urgent or impactful.

    Current Platform Status:
    - Pending Operator Approvals: {{{pendingOperatorApprovals}}}
    - Active System Alerts: {{{activeSystemAlerts}}}
    - Unresolved High-Priority Support Tickets: {{{unresolvedSupportTickets}}}
    - New Feature Feedback Items: {{{recentFeatureFeedbackCount}}}
    - Current Platform Load: {{{platformLoadPercentage}}}%

    Consider the following when generating tasks:
    - If pendingOperatorApprovals > 0, suggest reviewing them. This is 'high' priority if count > 3. (iconName: 'Users')
    - If activeSystemAlerts > 0, suggest investigating system alerts. Priority depends on the number (e.g., >1 is 'high'). (iconName: 'ShieldAlert')
    - If unresolvedSupportTickets > 0, suggest addressing support tickets. Priority 'high' if count > 5. (iconName: 'ClipboardList')
    - If recentFeatureFeedbackCount > 5, suggest reviewing feedback. Priority 'medium'. (iconName: 'MessageSquarePlus')
    - If platformLoadPercentage > 80, suggest monitoring system performance. Priority 'high'. (iconName: 'ServerCog')
    - If platformLoadPercentage > 60 but <=80, suggest checking performance logs. Priority 'medium'. (iconName: 'BarChart3')
    - If all metrics are very low (e.g., 0 pending, 0 alerts, few tickets), suggest a proactive/strategic task such as "Review platform security protocols" (category: 'Strategic Review', iconName: 'ShieldCheck') or "Brainstorm new feature ideas for passenger engagement" (category: 'Feature Development', iconName: 'Lightbulb').

    For each task, provide:
    - id: a short, kebab-case unique identifier (e.g., 'review-ops', 'check-alerts').
    - category: A brief category (e.g., "Operator Management", "System Monitoring", "Support", "Feature Development", "Strategic Planning").
    - label: A clear, concise action item (e.g., "Review 7 pending operator applications", "Investigate 2 critical system alerts").
    - priority: 'high', 'medium', or 'low'.
    - iconName: (Optional) Suggest a relevant Lucide icon name from the examples given or others like 'Users', 'ShieldAlert', 'ClipboardList', 'ServerCog', 'MessageSquarePlus', 'BarChart3', 'Lightbulb', 'ShieldCheck'. If unsure, omit it.

    Generate a list of 2-4 operational tasks based on the metrics. Ensure the labels are actionable.
    Do NOT include any "Post-Launch Roadmap" items from previous instructions. Focus only on the current operational status or general strategic items if operations are quiet.
  `,
});

const getAdminActionItemsFlow = ai.defineFlow(
  {
    name: 'getAdminActionItemsFlow',
    inputSchema: AdminActionItemsInputSchema,
    outputSchema: AdminActionItemsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    // Ensure a default empty array if AI returns nothing or an unexpected structure.
    // The output schema should enforce the array, but this is a safeguard.
    return output || { actionItems: [] }; 
  }
);

