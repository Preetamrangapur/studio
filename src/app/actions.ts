
// @ts-nocheck
// TODO: Remove @ts-nocheck and fix errors
"use server";

import { aiAssistant } from "@/ai/flows/ai-assistant";
import { analyzeUploadedDocument } from "@/ai/flows/analyze-uploaded-document";
import { extractStructuredDataFromImage } from "@/ai/flows/extract-structured-data-from-image";
import { transcribeHandwriting } from "@/ai/flows/transcribe-handwriting-flow";

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  type?: 'text' | 'table' | 'imageAnalysis' | 'documentAnalysis' | 'handwritingTranscription';
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
    const result = await extractStructuredDataFromImage({ photoDataUri: imageDataUri });
    return { success: true, data: result.table, type: 'imageAnalysis' };
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

export async function handleHandwritingTranscription(imageDataUri: string): Promise<ActionResult> {
  if (!imageDataUri || !imageDataUri.startsWith('data:image')) {
    return { success: false, error: "Invalid image data URI for handwriting transcription." };
  }
  try {
    const result = await transcribeHandwriting({ photoDataUri: imageDataUri });
    return { success: true, data: result.transcribedText, type: 'handwritingTranscription' };
  } catch (error) {
    console.error("Error in handleHandwritingTranscription:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to transcribe handwriting from image." };
  }
}


// Placeholder for voice processing if a specific AI flow is needed.
// For now, voice input will be transcribed to text and can use handleTextQuery.
export async function handleVoiceData( /* voiceData: any */ ): Promise<ActionResult> {
  // This would call a specific AI flow for voice if available.
  // For example, if voice needs to be structured differently than plain text.
  return { success: false, error: "Voice processing flow not implemented yet." };
}
