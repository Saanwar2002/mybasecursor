
'use server';
/**
 * @fileOverview An AI flow to simulate system diagnostics.
 *
 * - runAiSystemDiagnostic - Simulates running diagnostics and returns issues and recommendations.
 * - SystemDiagnosticInput - Input type for the diagnostic flow.
 * - SystemDiagnosticOutput - Output type for the diagnostic flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DiagnosticFindingSchema = z.object({
  title: z.string().describe("A short title for the finding."),
  description: z.string().describe("A detailed description of the finding."),
  severity: z.enum(['critical', 'warning', 'info']).describe("The severity of the issue or importance of the recommendation."),
  category: z.string().describe("The category of the finding (e.g., 'Data Integrity', 'Performance', 'Security')."),
  details: z.any().optional().describe("Any specific data related to the finding, like affected IDs or metrics."),
  suggestedAction: z.string().optional().describe("A specific action to take for an issue."),
});
export type DiagnosticFinding = z.infer<typeof DiagnosticFindingSchema>;

const RecommendationSchema = z.object({
  title: z.string().describe("A short title for the recommendation."),
  description: z.string().describe("A detailed description of the recommendation."),
  priority: z.enum(['high', 'medium', 'low']).optional().describe("The priority of the recommendation."),
  category: z.string().describe("The category of the recommendation (e.g., 'Optimization', 'Maintenance', 'New Feature')."),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;


const SystemDiagnosticInputSchema = z.object({
  checkLevel: z.enum(['quick_simulated', 'deep_simulated']).describe("The level of diagnostic check to perform (simulated).")
});
export type SystemDiagnosticInput = z.infer<typeof SystemDiagnosticInputSchema>;

const SystemDiagnosticOutputSchema = z.object({
  overallHealthStatus: z.string().describe("A brief summary of the system's health, e.g., 'Healthy', 'Needs Attention', 'Critical Issues Found'."),
  summary: z.string().describe("A more detailed summary of the diagnostic findings."),
  issues: z.array(DiagnosticFindingSchema).describe("A list of potential issues found."),
  recommendations: z.array(RecommendationSchema).describe("A list of recommendations for system improvement or maintenance."),
  timestamp: z.string().datetime().describe("The ISO 8601 timestamp when the diagnostic was run."),
  aiModelUsed: z.string().describe("Identifier of the AI model used for this diagnostic (simulated)."),
});
export type SystemDiagnosticOutput = z.infer<typeof SystemDiagnosticOutputSchema>;


export async function runAiSystemDiagnostic(input: SystemDiagnosticInput): Promise<SystemDiagnosticOutput> {
  return systemDiagnosticFlow(input);
}

// This prompt is a placeholder for how you might instruct an LLM.
// In a real scenario, you would provide actual system data or logs as input.
const prompt = ai.definePrompt({
  name: 'systemDiagnosticPrompt',
  input: { schema: SystemDiagnosticInputSchema },
  output: { schema: SystemDiagnosticOutputSchema },
  prompt: `
    You are an AI System Health Analyzer for a taxi booking platform.
    Based on a simulated system scan (level: {{{checkLevel}}}), provide a diagnostic report.

    For this simulation, generate a plausible set of findings.
    If checkLevel is 'quick_simulated', generate 0-1 minor issues and 1-2 recommendations.
    If checkLevel is 'deep_simulated', generate 1-3 issues (mix of severities) and 2-4 recommendations.

    Example Issues:
    - Title: "Orphaned Driver Profiles"
      Description: "Found 3 driver profiles not linked to any active operator account."
      Severity: "warning"
      Category: "Data Integrity"
      Details: { affectedIds: ["driverX", "driverY", "driverZ"] }
      SuggestedAction: "Review orphaned profiles and either re-assign or archive them."
    - Title: "Slow API Response: /api/bookings/create"
      Description: "The average response time for the booking creation API endpoint has increased by 30% in the last 24 hours, now averaging 1.5s."
      Severity: "warning"
      Category: "Performance"
      Details: { endpoint: "/api/bookings/create", currentAvgMs: 1500, thresholdMs: 1000 }
      SuggestedAction: "Investigate backend logs and database queries for the /api/bookings/create endpoint."

    Example Recommendations:
    - Title: "Implement Database Index on Bookings by Status"
      Description: "Queries filtering bookings by 'status' are frequent. Adding a database index on the 'status' field in the 'bookings' collection could improve query performance."
      Priority: "high"
      Category: "Optimization"
    - Title: "Automated Log Archival"
      Description: "System logs are growing rapidly. Implement an automated archival process for logs older than 90 days to manage storage and improve log query performance."
      Priority: "medium"
      Category: "Maintenance"

    Ensure the output strictly adheres to the SystemDiagnosticOutputSchema.
    The current timestamp is ${new Date().toISOString()}.
    The AI model is 'simulated-diagnostic-v1'.
  `,
});

const systemDiagnosticFlow = ai.defineFlow(
  {
    name: 'systemDiagnosticFlow',
    inputSchema: SystemDiagnosticInputSchema,
    outputSchema: SystemDiagnosticOutputSchema,
  },
  async (input) => {
    // In a real flow, you'd fetch actual system data, logs, metrics, etc.
    // Then, you might preprocess it and pass it to the LLM.
    // For now, the prompt itself guides the LLM to generate simulated data.
    const { output } = await prompt(input);
    
    if (!output) {
      // Fallback mock data if LLM fails or returns nothing (should be rare with good prompting)
      console.warn("AI did not return output for system diagnostic, using fallback mock.");
      return {
        overallHealthStatus: "Fallback: Healthy (Simulated)",
        summary: "This is a fallback mock response because the AI model did not return data. It indicates the system is nominally healthy but with some standard recommendations.",
        issues: input.checkLevel === 'deep_simulated' ? [
          { title: "Mock Issue: High Login Failures", description: "Observed an unusual number of failed login attempts for passenger accounts in the last hour.", severity: "warning", category: "Security", details: { failedAttempts: 120, timeWindow: "1 hour" }, suggestedAction: "Monitor login activity and consider temporary lockout policies."}
        ] : [],
        recommendations: [
          { title: "Mock Rec: Regular Database Backups", description: "Ensure regular automated database backups are configured and tested.", priority: "high", category: "Maintenance"},
          { title: "Mock Rec: Review User Permissions", description: "Periodically review user role permissions to ensure least privilege access.", priority: "medium", category: "Security"}
        ],
        timestamp: new Date().toISOString(),
        aiModelUsed: "simulated-diagnostic-v1-fallback",
      };
    }
    return output;
  }
);
