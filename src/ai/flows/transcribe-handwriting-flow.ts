
'use server';
/**
 * @fileOverview Transcribes handwritten text from an image.
 *
 * - transcribeHandwriting - A function that handles the handwriting transcription.
 * - TranscribeHandwritingInput - The input type for the transcribeHandwriting function.
 * - TranscribeHandwritingOutput - The return type for the transcribeHandwriting function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeHandwritingInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo containing handwritten text, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeHandwritingInput = z.infer<typeof TranscribeHandwritingInputSchema>;

const TranscribeHandwritingOutputSchema = z.object({
  transcribedText: z.string().describe('The transcribed handwritten text from the image.'),
});
export type TranscribeHandwritingOutput = z.infer<typeof TranscribeHandwritingOutputSchema>;

export async function transcribeHandwriting(input: TranscribeHandwritingInput): Promise<TranscribeHandwritingOutput> {
  return transcribeHandwritingFlow(input);
}

const transcribeHandwritingPrompt = ai.definePrompt({
  name: 'transcribeHandwritingPrompt',
  input: {schema: TranscribeHandwritingInputSchema},
  output: {schema: TranscribeHandwritingOutputSchema},
  prompt: `You are an expert OCR tool. Analyze the provided image and transcribe all handwritten text accurately.
If the image contains mixed handwritten and printed text, prioritize transcribing the handwritten portions.
Output only the transcribed text.

Image: {{media url=photoDataUri}}`,
});

const transcribeHandwritingFlow = ai.defineFlow(
  {
    name: 'transcribeHandwritingFlow',
    inputSchema: TranscribeHandwritingInputSchema,
    outputSchema: TranscribeHandwritingOutputSchema,
  },
  async input => {
    const {output} = await transcribeHandwritingPrompt(input);
    return output!;
  }
);
