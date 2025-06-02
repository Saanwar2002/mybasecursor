
'use server';
/**
 * @fileOverview AI agent that parses a natural language booking request into structured data.
 *
 * - parseBookingRequest - A function that handles parsing the user's textual booking request.
 * - ParseBookingRequestInput - The input type for the parseBookingRequest function.
 * - ParseBookingRequestOutput - The return type for the parseBookingRequest function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const ParseBookingRequestInputSchema = z.object({
  userRequestText: z
    .string()
    .describe(
      "The natural language text input from the user describing their taxi booking needs."
    ),
});
export type ParseBookingRequestInput = z.infer<typeof ParseBookingRequestInputSchema>;

export const ParseBookingRequestOutputSchema = z.object({
  pickupAddress: z
    .string()
    .optional()
    .describe(
      "The full pickup address mentioned by the user. If not specified, this field should be omitted."
    ),
  dropoffAddress: z
    .string()
    .optional()
    .describe(
      "The full drop-off address mentioned by the user. If not specified, this field should be omitted."
    ),
  numberOfPassengers: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "The number of passengers for the ride. If not explicitly mentioned, try to infer it or default to 1 if no information is available."
    ),
  requestedTime: z
    .string()
    .optional()
    .describe(
      "The desired pickup time as described by the user (e.g., 'ASAP', 'tomorrow at 3 PM', 'next Friday morning', 'in about 20 minutes'). If not specified, this field should be omitted or set to 'ASAP' if implied."
    ),
  additionalNotes: z
    .string()
    .optional()
    .describe(
      "Any other relevant details, specific instructions, or special requests from the user's input, such as 'need space for luggage', 'specific route preference', or 'please ring the bell'."
    ),
});
export type ParseBookingRequestOutput = z.infer<typeof ParseBookingRequestOutputSchema>;

export async function parseBookingRequest(input: ParseBookingRequestInput): Promise<ParseBookingRequestOutput> {
  return parseBookingRequestFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseBookingRequestPrompt',
  input: {schema: ParseBookingRequestInputSchema},
  output: {schema: ParseBookingRequestOutputSchema},
  prompt: `You are an expert assistant for a taxi booking service. Your task is to parse the user's natural language request and extract key information for booking a taxi.

Carefully analyze the user's request provided below. Extract the pickup address, drop-off address, number of passengers, desired pickup time, and any additional notes or special instructions.

- For 'pickupAddress' and 'dropoffAddress', provide the full addresses as mentioned.
- For 'numberOfPassengers', if not specified, assume 1. It must be a positive integer.
- For 'requestedTime', capture phrases like 'ASAP', 'now', a specific date/time (e.g., 'tomorrow at 4pm', 'July 20th around 10 AM'), or relative times (e.g., 'in 30 minutes'). If not specified, assume 'ASAP'.
- For 'additionalNotes', include any other relevant details like luggage information, preferences, or specific instructions for the driver.

User Request:
{{{userRequestText}}}

Provide the extracted information in the structured format defined by the output schema. If a piece of information is not present in the user's request, omit that field in the output.
`,
});

const parseBookingRequestFlow = ai.defineFlow(
  {
    name: 'parseBookingRequestFlow',
    inputSchema: ParseBookingRequestInputSchema,
    outputSchema: ParseBookingRequestOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    
    // Post-processing: If LLM doesn't set passengers and it's a common case to default,
    // we can do it here, though the prompt asks LLM to default to 1.
    // This is an example if we wanted stricter client-side defaulting:
    // if (output && typeof output.numberOfPassengers === 'undefined') {
    //   output.numberOfPassengers = 1;
    // }
    // if (output && typeof output.requestedTime === 'undefined') {
    //    output.requestedTime = 'ASAP';
    // }
    return output!;
  }
);
