
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
  Play,
  Pause,
  StopCircle,
  Camera as CameraIcon,
  Search,
  RefreshCw,
  FileText as FileTextIcon, 
  Loader2,
  AlertTriangle,
  Video,
  VideoOff,
  FileSpreadsheet, 
  Printer, 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { handleTextQuery, handleImageUpload, handleDocumentUpload, ActionResult } from './actions';
import type { ExtractStructuredDataFromImageOutput } from "@/ai/flows/extract-structured-data-from-image";
import type { AnalyzeUploadedDocumentOutput } from "@/ai/flows/analyze-uploaded-document";
import DataTable from '@/components/DataTable';
import { storage } from '@/lib/firebase'; 
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from 'jspdf';


type OutputType = 'text' | 'imageAnalysis' | 'documentAnalysis' | 'imagePreview' | 'error';
interface OutputData {
  type: OutputType;
  content: any;
  previewUrl?: string; 
  isFirebaseUrl?: boolean;
}

type CameraStreamState = 'inactive' | 'active' | 'paused';

export default function DataCapturePage() {
  const { toast } = useToast();

  const [history, setHistory] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  
  const [cameraStreamState, setCameraStreamState] = useState<CameraStreamState>('inactive');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
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
        setOutputData({ type: 'imagePreview', content: null, previewUrl: dataUri, isFirebaseUrl: false });
        setIsLoading(prev => ({ ...prev, [loaderKey]: false }));
        return; 
      } else { 
        addToHistory(`Uploaded document: ${file.name}`);
        setOutputData({ type: 'documentAnalysis', content: { extractedTable: { headers: [], rows: [] }, fullText: "" }, previewUrl: undefined, isFirebaseUrl: false });
        result = await handleDocumentUpload(dataUri);
      }

      if (result.success) {
        setOutputData({ type: result.type as OutputType, content: result.data, isFirebaseUrl: false });
        toast({ title: `${fileType === 'document' ? "Document" : "Item"} Processed`, description: `${fileType === 'document' ? "Document" : "Item"} analysis complete.` });
      } else {
        setOutputData({ type: 'error', content: result.error, isFirebaseUrl: false });
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
    setOutputData(prev => ({ 
        ...prev!, 
        type: 'imageAnalysis', 
        content: { table: { headers: [], rows: [] }, fullText: "" } 
    }));
    
    let dataUriToAnalyze = outputData.previewUrl;
    const result = await handleImageUpload(dataUriToAnalyze);

    if (result.success) {
      setOutputData({ 
        type: 'imageAnalysis', 
        content: result.data as ExtractStructuredDataFromImageOutput, 
        previewUrl: outputData.previewUrl, 
        isFirebaseUrl: outputData.isFirebaseUrl 
      });
      toast({ title: "Image Analyzed", description: "Data extraction complete." });
    } else {
      setOutputData({ 
        type: 'error', 
        content: result.error, 
        previewUrl: outputData.previewUrl,
        isFirebaseUrl: outputData.isFirebaseUrl 
      });
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
      setOutputData({ type: 'text', content: result.data, isFirebaseUrl: false });
    } else {
      setOutputData({ type: 'error', content: result.error, isFirebaseUrl: false });
      toast({ variant: "destructive", title: "Search Error", description: result.error });
    }
    setInputValue("");
    setIsLoading(prev => ({ ...prev, search: false }));
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition API is not supported in this browser.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = false; 
    recognition.interimResults = true; 

    recognition.onstart = () => {
      setIsRecording(true);
      setOutputData({ type: 'text', content: 'Listening...', isFirebaseUrl: false });
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
      setOutputData({ type: 'text', content: interimTranscript || finalTranscript || 'Listening...', isFirebaseUrl: false }); 
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
      setOutputData({ type: 'error', content: `Speech recognition error: ${event.error}`, isFirebaseUrl: false });
      toast({ variant: "destructive", title: "Speech Error", description: `Error: ${event.error}` });
      setIsRecording(false);
    };
     return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort(); 
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [toast, outputData?.content]);


  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        setOutputData(null); 
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting speech recognition:", e);
        toast({ variant: "destructive", title: "Speech Error", description: "Could not start voice recording." });
      }
    }
  };

  const startCamera = async () => {
    if (typeof navigator.mediaDevices?.getUserMedia === 'undefined') {
      toast({ variant: "destructive", title: "Camera Not Supported", description: "Your browser does not support camera access." });
      setHasCameraPermission(false);
      setCameraStreamState('inactive');
      return;
    }
    setIsLoading(prev => ({ ...prev, cameraStart: true }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise; // Wait for play to succeed or fail
          console.log("Camera stream playback started.");
          setHasCameraPermission(true);
          setCameraStreamState('active');
        } else {
          // Fallback for browsers where play() doesn't return a promise (older ones)
          // We assume autoplay attribute might work, or it might not.
          // For robustness, we can check if video is playing after a short delay if needed,
          // but for now, we proceed optimistically.
          setHasCameraPermission(true);
          setCameraStreamState('active');
        }
      } else {
        throw new Error("Video element reference not found. Cannot display camera stream.");
      }
    } catch (err) {
      console.error('Error accessing or playing camera:', err);
      let description = "Could not access or initialize the camera.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          description = "Camera permission was denied. Please enable it in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          description = "No camera was found on your device.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          description = "The camera is already in use or cannot be read (e.g., hardware error).";
        } else if (err.name === "AbortError") {
            description = "Camera access was aborted. This can happen if the page is closed or another process took over the camera.";
        } else if (err.name === "OverconstrainedError") {
            description = "The requested camera settings (e.g., resolution) are not supported by your camera.";
        } else if (err.name === "SecurityError") {
            description = "Camera access is blocked by browser security settings (e.g., page not served over HTTPS).";
        } else {
          description = `An unexpected error occurred: ${err.message}. Please ensure permissions are granted and the camera is available.`;
        }
      }
      toast({ variant: "destructive", title: "Camera Error", description });
      setHasCameraPermission(false);
      setCameraStreamState('inactive');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } finally {
      setIsLoading(prev => ({ ...prev, cameraStart: false }));
    }
  };

  const pauseCamera = () => {
    if (videoRef.current && cameraStreamState === 'active') {
      videoRef.current.pause();
      setCameraStreamState('paused');
    }
  };

  const resumeCamera = () => {
    if (videoRef.current && cameraStreamState === 'paused') {
      videoRef.current.play().catch(e => {
        console.error("Error resuming video:", e);
        toast({variant: "destructive", title: "Camera Error", description: "Could not resume camera."});
        setCameraStreamState('inactive'); // Consider it an error if resume fails
        setHasCameraPermission(false);
      });
      setCameraStreamState('active');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStreamState('inactive');
    setHasCameraPermission(null); 
  };

  const takePhoto = async () => {
    if (cameraStreamState !== 'active' || !videoRef.current || !canvasRef.current || !hasCameraPermission) {
      if (!hasCameraPermission && cameraStreamState !== 'inactive') {
        toast({ variant: "destructive", title: "Camera Permission", description: "Cannot take photo without camera permission."});
      } else if (cameraStreamState === 'paused') {
        toast({ title: "Camera Paused", description: "Please resume camera to take a photo."});
      }
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({ variant: "destructive", title: "Capture Error", description: "Camera feed is not active or has no dimensions. Cannot take photo." });
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');

    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      setIsLoading(prev => ({ ...prev, imageCaptureFirebase: true }));
      const localDataUri = canvas.toDataURL('image/png');
      // Immediately show local preview while uploading
      setOutputData({ type: 'imagePreview', content: null, previewUrl: localDataUri, isFirebaseUrl: false });
      addToHistory('Captured photo. Uploading to cloud...');

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast({ variant: "destructive", title: "Capture Error", description: "Failed to create image blob." });
          setIsLoading(prev => ({ ...prev, imageCaptureFirebase: false }));
          // Keep local preview if blob fails
          return;
        }
        try {
          const fileName = `photo-${Date.now()}.png`;
          const imageStorageRef = storageRef(storage, `captured_images/${fileName}`);
          
          await uploadBytes(imageStorageRef, blob);
          const downloadURL = await getDownloadURL(imageStorageRef);

          // Update preview to Firebase URL
          setOutputData({ type: 'imagePreview', content: null, previewUrl: downloadURL, isFirebaseUrl: true });
          addToHistory('Photo uploaded to cloud.');
          toast({ title: "Photo Uploaded", description: "Image successfully stored in the cloud." });
        } catch (error) {
          console.error("Error uploading to Firebase Storage:", error);
          toast({ variant: "destructive", title: "Upload Failed", description: "Could not store image in the cloud." });
          // Revert to local preview if upload fails but local one was shown
          setOutputData({ type: 'imagePreview', content: null, previewUrl: localDataUri, isFirebaseUrl: false });
        } finally {
          setIsLoading(prev => ({ ...prev, imageCaptureFirebase: false }));
        }
      }, 'image/png');
    }
  };

  const refreshPage = () => window.location.reload();

  const escapeCSVCell = (cellData: any): string => {
    if (cellData == null) return '';
    const str = String(cellData);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleDownloadCSV = (data: ExtractStructuredDataFromImageOutput | AnalyzeUploadedDocumentOutput | null) => {
    if (!data) return;
    const tableSource = (data as ExtractStructuredDataFromImageOutput).table || (data as AnalyzeUploadedDocumentOutput).extractedTable;
    
    if (!tableSource || !tableSource.headers || tableSource.headers.length === 0 || !tableSource.rows || tableSource.rows.length === 0) {
      toast({ variant: "destructive", title: "CSV Export Error", description: "No structured table data available to export." });
      return;
    }

    const { headers, rows } = tableSource;
    let csvContent = headers.map(escapeCSVCell).join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(escapeCSVCell).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "extracted_data.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    toast({ title: "CSV Downloaded", description: "Data exported as CSV." });
  };

  const handleDownloadPDF = (data: ExtractStructuredDataFromImageOutput | AnalyzeUploadedDocumentOutput | null) => {
    if (!data) return;
    const tableSource = (data as ExtractStructuredDataFromImageOutput).table || (data as AnalyzeUploadedDocumentOutput).extractedTable;
    
    if (!tableSource || !tableSource.headers || tableSource.headers.length === 0 || !tableSource.rows || tableSource.rows.length === 0) {
        toast({ variant: "destructive", title: "PDF Export Error", description: "No structured table data available to export." });
        return;
    }
    
    const pdf = new jsPDF();
    let yPos = 15;
    const lineHeight = 7;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 10;
    const usableWidth = pdf.internal.pageSize.width - margin * 2;

    pdf.setFontSize(16);
    pdf.text("Extracted Data Report", margin, yPos);
    yPos += lineHeight * 2;
    
    if (tableSource && tableSource.headers && tableSource.rows && tableSource.rows.length > 0) {
      const { headers, rows } = tableSource;
      pdf.setFontSize(12);
      pdf.text("Structured Table Data:", margin, yPos);
      yPos += lineHeight * 1.5;
      pdf.setFontSize(8);

      const colWidth = usableWidth / Math.max(1, headers.length);
      headers.forEach((header, index) => {
        const headerLines = pdf.splitTextToSize(String(header), colWidth - 2);
        pdf.text(headerLines, margin + index * colWidth, yPos);
      });
      yPos += lineHeight * (pdf.splitTextToSize(headers.join(' '), usableWidth).length || 1); 

      rows.forEach(row => {
        if (yPos > pageHeight - margin - lineHeight * 2) { 
          pdf.addPage();
          yPos = margin;
          pdf.setFontSize(12);
          pdf.text("Structured Table Data (Continued)", margin, yPos);
          yPos += lineHeight * 1.5;
          pdf.setFontSize(8);
          headers.forEach((header, index) => { 
            const headerLines = pdf.splitTextToSize(String(header), colWidth - 2);
            pdf.text(headerLines, margin + index * colWidth, yPos);
          });
          yPos += lineHeight * (pdf.splitTextToSize(headers.join(' '), usableWidth).length || 1);
        }
        let maxRowHeight = lineHeight;
        row.forEach((cell, index) => {
          const cellLines = pdf.splitTextToSize(String(cell), colWidth - 2);
          pdf.text(cellLines, margin + index * colWidth, yPos);
          if (cellLines.length * lineHeight > maxRowHeight) {
            maxRowHeight = cellLines.length * lineHeight;
          }
        });
        yPos += maxRowHeight;
      });
      yPos += lineHeight; 
    } else {
        pdf.setFontSize(10);
        pdf.text("No structured table data was extracted.", margin, yPos);
    }

    pdf.save("extracted_data.pdf");
    toast({ title: "PDF Downloaded", description: "Table data exported as PDF." });
  };


  const renderOutput = () => {
    if (!outputData && !Object.values(isLoading).some(Boolean)) return null;

    const isLoadingAnalysis = isLoading.imageAnalysis;
    const isLoadingDoc = isLoading.documentUpload;
    const isLoadingFirebaseUpload = isLoading.imageCaptureFirebase;
    
    const analysisData = outputData?.content as ExtractStructuredDataFromImageOutput | null;
    const docData = outputData?.content as AnalyzeUploadedDocumentOutput | null;

    const showDownloadButtons = 
      outputData && !isLoadingAnalysis && !isLoadingDoc && !isLoadingFirebaseUpload &&
      (
        (outputData.type === 'imageAnalysis' && analysisData && analysisData.table?.rows?.length > 0) ||
        (outputData.type === 'documentAnalysis' && docData && docData.extractedTable?.rows?.length > 0)
      );

    const currentDataForDownload = outputData?.content;


    if (outputData?.type === 'imageAnalysis' && outputData.previewUrl) {
      const tableData = analysisData?.table;
      const hasTableData = !!(tableData && tableData.headers && tableData.headers.length > 0 && tableData.rows && tableData.rows.length > 0);
      const fullTextData = analysisData?.fullText;
      
      return (
        <>
          <div className="flex flex-col md:flex-row md:gap-6 mb-4">
            <div className="md:w-1/3 mb-4 md:mb-0 flex flex-col items-center md:items-start">
              <p className="font-semibold mb-2 text-lg text-center md:text-left">
                {isLoadingAnalysis || !analysisData ? "Analyzing data..." : "Analyzed Image"}
              </p>
              <Image src={outputData.previewUrl} alt="Analyzed preview" width={150} height={100} className="rounded-md border object-contain" data-ai-hint="document user content"/>
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
          
          {!(isLoadingAnalysis || !analysisData) && !hasTableData && (
             <p className="text-muted-foreground mt-4">No structured table data extracted from the image.</p>
          )}

          {showDownloadButtons && (
            <div className="mt-6 flex gap-2">
              <Button onClick={() => handleDownloadCSV(currentDataForDownload)} variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download CSV
              </Button>
              <Button onClick={() => handleDownloadPDF(currentDataForDownload)} variant="outline">
                <Printer className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </div>
          )}
        </>
      );
    }

    if (outputData?.type === 'documentAnalysis') {
        const docTable = docData?.extractedTable;
        const hasDocTableData = !!(docTable && docTable.headers && docTable.headers.length > 0 && docTable.rows && docTable.rows.length > 0);
        const fullDocText = docData?.fullText;

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
               <p className="text-muted-foreground">No structured table data extracted from the document.</p>
            )}
            
            {!(isLoadingDoc || !docData) && !hasDocTableData && (
               <p className="text-muted-foreground mt-4">No structured table data extracted from the document.</p>
            )}

            {showDownloadButtons && (
                <div className="mt-6 flex gap-2">
                <Button onClick={() => handleDownloadCSV(currentDataForDownload)} variant="outline">
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Download CSV
                </Button>
                <Button onClick={() => handleDownloadPDF(currentDataForDownload)} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                </div>
            )}
           </div>
        );
    }

    if (!outputData) { 
        if (isLoading.imageUpload || isLoading.imageCaptureFirebase || isLoadingDoc || isLoadingAnalysis || isLoading.search || isLoading.cameraStart) {
            const message = isLoading.imageCaptureFirebase ? "Uploading image to cloud..." : 
                            isLoading.cameraStart ? "Starting camera..." : 
                            isLoadingAnalysis ? "Extracting structured data..." :
                            isLoadingDoc ? "Analyzing document for table..." :
                            isLoading.search ? "Searching..." :
                            "Processing...";
            return (
                <div className="space-y-2">
                    <div className="flex items-center justify-center text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 
                      {message}
                    </div>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-20 w-full" />
                </div>
            );
        }
        return null; 
    }

    const showImageActions = outputData.previewUrl && (outputData.type === 'imagePreview' || (outputData.type === 'error' && outputData.previewUrl));

    return (
      <>
        {outputData.previewUrl && outputData.type !== 'imageAnalysis' && outputData.type !== 'documentAnalysis' && ( 
          <div className="mb-4 flex flex-col items-center md:items-start">
            <p className="font-semibold mb-2 text-lg text-center md:text-left">
              {outputData.type === 'imagePreview' && !isLoadingAnalysis && !isLoadingFirebaseUpload ? "Preview" :
               (outputData.type === 'imagePreview' && isLoadingAnalysis) ? "Extracting structured data..." : 
               (outputData.type === 'imagePreview' && isLoadingFirebaseUpload) ? "Uploading to Cloud..." :
               outputData.type === 'error' ? "Image with Error" :
               "Image"
              }
            </p>
             {isLoadingFirebaseUpload && outputData.type === 'imagePreview' && !outputData.isFirebaseUrl && (
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            )}
            <Image src={outputData.previewUrl} alt="Uploaded/Captured preview" width={150} height={100} className="rounded-md border object-contain" data-ai-hint="document user content"/>
             {outputData.isFirebaseUrl && <span className="text-xs text-muted-foreground mt-1">Stored in cloud</span>}
          </div>
        )}

        {showImageActions && (
          <div className="flex gap-2 mb-4">
            <Button onClick={handleImageAnalysis} disabled={isLoadingAnalysis || isLoadingFirebaseUpload}>
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
                        <p className="font-semibold mb-2 text-lg">Extracting structured data...</p>
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </div>
                );
              }
              return <p className="text-muted-foreground">Image analysis results are displayed above.</p>;
            case 'documentAnalysis':
                 if (isLoadingDoc || !outputData.content) {
                     return ( 
                        <div>
                            <p className="font-semibold mb-2 text-lg">Analyzing document for table...</p>
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-1/3" />
                                <Skeleton className="h-20 w-full" />
                            </div>
                        </div>
                    );
                }
                return <p className="text-muted-foreground">Document analysis results are displayed above.</p>;
            case 'imagePreview':
              if (isLoading.imageUpload || isLoadingFirebaseUpload) {
                return <p>{isLoadingFirebaseUpload ? "Uploading to cloud..." : "Processing image..."}</p>;
              }
              if (isLoadingAnalysis) { 
                return ( 
                    <div>
                        <p className="font-semibold mb-2 text-lg">Extracting structured data...</p>
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    </div>
                );
              }
              return <p className="text-muted-foreground">Image ready. Click "Extract Table Data" above if needed.</p>;
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
                      <Button onClick={() => imageInputRef.current?.click()} disabled={isLoading.imageUpload || isLoading.imageCaptureFirebase || isLoading.imageAnalysis} className="flex-grow sm:flex-grow-0">
                      {isLoading.imageUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Upload Image
                      </Button>
                      <input type="file" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} accept="image/*" className="hidden" />

                      <Button onClick={() => documentInputRef.current?.click()} disabled={isLoading.documentUpload} className="flex-grow sm:flex-grow-0">
                      {isLoading.documentUpload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileTextIcon className="mr-2 h-4 w-4" />}
                      Upload Document
                      </Button>
                      <input type="file" ref={documentInputRef} onChange={(e) => handleFileChange(e, 'document')} accept=".pdf,.csv,.xls,.xlsx,.doc,.docx,.txt" className="hidden" />

                      <Button onClick={toggleVoiceRecording} variant={isRecording ? "destructive" : "default"} disabled={!recognitionRef.current} className="flex-grow sm:flex-grow-0">
                      {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                      {isRecording ? 'Stop Voice' : 'Start Voice'}
                      </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    {cameraStreamState === 'inactive' && (
                        <Button onClick={startCamera} disabled={isLoading.cameraStart} className="flex-grow sm:flex-grow-0">
                            {isLoading.cameraStart ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />} Start Camera
                        </Button>
                    )}
                    {cameraStreamState === 'active' && (
                        <>
                            <Button onClick={pauseCamera} variant="outline" className="flex-grow sm:flex-grow-0">
                                <Pause className="mr-2 h-4 w-4" /> Pause Camera
                            </Button>
                            <Button onClick={takePhoto} disabled={isLoading.imageCaptureFirebase || isLoading.imageAnalysis || !hasCameraPermission} className="flex-grow sm:flex-grow-0 bg-green-600 hover:bg-green-700 text-white">
                                {isLoading.imageCaptureFirebase ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CameraIcon className="mr-2 h-4 w-4" />}
                                Take Photo
                            </Button>
                        </>
                    )}
                    {cameraStreamState === 'paused' && (
                        <Button onClick={resumeCamera} variant="outline" className="flex-grow sm:flex-grow-0">
                            <Play className="mr-2 h-4 w-4" /> Resume Camera
                        </Button>
                    )}
                    {cameraStreamState !== 'inactive' && (
                        <Button onClick={stopCamera} variant="destructive" className="flex-grow sm:flex-grow-0">
                            <VideoOff className="mr-2 h-4 w-4" /> Stop Camera
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

            {cameraStreamState !== 'inactive' && (
              <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle>Live Camera Feed {cameraStreamState === 'paused' && '(Paused)'}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <video ref={videoRef} playsInline autoPlay muted className="w-full h-auto aspect-video bg-muted rounded-md border" />
                  <canvas ref={canvasRef} className="hidden" />
                  {cameraStreamState !== 'inactive' && hasCameraPermission === false && (
                    <Alert variant="destructive" className="rounded-md">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Camera Access Required</AlertTitle>
                      <AlertDescription>
                        Camera permission was denied or an error occurred. Please check your browser settings to allow camera access for this site.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="w-full lg:w-1/2">
            {(outputData || isLoading.imageAnalysis || isLoading.documentUpload || isLoading.imageUpload || isLoading.imageCaptureFirebase || isLoading.search || isLoading.cameraStart) && (
              <Card className="w-full shadow-lg mt-6 lg:mt-0">
                <CardHeader>
                  <CardTitle>Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[90rem] lg:max-h-[calc(100vh-var(--navbar-height,4rem)-6rem)] p-1">
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
