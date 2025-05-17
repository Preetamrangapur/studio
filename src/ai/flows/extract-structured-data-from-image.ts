
'use server';

/**
 * @fileOverview Extracts structured data and full text from an image using AI.
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
  table: z.array(TableRowSchema).describe('Structured data extracted as a table with headings and values. This can be an empty array if no structured data is found.'),
  fullText: z.string().describe('A comprehensive extraction of all recognizable text from the image. This can be an empty string if no text is found.')
});
export type ExtractStructuredDataFromImageOutput = z.infer<typeof ExtractStructuredDataFromImageOutputSchema>;

export async function extractStructuredDataFromImage(input: ExtractStructuredDataFromImageInput): Promise<ExtractStructuredDataFromImageOutput> {
  return extractStructuredDataFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractStructuredDataFromImagePrompt',
  input: {schema: ExtractStructuredDataFromImageInputSchema},
  output: {schema: ExtractStructuredDataFromImageOutputSchema},
  prompt: `You are an expert data extraction specialist. Your task is to analyze the provided image and extract information in two ways:

1.  **Structured Data**: Identify distinct items that can be represented as key-value pairs or table rows. Present this as a table with 'heading' and 'value' columns. If no clear structured data is found, this table should be an empty array.
2.  **Full Text**: Extract all recognizable text from the image as a single block of text. This should be a comprehensive transcription of the image's textual content. If no text is found, this should be an empty string.

Image: {{media url=photoDataUri}}

Return both the structured table and the full text according to the output schema.
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

