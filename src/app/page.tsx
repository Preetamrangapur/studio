// @ts-nocheck
// TODO: Remove @ts-nocheck and fix errors
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Camera,
  Search,
  RefreshCw,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { handleTextQuery, handleImageUpload, handleDocumentUpload, ActionResult } from './actions';
import type { ExtractStructuredDataFromImageOutput } from "@/ai/flows/extract-structured-data-from-image";
import type { AnalyzeUploadedDocumentOutput } from "@/ai/flows/analyze-uploaded-document";
import DataTable from '@/components/DataTable';

type OutputType = 'text' | 'imageAnalysis' | 'documentAnalysis' | 'imagePreview' | 'error';
interface OutputData {
  type: OutputType;
  content: any; // Can be string, ExtractStructuredDataFromImageOutput, AnalyzeUploadedDocumentOutput, etc.
  previewUrl?: string; // For image previews
}

export default function DataCapturePage() {
  const { toast } = useToast();

  const [history, setHistory] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [outputData, setOutputData] = useState<OutputData | null>(null);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addToHistory = (item: string) => {
    setHistory(prev => [item, ...prev.slice(0, 4)]);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const loaderKey = fileType === 'image' ? 'imageUpload' : 'documentUpload';
    setIsLoading(prev => ({ ...prev, [loaderKey]: true }));
    setOutputData(null); 

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      let result: ActionResult;

      if (fileType === 'image') {
        addToHistory(`Uploaded image: ${file.name}`);
        setOutputData({ type: 'imagePreview', content: null, previewUrl: dataUri });
        setIsLoading(prev => ({ ...prev, [loaderKey]: false }));
        return; 
      } else {
        addToHistory(`Uploaded document: ${file.name}`);
        result = await handleDocumentUpload(dataUri);
      }

      if (result.success) {
        setOutputData({ type: result.type as OutputType, content: result.data });
        toast({ title: `${fileType === 'document' ? "Document" : "Item"} Processed`, description: `${fileType === 'document' ? "Document" : "Item"} analysis complete.` });
      } else {
        setOutputData({ type: 'error', content: result.error });
        toast({ variant: "destructive", title: "Processing Error", description: result.error });
      }
      setIsLoading(prev => ({ ...prev, [loaderKey]: false }));
    };
    reader.readAsDataURL(file);
    event.target.value = ""; 
  };

  const handleImageAnalysis = async () => {
    if (!outputData?.previewUrl) return;
    setIsLoading(prev => ({ ...prev, imageAnalysis: true }));
    
    addToHistory('Extracting data from image.');
    const result = await handleImageUpload(outputData.previewUrl);
    if (result.success) {
      setOutputData({ type: 'imageAnalysis', content: result.data as ExtractStructuredDataFromImageOutput, previewUrl: outputData.previewUrl });
      toast({ title: "Image Analyzed", description: "Data extraction complete." });
    } else {
      setOutputData({ type: 'error', content: result.error, previewUrl: outputData.previewUrl });
      toast({ variant: "destructive", title: "Image Analysis Error", description: result.error });
    }
    setIsLoading(prev => ({ ...prev, imageAnalysis: false }));
  };
  

  const handleSearch = async () => {
    if (!inputValue.trim()) return;
    setIsLoading(prev => ({ ...prev, search: true }));
    setOutputData(null);
    addToHistory(`Search: ${inputValue}`);

    const result = await handleTextQuery(inputValue);
    if (result.success) {
      setOutputData({ type: 'text', content: result.data });
    } else {
      setOutputData({ type: 'error', content: result.error });
      toast({ variant: "destructive", title: "Search Error", description: result.error });
    }
    setInputValue("");
    setIsLoading(prev => ({ ...prev, search: false }));
  };
  
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition API is not supported in this browser.');
      toast({ variant: "destructive", title: "Unsupported Feature", description: "Speech recognition is not supported in this browser." });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = false; 
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      setOutputData({ type: 'text', content: 'Listening...' });
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript.trim();
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setOutputData({ type: 'text', content: interimTranscript || finalTranscript || 'Listening...' });
      if (finalTranscript) {
        setInputValue(finalTranscript); 
        recognition.stop(); 
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
       if (outputData?.content === 'Listening...') {
         setOutputData(null);
       }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setOutputData({ type: 'error', content: `Speech recognition error: ${event.error}` });
      toast({ variant: "destructive", title: "Speech Error", description: `Error: ${event.error}` });
      setIsRecording(false);
    };
     return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [outputData?.content, toast]);


  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsCameraActive(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      } catch (err) {
        console.error('Error accessing camera:', err);
        toast({ variant: "destructive", title: "Camera Error", description: "Could not access camera." });
      }
    }
  };

  const takePhoto = async () => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/png');
      
      setIsLoading(prev => ({ ...prev, imageCapture: true })); 
      setOutputData({ type: 'imagePreview', content: null, previewUrl: dataUri });
      addToHistory('Captured photo from camera.');
      setIsLoading(prev => ({ ...prev, imageCapture: false }));
    }
  };
  
  const refreshPage = () => window.location.reload();

  const renderOutput = () => {
    if (!outputData) return null;

    const showImageActions = outputData.previewUrl && (outputData.type === 'imagePreview' || outputData.type === 'imageAnalysis' || (outputData.type === 'error' && outputData.previewUrl));

    return (
      <>
        {outputData.previewUrl && (
          <div className="mb-4">
            <p className="font-semibold mb-2">
              {outputData.type === 'imagePreview' && !isLoading.imageAnalysis ? "Preview:" : 
               outputData.type === 'imageAnalysis' ? "Analyzed Image:" :
               isLoading.imageAnalysis ? "Analyzing for structured data. Analyzing for full data." :
               "Image:"
              }
            </p>
            <Image src={outputData.previewUrl} alt="Uploaded/Captured preview" width={300} height={200} className="rounded-md border" data-ai-hint="document user content" />
          </div>
        )}

        {showImageActions && (
          <div className="flex gap-2 mb-4">
            <Button onClick={handleImageAnalysis} disabled={isLoading.imageAnalysis}>
              {isLoading.imageAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Extract Table Data
            </Button>
          </div>
        )}

        {(() => {
          switch (outputData.type) {
            case 'text':
              return <p className="text-foreground whitespace-pre-wrap">{outputData.content}</p>;
            case 'imageAnalysis':
              const analysisData = outputData.content as ExtractStructuredDataFromImageOutput;
              const hasTableData = analysisData.table && analysisData.table.length > 0;
              const hasFullText = analysisData.fullText && analysisData.fullText.trim() !== '';
              return (
                <div>
                  {hasTableData && (
                    <>
                      <h3 className="font-semibold mb-2 text-lg">Structured Data (Table Format)</h3>
                      <DataTable data={analysisData.table} />
                    </>
                  )}
                  {hasFullText && (
                    <>
                      <h3 className={`font-semibold mt-4 mb-2 text-lg ${hasTableData ? 'mt-6' : ''}`}>Full Extracted Text</h3>
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">{analysisData.fullText}</pre>
                    </>
                  )}
                  {!hasTableData && !hasFullText && (
                     <p className="text-muted-foreground">No data extracted from the image.</p>
                  )}
                </div>
              );
            case 'documentAnalysis':
              const docData = outputData.content as AnalyzeUploadedDocumentOutput;
              const hasDocTableData = docData.extractedTable && docData.extractedTable.length > 0;
              const hasDocSummary = docData.summary && docData.summary.trim() !== '';
              return (
                 <div>
                  {hasDocTableData && (
                    <>
                      <h3 className="font-semibold mb-2 text-lg">Extracted Document Table</h3>
                      <DataTable data={docData.extractedTable} />
                    </>
                  )}
                  {hasDocSummary && (
                    <>
                      <h3 className={`font-semibold mt-4 mb-2 text-lg ${hasDocTableData ? 'mt-6' : ''}`}>Document Summary</h3>
                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">{docData.summary}</pre>
                    </>
                  )}
                  {!hasDocTableData && !hasDocSummary && (
                     <p className="text-muted-foreground">No data or summary extracted from the document.</p>
                  )}
                 </div>
              );
            case 'imagePreview':
              if (isLoading.imageUpload || isLoading.imageCapture) {
                return <p>Processing image...</p>;
              }
              return <p className="text-muted-foreground">Image ready. Choose an action above.</p>;
            case 'error':
              return (
                <div className="flex items-center text-destructive">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  <p>{outputData.content}</p>
                </div>
              );
            default:
              return null;
          }
        })()}
      </>
    );
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center min-h-[calc(100vh-var(--navbar-height,4rem))]">
      <Card className="w-full max-w-3xl mb-6 shadow-lg">
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Your recent activities.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground">No activity yet.</p>
          ) : (
            <ScrollArea className="h-32">
              <ul className="space-y-1">
                {history.map((item, index) => (
                  <li key={index} className="text-sm text-muted-foreground truncate">{item}</li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-3xl mb-6 shadow-lg">
        <CardHeader>
            <CardTitle className="text-center">Data Capture Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => imageInputRef.current?.click()} disabled={isLoading.imageUpload || isLoading.imageCapture} className="flex-grow sm:flex-grow-0">
                {isLoading.imageUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload Image
                </Button>
                <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} accept="image/*" className="hidden" />

                <Button onClick={() => documentInputRef.current?.click()} disabled={isLoading.documentUpload} className="flex-grow sm:flex-grow-0">
                {isLoading.documentUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Upload Document
                </Button>
                <input type="file" ref={documentInputRef} onChange={(e) => handleFileChange(e, 'document')} accept=".pdf,.csv,.xls,.xlsx" className="hidden" />
                
                <Button onClick={toggleVoiceRecording} variant={isRecording ? "destructive" : "default"} disabled={!recognitionRef.current} className="flex-grow sm:flex-grow-0">
                {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {isRecording ? 'Stop Voice' : 'Start Voice'}
                </Button>

                <Button onClick={toggleCamera} variant={isCameraActive ? "destructive" : "default"} className="flex-grow sm:flex-grow-0">
                {isCameraActive ? <VideoOff className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />}
                {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                </Button>

                {isCameraActive && (
                <Button onClick={takePhoto} disabled={isLoading.imageCapture || isLoading.imageAnalysis} className="flex-grow sm:flex-grow-0">
                    {isLoading.imageCapture ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Take Photo
                </Button>
                )}
            </div>
            
            <div className="flex gap-2 items-center">
                <Input 
                type="text" 
                placeholder="Or, ask anything..." 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-grow"
                />
                <Button onClick={handleSearch} disabled={isLoading.search || !inputValue.trim()}>
                  {isLoading.search ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Search
                </Button>
            </div>
        </CardContent>
      </Card>

      {isCameraActive && (
        <div className="w-full max-w-md mb-6 rounded-lg overflow-hidden shadow-lg border border-border">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto aspect-video bg-muted" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
      
      {(outputData || isLoading.imageAnalysis || isLoading.documentUpload) && (
        <Card className="w-full max-w-3xl mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[40rem]">
             {renderOutput()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
      
      <Button onClick={refreshPage} variant="outline" className="mt-auto self-center">
        <RefreshCw className="mr-2 h-4 w-4" /> Refresh Page
      </Button>
    </div>
  );
}
