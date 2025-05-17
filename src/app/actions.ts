
// @ts-nocheck
// TODO: Remove @ts-nocheck and fix errors
"use server";

import { aiAssistant } from "@/ai/flows/ai-assistant";
import { analyzeUploadedDocument } from "@/ai/flows/analyze-uploaded-document";
import { extractStructuredDataFromImage, ExtractStructuredDataFromImageOutput } from "@/ai/flows/extract-structured-data-from-image";

export interface ActionResult {
  success: boolean;
  data?: any; // For text and document analysis, this can be string. For image, it's ExtractStructuredDataFromImageOutput
  error?: string;
  type?: 'text' | 'imageAnalysis' | 'documentAnalysis';
}

export async function handleTextQuery(query: string): Promise<ActionResult> {
  try {
    const result = await aiAssistant({ query });
    return { success: true, data: result.response, type: 'text' };
  } catch (error) {
    console.error("Error in handleTextQuery:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred with AI assistant." };
  }
}

export async function handleImageUpload(imageDataUri: string): Promise<ActionResult> {
  if (!imageDataUri || !imageDataUri.startsWith('data:image')) {
    return { success: false, error: "Invalid image data URI." };
  }
  try {
    // result will be of type ExtractStructuredDataFromImageOutput
    const result: ExtractStructuredDataFromImageOutput = await extractStructuredDataFromImage({ photoDataUri: imageDataUri });
    return { success: true, data: result, type: 'imageAnalysis' }; // Return the entire result object
  } catch (error) {
    console.error("Error in handleImageUpload:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to analyze image." };
  }
}

export async function handleDocumentUpload(documentDataUri: string): Promise<ActionResult> {
   if (!documentDataUri || !documentDataUri.startsWith('data:')) {
    return { success: false, error: "Invalid document data URI." };
  }
  try {
    const result = await analyzeUploadedDocument({ documentDataUri });
    return { success: true, data: result.analysisResult, type: 'documentAnalysis' };
  } catch (error)
 {
    console.error("Error in handleDocumentUpload:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to analyze document." };
  }
}

// Placeholder for voice processing if a specific AI flow is needed.
// For now, voice input will be transcribed to text and can use handleTextQuery.
export async function handleVoiceData( /* voiceData: any */ ): Promise<ActionResult> {
  // This would call a specific AI flow for voice if available.
  // For example, if voice needs to be structured differently than plain text.
  return { success: false, error: "Voice processing flow not implemented yet." };
}

