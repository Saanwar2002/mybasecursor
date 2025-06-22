import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({ apiKey: "AIzaSyCsTVFOf6adEJR-JxxNCTZtFwiGlxq_p44" })],
  model: 'googleai/gemini-2.0-flash',
});
