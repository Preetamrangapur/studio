'use server';

/**
 * @fileOverview Extracts structured data from an image using OCR and AI.
 *
 * - extractStructuredDataFromImage - A function that handles the data extraction process.
 * - ExtractStructuredDataFromImageInput - The input type for the extractStructuredDataFromImage function.
 * - ExtractStructuredDataFromImageOutput - The return type for the extractStructuredDataFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractStructuredDataFromImageInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractStructuredDataFromImageInput = z.infer<typeof ExtractStructuredDataFromImageInputSchema>;

const TableRowSchema = z.object({
  heading: z.string().describe('The heading of the row.'),
  value: z.string().describe('The value associated with the heading.'),
});

const ExtractStructuredDataFromImageOutputSchema = z.object({
  table: z.array(TableRowSchema).describe('A table representing the structured data extracted from the image.'),
});
export type ExtractStructuredDataFromImageOutput = z.infer<typeof ExtractStructuredDataFromImageOutputSchema>;

export async function extractStructuredDataFromImage(input: ExtractStructuredDataFromImageInput): Promise<ExtractStructuredDataFromImageOutput> {
  return extractStructuredDataFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractStructuredDataFromImagePrompt',
  input: {schema: ExtractStructuredDataFromImageInputSchema},
  output: {schema: ExtractStructuredDataFromImageOutputSchema},
  prompt: `You are an expert data extraction specialist. Your task is to analyze the image and extract structured information from it.

  Identify key headings and their corresponding values within the image. Present the extracted data in a table format where each row consists of a heading and its associated value.

  Image: {{media url=photoDataUri}}
  `,
});

const extractStructuredDataFromImageFlow = ai.defineFlow(
  {
    name: 'extractStructuredDataFromImageFlow',
    inputSchema: ExtractStructuredDataFromImageInputSchema,
    outputSchema: ExtractStructuredDataFromImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
