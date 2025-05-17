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

const AnalyzeUploadedDocumentOutputSchema = z.object({
  analysisResult: z
    .string()
    .describe("The analysis result of the document, formatted as a table with headings and values."),
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
  prompt: `You are an expert data analyst. Analyze the content of the uploaded document and extract structured information, presenting it in a table format with headings and values.\n\nDocument: {{media url=documentDataUri}}\n\nPresent the analysis in a table format with 'Heading' and 'Value' columns.
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
