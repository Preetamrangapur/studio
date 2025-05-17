
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
import { Skeleton } from "@/components/ui/skeleton";
import { handleTextQuery, handleImageUpload, handleDocumentUpload, ActionResult } from './actions';
import type { ExtractStructuredDataFromImageOutput } from "@/ai/flows/extract-structured-data-from-image";
import type { AnalyzeUploadedDocumentOutput } from "@/ai/flows/analyze-uploaded-document";
import DataTable from '@/components/DataTable';

type OutputType = 'text' | 'imageAnalysis' | 'documentAnalysis' | 'imagePreview' | 'error';
interface OutputData {
  type: OutputType;
  content: any; 
  previewUrl?: string; 
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
        setOutputData({ type: 'documentAnalysis', content: { extractedTable: { headers: [], rows: [] }, fullText: "" }, previewUrl: undefined });
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
    setOutputData(prev => ({ ...prev!, type: 'imageAnalysis', content: { table: { headers: [], rows: [] }, fullText: "" } })); 
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
    if (!outputData && !Object.values(isLoading).some(Boolean)) return null;

    const isLoadingAnalysis = isLoading.imageAnalysis;
    const isLoadingDoc = isLoading.documentUpload;

    if (outputData?.type === 'imageAnalysis' && outputData.previewUrl) {
      const analysisData = outputData.content as ExtractStructuredDataFromImageOutput | null; 
      const tableData = analysisData?.table;
      const hasTableData = !!(tableData && tableData.headers && tableData.headers.length > 0 && tableData.rows && tableData.rows.length > 0);
      const hasFullText = !!(analysisData?.fullText && analysisData.fullText.trim() !== '');

      return (
        <>
          <div className="flex flex-col md:flex-row md:gap-6 mb-4">
            <div className="md:w-1/3 mb-4 md:mb-0 flex flex-col items-center md:items-start">
              <p className="font-semibold mb-2 text-lg text-center md:text-left">
                {isLoadingAnalysis || !analysisData ? "Analyzing..." : "Analyzed Image"}
              </p>
              <Image src={outputData.previewUrl} alt="Analyzed preview" width={150} height={100} className="rounded-md border object-contain" data-ai-hint="document user content" />
            </div>

            <div className="md:w-2/3">
              <h3 className="font-semibold mb-2 text-lg">Structured Data (Table Format)</h3>
              {isLoadingAnalysis || !analysisData ? (
                  <div className="space-y-2">
                      <Skeleton className="h-8 w-1/3" />
                      <Skeleton className="h-20 w-full" />
                  </div>
              ) : hasTableData ? (
                <DataTable headers={tableData.headers} rows={tableData.rows} />
              ) : (
                <p className="text-muted-foreground">No structured table data extracted from the image.</p>
              )}
            </div>
          </div>

          {(isLoadingAnalysis || !analysisData) ? (
            <div className="mt-6 space-y-2">
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : hasFullText ? (
            <>
              <h3 className="font-semibold mt-6 mb-2 text-lg">Full Extracted Text</h3>
              <ScrollArea className="h-auto max-h-60">
                <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">{analysisData.fullText}</pre>
              </ScrollArea>
            </>
          ) : null}
          
          {!(isLoadingAnalysis || !analysisData) && !hasTableData && !hasFullText && (
             <p className="text-muted-foreground mt-4">No structured table or full text extracted from the image.</p>
          )}
        </>
      );
    }
    
    if (outputData?.type === 'documentAnalysis') {
        const docData = outputData.content as AnalyzeUploadedDocumentOutput | null;
        const docTable = docData?.extractedTable;
        const hasDocTableData = !!(docTable && docTable.headers && docTable.headers.length > 0 && docTable.rows && docTable.rows.length > 0);
        const hasDocFullText = !!(docData?.fullText && docData.fullText.trim() !== '');

        return (
           <div>
            <h3 className="font-semibold mb-2 text-lg">Extracted Document Table</h3>
            {isLoadingDoc || !docData ? (
               <div className="space-y-2">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-20 w-full" />
              </div>
            ) : hasDocTableData ? (
              <DataTable headers={docTable.headers} rows={docTable.rows} />
            ) : (
               <p className="text-muted-foreground">No table data extracted from the document.</p>
            )}

            {(isLoadingDoc || !docData) ? (
              <div className="mt-6 space-y-2">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : hasDocFullText ? (
              <>
                <h3 className="font-semibold mt-6 mb-2 text-lg">Full Extracted Text from Document</h3>
                <ScrollArea className="h-auto max-h-60">
                  <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">{docData.fullText}</pre>
                </ScrollArea>
              </>
            ) : null}
            
            {!(isLoadingDoc || !docData) && !hasDocTableData && !hasDocFullText && (
               <p className="text-muted-foreground mt-4">No table data or full text extracted from the document.</p>
            )}
           </div>
        );
    }


    if (!outputData) {
        if (isLoading.imageUpload || isLoading.imageCapture || isLoadingDoc || isLoadingAnalysis) {
            return (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-20 w-full" />
                    {(isLoadingDoc || isLoadingAnalysis) && ( 
                      <>
                        <Skeleton className="h-8 w-1/4 mt-4" />
                        <Skeleton className="h-16 w-full" />
                      </>
                    )}
                </div>
            );
        }
        return null;
    }

    const showImageActions = outputData.previewUrl && (outputData.type === 'imagePreview' || (outputData.type === 'error' && outputData.previewUrl));

    return (
      <>
        {outputData.previewUrl && outputData.type !== 'imageAnalysis' && (
          <div className="mb-4 flex flex-col items-center md:items-start">
            <p className="font-semibold mb-2 text-lg text-center md:text-left">
              {outputData.type === 'imagePreview' && !isLoadingAnalysis ? "Preview" :
               (outputData.type === 'imagePreview' && isLoadingAnalysis) ? "Analyzing..." :
               outputData.type === 'error' ? "Image with Error" :
               "Image"
              }
            </p>
            <Image src={outputData.previewUrl} alt="Uploaded/Captured preview" width={150} height={100} className="rounded-md border object-contain" data-ai-hint="document user content" />
          </div>
        )}

        {showImageActions && (
          <div className="flex gap-2 mb-4">
            <Button onClick={handleImageAnalysis} disabled={isLoadingAnalysis}>
              {isLoadingAnalysis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Extract Table Data
            </Button>
          </div>
        )}

        {(() => {
          switch (outputData.type) {
            case 'text':
              return <p className="text-foreground whitespace-pre-wrap">{outputData.content}</p>;
            case 'imageAnalysis': 
              if (isLoadingAnalysis || !outputData.content) {
                 return (
                    <div>
                        <p className="font-semibold mb-2 text-lg">Analyzing for structured data. Analyzing for full data.</p>
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-8 w-1/4 mt-4" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                );
              }
              return <p className="text-muted-foreground">Image analysis results are being processed or displayed above.</p>;
            case 'imagePreview':
              if (isLoading.imageUpload || isLoading.imageCapture) {
                return <p>Processing image...</p>;
              }
              if (isLoadingAnalysis) {
                return (
                    <div>
                        <p className="text-muted-foreground mt-2">Waiting for analysis results...</p>
                    </div>
                );
              }
              return <p className="text-muted-foreground">Image ready. Click "Extract Table Data" above.</p>;
            case 'error':
              return (
                <div className="flex items-center text-destructive">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  <p>{outputData.content}</p>
                </div>
              );
            default:
               if (isLoading.search || Object.values(isLoading).some(val => val === true && !outputData)) {
                 return (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-20 w-full" />
                    </div>
                  );
               }
              return null;
          }
        })()}
      </>
    );
  };


  return (
    <>
      <div className="container mx-auto p-4 flex-grow">
        <div className="w-full flex flex-col lg:flex-row lg:gap-8 items-start">
          {/* Left Pane */}
          <div className="flex flex-col gap-6 w-full lg:w-1/2">
            <Card className="w-full shadow-lg">
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

            <Card className="w-full shadow-lg">
              <CardHeader>
                  <CardTitle className="text-center">Data Capture Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                      <Button onClick={() => imageInputRef.current?.click()} disabled={isLoading.imageUpload || isLoading.imageCapture || isLoading.imageAnalysis} className="flex-grow sm:flex-grow-0">
                      {isLoading.imageUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload Image
                      </Button>
                      <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} accept="image/*" className="hidden" />

                      <Button onClick={() => documentInputRef.current?.click()} disabled={isLoading.documentUpload} className="flex-grow sm:flex-grow-0">
                      {isLoading.documentUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Upload Document
                      </Button>
                      <input type="file" ref={documentInputRef} onChange={(e) => handleFileChange(e, 'document')} accept=".pdf,.csv,.xls,.xlsx,.doc,.docx,.txt" className="hidden" />
                      
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
              <div className="w-full rounded-lg overflow-hidden shadow-lg border border-border">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto aspect-video bg-muted" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>

          {/* Right Pane - Results */}
          <div className="w-full lg:w-1/2">
            {(outputData || isLoading.imageAnalysis || isLoading.documentUpload || isLoading.imageUpload || isLoading.imageCapture || isLoading.search ) && ( 
              <Card className="w-full shadow-lg mt-6 lg:mt-0">
                <CardHeader>
                  <CardTitle>Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[60rem] lg:max-h-[calc(100vh-var(--navbar-height,4rem)-6rem)] p-1">
                   {renderOutput()}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <div className="container mx-auto p-4 flex justify-center">
        <Button onClick={refreshPage} variant="outline" className="mb-4">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Page
        </Button>
      </div>
    </>
  );
}

