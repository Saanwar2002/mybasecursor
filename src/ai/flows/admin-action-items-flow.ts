
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
  category: z.string().describe("The general category of the task, e.g., 'User Management', 'System Health', 'Development Roadmap'."),
  label: z.string().describe("A concise description of the task to be done."),
  priority: z.enum(['high', 'medium', 'low']).describe("The priority of the task."),
  iconName: z.string().optional().describe("An optional Lucide icon name (e.g., 'Users', 'ShieldAlert', 'ClipboardList', 'ServerCog', 'MailCheck', 'CreditCard', 'ShieldCheck', 'Wifi', 'Scale', 'Settings2', 'Route', 'Dog', 'Wheelchair', 'ClipboardCheck', 'DatabaseZap', 'Filter', 'MessageSquarePlus') relevant to the task. If unsure, omit.")
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
    You are an AI assistant for the TaxiNow platform administrator. Your role is to suggest a short list of 2 to 4 actionable operational to-do items based on the current platform status, AND to include standing development roadmap items.
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
    - category: A brief category (e.g., "Operator Management", "System Monitoring", "Support", "Feature Development", "Strategic Planning", "Development Roadmap").
    - label: A clear, concise action item (e.g., "Review 7 pending operator applications", "Investigate 2 critical system alerts").
    - priority: 'high', 'medium', or 'low'.
    - iconName: (Optional) Suggest a relevant Lucide icon name (e.g., Users, ShieldAlert, MessageSquare, Lightbulb, ClipboardList, ServerCog, MailCheck, CreditCard, ShieldCheck, Wifi, Scale, Settings2, Route, Dog, Wheelchair, ClipboardCheck, DatabaseZap, Filter, MessageSquarePlus). If unsure, omit it.

    Additionally, ALWAYS include the following Development Roadmap items. These are standing tasks/reminders for future development:
    1.  id: 'dev-task-scheduled-rides-ui', category: 'Development Roadmap', label: 'UI Complete: "Scheduled Rides" CRUD. Next: Backend logic for auto-booking.', priority: 'medium', iconName: 'ClipboardCheck'
    2.  id: 'dev-task-help-support-backend', category: 'Development Roadmap', label: 'Task: Implement backend for Help & Support (save tickets, notifications).', priority: 'high', iconName: 'DatabaseZap'
    3.  id: 'dev-task-help-support-ui-refine', category: 'Development Roadmap', label: 'Task: Refine Admin/Operator Support Ticket views (filtering, real data).', priority: 'medium', iconName: 'Filter'
    4.  id: 'dev-task-help-support-passenger-ui', category: 'Development Roadmap', label: 'Task: Design & Implement Passenger-side Help & Support submission UI.', priority: 'medium', iconName: 'MessageSquarePlus'
    5.  id: 'dev-reminder-backend-automation', category: 'Development Roadmap', label: 'Reminder: Server-side automation (Cloud Function/job) for scheduled bookings is a backend task.', priority: 'high', iconName: 'ServerCog'
    6.  id: 'dev-reminder-messaging-integration', category: 'Development Roadmap', label: 'Reminder: Integrate real SMS/Email services (e.g., Twilio, SendGrid) for communications.', priority: 'high', iconName: 'MailCheck'
    7.  id: 'dev-task-payment-gateway', category: 'Development Roadmap', label: 'Task: Implement real payment gateway (e.g., Stripe) for fare collection.', priority: 'high', iconName: 'CreditCard'
    8.  id: 'dev-task-driver-verification', category: 'Development Roadmap', label: 'Task: Design and implement a robust driver document verification workflow.', priority: 'high', iconName: 'ShieldCheck'
    9.  id: 'dev-reminder-realtime-tracking', category: 'Development Roadmap', label: 'Reminder: Full real-time ride tracking requires backend WebSocket/listener implementation.', priority: 'medium', iconName: 'Wifi'
    10. id: 'dev-task-fair-assignment', category: 'Development Roadmap', label: 'Design & Implement Fair Ride Assignment Algorithm (Backend Task - track driver session earnings & time).', priority: 'high', iconName: 'Scale'
    11. id: 'dev-task-operator-dispatch-mode', category: 'Development Roadmap', label: 'Develop Operator Setting for Manual/Auto Job Dispatch Mode.', priority: 'medium', iconName: 'Settings2'
    12. id: 'dev-reminder-backend-dispatch-logic', category: 'Development Roadmap', label: 'Implement Backend Logic for Operator-Chosen Dispatch Modes (Manual/Auto).', priority: 'high', iconName: 'Route'
    13. id: 'dev-task-pet-friendly-pref', category: 'Development Roadmap', label: 'Backend: Implement driver preference for Pet Friendly jobs (all applicable vehicle types) & update assignment logic.', priority: 'medium', iconName: 'Dog'
    14. id: 'dev-task-wheelchair-vehicle-tracking', category: 'Development Roadmap', label: 'Backend: Implement vehicle capability tracking for Wheelchair Accessible rides & update assignment logic.', priority: 'high', iconName: 'Wheelchair'

    Generate a list of 2-4 operational tasks based on the metrics, plus the development roadmap items mentioned above. Ensure the labels are actionable.
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
