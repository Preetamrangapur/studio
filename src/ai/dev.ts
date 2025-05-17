
import { config } from 'dotenv';
config();

import '@/ai/flows/ai-assistant.ts';
import '@/ai/flows/analyze-uploaded-document.ts';
import '@/ai/flows/extract-structured-data-from-image.ts';
// No longer importing '@/ai/flows/transcribe-handwriting-flow.ts';

