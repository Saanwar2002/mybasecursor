
'use server';
/**
 * @fileOverview An AI flow to suggest actionable to-do items for platform administrators
 * based on simulated current platform metrics and predefined development tasks.
 *
 * - getAdminActionItems - Simulates fetching or generating admin tasks based on system state.
 * - AdminActionItemsInput - Input type for the action items flow.
 * - AdminActionItemsOutput - Output type for the action items flow.
 * - ActionItem - Represents a single to-do item.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ActionItemSchema = z.object({
  id: z.string().describe("A unique identifier for the action item, e.g., 'review-op-apps'."),
  category: z.string().describe("The general category of the task, e.g., 'User Management', 'System Health', 'Post-Launch Roadmap', 'Operational Review'.."),
  label: z.string().describe("A concise description of the task to be done."),
  priority: z.enum(['high', 'medium', 'low']).describe("The priority of the task."),
  iconName: z.string().optional().describe("An optional Lucide icon name (e.g., 'Users', 'ShieldAlert', 'ClipboardList', 'ServerCog', 'Megaphone', 'MessageSquarePlus', 'BarChart3', 'Award', 'CreditCard', 'FileText', 'Workflow', 'Leaf', 'DatabaseBackup', 'Globe', 'Waypoints', 'Palette', 'Gavel', 'UserCheck', 'Lightbulb') relevant to the task. If unsure, omit.")
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
  actionItems: z.array(ActionItemSchema).describe("A list of suggested action items for the administrator."),
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
    You are an AI assistant for the TaxiNow platform administrator. Your role is to suggest a short list of 2 to 4 actionable operational to-do items based on the current platform status, AND to include standing Post-Launch Roadmap items.
    Prioritize operational tasks that seem most urgent or impactful.

    Current Platform Status (for operational tasks):
    - Pending Operator Approvals: {{{pendingOperatorApprovals}}}
    - Active System Alerts: {{{activeSystemAlerts}}}
    - Unresolved High-Priority Support Tickets: {{{unresolvedSupportTickets}}}
    - New Feature Feedback Items: {{{recentFeatureFeedbackCount}}}
    - Current Platform Load: {{{platformLoadPercentage}}}%

    Consider the following when generating operational tasks:
    - If pendingOperatorApprovals > 0, suggest reviewing them. This is usually 'high' priority if count > 3.
    - If activeSystemAlerts > 0, suggest investigating system alerts. Priority depends on the number (e.g., >1 is 'high').
    - If unresolvedSupportTickets > 0, suggest addressing support tickets. Priority 'high' if count > 5.
    - If recentFeatureFeedbackCount > 5, suggest reviewing feedback. Priority 'medium'.
    - If platformLoadPercentage > 80, suggest monitoring system performance. Priority 'high'.
    - If platformLoadPercentage > 60 but <=80, suggest checking performance logs. Priority 'medium'.
    - If all metrics are very low (e.g., 0 pending, 0 alerts, few tickets), suggest a proactive/strategic task like "Review platform security protocols" or "Brainstorm new feature ideas".

    For each task, provide:
    - id: a short, kebab-case unique identifier (e.g., 'review-ops', 'check-alerts').
    - category: A brief category (e.g., "Operator Management", "System Monitoring", "Support", "Feature Development", "Strategic Planning", "Post-Launch Roadmap").
    - label: A clear, concise action item (e.g., "Review 7 pending operator applications", "Investigate 2 critical system alerts").
    - priority: 'high', 'medium', or 'low'.
    - iconName: (Optional) Suggest a relevant Lucide icon name (e.g., Users, ShieldAlert, ClipboardList, ServerCog, Megaphone, MessageSquarePlus, BarChart3, Award, CreditCard, FileText, Workflow, Leaf, DatabaseBackup, Globe, Waypoints, Palette, Gavel, UserCheck, Lightbulb). If unsure, omit it.

    Additionally, ALWAYS include the following Post-Launch Roadmap items. These are standing tasks/reminders for future development and operational excellence:
    1.  id: 'post-live-monitoring-setup', category: 'Post-Launch Roadmap', label: 'Setup comprehensive server performance & error monitoring (e.g., Sentry, New Relic).', priority: 'high', iconName: 'ServerCog'
    2.  id: 'post-live-user-feedback-collection', category: 'Post-Launch Roadmap', label: 'Implement robust system for collecting & analyzing user feedback (passengers, drivers, operators).', priority: 'high', iconName: 'MessageSquarePlus'
    3.  id: 'post-live-marketing-campaign-1', category: 'Post-Launch Roadmap', label: 'Plan & execute initial post-launch marketing campaigns for user acquisition.', priority: 'high', iconName: 'Megaphone'
    4.  id: 'post-live-support-scalability-plan', category: 'Post-Launch Roadmap', label: 'Develop plan for scaling customer support operations based on user growth.', priority: 'medium', iconName: 'Users'
    5.  id: 'post-live-advanced-analytics-dev', category: 'Post-Launch Roadmap', label: 'Design & scope advanced analytics dashboards for admin & operators.', priority: 'medium', iconName: 'BarChart3'
    6.  id: 'post-live-driver-incentive-program', category: 'Post-Launch Roadmap', label: 'Develop and launch a driver incentive/rewards program.', priority: 'medium', iconName: 'Award'
    7.  id: 'post-live-payment-reconciliation-sop', category: 'Post-Launch Roadmap', label: 'Establish Standard Operating Procedures for payment reconciliation & dispute resolution.', priority: 'high', iconName: 'CreditCard'
    8.  id: 'post-live-security-audit-phase1', category: 'Post-Launch Roadmap', label: 'Conduct initial post-launch security audit and penetration testing.', priority: 'high', iconName: 'ShieldCheck'
    9.  id: 'post-live-localization-research', category: 'Post-Launch Roadmap', label: 'Research and plan for potential localization/internationalization efforts.', priority: 'low', iconName: 'Globe'
    10. id: 'post-live-api-third-party', category: 'Post-Launch Roadmap', label: 'Explore potential API integrations for third-party services (e.g., flight info, local events).', priority: 'low', iconName: 'Waypoints'
    11. id: 'post-live-op-agreement-refinement', category: 'Post-Launch Roadmap', label: 'Refine standard operator agreement templates based on initial operator feedback.', priority: 'medium', iconName: 'FileText'
    12. id: 'post-live-automated-onboarding', category: 'Post-Launch Roadmap', label: 'Scope feasibility of more automated driver/operator onboarding workflows.', priority: 'medium', iconName: 'Workflow'
    13. id: 'post-live-sustainability-initiatives', category: 'Post-Launch Roadmap', label: 'Investigate and plan for sustainability initiatives (e.g., EV incentives, carbon offset).', priority: 'low', iconName: 'Leaf'
    14. id: 'post-live-data-backup-dr-review', category: 'Post-Launch Roadmap', label: 'Review and test data backup and disaster recovery plans.', priority: 'high', iconName: 'DatabaseBackup'
    15. id: 'post-live-ui-ux-iteration', category: 'Post-Launch Roadmap', label: 'Establish iterative UI/UX improvement cycle based on analytics and user feedback.', priority: 'medium', iconName: 'Palette'
    16. id: 'post-live-legal-compliance-review', category: 'Post-Launch Roadmap', label: 'Schedule periodic legal & regulatory compliance reviews (GDPR, local taxi laws).', priority: 'high', iconName: 'Gavel'
    17. id: 'post-live-driver-engagement-program', category: 'Post-Launch Roadmap', label: 'Develop ongoing driver training & engagement programs for retention and quality.', priority: 'medium', iconName: 'UserCheck'
    18. id: 'post-live-new-revenue-streams', category: 'Post-Launch Roadmap', label: 'Explore new revenue streams or service tiers (e.g., premium rides, delivery partnerships).', priority: 'low', iconName: 'Lightbulb'
    
    Generate a list of 2-4 operational tasks based on the metrics, plus the Post-Launch Roadmap items mentioned above. Ensure the labels are actionable.
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
    return output || { actionItems: [] }; // Ensure a default empty array if AI returns nothing
  }
);

    
