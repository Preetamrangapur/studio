'use server';

/**
 * @fileOverview Analyzes an uploaded document (PDF, Excel, or CSV) and extracts structured information.
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

const TableRowSchema = z.object({
  heading: z.string().describe('The heading of the row.'),
  value: z.string().describe('The value associated with the heading.'),
});

const AnalyzeUploadedDocumentOutputSchema = z.object({
  extractedTable: z.array(TableRowSchema).describe("Structured data extracted from the document, presented as an array of heading-value pairs. This can be an empty array if no structured data is found."),
  summary: z.string().optional().describe("A brief textual summary of the document's content if no structured table can be extracted or as a supplement.")
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

Your primary goal is to extract structured information and present it as a table.
The table should be an array of objects, where each object has a 'heading' and a 'value' property.
If you find structured data, populate the 'extractedTable' field in the output.

If the document does not contain clearly structured data suitable for a table, or if you can provide additional context, provide a textual summary in the 'summary' field.
If structured data is extracted, the summary can be brief or omitted.

Document: {{media url=documentDataUri}}

Return the extracted table and/or summary according to the output schema.
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
    return output!;
  }
);
