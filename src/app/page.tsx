
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
import DataTable from '@/components/DataTable';

type OutputType = 'text' | 'imageAnalysis' | 'documentAnalysis' | 'imagePreview' | 'error';
interface OutputData {
  type: OutputType;
  content: any;
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
    setOutputData(null); // Clear previous output

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      let result: ActionResult;

      if (fileType === 'image') {
        addToHistory(`Uploaded image: ${file.name}`);
        setOutputData({ type: 'imagePreview', content: null, previewUrl: dataUri });
        result = await handleImageUpload(dataUri);
      } else {
        addToHistory(`Uploaded document: ${file.name}`);
        result = await handleDocumentUpload(dataUri);
      }

      if (result.success) {
        setOutputData({ type: result.type as OutputType, content: result.data, previewUrl: fileType === 'image' ? dataUri : undefined });
        toast({ title: `${fileType === 'image' ? "Image" : "Document"} Processed`, description: `${fileType === 'image' ? "Image" : "Document"} analysis complete.` });
      } else {
        setOutputData({ type: 'error', content: result.error });
        toast({ variant: "destructive", title: "Processing Error", description: result.error });
      }
      setIsLoading(prev => ({ ...prev, [loaderKey]: false }));
    };
    reader.readAsDataURL(file);
    event.target.value = ""; // Reset file input
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
    recognition.continuous = false; // Set to false to stop after first result for simplicity
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
        setInputValue(finalTranscript); // Populate input field
        recognition.stop(); // Stop recognition after final result
        // Optionally, trigger search automatically:
        // setInputValue(finalTranscript); // Keep this line
        // handleTextQuery(finalTranscript).then(result => { ... }); // Call search directly
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
      addToHistory('Captured photo for analysis.');
      
      const result = await handleImageUpload(dataUri);
      if (result.success) {
        setOutputData({ type: 'imageAnalysis', content: result.data, previewUrl: dataUri });
        toast({ title: "Photo Processed", description: "Photo analysis complete." });
      } else {
        setOutputData({ type: 'error', content: result.error });
        toast({ variant: "destructive", title: "Processing Error", description: result.error });
      }
      setIsLoading(prev => ({ ...prev, imageCapture: false }));

      // Optionally stop camera after taking photo
      // toggleCamera(); 
    }
  };
  
  const refreshPage = () => window.location.reload();

  const renderOutput = () => {
    if (!outputData) return null;

    switch (outputData.type) {
      case 'text':
        return <p className="text-foreground whitespace-pre-wrap">{outputData.content}</p>;
      case 'imageAnalysis':
        return (
          <div>
            {outputData.previewUrl && (
              <div className="mb-4">
                <p className="font-semibold mb-2">Preview:</p>
                <Image src={outputData.previewUrl} alt="Uploaded preview" width={300} height={200} className="rounded-md border" data-ai-hint="abstract data" />
              </div>
            )}
            <DataTable data={outputData.content} caption="Extracted Image Data" />
          </div>
        );
      case 'documentAnalysis':
        return (
           <div>
            <p className="font-semibold mb-2">Document Analysis Result:</p>
            <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">{outputData.content}</pre>
           </div>
        );
      case 'imagePreview':
         return (
            <div>
              <p className="font-semibold mb-2">Image Preview (processing...):</p>
              <Image src={outputData.previewUrl!} alt="Processing preview" width={300} height={200} className="rounded-md border" data-ai-hint="document scan"/>
            </div>
          );
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
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center min-h-[calc(100vh-var(--navbar-height,4rem))]">
      {/* History Section */}
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

      {/* Controls Container */}
      <Card className="w-full max-w-3xl mb-6 shadow-lg">
        <CardHeader>
            <CardTitle className="text-center">Data Capture Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => imageInputRef.current?.click()} disabled={isLoading.imageUpload} className="flex-grow sm:flex-grow-0">
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
                <Button onClick={takePhoto} disabled={isLoading.imageCapture} className="flex-grow sm:flex-grow-0">
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

      {/* Camera View */}
      {isCameraActive && (
        <div className="w-full max-w-md mb-6 rounded-lg overflow-hidden shadow-lg border border-border">
          <video ref={videoRef} autoPlay playsInline className="w-full h-auto aspect-video bg-muted" />
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
      
      {/* Output Area */}
      {outputData && (
        <Card className="w-full max-w-3xl mb-6 shadow-lg">
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
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
