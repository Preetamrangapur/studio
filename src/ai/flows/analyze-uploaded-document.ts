
'use server';

/**
 * @fileOverview Analyzes an uploaded document (PDF, Excel, or CSV) and extracts structured information into a multi-column table.
 *
 * - analyzeUploadedDocument - A function that handles the document analysis process.
 * - AnalyzeUploadedDocumentInput - The input type for the analyzeUploadedDocument function.
 * - AnalyzeUploadedDocumentOutput - The return type for the analyzeUploadedDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedDocumentInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "A document (PDF, Excel, or CSV) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeUploadedDocumentInput = z.infer<typeof AnalyzeUploadedDocumentInputSchema>;

const ExtractedTableSchema = z.object({
  headers: z.array(z.string()).describe("An array of strings representing the column headers of the extracted table from the document. Example: ['Order ID', 'Customer', 'Amount']. If no table is found or headers are not identifiable, this should be an empty array."),
  rows: z.array(z.array(z.string())).describe("An array of rows, where each row is an array of strings representing the cell values in the order of the headers. Example: [['101', 'John Doe', '25.50'], ['102', 'Jane Smith', '75.00']]. If no table is found, this should be an empty array.")
}).describe("The structured table data extracted from the document. If no table is found, an object with empty headers and rows should be returned.");


const AnalyzeUploadedDocumentOutputSchema = z.object({
  extractedTable: ExtractedTableSchema.describe("Structured data extracted from the document, presented as a table with headers and rows. If no structured table can be formed, return an object with empty headers and rows."),
});
export type AnalyzeUploadedDocumentOutput = z.infer<typeof AnalyzeUploadedDocumentOutputSchema>;

export async function analyzeUploadedDocument(
  input: AnalyzeUploadedDocumentInput
): Promise<AnalyzeUploadedDocumentOutput> {
  return analyzeUploadedDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeUploadedDocumentPrompt',
  input: {schema: AnalyzeUploadedDocumentInputSchema},
  output: {schema: AnalyzeUploadedDocumentOutputSchema},
  prompt: `You are an expert data analyst. Analyze the content of the uploaded document.

Your primary and only goal is to extract structured information and present it as a table with clear column headers and corresponding rows of data.
The table should be an object with a 'headers' array (for column names) and a 'rows' array (where each sub-array is a row of cell values as strings).
Populate the 'extractedTable' field in the output with this data.

*   Identify the column headers.
*   Extract the data for each row under these headers.
*   The number of items in each 'row' array MUST strictly match the number of items in the 'headers' array.

If the document does not contain clearly structured data suitable for such a table, return an object with an empty 'headers' array and an empty 'rows' array for 'extractedTable'.
Do NOT provide any summary or textual explanation outside of this structured table format.

Document: {{media url=documentDataUri}}

Return ONLY the extracted table according to the output schema (headers and rows).
`,
});

const analyzeUploadedDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedDocumentFlow',
    inputSchema: AnalyzeUploadedDocumentInputSchema,
    outputSchema: AnalyzeUploadedDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure extractedTable is always an object, even if empty, to match schema
    if (!output!.extractedTable) {
        output!.extractedTable = { headers: [], rows: [] };
    } else {
        if (!output!.extractedTable.headers) output!.extractedTable.headers = [];
        if (!output!.extractedTable.rows) output!.extractedTable.rows = [];
    }
    return output!;
  }
);
