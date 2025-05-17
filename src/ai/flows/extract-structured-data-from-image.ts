
'use server';

/**
 * @fileOverview Extracts structured data (multi-column table) and full text from an image using AI.
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
      "A photo of a document or object, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractStructuredDataFromImageInput = z.infer<typeof ExtractStructuredDataFromImageInputSchema>;

const ExtractedTableSchema = z.object({
  headers: z.array(z.string()).describe("An array of strings representing the column headers of the extracted table. Example: ['Name', 'Quantity', 'Price']. If no table is found or headers are not identifiable, this should be an empty array."),
  rows: z.array(z.array(z.string())).describe("An array of rows, where each row is an array of strings representing the cell values in the order of the headers. Example: [['Apple', '10', '1.00'], ['Banana', '5', '0.50']]. If no table is found, this should be an empty array.")
}).describe("The structured table data extracted from the image. If no table is found, an object with empty headers and rows should be returned.");

const ExtractStructuredDataFromImageOutputSchema = z.object({
  table: ExtractedTableSchema,
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

1.  **Structured Table**: Identify any tabular data in the image.
    *   Determine the column headers. These are the names of each column.
    *   Extract the data for each row under these headers. Each row should be an array of strings, with values corresponding to each header in order.
    *   Return this as an object with a 'headers' array (for column names) and a 'rows' array (where each sub-array is a row of cell values as strings).
    *   If no discernible table structure (with headers and rows) is present, return an object with an empty 'headers' array and an empty 'rows' array for the 'table' field.
    *   The number of items in each 'row' array MUST strictly match the number of items in the 'headers' array.

2.  **Full Text**: Extract all recognizable text from the image as a single block of text. If no text is found, this should be an empty string.

Image: {{media url=photoDataUri}}

Return BOTH the extracted table (following the 'headers' and 'rows' structure strictly) AND the full text according to the output schema.
Prioritize accuracy and structure for the table.
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
    // Ensure table is always an object, even if empty, to match schema
    if (!output!.table) {
        output!.table = { headers: [], rows: [] };
    } else {
        if (!output!.table.headers) output!.table.headers = [];
        if (!output!.table.rows) output!.table.rows = [];
    }
    return output!;
  }
);

