
'use server';

/**
 * @fileOverview Analyzes an uploaded document (PDF, Excel, or CSV) and extracts structured information into a multi-column table and full text content.
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
  fullText: z.string().describe('All text content extracted from the document. This can be an empty string if no text is found or if the document is purely image-based without OCR-able text.')
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
  prompt: `You are an expert data analyst and document processor. Your task is to analyze the provided document and extract information in two ways:

1.  **Structured Table**: If the document contains tabular data:
    *   Identify the column headers.
    *   Extract the data for each row under these headers.
    *   Return this as an object with a 'headers' array (for column names) and a 'rows' array (where each sub-array is a row of cell values as strings).
    *   The number of items in each 'row' array MUST strictly match the number of items in the 'headers' array.
    *   If no discernible table structure (with headers and rows) is present, return an object with an empty 'headers' array and an empty 'rows' array for the 'extractedTable' field.

2.  **Full Text**: Extract all recognizable text content from the document as a single block of text. If no text is found, or if the document is purely image-based without OCR-able text, this should be an empty string for the 'fullText' field.

Document: {{media url=documentDataUri}}

Return BOTH the extracted table (following the 'headers' and 'rows' structure strictly for the 'extractedTable' field) AND the full text content (for the 'fullText' field) according to the output schema.
Prioritize accuracy and structure for the table if one exists. If the document is primarily textual, focus on extracting the full text accurately.
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
    if (output!.fullText === undefined) {
        output!.fullText = "";
    }
    return output!;
  }
);

