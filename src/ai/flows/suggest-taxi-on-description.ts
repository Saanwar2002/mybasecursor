// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview AI agent that suggest taxis based on the user's description of their desired taxi and requirements.
 *
 * - suggestTaxiOnDescription - A function that handles the process of suggesting a taxi based on the description.
 * - SuggestTaxiOnDescriptionInput - The input type for the suggestTaxiOnDescription function.
 * - SuggestTaxiOnDescriptionOutput - The return type for the suggestTaxiOnDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTaxiOnDescriptionInputSchema = z.object({
  taxiDescription: z
    .string()
    .describe(
      'A description of the type of taxi the user wants and any specific requirements.'
    ),
});

export type SuggestTaxiOnDescriptionInput = z.infer<
  typeof SuggestTaxiOnDescriptionInputSchema
>;

const SuggestTaxiOnDescriptionOutputSchema = z.object({
  suggestedTaxi: z
    .string()
    .describe(
      'The suggested taxi that matches the user description and requirements.'
    ),
  reason: z.string().describe('The reason for suggesting this taxi.'),
});

export type SuggestTaxiOnDescriptionOutput = z.infer<
  typeof SuggestTaxiOnDescriptionOutputSchema
>;

export async function suggestTaxiOnDescription(
  input: SuggestTaxiOnDescriptionInput
): Promise<SuggestTaxiOnDescriptionOutput> {
  return suggestTaxiOnDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestTaxiOnDescriptionPrompt',
  input: {schema: SuggestTaxiOnDescriptionInputSchema},
  output: {schema: SuggestTaxiOnDescriptionOutputSchema},
  prompt: `You are a taxi suggestion expert. A user will provide a description of the type of taxi they want and any requirements they may have.  Based on that, you will suggest a taxi to the user, and provide a reason for the suggestion.

User description: {{{taxiDescription}}}`,
});

const suggestTaxiOnDescriptionFlow = ai.defineFlow(
  {
    name: 'suggestTaxiOnDescriptionFlow',
    inputSchema: SuggestTaxiOnDescriptionInputSchema,
    outputSchema: SuggestTaxiOnDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
