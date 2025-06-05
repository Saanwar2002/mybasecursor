
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-taxi-on-description.ts';
import '@/ai/flows/parse-booking-request-flow.ts';
import '@/ai/flows/system-diagnostic-flow.ts';
import '@/ai/flows/admin-action-items-flow.ts'; // Added this line
    